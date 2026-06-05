import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { MonitorService } from "../services/service.interface";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger("Notifications");
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: false,
    ignoreTLS: true,
    tls: { rejectUnauthorized: false },
  });

  async sendAlert(service: MonitorService, type: "up" | "down") {
    const emails = (process.env.ALERT_EMAILS ?? "").split(",").map(e => e.trim());
    const isDown = type === "down";
    const subject = isDown
      ? "ALERTA: " + service.name + " esta CAIDO - MonitoreoApp ProDominicana"
      : "RECUPERADO: " + service.name + " esta en linea - MonitoreoApp ProDominicana";

    const html = isDown
      ? `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#C8102E;padding:20px;text-align:center">
            <h1 style="color:white;margin:0">MonitoreoApp ProDominicana</h1>
          </div>
          <div style="padding:30px;background:#f9f9f9">
            <h2 style="color:#C8102E">Servicio Caido</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:10px;border-bottom:1px solid #eee"><b>Servicio</b></td><td style="padding:10px;border-bottom:1px solid #eee">${service.name}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #eee"><b>URL</b></td><td style="padding:10px;border-bottom:1px solid #eee">${service.url}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #eee"><b>Hora</b></td><td style="padding:10px;border-bottom:1px solid #eee">${new Date().toLocaleString("es-DO")}</td></tr>
              <tr><td style="padding:10px"><b>Uptime</b></td><td style="padding:10px">${service.uptime}%</td></tr>
            </table>
            <p style="color:#666;margin-top:20px">El monitor verificara cada minuto y te notificara cuando se recupere.</p>
          </div>
        </div>`
      : `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#C8102E;padding:20px;text-align:center">
            <h1 style="color:white;margin:0">MonitoreoApp ProDominicana</h1>
          </div>
          <div style="padding:30px;background:#f9f9f9">
            <h2 style="color:#2E7D32">Servicio Recuperado</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:10px;border-bottom:1px solid #eee"><b>Servicio</b></td><td style="padding:10px;border-bottom:1px solid #eee">${service.name}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #eee"><b>URL</b></td><td style="padding:10px;border-bottom:1px solid #eee">${service.url}</td></tr>
              <tr><td style="padding:10px"><b>Hora</b></td><td style="padding:10px">${new Date().toLocaleString("es-DO")}</td></tr>
            </table>
          </div>
        </div>`;

    try {
      await this.transporter.sendMail({
        from: '"MonitoreoApp ProDominicana" <' + process.env.SMTP_FROM + ">",
        to: emails.join(","),
        subject,
        html,
      });
      this.logger.log("Email enviado: " + subject);
    } catch (e: any) {
      this.logger.error("Error enviando email: " + e.message);
    }
  }
}