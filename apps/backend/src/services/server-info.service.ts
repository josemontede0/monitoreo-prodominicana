import { Injectable, Logger } from "@nestjs/common";
import * as dns from "dns";
import * as tls from "tls";
import * as https from "https";
import * as http from "http";
import { promisify } from "util";

const lookup = promisify(dns.lookup);
const reverse = promisify(dns.reverse);

@Injectable()
export class ServerInfoService {
  private readonly logger = new Logger("ServerInfo");

  async getServerInfo(url: string) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      const port = parsed.port ? parseInt(parsed.port) : (parsed.protocol === "https:" ? 443 : 80);
      const [ipInfo, sslInfo, geoInfo, techInfo] = await Promise.allSettled([
        this.getIpInfo(hostname),
        this.getSslInfo(hostname, port),
        this.getGeoInfo(hostname),
        this.getTechInfo(url, hostname, port, parsed.protocol),
      ]);
      return {
        hostname,
        port,
        protocol: parsed.protocol.replace(":", ""),
        ip: ipInfo.status === "fulfilled" ? ipInfo.value : null,
        ssl: sslInfo.status === "fulfilled" ? sslInfo.value : null,
        geo: geoInfo.status === "fulfilled" ? geoInfo.value : null,
        tech: techInfo.status === "fulfilled" ? techInfo.value : null,
      };
    } catch (e: any) {
      this.logger.error("Error: " + e.message);
      return null;
    }
  }

  private async getIpInfo(hostname: string) {
    try {
      const result = await lookup(hostname);
      let rdns: string | null = null;
      try {
        const r = await reverse(result.address);
        if (r && r.length > 0) rdns = r[0];
      } catch {}
      return { address: result.address, family: "IPv" + result.family, rdns };
    } catch {
      return null;
    }
  }

  private getTechInfo(url: string, hostname: string, port: number, protocol: string): Promise<any> {
    return new Promise((resolve) => {
      try {
        const mod = protocol === "https:" ? https : http;
        const req = mod.request(
          { hostname, port, path: "/", method: "HEAD", timeout: 8000, rejectUnauthorized: false },
          (res) => {
            const headers = res.headers;
            const server = headers["server"] ?? null;
            const poweredBy = headers["x-powered-by"] ?? null;
            const framework = headers["x-framework"] ?? null;
            const runtime = headers["x-runtime"] ?? null;
            const via = headers["via"] ?? null;
            const cdn = headers["cf-ray"] ? "Cloudflare"
              : headers["x-amz-cf-id"] ? "AWS CloudFront"
              : headers["x-azure-ref"] ? "Azure CDN"
              : headers["x-fastly-request-id"] ? "Fastly"
              : via ? String(via) : null;

            const tech: string[] = [];
            if (server) tech.push(String(server));
            if (poweredBy) tech.push(String(poweredBy));
            if (framework) tech.push(String(framework));
            if (headers["x-aspnet-version"]) tech.push("ASP.NET " + headers["x-aspnet-version"]);
            if (headers["x-aspnetmvc-version"]) tech.push("ASP.NET MVC " + headers["x-aspnetmvc-version"]);
            if (String(poweredBy ?? "").toLowerCase().includes("php")) tech.push("PHP");
            if (String(server ?? "").toLowerCase().includes("nginx")) tech.push("Nginx");
            if (String(server ?? "").toLowerCase().includes("apache")) tech.push("Apache");
            if (String(server ?? "").toLowerCase().includes("iis")) tech.push("IIS");
            if (String(server ?? "").toLowerCase().includes("node")) tech.push("Node.js");

            resolve({
              server: server ? String(server) : null,
              poweredBy: poweredBy ? String(poweredBy) : null,
              cdn,
              technologies: [...new Set(tech)],
              allHeaders: Object.fromEntries(
                Object.entries(headers).filter(([k]) =>
                  ["server","x-powered-by","x-framework","x-runtime","via","content-type",
                   "x-cache","age","cache-control","strict-transport-security"].includes(k)
                )
              ),
            });
          }
        );
        req.on("error", () => resolve(null));
        req.on("timeout", () => { req.destroy(); resolve(null); });
        req.end();
      } catch { resolve(null); }
    });
  }

  private getSslInfo(hostname: string, port: number): Promise<any> {
    return new Promise((resolve) => {
      if (![443, 2053, 2087, 8443].includes(port)) { resolve(null); return; }
      try {
        const socket = tls.connect(
          { host: hostname, port, servername: hostname, rejectUnauthorized: false, timeout: 8000 },
          () => {
            try {
              const cert = socket.getPeerCertificate();
              if (!cert || !cert.valid_to) { socket.destroy(); resolve(null); return; }
              const validFrom = new Date(cert.valid_from);
              const validTo = new Date(cert.valid_to);
              const daysLeft = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              socket.destroy();
              resolve({
                valid: daysLeft > 0,
                validFrom: validFrom.toISOString(),
                validTo: validTo.toISOString(),
                daysLeft,
                issuer: cert.issuer?.O ?? cert.issuer?.CN ?? "Desconocido",
                subject: cert.subject?.CN ?? hostname,
              });
            } catch { socket.destroy(); resolve(null); }
          },
        );
        socket.on("error", () => resolve(null));
        socket.on("timeout", () => { socket.destroy(); resolve(null); });
      } catch { resolve(null); }
    });
  }

  private async getGeoInfo(hostname: string) {
    try {
      const ip = (await lookup(hostname)).address;
      const res = await fetch("http://ip-api.com/json/" + ip + "?fields=country,regionName,city,isp,org,as,lat,lon");
      const data = await res.json() as any;
      return { country: data.country, region: data.regionName, city: data.city, isp: data.isp, org: data.org, as: data.as, lat: data.lat, lon: data.lon };
    } catch {
      return null;
    }
  }
}