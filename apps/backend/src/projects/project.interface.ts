export type ProjectStatus =
  | "planificado"
  | "en_curso"
  | "en_pausa"
  | "terminado"
  | "cancelado";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "planificado",
  "en_curso",
  "en_pausa",
  "terminado",
  "cancelado",
];

export interface Project {
  id: number;
  name: string;
  description: string | null;
  serviceIds: number[];
  assignedTo: string;
  status: ProjectStatus;
  progress: number;
  createdAt: string;
}

export interface ProjectInput {
  name?: unknown;
  description?: unknown;
  serviceIds?: unknown;
  assignedTo?: unknown;
  status?: unknown;
  progress?: unknown;
}
