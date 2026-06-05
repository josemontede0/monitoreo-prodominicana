import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ConfigModule } from "@nestjs/config";
import { ServicesModule } from "./services/services.module";
import { MonitorModule } from "./monitor/monitor.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { GatewayModule } from "./gateway/gateway.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    ScheduleModule.forRoot(),
    AuthModule,
    ServicesModule,
    MonitorModule,
    NotificationsModule,
    GatewayModule,
  ],
})
export class AppModule {}