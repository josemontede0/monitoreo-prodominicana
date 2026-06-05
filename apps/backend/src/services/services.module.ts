import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { ServerInfoService } from './server-info.service';

@Module({
  providers: [ServicesService, ServerInfoService],
  controllers: [ServicesController],
  exports: [ServicesService],
})
export class ServicesModule {}