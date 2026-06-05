import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as https from 'https';
import * as http from 'http';
import { ServicesService } from '../services/services.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MonitorGateway } from '../gateway/gateway';
import { MonitorService } from '../services/service.interface';

@Injectable()
export class MonitorService_ {
  private readonly logger = new Logger('Monitor');
  private alerts: any[] = [];

  constructor(
    private readonly svc: ServicesService,
    private readonly notify: NotificationsService,
    private readonly gateway: MonitorGateway,
  ) {}

  private checkUrl(url: string): Promise<{ status: 'up' | 'down'; response: number | null; httpCode: number | null }> {
    return new Promise((resolve) => {
      const start = Date.now();
      try {
        const parsed = new URL(url);
        const mod = parsed.protocol === 'https:' ? https : http;
        const req = mod.request(
          {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname || '/',
            method: 'GET',
            timeout: 10000,
            rejectUnauthorized: false,
          },
          (res) => {
            const response = Date.now() - start;
            const httpCode = res.statusCode ?? null;
            resolve({ status: httpCode !== null && httpCode < 500 ? 'up' : 'down', response, httpCode });
          },
        );
        req.on('timeout', () => { req.destroy(); resolve({ status: 'down', response: null, httpCode: null }); });
        req.on('error', () => resolve({ status: 'down', response: null, httpCode: null }));
        req.end();
      } catch {
        resolve({ status: 'down', response: null, httpCode: null });
      }
    });
  }

  async checkAll() {
    const services = this.svc.getAll();
    for (const service of services) {
      await this.checkOne(service);
    }
    this.gateway.broadcast({ type: 'update', services: this.svc.getAll(), alerts: this.alerts });
  }

  async checkOne(service: MonitorService) {
    const prev = service.status;
    const result = await this.checkUrl(service.url);

    service.status = result.status;
    service.response = result.response;
    service.history = [...(service.history ?? []).slice(-29), result.status];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    if (!service.logs) service.logs = [];
    service.logs.push({
      timestamp: new Date().toISOString(),
      status: result.status,
      response: result.response,
      httpCode: result.httpCode,
    });
    service.logs = service.logs.filter(l => l.timestamp > thirtyDaysAgo).slice(-43200);

    const total = service.history.length;
    const ups = service.history.filter(h => h === 'up').length;
    service.uptime = total > 0 ? parseFloat(((ups / total) * 100).toFixed(1)) : 100;

    if (prev !== 'down' && result.status === 'down' && !service.notified) {
      service.downSince = new Date().toISOString();
      service.notified = true;
      this.logger.warn('CAIDO: ' + service.name);
      await this.notify.sendAlert(service, 'down');
      this.addAlert(service, 'down');
      this.gateway.broadcast({ type: 'alert', service });
    }

    if (prev === 'down' && result.status === 'up' && service.notified) {
      service.notified = false;
      service.downSince = null;
      this.logger.log('RECUPERADO: ' + service.name);
      await this.notify.sendAlert(service, 'up');
      this.addAlert(service, 'up');
      this.gateway.broadcast({ type: 'alert', service });
    }

    this.svc.update(service);
  }

  private addAlert(service: MonitorService, type: 'up' | 'down') {
    this.alerts.unshift({ id: Date.now(), service: service.name, type, time: new Date().toISOString() });
    this.alerts = this.alerts.slice(0, 50);
  }

  getAlerts() { return this.alerts; }

  @Cron(CronExpression.EVERY_MINUTE)
  scheduledCheck() { this.checkAll(); }
}