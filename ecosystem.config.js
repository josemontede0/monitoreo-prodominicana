// Procesos de pm2 para el servidor Linux (ceird@192.168.0.79), donde monitoreo
// convive con el directorio y ControlVisitantes.
//
// Se arranca desde la carpeta del despliegue:
//   cd /home/ceird/monitoreo && pm2 start ecosystem.config.js && pm2 save
//
// Los puertos se fijan aqui y no se dejan al valor por defecto a proposito: en
// este servidor hay varias apps de Next, y todas tomarian el 3000.
//
// El cwd del backend importa: services.json y projects.json —que son la base de
// datos de esta app— se leen y escriben con rutas relativas al directorio de
// trabajo. Si cambia el cwd, el backend arranca con los datos vacios.
module.exports = {
  apps: [
    {
      name: "monitoreo-backend",
      script: "dist/main.js",
      cwd: "/home/ceird/monitoreo/backend",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
    },
    {
      name: "monitoreo-frontend",
      script: "apps/frontend/server.js",
      cwd: "/home/ceird/monitoreo/frontend",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3020,
        // Sin esto el servidor de Next escucha solo en localhost y no se llega
        // desde otra maquina de la red.
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
