'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  FolderKanban,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type { AssignableUser, Project } from '../../../hooks/useProjects';
import {
  STATUS_CLASS,
  STATUS_LABEL,
  formatFecha,
  progressBarClass,
  progressTextClass,
} from '../../../hooks/useProjects';
import type { MonitorService } from '../../../hooks/useMonitor';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function getToken() {
  try {
    return localStorage.getItem('monitor_token');
  } catch {
    return null;
  }
}

function fecha(iso: string) {
  return new Date(iso).toLocaleString('es-DO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProjectDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [services, setServices] = useState<MonitorService[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [noExiste, setNoExiste] = useState(false);

  const cargar = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    const cabeceras = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
    try {
      const [resProyecto, resServicios, resUsuarios] = await Promise.all([
        fetch(API + '/api/projects/' + id, { headers: cabeceras }),
        fetch(API + '/api/services', { headers: cabeceras }),
        fetch(API + '/api/auth/users', { headers: cabeceras }),
      ]);
      // El backend responde 200 con cuerpo vacio cuando el id no existe, porque el
      // controlador devuelve null. Sin este rodeo, res.json() lanza un error que no
      // le dice nada al usuario.
      const texto = await resProyecto.text();
      if (!texto || texto === 'null') setNoExiste(true);
      else setProject(JSON.parse(texto));
      setServices(await resServicios.json());
      setUsers(await resUsuarios.json());
    } catch {
      setNoExiste(true);
    }
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    // La carga inicial es justo la sincronizacion con un sistema externo para la
    // que existe useEffect. La regla persigue los setState en cascada, no un fetch
    // cuyo setState ocurre despues del await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // Los servicios ligados muestran estado en vivo, asi que se refresca igual que
    // la pantalla de detalle de un servicio.
    const t = setInterval(cargar, 10000);
    return () => clearInterval(t);
  }, [cargar]);

  const nombreUsuario = (username: string) =>
    users.find(u => u.username === username)?.name ?? username;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 flex items-center gap-3">
          <Clock className="w-5 h-5 animate-spin" /> Cargando...
        </div>
      </div>
    );
  }

  if (noExiste || !project) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Proyecto no encontrado</p>
        <button
          onClick={() => router.push('/?tab=projects')}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition"
        >
          Volver al panel
        </button>
      </div>
    );
  }

  const modules = project.modules ?? [];
  const hechos = modules.filter(m => m.done).length;
  const ligados = project.serviceIds
    .map(sid => ({ id: sid, service: services.find(s => s.id === sid) }))
    .filter(x => x.service);
  const sinAsignar = modules.filter(m => (m.assignedTo ?? []).length === 0).length;

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => router.push('/?tab=projects')}
              className="text-gray-400 hover:text-white transition flex items-center gap-2 flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" /> Volver
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-red-700 p-2 rounded-lg flex-shrink-0">
                <FolderKanban className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-white truncate">{project.name}</h1>
                <p className="text-xs text-gray-400">
                  Responsable: {nombreUsuario(project.assignedTo)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_CLASS[project.status]}`}>
              {STATUS_LABEL[project.status]}
            </span>
            <button
              onClick={cargar}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition"
            >
              <RefreshCw className="w-4 h-4" /> Actualizar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Avance',
              value: project.progress + '%',
              color: progressTextClass(project.progress),
            },
            { label: 'Modulos completados', value: hechos + ' de ' + modules.length, color: 'text-white' },
            { label: 'Modulos sin asignar', value: String(sinAsignar), color: sinAsignar > 0 ? 'text-yellow-400' : 'text-green-400' },
            { label: 'Servicios ligados', value: String(ligados.length), color: 'text-blue-400' },
          ].map(m => (
            <div key={m.label} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-xs mb-1">{m.label}</p>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
          <div className="flex items-end justify-between gap-4 mb-3">
            <p className="text-gray-400 text-sm">Avance del proyecto</p>
            <p className={`text-sm font-bold ${progressTextClass(project.progress)}`}>{project.progress}%</p>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressBarClass(project.progress)}`}
              style={{ width: project.progress + '%' }}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
            <span>
              Inicio:{' '}
              <span className="text-gray-300">
                {project.startDate ? formatFecha(project.startDate, true) : 'sin fijar'}
              </span>
            </span>
            <span>
              Finalizacion:{' '}
              <span className="text-gray-300">
                {project.endDate ? formatFecha(project.endDate, true) : 'sin fijar'}
              </span>
            </span>
            <span>Creado el {fecha(project.createdAt)}</span>
          </div>
        </div>

        {project.description && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
            <p className="text-gray-400 text-xs mb-2">Descripcion</p>
            <p className="text-sm text-gray-200 whitespace-pre-line">{project.description}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-gray-900 rounded-xl border border-gray-800">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Modulos</h2>
              <span className="text-xs text-gray-500">{hechos} de {modules.length} completados</span>
            </div>
            {modules.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-gray-500">Este proyecto no tiene modulos</p>
            )}
            <div className="divide-y divide-gray-800">
              {modules.map(modulo => (
                <div key={modulo.id} className="px-6 py-3 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    {modulo.done ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                    )}
                    <p className={`text-sm ${modulo.done ? 'text-gray-400 line-through' : 'text-white'}`}>
                      {modulo.name}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1 flex-shrink-0 max-w-[50%]">
                    {(modulo.assignedTo ?? []).length === 0 ? (
                      <span className="text-xs text-gray-600 italic">sin asignar</span>
                    ) : (
                      (modulo.assignedTo ?? []).map(username => (
                        <span
                          key={username}
                          className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-full border border-gray-700"
                        >
                          {nombreUsuario(username)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 h-fit">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">Servicios ligados</h2>
            </div>
            {ligados.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-gray-500">Sin servicios ligados</p>
            )}
            <div className="divide-y divide-gray-800">
              {ligados.map(({ id: sid, service }) => (
                <button
                  key={sid}
                  onClick={() => router.push('/services/' + sid)}
                  className="w-full px-6 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-800 transition group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {service!.status === 'up' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : service!.status === 'down' ? (
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    )}
                    <span className="text-sm text-gray-200 truncate group-hover:text-white transition">
                      {service!.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {service!.response ? service!.response + 'ms' : '-'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
