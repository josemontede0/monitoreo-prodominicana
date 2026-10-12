import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { AuthService } from "../auth/auth.service";
import { ServicesService } from "../services/services.service";
import { PROJECT_STATUSES, Project, ProjectInput, ProjectStatus } from "./project.interface";

const DB_FILE = path.join(process.cwd(), "projects.json");

@Injectable()
export class ProjectsService implements OnModuleInit {
  private readonly logger = new Logger("ProjectsService");
  private projects: Project[] = [];
  private lastMtimeMs = 0;

  constructor(
    private readonly services: ServicesService,
    private readonly auth: AuthService,
  ) {}

  onModuleInit() {
    this.load();
  }

  private load() {
    this.lastMtimeMs = this.fileMtimeMs();
    if (!fs.existsSync(DB_FILE)) {
      this.projects = [];
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch (e: any) {
      this.startEmptyAfterBackup("projects.json ilegible (" + e.message + ")");
      return;
    }
    if (!Array.isArray(parsed)) {
      this.startEmptyAfterBackup("projects.json no contiene un arreglo");
      return;
    }
    this.projects = parsed;
  }

  // Un archivo que no se puede leer se aparta antes de arrancar vacio. Sin esto, la
  // primera escritura posterior sobreescribiria con [] el unico almacen de datos.
  private startEmptyAfterBackup(motivo: string) {
    const backup = DB_FILE + ".corrupto-" + Date.now();
    let guardado = false;
    try {
      fs.renameSync(DB_FILE, backup);
      guardado = true;
    } catch (e: any) {
      this.logger.error("No se pudo respaldar projects.json: " + e.message);
    }
    this.logger.error(
      motivo +
        (guardado ? ", se respaldo en " + path.basename(backup) : ", sin respaldo") +
        " y se arranca con la lista vacia",
    );
    this.projects = [];
    this.lastMtimeMs = this.fileMtimeMs();
  }

  private fileMtimeMs(): number {
    try {
      return fs.statSync(DB_FILE).mtimeMs;
    } catch {
      return 0;
    }
  }

  // Varios procesos pueden compartir el mismo projects.json (un nest start:dev junto al
  // backend de produccion, por ejemplo). Cada save reescribe el archivo completo, asi que
  // se relee antes de escribir si el disco cambio, para no borrar lo que escribio el otro.
  private reloadIfChangedOnDisk() {
    if (this.fileMtimeMs() !== this.lastMtimeMs) {
      this.load();
    }
  }

  private write() {
    fs.writeFileSync(DB_FILE, JSON.stringify(this.projects, null, 2));
    this.lastMtimeMs = this.fileMtimeMs();
  }

  // Deja memoria y disco de acuerdo: si la escritura falla, la lista vuelve a su estado previo.
  private commit(previous: Project[]) {
    try {
      this.write();
    } catch (e: any) {
      this.projects = previous;
      this.logger.error("No se pudo guardar projects.json: " + e.message);
      throw e;
    }
  }

  getAll(): Project[] {
    return this.projects;
  }

  getOne(id: number): Project | null {
    return this.projects.find((p) => p.id === id) ?? null;
  }

  add(input: ProjectInput): Project {
    this.reloadIfChangedOnDisk();
    const project: Project = {
      id: this.nextId(),
      name: this.cleanName(input.name),
      description: this.cleanDescription(input.description),
      serviceIds: this.cleanServiceIds(input.serviceIds),
      assignedTo: this.cleanAssignedTo(input.assignedTo),
      status: input.status === undefined ? "planificado" : this.cleanStatus(input.status),
      progress: input.progress === undefined ? 0 : this.cleanProgress(input.progress),
      createdAt: new Date().toISOString(),
    };
    const previous = this.projects;
    this.projects = [...previous, project];
    this.commit(previous);
    return project;
  }

  update(id: number, input: ProjectInput): Project | null {
    this.reloadIfChangedOnDisk();
    const index = this.projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    // Se valida todo antes de construir nada, para que un campo invalido
    // no deje el proyecto a medio cambiar.
    const changes: Partial<Project> = {};
    if (input.name !== undefined) changes.name = this.cleanName(input.name);
    if (input.description !== undefined) changes.description = this.cleanDescription(input.description);
    if (input.serviceIds !== undefined) changes.serviceIds = this.cleanServiceIds(input.serviceIds);
    if (input.assignedTo !== undefined) changes.assignedTo = this.cleanAssignedTo(input.assignedTo);
    if (input.status !== undefined) changes.status = this.cleanStatus(input.status);
    if (input.progress !== undefined) changes.progress = this.cleanProgress(input.progress);

    // El spread parte del proyecto actual, asi que un id o un createdAt enviados
    // en el cuerpo no tienen por donde entrar.
    const updated: Project = { ...this.projects[index], ...changes };
    const previous = this.projects;
    this.projects = previous.map((p, i) => (i === index ? updated : p));
    this.commit(previous);
    return updated;
  }

  remove(id: number): boolean {
    this.reloadIfChangedOnDisk();
    const previous = this.projects;
    const filtered = previous.filter((p) => p.id !== id);
    if (filtered.length === previous.length) return false;
    this.projects = filtered;
    this.commit(previous);
    return true;
  }

  private nextId(): number {
    let id = Date.now();
    while (this.projects.some((p) => p.id === id)) id++;
    return id;
  }

  private cleanName(value: unknown): string {
    const name = typeof value === "string" ? value.trim() : "";
    if (name === "") {
      throw new BadRequestException("El nombre del proyecto es obligatorio");
    }
    return name;
  }

  private cleanDescription(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const description = value.trim();
    return description === "" ? null : description;
  }

  private cleanStatus(value: unknown): ProjectStatus {
    if (!PROJECT_STATUSES.includes(value as ProjectStatus)) {
      throw new BadRequestException("Estado de proyecto invalido");
    }
    return value as ProjectStatus;
  }

  private cleanProgress(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new BadRequestException("El progreso debe ser un numero entre 0 y 100");
    }
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  private cleanAssignedTo(value: unknown): string {
    const username = typeof value === "string" ? value.trim() : "";
    const exists = this.auth.listUsers().some((u) => u.username === username);
    if (!exists) {
      throw new BadRequestException("Responsable no encontrado");
    }
    return username;
  }

  private cleanServiceIds(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    const valid = new Set(this.services.getAll().map((s) => s.id));
    return value
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && valid.has(id));
  }
}
