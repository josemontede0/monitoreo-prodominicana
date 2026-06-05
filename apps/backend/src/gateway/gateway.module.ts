import { Module } from '@nestjs/common';
import { MonitorGateway } from './gateway';

@Module({
  providers: [MonitorGateway],
  exports: [MonitorGateway],
})
export class GatewayModule {}
