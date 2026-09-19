// Pipeline de FE-HUASCARAN (Jenkins multibranch del curso).
//
//   development → despliegue
//   qa, uat     → pruebas (lint + Vitest con cobertura), SonarQube, Quality Gate y despliegue
//   main        → todavía no despliega
//
// El .env de cada entorno está en Jenkins como credencial "Secret file":
// HUASCARAN_SECRETS_FRONTEND_DEV, _QA y _UAT. Nunca se imprime en el log.
// El contenedor no publica puertos: el proxy del servidor lo alcanza por la red
// proxy_net con el nombre <entorno>-huascaran (ver docker-compose.yml).

pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '5'))
        disableConcurrentBuilds()
    }

    environment {
        ENTORNO  = "${env.BRANCH_NAME == 'development' ? 'dev' : env.BRANCH_NAME}"
        PROYECTO = "huascaran_fe_${env.BRANCH_NAME == 'development' ? 'dev' : env.BRANCH_NAME}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Pruebas') {
            when {
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
                    npm run test:coverage
                '''
            }
        }

        stage('SonarQube') {
            when {
                anyOf {
                    branch 'qa'
                    branch 'uat'
                }
            }
            environment {
                scannerHome = tool 'SonarScanner'
            }
            steps {
                withSonarQubeEnv('SonarQube-Server') {
                    sh "${scannerHome}/bin/sonar-scanner"
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
                    file(credentialsId: "HUASCARAN_SECRETS_FRONTEND_${env.ENTORNO.toUpperCase()}", variable: 'ENV_FILE')
                ]) {
                    sh '''
                        rm -f .env
                        cp "$ENV_FILE" .env
                        docker compose -p "$PROYECTO" up -d --build --remove-orphans
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
    }

    post {
        always {
            // El .env solo hace falta para levantar el contenedor.
            sh 'rm -f .env'
        }
    }
}
