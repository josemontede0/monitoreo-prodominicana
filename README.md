# MonitoreoApp ProDominicana

Sistema de monitoreo de servicios digitales en tiempo real para ProDominicana.

![Dashboard](https://img.shields.io/badge/status-activo-green) ![Node](https://img.shields.io/badge/Node.js-20+-green) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![NestJS](https://img.shields.io/badge/NestJS-11-red)

## Caracteristicas

- Dashboard en tiempo real con WebSockets
- Monitoreo de servicios HTTP/HTTPS cada X segundos
- Historial de uptime de los ultimos 30 dias
- Graficas de tiempo de respuesta, uptime y codigo HTTP
- Logs detallados por servicio
- Informacion del servidor: IP publica, IP privada, SSL, CDN, tecnologia detectada
- Alertas por email via SMTP institucional
- Sonido de alerta cuando un servicio cae
- Autenticacion con Active Directory (LDAP) con fallback local
- Agregar y eliminar servicios desde el dashboard

## Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 16, Tailwind CSS, Recharts, Socket.io-client |
| Backend | NestJS 11, Socket.io, node-cron, nodemailer, ldapts |
| Monorepo | pnpm workspaces |
| Deploy | PM2, Linux |

## Estructura del proyecto  monitoreo-prodominicana/
├── apps/
│   ├── backend/          # NestJS API + WebSockets
│   │   ├── src/
│   │   │   ├── auth/           # Autenticacion LDAP + JWT
│   │   │   ├── services/       # CRUD de servicios monitoreados
│   │   │   ├── monitor/        # Motor de chequeo HTTP
│   │   │   ├── notifications/  # Alertas por email
│   │   │   └── gateway/        # WebSockets en tiempo real
│   │   └── .env.example
│   └── frontend/         # Next.js Dashboard
│       ├── app/
│       │   ├── page.tsx        # Dashboard principal
│       │   ├── login/          # Pagina de login
│       │   └── services/[id]/  # Detalle de servicio
│       └── hooks/
│           └── useMonitor.ts   # Hook WebSocket + API
├── package.json          # Monorepo root
└── pnpm-workspace.yaml## Instalacion local (desarrollo)

### Requisitos

- Node.js 20+
- pnpm 8+

### Pasos

```bash
# Clonar el repositorio
git clone https://github.com/josemontede0/monitoreo-prodominicana.git
cd monitoreo-prodominicana

# Instalar dependencias
cd apps/backend && pnpm install
cd ../frontend && pnpm install

# Configurar variables de entorno
cp apps/backend/.env.example apps/backend/.env
# Editar .env con los datos del servidor

# Iniciar en desarrollo (dos terminales)
# Terminal 1 - Backend
cd apps/backend && pnpm run start:dev

# Terminal 2 - Frontend
cd apps/frontend && pnpm run dev
```

Abrir `http://localhost:3000`

## Variables de entorno

Crear `apps/backend/.env` basado en `.env.example`:

```env
# Servidor
PORT=4000

# SMTP (sin autenticacion)
SMTP_HOST=10.25.1.68
SMTP_PORT=587
SMTP_FROM=alerta@prodominicana.gob.do
ALERT_EMAILS=usuario@prodominicana.gob.do

# JWT
JWT_SECRET=clave-secreta-segura

# LDAP / Active Directory
LDAP_URL=ldap://192.168.0.20:389
LDAP_BASE_DN=dc=cei-rd,dc=gov,dc=do
```

## Despliegue en Linux (produccion)

### Requisitos del servidor

- Ubuntu 20.04+ o Debian 11+
- Node.js 20+
- pnpm
- PM2

### Instalacion

```bash
# Clonar el repositorio
git clone https://github.com/josemontede0/monitoreo-prodominicana.git
cd monitoreo-prodominicana

# Instalar dependencias
cd apps/backend && pnpm install --production
cd ../frontend && pnpm install

# Build del frontend
cd apps/frontend && pnpm run build

# Configurar .env
nano apps/backend/.env

# Iniciar con PM2
pm2 start apps/backend/dist/main.js --name monitoreo-backend
pm2 start "pnpm start" --name monitoreo-frontend --cwd apps/frontend
pm2 save
pm2 startup
```

### Nginx (proxy inverso)

```nginx
server {
    listen 80;
    server_name monitor.prodominicana.gob.do;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    # Backend API + WebSockets
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /socket.io {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

## Servicios monitoreados por defecto

| Servicio | URL |
|---------|-----|
| Formulario de Inscripcion | https://formulario.prodominicana.gob.do:2053 |
| ProtalentHub | https://protalenthub.prodominicana.gob.do |
| Learning Lab | https://protalenthub.prodominicana.gob.do/learning/ |
| Capacita Frontend | https://capacita.prodominicana.gob.do |
| Mapa Regional AIF | https://maparegionalaif.prodominicana.gob.do:2087 |

## Autenticacion

El sistema usa **Active Directory (LDAP)** como fuente principal. Si el servidor LDAP no esta disponible, cae automaticamente a usuarios locales configurados en el backend.

En produccion (servidor dentro de la red institucional) el LDAP funcionara automaticamente con las credenciales de red de cada usuario.

## Alertas

Cuando un servicio cae el sistema:
1. Envia email inmediato via SMTP institucional
2. Muestra alerta visual en el dashboard
3. Reproduce sonido de alerta en el navegador
4. Registra el evento en el historial del servicio

Cuando el servicio se recupera envia un email de recuperacion automaticamente.

## Equipo

Desarrollado por el equipo de Tecnologia de la Informacion de **ProDominicana**.

---

*MonitoreoApp ProDominicana — Sistema interno de monitoreo de servicios digitales*