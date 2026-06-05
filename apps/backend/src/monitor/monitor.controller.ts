import { Controller, Get, Post, Param } from '@nestjs/common';
import { MonitorService_ } from './monitor.service';

@Controller('monitor')
export class MonitorController {
  constructor(private readonly monitor: MonitorService_) {}

  @Get('alerts')
  getAlerts() { return this.monitor.getAlerts(); }

  @Post('check')
  checkNow() {
    this.monitor.checkAll();
    return { ok: true };
  }
}
