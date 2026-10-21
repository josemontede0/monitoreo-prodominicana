export type ProjectStatus = "iniciado" | "en_curso" | "en_pausa";

export const PROJECT_STATUSES: ProjectStatus[] = ["iniciado", "en_curso", "en_pausa"];

export interface ProjectModule {
  id: number;
  name: string;
  done: boolean;
  // Usuarios responsables del modulo. Vacio = sin asignar; admite varios.
  assignedTo: string[];
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  serviceIds: number[];
  assignedTo: string;
  status: ProjectStatus;
  // Fechas de calendario en AAAA-MM-DD, sin hora ni zona horaria. null = sin fijar.
  startDate: string | null;
  endDate: string | null;
  modules: ProjectModule[];
  // Derivado de los modulos marcados; no se recibe del cliente.
  progress: number;
  createdAt: string;
}

export interface ProjectInput {
  name?: unknown;
  description?: unknown;
  serviceIds?: unknown;
  assignedTo?: unknown;
  status?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  modules?: unknown;
  // Se acepta en el cuerpo por compatibilidad, pero se ignora: el progreso
  // sale de los modulos.
  progress?: unknown;
}
