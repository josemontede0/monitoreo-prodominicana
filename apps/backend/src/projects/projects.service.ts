import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { AuthService } from "../auth/auth.service";
import { ServicesService } from "../services/services.service";
import {
  PROJECT_STATUSES,
  Project,
  ProjectInput,
  ProjectModule,
  ProjectStatus,
} from "./project.interface";

const DB_FILE = path.join(process.cwd(), "projects.json");

// Los siete modulos con los que nace todo proyecto nuevo.
const DEFAULT_MODULE_NAMES = [
  "Levantamiento de requerimientos",
  "Diseno",
  "Desarrollo",
  "Pruebas",
  "Documentacion",
  "Despliegue",
  "Capacitacion",
];

function defaultModules(): ProjectModule[] {
  return DEFAULT_MODULE_NAMES.map((name, index) => ({
    id: index + 1,
    name,
    done: false,
    assignedTo: [],
  }));
}

function progressFromModules(modules: ProjectModule[]): number {
  if (modules.length === 0) return 0;
  const hechos = modules.filter((m) => m.done).length;
  return Math.round((hechos / modules.length) * 100);
}

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
    const modules =
      input.modules === undefined ? defaultModules() : this.cleanModules(input.modules);
    const project: Project = {
      id: this.nextId(),
      name: this.cleanName(input.name),
      description: this.cleanDescription(input.description),
      serviceIds: this.cleanServiceIds(input.serviceIds),
      assignedTo: this.cleanAssignedTo(input.assignedTo),
      status: input.status === undefined ? "iniciado" : this.cleanStatus(input.status),
      startDate: this.cleanDate(input.startDate),
      endDate: this.cleanDate(input.endDate),
      modules,
      progress: progressFromModules(modules),
      createdAt: new Date().toISOString(),
    };
    this.assertRangoDeFechas(project.startDate, project.endDate);
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
    if (input.startDate !== undefined) changes.startDate = this.cleanDate(input.startDate);
    if (input.endDate !== undefined) changes.endDate = this.cleanDate(input.endDate);
    // El progreso no se toca directamente: solo se mueve cuando cambian los modulos.
    if (input.modules !== undefined) {
      changes.modules = this.cleanModules(input.modules);
      changes.progress = progressFromModules(changes.modules);
    }

    // El spread parte del proyecto actual, asi que un id o un createdAt enviados
    // en el cuerpo no tienen por donde entrar.
    const updated: Project = { ...this.projects[index], ...changes };
    // El rango se comprueba sobre el resultado final: al enviar solo una de las dos
    // fechas, la otra es la que ya tenia guardada el proyecto.
    this.assertRangoDeFechas(updated.startDate, updated.endDate);
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

  private cleanDate(value: unknown): string | null {
    if (value === undefined || value === null || value === "") return null;
    const texto = typeof value === "string" ? value.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      throw new BadRequestException("La fecha debe venir como AAAA-MM-DD");
    }
    // Date admite un 31 de febrero y lo corre al 3 de marzo; comparar la vuelta
    // atras es lo que descarta las fechas que no existen en el calendario.
    const fecha = new Date(texto + "T00:00:00Z");
    if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) {
      throw new BadRequestException("La fecha no existe en el calendario");
    }
    return texto;
  }

  // En AAAA-MM-DD el orden alfabetico es el cronologico, no hace falta parsear.
  private assertRangoDeFechas(startDate: string | null, endDate: string | null) {
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException(
        "La fecha de finalizacion no puede ser anterior a la de inicio",
      );
    }
  }

  private cleanStatus(value: unknown): ProjectStatus {
    if (!PROJECT_STATUSES.includes(value as ProjectStatus)) {
      throw new BadRequestException("Estado de proyecto invalido");
    }
    return value as ProjectStatus;
  }

  // El id sale de la posicion en la lista, asi no hay forma de que lleguen repetidos
  // ni de que un id inventado por el cliente pise a otro modulo.
  private cleanModules(value: unknown): ProjectModule[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException("Los modulos deben venir en una lista");
    }
    return value.map((item, index) => {
      const raw = (item ?? {}) as { name?: unknown; done?: unknown; assignedTo?: unknown };
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      if (name === "") {
        throw new BadRequestException("Cada modulo necesita un nombre");
      }
      return {
        id: index + 1,
        name,
        done: raw.done === true,
        assignedTo: this.cleanModuleAssignees(raw.assignedTo),
      };
    });
  }

  // Misma politica que cleanServiceIds: lo que no corresponde a un usuario conocido
  // se descarta en silencio, para que quitar a alguien de la plantilla no bloquee
  // el guardado de todos los proyectos donde estaba asignado.
  private cleanModuleAssignees(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const conocidos = new Set(this.auth.listUsers().map((u) => u.username));
    const vistos = new Set<string>();
    for (const item of value) {
      const username = typeof item === "string" ? item.trim() : "";
      if (conocidos.has(username)) vistos.add(username);
    }
    return [...vistos];
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
