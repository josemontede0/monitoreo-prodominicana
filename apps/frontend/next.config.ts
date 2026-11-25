import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empaqueta el servidor y solo las dependencias usadas en .next/standalone,
  // para desplegar sin correr pnpm install en el servidor. Mismo criterio que
  // el directorio y ControlVisitantes.
  output: "standalone",

  // En un monorepo el rastreo arranca en la carpeta de la app y se dejaria
  // fuera las dependencias que viven en el node_modules de la raiz. Apuntando
  // a la raiz, standalone queda con la misma forma del repo:
  //   .next/standalone/apps/frontend/server.js  +  .next/standalone/node_modules
  outputFileTracingRoot: path.join(__dirname, "..", ".."),

  // NEXT_PUBLIC_API_URL ya no se fija aqui. Al declararla en "env" se incrustaba
  // http://localhost:4000 en el bundle del navegador y ganaba sobre .env.local,
  // asi que desde cualquier otra maquina de la red el panel llamaba al localhost
  // de quien lo abria. Ahora sale del entorno en tiempo de compilacion:
  //   desarrollo -> apps/frontend/.env.local
  //   despliegue -> la variable que exporta deploy.sh
  // Sigue siendo una variable NEXT_PUBLIC_: se decide al compilar, no al
  // arrancar, de modo que cambiar de servidor exige volver a compilar.
};

export default nextConfig;
