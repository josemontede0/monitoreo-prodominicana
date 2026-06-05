'use client';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';

export interface MonitorService {
  id: number;
  name: string;
  url: string;
  interval: number;
  status: 'up' | 'down' | 'checking';
  response: number | null;
  uptime: number;
  downSince: string | null;
  history: string[];
  privateIp: string | null;
  notes: string | null;
}

export interface Alert {
  id: number;
  service: string;
  type: 'up' | 'down';
  time: string;
}

export interface User {
  username: string;
  name: string;
  email: string;
  department: string;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('monitor_token');
}

function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('monitor_user') ?? 'null'); } catch { return null; }
}

export function useMonitor() {
  const [services, setServices] = useState<MonitorService[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const authFetch = async (url: string, opts: RequestInit = {}) => {
    const token = getToken();
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers ?? {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
    });
    if (res.status === 401) {
      localStorage.removeItem('monitor_token');
      localStorage.removeItem('monitor_user');
      router.push('/login');
    }
    return res;
  };

  const logout = () => {
    localStorage.removeItem('monitor_token');
    localStorage.removeItem('monitor_user');
    document.cookie = 'monitor_token=; Max-Age=0; path=/';
    router.push('/login');
  };

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setUser(getUser());
    document.cookie = 'monitor_token=' + token + '; path=/; SameSite=Strict';

    authFetch('http://localhost:4000/api/services').then(r => r.json()).then(setServices).catch(() => {});
    authFetch('http://localhost:4000/api/monitor/alerts').then(r => r.json()).then(setAlerts).catch(() => {});

    const socket: Socket = io('http://localhost:4000');
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('monitor', (data: any) => {
      if (data.type === 'update') { setServices(data.services); setAlerts(data.alerts); }
      if (data.type === 'alert' && data.service?.status === 'down') {
        new Audio('/alert.mp3').play().catch(() => {});
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  const addService = async (name: string, url: string, interval: number) => {
    const res = await authFetch('http://localhost:4000/api/services', {
      method: 'POST',
      body: JSON.stringify({ name, url, interval }),
    });
    return res.json();
  };

  const removeService = async (id: number) => {
    await authFetch('http://localhost:4000/api/services/' + id, { method: 'DELETE' });
    setServices(prev => prev.filter(s => s.id !== id));
  };

  const checkNow = async () => {
    await authFetch('http://localhost:4000/api/monitor/check', { method: 'POST' });
  };

  return { services, alerts, connected, user, logout, addService, removeService, checkNow };
}