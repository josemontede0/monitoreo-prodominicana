'use client';
import { useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ProjectStatus = 'iniciado' | 'en_curso' | 'en_pausa';

// Presentacion compartida por la lista (ProjectsTab) y la pantalla de detalle,
// para que no haya dos tablas de etiquetas que se desincronicen.
export const STATUS_LABEL: Record<ProjectStatus, string> = {
  iniciado: 'Iniciado',
  en_curso: 'En curso',
  en_pausa: 'En pausa',
};

export const STATUS_CLASS: Record<ProjectStatus, string> = {
  iniciado: 'bg-gray-800 text-gray-300',
  en_curso: 'bg-blue-900 text-blue-300',
  en_pausa: 'bg-yellow-900 text-yellow-300',
};

// AAAA-MM-DD se descompone a mano a proposito: new Date('2026-10-12') se interpreta
// como UTC y en nuestro huso acaba mostrando el dia anterior.
export function formatFecha(ymd: string, largo = false) {
  const [anio, mes, dia] = ymd.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: largo ? 'long' : 'short',
    year: 'numeric',
  });
}

export function rangoDeFechas(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return null;
  const inicio = startDate ? formatFecha(startDate) : 'sin inicio';
  const fin = endDate ? formatFecha(endDate) : 'sin fin';
  return inicio + ' - ' + fin;
}

export function progressOf(modules: { done: boolean }[]) {
  if (modules.length === 0) return 0;
  return Math.round((modules.filter(m => m.done).length / modules.length) * 100);
}

export function progressBarClass(progress: number) {
  if (progress >= 67) return 'bg-green-500';
  if (progress >= 34) return 'bg-yellow-500';
  return 'bg-red-500';
}

// Mismos cortes que la barra, en el tono claro que necesita el texto sobre gris oscuro.
export function progressTextClass(progress: number) {
  if (progress >= 67) return 'text-green-400';
  if (progress >= 34) return 'text-yellow-400';
  return 'text-red-400';
}

export interface ProjectModule {
  id: number;
  name: string;
  done: boolean;
  // Usuarios responsables del modulo; admite varios.
  assignedTo: string[];
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  serviceIds: number[];
  assignedTo: string;
  status: ProjectStatus;
  // Fechas de calendario en AAAA-MM-DD. null = sin fijar.
  startDate: string | null;
  endDate: string | null;
  modules: ProjectModule[];
  // Lo calcula el backend a partir de los modulos marcados.
  progress: number;
  createdAt: string;
}

export interface AssignableUser {
  username: string;
  name: string;
  email: string;
  department: string;
}

export interface ProjectInput {
  name: string;
  description: string;
  serviceIds: number[];
  assignedTo: string;
  status: ProjectStatus;
  // Cadena vacia = sin fecha, que es lo que devuelve un <input type="date"> vacio.
  startDate: string;
  endDate: string;
  modules: { name: string; done: boolean; assignedTo: string[] }[];
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    let token: string | null = null;
    try {
      token = localStorage.getItem('monitor_token');
    } catch {}
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers ?? {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
    });
    if (!res.ok) {
      let message = 'HTTP ' + res.status;
      try {
        const body = await res.json();
        if (body?.message) message = String(body.message);
      } catch {}
      throw new Error(message);
    }
    return res;
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [projectsRes, usersRes] = await Promise.all([
        authFetch(API + '/api/projects'),
        authFetch(API + '/api/auth/users'),
      ]);
      setProjects(await projectsRes.json());
      setUsers(await usersRes.json());
    } catch {
      setError('No se pudo cargar los proyectos');
    }
    setLoading(false);
  }, [authFetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addProject = async (input: ProjectInput) => {
    const res = await authFetch(API + '/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const created: Project = await res.json();
    setProjects(prev => [...prev, created]);
  };

  const updateProject = async (id: number, input: ProjectInput) => {
    const res = await authFetch(API + '/api/projects/' + id, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    // El backend responde 200 con cuerpo vacio cuando el id ya no existe, porque
    // el controlador devuelve null. res.json() sobre un cuerpo vacio lanza
    // "Unexpected end of JSON input", que no le dice nada al usuario.
    const text = await res.text();
    if (!text) {
      await reload();
      throw new Error('El proyecto ya no existe. Se actualizo la lista.');
    }
    const saved: Project = JSON.parse(text);
    setProjects(prev => prev.map(p => (p.id === id ? saved : p)));
  };

  const removeProject = async (id: number) => {
    await authFetch(API + '/api/projects/' + id, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  return { projects, users, loading, error, reload, addProject, updateProject, removeProject };
}
