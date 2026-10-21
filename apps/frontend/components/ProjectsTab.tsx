'use client';
import { useState } from 'react';
import { Calendar, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { MonitorService } from '../hooks/useMonitor';
import { useRouter } from 'next/navigation';
import type { Project, ProjectInput, ProjectStatus, useProjects } from '../hooks/useProjects';
import {
  STATUS_CLASS,
  STATUS_LABEL,
  progressBarClass,
  progressOf,
  rangoDeFechas,
} from '../hooks/useProjects';

type ProjectsTabProps = ReturnType<typeof useProjects> & { services: MonitorService[] };

// Los mismos siete que aplica el backend cuando se crea un proyecto sin modulos.
// Se repiten aqui para que el formulario de alta los muestre y se puedan ajustar
// antes de guardar.
const DEFAULT_MODULE_NAMES = [
  'Levantamiento de requerimientos',
  'Diseno',
  'Desarrollo',
  'Pruebas',
  'Documentacion',
  'Despliegue',
  'Capacitacion',
];

const EMPTY_FORM: ProjectInput = {
  name: '',
  description: '',
  serviceIds: [],
  assignedTo: '',
  status: 'iniciado',
  startDate: '',
  endDate: '',
  modules: DEFAULT_MODULE_NAMES.map(name => ({ name, done: false, assignedTo: [] })),
};

function serviceDotClass(status: MonitorService['status'] | undefined) {
  if (status === 'up') return 'bg-green-500';
  if (status === 'down') return 'bg-red-500';
  return 'bg-gray-600';
}

export default function ProjectsTab({
  services,
  projects,
  users,
  loading,
  error,
  reload,
  addProject,
  updateProject,
  removeProject,
}: ProjectsTabProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProjectInput>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  const userName = (username: string) =>
    users.find(u => u.username === username)?.name ?? username;

  const iniciales = (username: string) =>
    userName(username)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(palabra => palabra[0])
      .join('')
      .toUpperCase();

  // Quien participa en el proyecto, sin repetir, mirando todos sus modulos.
  const personasDe = (project: Project) =>
    Array.from(new Set((project.modules ?? []).flatMap(m => m.assignedTo ?? [])));

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      assignedTo: users[0]?.username ?? '',
      modules: EMPTY_FORM.modules.map(m => ({ ...m, assignedTo: [] })),
    });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (project: Project) => {
    setEditingId(project.id);
    setForm({
      name: project.name,
      description: project.description ?? '',
      serviceIds: project.serviceIds,
      assignedTo: project.assignedTo,
      status: project.status,
      startDate: project.startDate ?? '',
      endDate: project.endDate ?? '',
      modules: (project.modules ?? []).map(m => ({
        name: m.name,
        done: m.done,
        assignedTo: [...(m.assignedTo ?? [])],
      })),
    });
    setFormError('');
    setShowForm(true);
  };

  const handleRemove = async (id: number) => {
    setActionError('');
    try {
      await removeProject(id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo borrar el proyecto');
    }
  };

  const addModule = () =>
    setForm(p => ({ ...p, modules: [...p.modules, { name: '', done: false, assignedTo: [] }] }));

  const assignPerson = (index: number, username: string) =>
    setForm(p => ({
      ...p,
      modules: p.modules.map((m, i) =>
        i === index && !m.assignedTo.includes(username)
          ? { ...m, assignedTo: [...m.assignedTo, username] }
          : m,
      ),
    }));

  const unassignPerson = (index: number, username: string) =>
    setForm(p => ({
      ...p,
      modules: p.modules.map((m, i) =>
        i === index ? { ...m, assignedTo: m.assignedTo.filter(u => u !== username) } : m,
      ),
    }));

  const renameModule = (index: number, name: string) =>
    setForm(p => ({
      ...p,
      modules: p.modules.map((m, i) => (i === index ? { ...m, name } : m)),
    }));

  const toggleModule = (index: number) =>
    setForm(p => ({
      ...p,
      modules: p.modules.map((m, i) => (i === index ? { ...m, done: !m.done } : m)),
    }));

  const removeModule = (index: number) =>
    setForm(p => ({ ...p, modules: p.modules.filter((_, i) => i !== index) }));

  const toggleServiceId = (id: number) => {
    setForm(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(id)
        ? prev.serviceIds.filter(s => s !== id)
        : [...prev.serviceIds, id],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('El nombre del proyecto es obligatorio');
      return;
    }
    if (!form.assignedTo) {
      setFormError('Selecciona un responsable');
      return;
    }
    if (form.modules.some(m => !m.name.trim())) {
      setFormError('Todos los modulos necesitan un nombre');
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setFormError('La fecha de finalizacion no puede ser anterior a la de inicio');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId === null) await addProject(form);
      else await updateProject(editingId, form);
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo guardar el proyecto');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">Cargando proyectos...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-950 border border-red-800 rounded-xl p-6 flex items-center justify-between">
        <p className="text-red-200">{error}</p>
        <button onClick={reload} className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition">
          <Plus className="w-4 h-4" /> Nuevo proyecto
        </button>
      </div>

      {actionError && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-4 text-sm text-red-200">
          {actionError}
        </div>
      )}

      {projects.length === 0 && (
        <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
          No hay proyectos registrados
        </div>
      )}

      {projects.map(project => (
        <div
          key={project.id}
          onClick={() => router.push('/projects/' + project.id)}
          className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-red-700 transition mb-3 cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-white truncate group-hover:text-red-400 transition">{project.name}</h3>
              {project.description && (
                <p className="text-xs text-gray-400 mt-1">{project.description}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Responsable: {userName(project.assignedTo)}</p>
              {rangoDeFechas(project.startDate, project.endDate) && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {rangoDeFechas(project.startDate, project.endDate)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`inline-block w-28 text-center px-3 py-1 rounded-full text-xs font-bold ${STATUS_CLASS[project.status]}`}>
                {STATUS_LABEL[project.status]}
              </span>
              <button
                onClick={e => { e.stopPropagation(); openEdit(project); }}
                className="text-gray-600 hover:text-white transition"
                aria-label={'Editar ' + project.name}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleRemove(project.id); }}
                className="text-gray-600 hover:text-red-400 transition"
                aria-label={'Borrar ' + project.name}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-red-400 transition" />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${progressBarClass(project.progress)}`} style={{ width: project.progress + '%' }} />
            </div>
            <span className="text-xs font-bold text-gray-300 w-10 text-right">{project.progress}%</span>
          </div>

          {(project.modules?.length ?? 0) > 0 && (
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs text-gray-500">
                {project.modules.filter(m => m.done).length} de {project.modules.length} modulos completados
              </p>
              {personasDe(project).length > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {personasDe(project).map(username => (
                    <span
                      key={username}
                      title={userName(username)}
                      className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 text-[10px] font-bold text-gray-300 flex items-center justify-center"
                    >
                      {iniciales(username)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {project.serviceIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {project.serviceIds.map(id => {
                const service = services.find(s => s.id === id);
                return (
                  <span key={id} className="flex items-center gap-2 bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-lg border border-gray-700">
                    <span className={`w-2 h-2 rounded-full ${serviceDotClass(service?.status)}`} />
                    {service?.name ?? 'Servicio ' + id}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          {/* Columna flex en vez de un panel con scroll: asi la cabecera se queda
              fija arriba y la X sigue a mano por muy abajo que se baje. */}
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-700 max-h-full flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 shrink-0">
              <h2 className="text-lg font-bold text-white">
                {editingId === null ? 'Nuevo proyecto' : 'Editar proyecto'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                aria-label="Cerrar"
                title="Cerrar"
                className="-mr-2 -mt-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg p-1.5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* min-h-0 es imprescindible: en una columna flex los hijos tienen
                min-height:auto y sin esto el cuerpo creceria en vez de desplazarse. */}
            <div className="overflow-y-auto min-h-0 px-6 pb-6">
            <div className="grid gap-3">
              <input
                className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700 focus:border-red-500"
                placeholder="Nombre del proyecto"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />

              <textarea
                className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700 focus:border-red-500 resize-none"
                rows={3}
                placeholder="Descripcion (opcional)"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />

              <select
                className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700"
                value={form.assignedTo}
                onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))}
              >
                <option value="">Selecciona un responsable</option>
                {users.map(u => (
                  <option key={u.username} value={u.username}>{u.name}</option>
                ))}
              </select>

              <div>
                <label className="text-xs text-gray-400">Estado</label>
                <select
                  className="mt-1 w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700"
                  value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value as ProjectStatus }))}
                >
                  {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map(status => (
                    <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Fecha de inicio</label>
                  <input
                    type="date"
                    className="mt-1 w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none border border-gray-700 focus:border-red-500 [color-scheme:dark]"
                    value={form.startDate}
                    onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Fecha de finalizacion</label>
                  <input
                    type="date"
                    // El calendario del navegador ya no deja elegir un dia anterior al inicio.
                    min={form.startDate || undefined}
                    className="mt-1 w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none border border-gray-700 focus:border-red-500 [color-scheme:dark]"
                    value={form.endDate}
                    onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">Modulos</label>
                  {/* El progreso no se teclea: es el reflejo de los modulos marcados. */}
                  <span className="text-xs font-bold text-gray-300">
                    {progressOf(form.modules)}% ({form.modules.filter(m => m.done).length}/{form.modules.length})
                  </span>
                </div>

                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${progressBarClass(progressOf(form.modules))}`}
                    style={{ width: progressOf(form.modules) + '%' }}
                  />
                </div>

                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {form.modules.length === 0 && (
                    <p className="text-xs text-gray-600">Sin modulos: el progreso se queda en 0%.</p>
                  )}
                  {form.modules.map((modulo, index) => {
                    const libres = users.filter(u => !modulo.assignedTo.includes(u.username));
                    return (
                      <div key={index} className="bg-gray-800 rounded-lg border border-gray-700 p-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="accent-red-600 flex-shrink-0"
                            checked={modulo.done}
                            onChange={() => toggleModule(index)}
                            aria-label={'Marcar ' + (modulo.name || 'modulo sin nombre')}
                          />
                          <input
                            className="flex-1 min-w-0 bg-gray-900 text-white rounded-lg px-3 py-1 text-sm outline-none border border-gray-700 focus:border-red-500"
                            placeholder="Nombre del modulo"
                            value={modulo.name}
                            onChange={e => renameModule(index, e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => removeModule(index)}
                            className="text-gray-600 hover:text-red-400 transition flex-shrink-0"
                            aria-label={'Borrar ' + (modulo.name || 'modulo sin nombre')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1 mt-2 pl-6">
                          {modulo.assignedTo.map(username => (
                            <span
                              key={username}
                              className="flex items-center gap-1 bg-gray-700 text-gray-200 text-xs pl-2 pr-1 py-0.5 rounded-full"
                            >
                              {userName(username)}
                              <button
                                type="button"
                                onClick={() => unassignPerson(index, username)}
                                className="text-gray-400 hover:text-red-400 transition"
                                aria-label={'Quitar a ' + userName(username)}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          {libres.length > 0 && (
                            <select
                              value=""
                              onChange={e => e.target.value && assignPerson(index, e.target.value)}
                              className="bg-gray-900 text-gray-400 text-xs rounded-full px-2 py-0.5 border border-gray-700 outline-none cursor-pointer"
                              aria-label={'Asignar a ' + (modulo.name || 'modulo sin nombre')}
                            >
                              <option value="">+ Asignar</option>
                              {libres.map(u => (
                                <option key={u.username} value={u.username}>{u.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addModule}
                  className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-white transition"
                >
                  <Plus className="w-3 h-3" /> Agregar modulo
                </button>
              </div>

              <div>
                <label className="text-xs text-gray-400">Servicios ligados</label>
                <div className="mt-2 grid gap-2 max-h-40 overflow-y-auto">
                  {services.length === 0 && <p className="text-xs text-gray-600">No hay servicios monitoreados</p>}
                  {services.map(service => (
                    <label key={service.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-red-600"
                        checked={form.serviceIds.includes(service.id)}
                        onChange={() => toggleServiceId(service.id)}
                      />
                      {service.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {formError && <p className="text-red-400 text-sm mt-3">{formError}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white py-2 rounded-lg transition font-semibold">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
