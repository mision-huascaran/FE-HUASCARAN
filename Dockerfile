# ─── SICEDU · frontend ───────────────────────────────────────────────────────
# Contenedor de dos etapas (§10, §11 del prompt y documento de stack):
#   1. build  → Node instala dependencias y ejecuta `npm run build`.
#   2. runtime → Nginx sirve el contenido estático de dist/.
# El resultado no lleva Node ni node_modules: solo HTML, CSS, JS y Nginx.

# ── Etapa 1: construcción ────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Las variables VITE_* se fijan EN TIEMPO DE CONSTRUCCIÓN: Vite las incrusta en
# el JavaScript. Cambiarlas exige reconstruir la imagen.
#
# VITE_API_BASE_URL=/api  → la API vive bajo el mismo dominio (§11), sin CORS.
# VITE_USE_MOCK=true      → HOY el backend no publica endpoints de negocio.
# VITE_AUTH_REAL=true     → la sesión sí va contra la API real.
ARG VITE_API_BASE_URL=/api
ARG VITE_USE_MOCK=true
ARG VITE_AUTH_REAL=true
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_USE_MOCK=$VITE_USE_MOCK \
    VITE_AUTH_REAL=$VITE_AUTH_REAL

# Primero solo los manifiestos: si no cambian, Docker reutiliza la capa de
# dependencias y el build del pipeline tarda segundos en vez de minutos.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ── Etapa 2: servidor estático ───────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# La imagen oficial de Nginx procesa /etc/nginx/templates/*.template con
# envsubst al arrancar: así el destino de /api se decide al desplegar, sin
# reconstruir. Por defecto, el servicio "backend" de la red de Docker.
# NGINX_ENTRYPOINT_LOCAL_RESOLVERS hace que la imagen exporte el DNS del
# contenedor como NGINX_LOCAL_RESOLVERS, que usa el `resolver` de nginx.conf.
ENV API_UPSTREAM=http://backend:8000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY deploy/cabeceras-seguridad.conf /etc/nginx/snippets/cabeceras-seguridad.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/salud || exit 1
