import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import type { ProjectInput } from "./project.interface";
import { ProjectsService } from "./projects.service";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  getAll() {
    return this.projects.getAll();
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.projects.getOne(Number(id));
  }

  @Post()
  create(@Body() body: ProjectInput) {
    return this.projects.add(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: ProjectInput) {
    return this.projects.update(Number(id), body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return { ok: this.projects.remove(Number(id)) };
  }
}
