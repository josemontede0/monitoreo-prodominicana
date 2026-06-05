import { Injectable, OnModuleInit } from "@nestjs/common";
import { MonitorService } from "./service.interface";
import * as fs from "fs";

const DB_FILE = "./services.json";

@Injectable()
export class ServicesService implements OnModuleInit {
  private services: MonitorService[] = [];

  onModuleInit() { this.load(); }

  private load() {
    if (fs.existsSync(DB_FILE)) {
      this.services = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      this.services = this.services.map(s => ({ ...s, logs: s.logs ?? [], privateIp: s.privateIp ?? null, notes: s.notes ?? null }));
    } else {
      this.services = [
        { id:1, name:"Formulario de Inscripcion", url:"https://formulario.prodominicana.gob.do:2053", interval:60, status:"checking", response:null, uptime:100, downSince:null, notified:false, history:[], logs:[], privateIp:null, notes:null },
        { id:2, name:"ProtalentHub", url:"https://protalenthub.prodominicana.gob.do", interval:60, status:"checking", response:null, uptime:100, downSince:null, notified:false, history:[], logs:[], privateIp:null, notes:null },
        { id:3, name:"Learning Lab", url:"https://protalenthub.prodominicana.gob.do/learning/", interval:60, status:"checking", response:null, uptime:100, downSince:null, notified:false, history:[], logs:[], privateIp:null, notes:null },
        { id:4, name:"Capacita Frontend", url:"https://capacita.prodominicana.gob.do", interval:60, status:"checking", response:null, uptime:100, downSince:null, notified:false, history:[], logs:[], privateIp:null, notes:null },
        { id:5, name:"Mapa Regional AIF", url:"https://maparegionalaif.prodominicana.gob.do:2087", interval:60, status:"checking", response:null, uptime:100, downSince:null, notified:false, history:[], logs:[], privateIp:null, notes:null },
      ];
      this.save();
    }
  }

  save() { fs.writeFileSync(DB_FILE, JSON.stringify(this.services, null, 2)); }

  getAll(): MonitorService[] { return this.services; }

  add(name: string, url: string, interval = 60, privateIp?: string, notes?: string): MonitorService {
    const s: MonitorService = { id: Date.now(), name, url, interval, status: "checking", response: null, uptime: 100, downSince: null, notified: false, history: [], logs: [], privateIp: privateIp ?? null, notes: notes ?? null };
    this.services.push(s);
    this.save();
    return s;
  }

  remove(id: number): boolean {
    const before = this.services.length;
    this.services = this.services.filter(s => s.id !== id);
    this.save();
    return this.services.length < before;
  }

  update(service: MonitorService) {
    const idx = this.services.findIndex(s => s.id === service.id);
    if (idx !== -1) { this.services[idx] = service; this.save(); }
  }
}