'use client';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';

const API = 'http://192.168.0.239:4000';

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

export function useMonitor() {
  const [services, setServices] = useState<MonitorService[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  const getToken = () => {
    try { return localStorage.getItem('monitor_token'); } catch { return null; }
  };

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
    return res;
  };

  const logout = () => {
    try { localStorage.removeItem('monitor_token'); localStorage.removeItem('monitor_user'); } catch {}
    router.push('/login');
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const u = JSON.parse(localStorage.getItem('monitor_user') ?? 'null');
      setUser(u);
    } catch {}

    setReady(true);

    authFetch(API + '/api/services').then(r => r.json()).then(setServices).catch(() => {});
    authFetch(API + '/api/monitor/alerts').then(r => r.json()).then(setAlerts).catch(() => {});

    const socket: Socket = io(API);
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
    const res = await authFetch(API + '/api/services', { method: 'POST', body: JSON.stringify({ name, url, interval }) });
    return res.json();
  };

  const removeService = async (id: number) => {
    await authFetch(API + '/api/services/' + id, { method: 'DELETE' });
    setServices(prev => prev.filter(s => s.id !== id));
  };

  const checkNow = async () => {
    await authFetch(API + '/api/monitor/check', { method: 'POST' });
  };

  return { services, alerts, connected, user, ready, logout, addService, removeService, checkNow };
}