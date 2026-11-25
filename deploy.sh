#!/usr/bin/env bash
# Despliega el ultimo commit (HEAD) al servidor Linux, junto al directorio y a
# ControlVisitantes.
#
# Uso (desde WSL/Linux, en la carpeta del proyecto):   bash deploy.sh
#
# Que hace:
#   1. Extrae HEAD a una carpeta de compilacion en Linux (no usa el node_modules
#      de Windows, que traeria binarios de otra plataforma).
#   2. pnpm install, nest build (backend) y next build (frontend).
#   3. Resuelve las dependencias de produccion del backend con npm en una carpeta
#      aparte: npm deja un node_modules de carpetas reales, sin los enlaces
#      simbolicos de pnpm, que es lo unico que sobrevive a un rsync.
#   4. Guarda en el servidor una copia de la version actual (<ruta>.prev).
#   5. Copia al servidor con rsync, SIN tocar .env ni services.json/projects.json.
#   6. Reinicia los dos procesos de pm2.
#
# La primera vez, antes de correr esto, hay que preparar el servidor a mano:
# crear backend/.env y traer los datos del Windows. Ver NOTAS al final.
#
# Variables opcionales: DEPLOY_HOST, DEPLOY_PATH, DEPLOY_BUILD_DIR, API_URL.
set -euo pipefail

SERVIDOR="${DEPLOY_HOST:-ceird@192.168.0.79}"
RUTA="${DEPLOY_PATH:-/home/ceird/monitoreo}"
BUILD="${DEPLOY_BUILD_DIR:-$HOME/.cache/monitoreo-build}"

# El panel corre en el navegador del usuario, asi que esta URL tiene que ser
# alcanzable DESDE SU MAQUINA: no vale localhost. Se incrusta en el bundle al
# compilar (es NEXT_PUBLIC_), de modo que cambiarla exige volver a desplegar.
API_URL="${API_URL:-http://192.168.0.79:4000}"

cd "$(dirname "$0")"

