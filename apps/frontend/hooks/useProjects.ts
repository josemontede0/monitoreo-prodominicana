'use client';
import { useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ProjectStatus = 'planificado' | 'en_curso' | 'en_pausa' | 'terminado' | 'cancelado';

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
  progress: number;
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
