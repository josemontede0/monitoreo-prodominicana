import { Module } from '@nestjs/common';
import { MonitorService_ } from './monitor.service';
import { MonitorController } from './monitor.controller';
import { ServicesModule } from '../services/services.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [ServicesModule, NotificationsModule, GatewayModule],
  providers: [MonitorService_],
  controllers: [MonitorController],
  exports: [MonitorService_],
})
export class MonitorModule {}
