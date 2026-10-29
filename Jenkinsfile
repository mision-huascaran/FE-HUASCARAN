// Pipeline de FE-HUASCARAN (Jenkins multibranch del curso).
//
//   development → despliegue
//   qa, uat     → pruebas (lint + Vitest con cobertura), SonarQube, Quality Gate y despliegue
//   qa          → además, Build imagen y Trivy antes del despliegue, y E2E Tests, OWASP ZAP
//                 y Security Headers - CSP contra el despliegue
//   main        → todavía no despliega
//
// En qa, Trivy escanea la imagen candidata antes del despliegue: solo se permiten hallazgos
// LOW. Uno MEDIUM, HIGH, CRITICAL o UNKNOWN, o un escaneo que no termina, detiene el pipeline.
//
// El .env de cada entorno está en Jenkins como credencial "Secret file":
// HUASCARAN_FRONTEND_DEV, _QA y _UAT. Nunca se imprime en el log.
// El contenedor no publica puertos: el proxy del servidor lo alcanza por la red
// externa proxy_net con el nombre <entorno>-huascaran (ver docker-compose.yml).

pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '1', artifactNumToKeepStr: '1'))
        disableConcurrentBuilds()
    }

    environment {
        ENTORNO  = "${env.BRANCH_NAME == 'development' ? 'dev' : env.BRANCH_NAME}"
        PROYECTO = "huascaran_fe_${env.BRANCH_NAME == 'development' ? 'dev' : env.BRANCH_NAME}"
        // Una imagen por entorno para que dev, qa y uat no se pisen. docker-compose.yml la
        // usa como ${IMAGEN}:actual; en qa el build la deja como :candidata hasta pasar Trivy.
        IMAGEN   = "huascaran-fe-${ENTORNO}"
        // Trivy 0.76.1 fijado por digest, el mismo del backend. Nunca usar `latest` ni
        // 0.69.4, 0.69.5 o 0.69.6: fueron versiones comprometidas (GHSA-69fq-xp46-6x23).
        TRIVY_IMAGEN = 'aquasec/trivy@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Pruebas') {
            when {
                // Sin esto, Jenkins levanta el contenedor del agente antes de
                // evaluar la condición y lo descarta enseguida en development.
                beforeAgent true
                anyOf {
                    branch 'qa'
                    branch 'uat'
                }
            }
            agent {
                docker {
                    image 'node:20-alpine'
                    reuseNode true
                }
            }
            steps {
                // El contenedor corre sin HOME escribible: la caché de npm va al workspace.
                sh '''
                    export npm_config_cache="${WORKSPACE}/.npm"
                    npm ci --no-audit --no-fund
                    npm run lint
                    npm run test:coverage -- --testTimeout=30000
                '''
            }
        }

        stage('SonarQube') {
            when {
                beforeAgent true
                anyOf {
                    branch 'qa'
                    branch 'uat'
                }
            }
            agent {
                // El análisis de JavaScript necesita Node.js y el servidor de Jenkins
                // no lo tiene; la imagen oficial del scanner lo trae.
                docker {
                    image 'sonarsource/sonar-scanner-cli'
                    args '--entrypoint='
                    reuseNode true
                }
            }
            steps {
                withSonarQubeEnv('SonarQube-Server') {
                    // El contenedor corre con el usuario de Jenkins: la caché del scanner va al workspace.
                    sh '''
                        export SONAR_USER_HOME="${WORKSPACE}/.sonar"
                        SONAR_TOKEN="${SONAR_AUTH_TOKEN}" sonar-scanner
                    '''
                }
            }
        }

        stage('Quality Gate') {
            when {
                anyOf {
                    branch 'qa'
                    branch 'uat'
                }
            }
            steps {
                timeout(time: 15, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build imagen') {
            when {
                branch 'qa'
            }
            steps {
                // Las VITE_* del .env se fijan al construir (Dockerfile): el build lo necesita.
                // --pull: cada build trae los últimos parches de las imágenes base.
                withCredentials([
                    file(credentialsId: "HUASCARAN_FRONTEND_${env.ENTORNO.toUpperCase()}", variable: 'ENV_FILE')
                ]) {
                    sh '''
                        rm -f .env
                        cp "$ENV_FILE" .env
                        IMAGEN_ETIQUETA=candidata docker compose -p "$PROYECTO" build --pull frontend
                        rm -f .env
                    '''
                }
            }
        }

        // Trivy sobre la imagen candidata, antes del despliegue. Solo se permiten hallazgos
        // LOW: MEDIUM, HIGH, CRITICAL o UNKNOWN detienen el pipeline, sin excepciones (ni
        // .trivyignore ni filtros). Un escaneo que no termina también lo detiene.
        //
        // Como en ZAP, nada se monta desde el workspace: la imagen entra a un volumen con
        // nombre como tarball (Trivy no necesita el socket de Docker) y los reportes vuelven
        // con `docker cp`. Un solo escaneo deja el JSON completo; de ese mismo JSON salen el
        // HTML (con los LOW), la tabla del log y la regla.
        stage('Trivy - Imagen') {
            when {
                branch 'qa'
            }
            options {
                timeout(time: 20, unit: 'MINUTES')
            }
            environment {
                TRIVY_CONTENEDOR = "${PROYECTO}-trivy-${BUILD_NUMBER}"
                TRIVY_VOLUMEN    = "${PROYECTO}-trivy-${BUILD_NUMBER}-wrk"
                // Caché de la base de vulnerabilidades, una por entorno: unos cientos de MB que
                // no crecen con cada build (se actualizan en el lugar). Es una caché, no un
                // artefacto: no se borra en el post. Si queda inconsistente, Trivy falla y el
                // pipeline se detiene; nunca se salta el escaneo.
                TRIVY_CACHE      = "${PROYECTO}-trivy-cache"
            }
            steps {
                script {
                    def status = sh(
                        returnStatus: true,
                        script: '''
                            rm -rf trivy-reports
                            mkdir -p trivy-reports
                            docker volume create "$TRIVY_VOLUMEN" >/dev/null
                            docker volume create "$TRIVY_CACHE" >/dev/null

                            # Imagen candidata al volumen. Un fallo sale con 3 (error de ejecución),
                            # nunca con el 5 que se leería como "tiene vulnerabilidades". Si
                            # `docker save` fallara a mitad, el tarball queda incompleto y Trivy
                            # termina con error: el pipeline se detiene igual.
                            if ! docker image inspect "$IMAGEN:candidata" >/dev/null; then
                                echo "ERROR: no existe la imagen $IMAGEN:candidata"
                                exit 3
                            fi
                            if ! docker save "$IMAGEN:candidata" | docker run -i --rm -v "$TRIVY_VOLUMEN:/w" \
                                    --entrypoint sh "$TRIVY_IMAGEN" -c 'cat > /w/imagen.tar'; then
                                echo "ERROR: no se pudo pasar la imagen al volumen de Trivy"
                                exit 3
                            fi

                            # Jenkins corre `sh -xe`: sin el `||`, un fallo cortaría el script antes
                            # de copiar los reportes. Cada paso corre solo si el anterior salió con 0.
                            ESTADO=0
                            docker run --name "$TRIVY_CONTENEDOR" -v "$TRIVY_VOLUMEN:/w" -v "$TRIVY_CACHE:/root/.cache" \
                                "$TRIVY_IMAGEN" image --input /w/imagen.tar --scanners vuln,secret \
                                --format json --output /w/frontend-trivy.json --no-progress || ESTADO=$?
                            if [ "$ESTADO" -eq 0 ]; then
                                docker run --rm -v "$TRIVY_VOLUMEN:/w" "$TRIVY_IMAGEN" convert --format template \
                                    --template "@contrib/html.tpl" --output /w/frontend-trivy.html /w/frontend-trivy.json || ESTADO=$?
                            fi
                            # Tabla completa en el log. --scanners solo agrega el resumen por target:
                            # sin él, una imagen sin hallazgos no deja nada en el log.
                            if [ "$ESTADO" -eq 0 ]; then
                                docker run --rm -v "$TRIVY_VOLUMEN:/w" "$TRIVY_IMAGEN" convert --format table \
                                    --scanners vuln,secret /w/frontend-trivy.json || ESTADO=$?
                            fi
                            # La regla: 5 si hay algún hallazgo que no sea LOW (1 queda para errores de Trivy).
                            if [ "$ESTADO" -eq 0 ]; then
                                docker run --rm -v "$TRIVY_VOLUMEN:/w" "$TRIVY_IMAGEN" convert \
                                    --severity UNKNOWN,MEDIUM,HIGH,CRITICAL --exit-code 5 --format table \
                                    /w/frontend-trivy.json || ESTADO=$?
                            fi

                            docker cp "$TRIVY_CONTENEDOR:/w/frontend-trivy.html" trivy-reports/ || echo "AVISO: no se pudo copiar frontend-trivy.html"
                            docker cp "$TRIVY_CONTENEDOR:/w/frontend-trivy.json" trivy-reports/ || echo "AVISO: no se pudo copiar frontend-trivy.json"
                            exit $ESTADO
                        '''
                    )

                    // 0 = solo hallazgos LOW (o ninguno) · 5 = algún hallazgo MEDIUM, HIGH,
                    // CRITICAL o UNKNOWN · cualquier otro = el escaneo no terminó.
                    if (status == 5) {
                        error('Trivy: la imagen tiene vulnerabilidades MEDIUM, HIGH, CRITICAL o UNKNOWN. No se despliega.')
                    } else if (status != 0) {
                        error("Trivy: el escaneo no terminó (${status}). No se despliega.")
                    }
                }
            }
            post {
                always {
                    // También si el timeout cortó el escaneo: no quedan contenedores ni volumen
                    // de trabajo. La caché (TRIVY_CACHE) se conserva.
                    sh '''
                        docker rm -f "$TRIVY_CONTENEDOR" >/dev/null 2>&1 || true
                        docker volume rm -f "$TRIVY_VOLUMEN" >/dev/null 2>&1 || true
                    '''
                    // Se archiva también cuando falla: ese HTML es el que hay que revisar.
                    archiveArtifacts(
                        artifacts: 'trivy-reports/**',
                        allowEmptyArchive: true
                    )
                }
            }
        }

        stage('Deploy') {
            when {
                anyOf {
                    branch 'development'
                    branch 'qa'
                    branch 'uat'
                }
            }
            steps {
                withCredentials([
                    file(credentialsId: "HUASCARAN_FRONTEND_${env.ENTORNO.toUpperCase()}", variable: 'ENV_FILE')
                ]) {
                    // En qa solo se marca como "actual" y se despliega la imagen que pasó Trivy,
                    // sin volver a construir. development y uat construyen al desplegar.
                    sh '''
                        rm -f .env
                        cp "$ENV_FILE" .env
                        if [ "$BRANCH_NAME" = "qa" ]; then
                            docker tag "$IMAGEN:candidata" "$IMAGEN:actual"
                            docker compose -p "$PROYECTO" up -d --no-build --remove-orphans
                        else
                            docker compose -p "$PROYECTO" up -d --build --remove-orphans
                        fi
                    '''
                }
            }
        }

        stage('Verificar despliegue') {
            when {
                anyOf {
                    branch 'development'
                    branch 'qa'
                    branch 'uat'
                }
            }
            steps {
                sh '''
                    set +e
                    CONTENEDOR=$(docker compose -p "$PROYECTO" ps -aq frontend)

                    # El Dockerfile trae HEALTHCHECK contra /salud: se espera a "healthy".
                    echo "Esperando hasta 120 s a que el frontend esté healthy..."
                    for i in $(seq 1 24); do
                        SALUD=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}' "$CONTENEDOR" 2>/dev/null)
                        CORRIENDO=$(docker inspect -f '{{.State.Running}}' "$CONTENEDOR" 2>/dev/null)
                        echo "  intento $i/24 -> Running=$CORRIENDO Health=$SALUD"
                        if [ "$CORRIENDO" != "true" ] || [ "$SALUD" = "healthy" ]; then break; fi
                        sleep 5
                    done

                    docker compose -p "$PROYECTO" ps -a
                    docker compose -p "$PROYECTO" logs --tail=50 --no-color

                    if [ "$CORRIENDO" != "true" ] || [ "$SALUD" != "healthy" ]; then
                        echo "ERROR: el frontend no está corriendo o no llegó a healthy (Health=$SALUD)."
                        exit 1
                    fi
                    echo "OK: el frontend responde."

                    # El backend se despliega en su propio pipeline: si aún no responde,
                    # se avisa pero no se marca el despliegue del frontend como fallido.
                    if docker compose -p "$PROYECTO" exec -T frontend wget -qO- -T 5 http://127.0.0.1/api/; then
                        echo ""
                        echo "OK: el proxy /api llega al backend."
                    else
                        echo "AVISO: /api no responde. Revisar API_UPSTREAM en el .env o el despliegue del backend."
                    fi
                '''
            }
        }

        stage('E2E Tests') {
            when {
                beforeAgent true
                branch 'qa'
            }
            agent {
                docker {
                    image 'mcr.microsoft.com/playwright:v1.63.0-noble'
                    args '--ipc=host'
                    reuseNode true
                }
            }
            environment {
                CI       = 'true'
                BASE_URL = 'https://qa-huascaran.ingsoftware.lat'
                // Cuentas que crea el seed del backend. Las contraseñas NO van aquí:
                // salen de la credencial del .env de qa (ver steps).
                E2E_DOCENTE_USER    = 'soloparaunuso123+e2e.docente@gmail.com'
                E2E_SUPERVISOR_USER = 'soloparaunuso123+e2e.supervisor@gmail.com'
                E2E_DIRECTIVO_USER  = 'soloparaunuso123+e2e.directivo@gmail.com'
                E2E_INACTIVO_USER   = 'soloparaunuso123+e2e.inactivo@gmail.com'
            }
            steps {
                // Las contraseñas E2E viven en el mismo "Secret file" del .env de qa
                // que usa el stage Deploy. Del archivo se toman SOLO las líneas
                // E2E_*_PASS, una por una: nada de `source` del .env entero y ningún
                // valor en el log (`set +x` antes de leerlo).
                withCredentials([file(credentialsId: 'HUASCARAN_FRONTEND_QA', variable: 'ENV_FILE')]) {
                    sh '''
                        set +x
                        while IFS='=' read -r clave valor || [ -n "$clave" ]; do
                            case "$clave" in
                                *[!A-Z0-9_]*|'') continue ;;
                                E2E_*_PASS) ;;
                                *) continue ;;
                            esac
                            # Fin de línea de Windows y comillas alrededor, como las acepta docker compose.
                            case "$valor" in *[[:cntrl:]]) valor=${valor%?} ;; esac
                            case "$valor" in
                                "'"*"'") valor=${valor#"'"}; valor=${valor%"'"} ;;
                                '"'*'"') valor=${valor#'"'}; valor=${valor%'"'} ;;
                            esac
                            export "$clave=$valor"
                        done < "$ENV_FILE"

                        faltan=''
                        for variable in E2E_DOCENTE_PASS E2E_SUPERVISOR_PASS E2E_DIRECTIVO_PASS E2E_INACTIVO_PASS; do
                            [ -n "$(printenv "$variable")" ] || faltan="$faltan $variable"
                        done
                        if [ -n "$faltan" ]; then
                            echo "ERROR: faltan en la credencial HUASCARAN_FRONTEND_QA:$faltan"
                            exit 1
                        fi

                        # Como en 'Pruebas': sin HOME escribible, la caché va al workspace.
                        # npm ci de nuevo: node_modules de 'Pruebas' se instaló en Alpine (musl).
                        export HOME="${WORKSPACE}/.e2e-home"
                        export npm_config_cache="${WORKSPACE}/.npm"
                        npm ci --no-audit --no-fund
                        npx playwright test
                    '''
                }
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'test-results/junit.xml'
                    archiveArtifacts artifacts: 'playwright-report/**, test-results/**', allowEmptyArchive: true
                }
            }
        }

        // OWASP ZAP Full Scan del frontend desplegado en qa, sin autenticación.
        //
        // Los reportes NO se montan desde el workspace: zap-full-scan.py exige
        // /zap/wrk y, si Jenkins corre en un contenedor, "$WORKSPACE" no existe en
        // el host y el montaje dejaría zap-reports/ vacío. Se usa un volumen de
        // Docker con nombre y, al terminar, `docker cp` copia los reportes al
        // workspace: funciona igual con Jenkins en el host o en un contenedor.
        stage('OWASP ZAP - Frontend') {
            when {
                branch 'qa'
            }
            options {
                timeout(time: 60, unit: 'MINUTES')
            }
            environment {
                ZAP_TARGET     = 'https://qa-huascaran.ingsoftware.lat'
                // Versión fija para que el resultado sea reproducible (era la "stable").
                ZAP_IMAGEN     = 'ghcr.io/zaproxy/zaproxy:2.17.0'
                ZAP_CONTENEDOR = "${PROYECTO}-zap-${BUILD_NUMBER}"
                ZAP_VOLUMEN    = "${PROYECTO}-zap-${BUILD_NUMBER}-wrk"
            }
            steps {
                script {
                    def status = sh(
                        returnStatus: true,
                        script: '''
                            rm -rf zap-reports
                            mkdir -p zap-reports
                            docker volume create "$ZAP_VOLUMEN" >/dev/null
                            # El volumen nace de root: el usuario zap (uid 1000) tiene que poder escribir.
                            docker run --rm -u root -v "$ZAP_VOLUMEN:/zap/wrk" --entrypoint chmod "$ZAP_IMAGEN" 0777 /zap/wrk

                            # Reglas del escaneo (zap/reglas-frontend.conf) al volumen. docker cp no
                            # escribe en un volumen, sino en un contenedor que lo monta: uno creado y
                            # sin arrancar basta. Si falla, sale con 3 (error de ejecución), no con
                            # el 1 de `sh -e`, que se leería como "reglas incumplidas".
                            if ! { docker create --name "$ZAP_CONTENEDOR-reglas" -v "$ZAP_VOLUMEN:/zap/wrk" "$ZAP_IMAGEN" >/dev/null &&
                                   docker cp zap/reglas-frontend.conf "$ZAP_CONTENEDOR-reglas:/zap/wrk/reglas-frontend.conf"; }; then
                                echo "ERROR: no se pudo copiar zap/reglas-frontend.conf al volumen de ZAP"
                                exit 3
                            fi
                            docker rm "$ZAP_CONTENEDOR-reglas" >/dev/null

                            set -- zap-full-scan.py -t "$ZAP_TARGET" -j --client-spider -m 5
                            set -- "$@" -z "-config scanner.maxScanDurationInMins=30"
                            set -- "$@" -c reglas-frontend.conf
                            set -- "$@" -r frontend-zap.html -J frontend-zap.json
                            # Jenkins corre `sh -xe`: sin el `||`, un 1 o un 2 de ZAP cortaría
                            # el script antes de copiar los reportes.
                            ESTADO=0
                            docker run --name "$ZAP_CONTENEDOR" -v "$ZAP_VOLUMEN:/zap/wrk" "$ZAP_IMAGEN" "$@" || ESTADO=$?

                            docker cp "$ZAP_CONTENEDOR:/zap/wrk/." zap-reports/ || echo "AVISO: no se pudieron copiar los reportes de ZAP"
                            exit $ESTADO
                        '''
                    )

                    // Código de salida de zap-full-scan.py:
                    //   0 = sin alertas · 1 = al menos una regla en FAIL ·
                    //   2 = solo advertencias (WARN) · 3 u otro = el escaneo no terminó.
                    if (status == 1) {
                        error('ZAP Frontend: reglas de seguridad incumplidas')
                    } else if (status == 2) {
                        unstable('ZAP Frontend: advertencias detectadas')
                    } else if (status != 0) {
                        error("ZAP Frontend: error de ejecución (${status})")
                    }
                }
            }
            post {
                always {
                    // También si el timeout cortó el escaneo: no quedan contenedor ni volumen.
                    sh '''
                        docker rm -f "$ZAP_CONTENEDOR" "$ZAP_CONTENEDOR-reglas" >/dev/null 2>&1 || true
                        docker volume rm -f "$ZAP_VOLUMEN" >/dev/null 2>&1 || true
                    '''
                    archiveArtifacts(
                        artifacts: 'zap-reports/**',
                        allowEmptyArchive: true
                    )
                }
            }
        }

        // Verificación independiente de la CSP del frontend desplegado, última
        // etapa de qa. ZAP también mira la CSP; aquí se exige la política del
        // proyecto (deploy/cabeceras-seguridad.conf) en "/" y en "/login":
        // directivas mínimas, nada inseguro y una sola cabecera. La lógica y sus
        // pruebas están en scripts/verificar-csp.mjs; la prueba en el navegador,
        // en e2e/f10-csp-navegador.spec.js.
        stage('Security Headers - CSP') {
            when {
                beforeAgent true
                branch 'qa'
            }
            agent {
                // Como 'Pruebas' y 'E2E Tests': con reuseNode el contenedor monta el
                // workspace de este mismo nodo, así que el JSON queda en zap-reports/
                // sin docker cp.
                docker {
                    image 'node:24-alpine'
                    reuseNode true
                }
            }
            environment {
                CSP_TARGET_URL = 'https://qa-huascaran.ingsoftware.lat'
            }
            steps {
                // Sin dependencias, así que sin npm ci. No borra zap-reports/: ahí
                // quedan los reportes del stage de ZAP. Sale con 1 (stage en rojo) si
                // la política no cumple o hay un error de red.
                sh 'node scripts/verificar-csp.mjs "$CSP_TARGET_URL" zap-reports/csp-validation.json'
            }
            post {
                always {
                    archiveArtifacts(
                        artifacts: 'zap-reports/csp-validation.json',
                        allowEmptyArchive: true
                    )
                }
            }
        }
    }

    post {
        always {
            // El .env solo hace falta para levantar el contenedor.
            sh 'rm -f .env'
            // Limpia el workspace; los artefactos archivados no se borran.
            deleteDir()
        }
    }
}
