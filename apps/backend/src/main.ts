import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: "http://localhost:3000", credentials: true });
  app.setGlobalPrefix("api");
  await app.listen(process.env.PORT ?? 4000);
  console.log("MonitoreoApp ProDominicana corriendo en http://localhost:4000");
}
bootstrap();