# El npm/pnpm de Windows no puede compilar en una ruta de Linux: la ve como UNC
# y lanza los postinstall con cmd.exe, que no admite UNC como directorio actual.
if [[ "$(command -v npm)" == /mnt/c/* ]]; then
  echo "ERROR: npm resuelve al de Windows ($(command -v npm))." >&2
  echo "       Abre una terminal nueva para que cargue nvm, o ejecuta:" >&2
  echo "         export NVM_DIR=\"\$HOME/.nvm\" && . \"\$NVM_DIR/nvm.sh\"" >&2
  exit 1
fi
# pnpm suele quedar instalado solo en Windows: el del PATH de WSL apunta a
# AppData y arrastra el mismo problema de UNC que npm.
if ! command -v pnpm >/dev/null; then
  echo "ERROR: falta pnpm en WSL. Instalalo con: npm i -g pnpm" >&2
  exit 1
fi
if [[ "$(command -v pnpm)" == /mnt/c/* ]]; then
  echo "ERROR: pnpm resuelve al de Windows ($(command -v pnpm))." >&2
  echo "       Instala el de Linux en esta terminal:  npm i -g pnpm" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "AVISO: hay cambios sin commit. Solo se despliega lo que esta en el ultimo commit."
fi
# Sin pedir credenciales: si no hay acceso a GitHub desde WSL, solo se omite la comprobacion.
GIT_TERMINAL_PROMPT=0 git fetch --quiet origin main 2>/dev/null \
  || echo "AVISO: no se pudo consultar GitHub desde WSL; no se verifica si hiciste push."
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main 2>/dev/null || echo)" ]; then
  echo "AVISO: HEAD ($(git rev-parse --short HEAD)) no coincide con origin/main. ¿Falta hacer push?"
fi
echo "El panel llamara a la API en: $API_URL"
read -r -p "Desplegar $(git rev-parse --short HEAD) a $SERVIDOR:$RUTA ? [s/N] " resp
[ "$resp" = "s" ] || [ "$resp" = "S" ] || { echo "Cancelado."; exit 1; }

echo "==> Preparando copia limpia de HEAD en $BUILD"
mkdir -p "$BUILD"
find "$BUILD" -mindepth 1 -maxdepth 1 \
  ! -name node_modules ! -name .backend-prod -exec rm -rf {} +
git archive HEAD | tar -x -C "$BUILD"

cd "$BUILD"
echo "==> pnpm install"
pnpm install --prefer-offline

echo "==> nest build (backend)"
pnpm --filter backend run build

echo "==> next build (frontend)"
NEXT_PUBLIC_API_URL="$API_URL" pnpm --filter frontend run build

if [ ! -f apps/frontend/.next/standalone/apps/frontend/server.js ]; then
  echo "ERROR: next build no genero el servidor standalone donde se esperaba." >&2
  echo "       Revisa output/outputFileTracingRoot en apps/frontend/next.config.ts." >&2
  exit 1
fi

# Dependencias de produccion del backend. Se cachean: solo se reinstalan si
# cambio su package.json.
PROD="$BUILD/.backend-prod"
mkdir -p "$PROD"
if ! cmp -s apps/backend/package.json "$PROD/package.json"; then
  echo "==> npm install --omit=dev (dependencias del backend)"
  cp apps/backend/package.json "$PROD/package.json"
  (cd "$PROD" && npm install --omit=dev --no-audit --no-fund)
else
  echo "==> dependencias del backend sin cambios, se reutilizan"
fi

echo "==> Armando carpeta de despliegue"
rm -rf deploy
mkdir -p deploy/backend deploy/frontend

# Backend: el compilado, su package.json y sus dependencias.
cp -r apps/backend/dist deploy/backend/dist
cp apps/backend/package.json deploy/backend/package.json
cp -r "$PROD/node_modules" deploy/backend/node_modules

# Frontend: standalone ya trae su propio node_modules; static y public van aparte
# porque next build los deja fuera a proposito.
cp -r apps/frontend/.next/standalone/. deploy/frontend/
mkdir -p deploy/frontend/apps/frontend/.next
cp -r apps/frontend/.next/static deploy/frontend/apps/frontend/.next/static
cp -r apps/frontend/public deploy/frontend/apps/frontend/public

cp ecosystem.config.js deploy/ecosystem.config.js

echo "==> Copia de respaldo en el servidor (${RUTA}.prev)"
ssh "$SERVIDOR" "rm -rf '${RUTA}.prev' && cp -a '${RUTA}' '${RUTA}.prev' 2>/dev/null || true"

echo "==> Copiando al servidor"
ssh "$SERVIDOR" "mkdir -p '$RUTA'"
# services.json y projects.json son la base de datos de la app: sin excluirlos,
# --delete se llevaria por delante todo el historial y los proyectos.
rsync -rlt --delete \
  --exclude 'backend/.env' \
  --exclude 'backend/services.json' \
  --exclude 'backend/projects.json' \
  deploy/ "$SERVIDOR:$RUTA/"

echo "==> Reiniciando pm2"
ssh "$SERVIDOR" "cd '$RUTA' && (pm2 restart monitoreo-backend monitoreo-frontend --update-env || pm2 start ecosystem.config.js) && pm2 save && sleep 3 && pm2 logs monitoreo-backend --lines 10 --nostream"

echo "Listo. Para volver a la version anterior:"
echo "  ssh $SERVIDOR \"rsync -a --delete --exclude backend/.env --exclude 'backend/*.json' ${RUTA}.prev/ ${RUTA}/ && pm2 restart monitoreo-backend monitoreo-frontend\""
echo
echo "NOTAS para la primera vez (en el servidor, a mano):"
echo "  1. mkdir -p $RUTA/backend && nano $RUTA/backend/.env   (PORT, JWT_SECRET, SMTP_*, LDAP_*)"
echo "  2. Traer los datos del Windows 192.168.0.239:"
echo "       C:\\monitoreo-prodominicana\\apps\\backend\\{services,projects}.json  ->  $RUTA/backend/"
echo "  3. Abrir los puertos 4000 (API+WebSockets) y 3020 (panel) en el firewall."
