# Cómo ejecutar el frontend y trabajar con Git

Guía rápida para levantar el proyecto y para hacer commit, push, pull y pasar cambios entre
ramas sin depender de nadie. Todos los comandos se escriben en la terminal de VS Code
(**Terminal → New Terminal**), dentro de la carpeta del proyecto.

---

## 1. Ejecutar el frontend

La primera vez (o cuando cambie `package.json`):

```bash
npm install
cp .env.example .env
```

Para levantarlo:

```bash
npm run dev
```

Abre **http://localhost:5173**. Para detenerlo: `Ctrl + C` en la terminal.

En la pantalla de login aparece un recuadro con las cuentas de prueba y un botón **Usar**: no
hace falta escribirlas.

### Otros comandos útiles

| Comando | Para qué |
|---|---|
| `npm run test` | Corre las pruebas. Hazlo antes de cada commit. |
| `npm run lint` | Revisa errores de código. También antes de cada commit. |
| `npm run build` | Genera la versión de producción en `dist/`. |
| `npm run verificar:backend` | Te dice qué endpoints del backend ya existen. |

---

## 2. Las cuatro ramas y para qué sirve cada una

```
development  →  qa  →  uat  →  main
 (tú trabajas)  (tester)  (presentación)  (producción)
```

| Rama | Quién la usa | Regla |
|---|---|---|
| `development` | Tú, todos los días | Aquí haces commit y push |
| `qa` | La tester, para validar | Solo recibe cambios de `development` |
| `uat` | Presentaciones semanales | Solo recibe de `qa`, con autorización del Project Manager |
| `main` | Producción | Solo recibe de `uat`. Nunca se escribe directo |

**Regla de oro:** tú solo trabajas en `development`. Las demás ramas se actualizan con
Pull Requests (sección 5), nunca haciendo push directo.

---

## 3. El trabajo del día a día

### Antes de empezar: asegúrate de estar en `development` y al día

```bash
git switch development
git pull
```

`git pull` baja los cambios que otros hayan subido. Hazlo **siempre** antes de empezar,
así evitas conflictos.

Para saber en qué rama estás:

```bash
git branch --show-current
```

### Guardar tu trabajo: commit

1. Mira qué cambiaste:
   ```bash
   git status
   ```
   En rojo salen los archivos modificados. Revisa que **no aparezca `.env`** (nunca se sube).

2. Prepara los cambios:
   ```bash
   git add -A
   ```
   `-A` agrega todo. Si solo quieres un archivo: `git add src/features/login/LoginPage.jsx`.

3. Crea el commit con un mensaje que diga qué hiciste:
   ```bash
   git commit -m "Agrega filtro por aula en estudiantes"
   ```

Un commit es una "foto" de tu trabajo guardada **solo en tu computadora**. Todavía no está
en GitHub.

### Subir a GitHub: push

```bash
git push
```

Ahora sí está en https://github.com/mision-huascaran/FE-HUASCARAN/tree/development.

### Resumen para copiar y pegar

```bash
git switch development
git pull
# ... trabajas ...
npm run test
npm run lint
git status
git add -A
git commit -m "Describe aquí lo que hiciste"
git push
```

---

## 4. Traer cambios de otros: pull

Si alguien más subió algo a `development`:

```bash
git switch development
git pull
```

### Si `git push` te dice *rejected* o *failed to push*

Significa que en GitHub hay cambios que tú no tienes. Solución:

```bash
git pull
git push
```

### Si `git pull` te dice *CONFLICT*

Dos personas cambiaron las mismas líneas. VS Code marca los archivos en conflicto:

1. Abre cada archivo marcado. Verás bloques así:
   ```
   <<<<<<< HEAD
   tu versión
   =======
   la versión de GitHub
   >>>>>>> ...
   ```
2. Deja el código correcto y borra las marcas `<<<<<<<`, `=======` y `>>>>>>>`
   (VS Code tiene botones "Accept Current / Incoming / Both").
3. Termina:
   ```bash
   git add -A
   git commit -m "Resuelve conflicto"
   git push
   ```

---

## 5. Pasar `development` a `qa` para que la tester lo valide

### La forma correcta: Pull Request (recomendada)

Un Pull Request (PR) es una solicitud para pasar los cambios de una rama a otra. Queda
registrado quién lo pidió, qué cambió y quién lo aprobó.

1. Asegúrate de haber hecho `git push` de todo en `development`.
2. Entra a https://github.com/mision-huascaran/FE-HUASCARAN
3. Pestaña **Pull requests** → botón **New pull request**.
4. Arriba elige:
   - **base: `qa`** ← la rama que recibe
   - **compare: `development`** ← la rama que envía

   Debe leerse `base: qa ← compare: development`. **Revisa esto siempre**: GitHub a veces
   propone `main` por defecto.
5. Ponle un título (ej. *"Fase 6 y 7 para validación"*) → **Create pull request**.
6. Cuando esté listo, **Merge pull request** → **Confirm merge**.

Ahora `qa` tiene exactamente lo mismo que `development` y la tester puede validarlo.

El mismo proceso sirve para los siguientes pasos:

| Paso | base | compare | Cuándo |
|---|---|---|---|
| Validación | `qa` | `development` | Cuando quieras que la tester pruebe |
| Presentación | `uat` | `qa` | Cuando la tester aprobó, con autorización del PM |
| Producción | `main` | `uat` | Cuando se aprobó en la presentación |

### Con comandos (alternativa)

Si prefieres la terminal, esto hace lo mismo que el PR de `development` a `qa`:

```bash
git switch qa
git pull
git merge development
git push
git switch development
```

La última línea te devuelve a tu rama de trabajo: **no olvides volver**, o tus próximos
commits caerán en `qa`.

Esto **no** funciona para `main` si la rama está protegida: ahí solo se puede con Pull Request.

### ¿Queda idéntico?

Sí, si `qa` solo recibe cambios de `development` (que es la regla). El merge copia todo lo
nuevo y `qa` queda igual que `development`. Para comprobarlo:

```bash
git fetch
git diff origin/qa origin/development
```

Si no imprime nada, las dos ramas son idénticas.

### Si `qa` se desordenó y quieres dejarla igual a `development` a la fuerza

Solo en ese caso, y avisando al equipo, porque **borra** lo que tuviera `qa` que no esté en
`development`:

```bash
git switch qa
git reset --hard origin/development
git push --force
git switch development
```

`--force` sobrescribe la rama en GitHub. No lo uses en el día a día.

---

## 6. Comandos para consultar y deshacer

| Quiero… | Comando |
|---|---|
| Ver en qué rama estoy | `git branch --show-current` |
| Ver todas las ramas | `git branch -a` |
| Ver los últimos commits | `git log --oneline -10` |
| Ver qué cambié en un archivo | `git diff src/ruta/archivo.jsx` |
| Descartar cambios de un archivo (sin commit) | `git restore src/ruta/archivo.jsx` |
| Sacar un archivo del `git add` | `git restore --staged src/ruta/archivo.jsx` |
| Cambiar el mensaje del último commit (antes de hacer push) | `git commit --amend -m "Nuevo mensaje"` |
| Ver a qué repositorio sube | `git remote -v` |

**Cuidado:** `git restore` borra tus cambios de ese archivo para siempre.

---

## 7. Tres reglas para no romper nada

1. **Nunca subas `.env`.** Ya está en `.gitignore`; revisa `git status` antes del commit.
2. **Pull antes de empezar, test y lint antes del commit.**
3. **Nunca `push --force` a `qa`, `uat` ni `main`** salvo el caso de la sección 5, y avisando.
