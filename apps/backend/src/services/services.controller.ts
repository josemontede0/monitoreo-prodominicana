import { Controller, Get, Post, Delete, Patch, Param, Body } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServerInfoService } from "./server-info.service";

@Controller("services")
export class ServicesController {
  constructor(
    private readonly svc: ServicesService,
    private readonly serverInfo: ServerInfoService,
  ) {}

  @Get()
  getAll() { return this.svc.getAll(); }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.svc.getAll().find(s => s.id === Number(id)) ?? null;
  }

  @Get(":id/server-info")
  async getServerInfo(@Param("id") id: string) {
    const service = this.svc.getAll().find(s => s.id === Number(id));
    if (!service) return null;
    return this.serverInfo.getServerInfo(service.url);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: { privateIp?: string; notes?: string; name?: string }) {
    const service = this.svc.getAll().find(s => s.id === Number(id));
    if (!service) return null;
    if (body.privateIp !== undefined) service.privateIp = body.privateIp;
    if (body.notes !== undefined) service.notes = body.notes;
    if (body.name !== undefined) service.name = body.name;
    this.svc.update(service);
    return service;
  }

  @Post()
  create(@Body() body: { name: string; url: string; interval?: number; privateIp?: string; notes?: string }) {
    return this.svc.add(body.name, body.url, body.interval, body.privateIp, body.notes);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return { ok: this.svc.remove(Number(id)) };
  }
}