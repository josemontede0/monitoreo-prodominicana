'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import type { MonitorService } from '../hooks/useMonitor';
import type { Project, ProjectInput, ProjectStatus, useProjects } from '../hooks/useProjects';

type ProjectsTabProps = ReturnType<typeof useProjects> & { services: MonitorService[] };

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planificado: 'Planificado',
  en_curso: 'En curso',
  en_pausa: 'En pausa',
  terminado: 'Terminado',
  cancelado: 'Cancelado',
};

const STATUS_CLASS: Record<ProjectStatus, string> = {
  planificado: 'bg-gray-800 text-gray-300',
  en_curso: 'bg-blue-900 text-blue-300',
  en_pausa: 'bg-yellow-900 text-yellow-300',
  terminado: 'bg-green-900 text-green-300',
  cancelado: 'bg-red-900 text-red-300',
};

const GROUPS: { key: string; label: string; statuses: ProjectStatus[] }[] = [
  { key: 'actuales', label: 'Actuales', statuses: ['en_curso', 'en_pausa'] },
  { key: 'futuros', label: 'Futuros', statuses: ['planificado'] },
  { key: 'pasados', label: 'Pasados', statuses: ['terminado', 'cancelado'] },
];

const EMPTY_FORM: ProjectInput = {
  name: '',
  description: '',
  serviceIds: [],
  assignedTo: '',
  status: 'planificado',
  progress: 0,
};

function progressBarClass(progress: number) {
  if (progress >= 67) return 'bg-green-500';
  if (progress >= 34) return 'bg-yellow-500';
  return 'bg-red-500';
}

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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    actuales: true,
    futuros: false,
    pasados: false,
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProjectInput>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [saving, setSaving] = useState(false);

  const userName = (username: string) =>
    users.find(u => u.username === username)?.name ?? username;

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, assignedTo: users[0]?.username ?? '' });
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
      progress: project.progress,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleRemove = async (id: number) => {
    setDeleteError('');
    try {
      await removeProject(id);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'No se pudo borrar el proyecto');
    }
  };

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
    setSaving(true);
    setFormError('');
    try {
      if (editingId === null) await addProject(form);
      else await updateProject(editingId, form);
      // El grupo que recibe el proyecto se abre, para que el guardado se vea.
      // Sin esto, crear con el estado por defecto lo manda a Futuros, que arranca
      // colapsado, y la pantalla no muestra ninguna senal de que se guardo.
      const group = GROUPS.find(g => g.statuses.includes(form.status));
      if (group) setOpenGroups(prev => ({ ...prev, [group.key]: true }));
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

      {deleteError && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-4 text-sm text-red-200">
          {deleteError}
        </div>
      )}

      {projects.length === 0 && (
        <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
          No hay proyectos registrados
        </div>
      )}

      {projects.length > 0 &&
        GROUPS.map(group => {
          const grouped = projects.filter(p => group.statuses.includes(p.status));
          const isOpen = openGroups[group.key];
          return (
            <div key={group.key} className="mb-4">
              <button
                onClick={() => setOpenGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                className="w-full flex items-center gap-2 text-left text-sm font-semibold text-gray-300 hover:text-white transition mb-2"
              >
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {group.label}
                <span className="text-gray-500 font-normal">({grouped.length})</span>
              </button>

              {isOpen && grouped.length === 0 && (
                <p className="text-xs text-gray-600 pl-6 pb-2">Sin proyectos en este grupo</p>
              )}

              {isOpen &&
                grouped.map(project => (
                  <div key={project.id} className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-red-700 transition mb-3">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate">{project.name}</h3>
                        {project.description && (
                          <p className="text-xs text-gray-400 mt-1">{project.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">Responsable: {userName(project.assignedTo)}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_CLASS[project.status]}`}>
                          {STATUS_LABEL[project.status]}
                        </span>
                        <button onClick={() => openEdit(project)} className="text-gray-600 hover:text-white transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleRemove(project.id)} className="text-gray-600 hover:text-red-400 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${progressBarClass(project.progress)}`} style={{ width: project.progress + '%' }} />
                      </div>
                      <span className="text-xs font-bold text-gray-300 w-10 text-right">{project.progress}%</span>
                    </div>

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
            </div>
          );
        })}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 max-h-full overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-4">
              {editingId === null ? 'Nuevo proyecto' : 'Editar proyecto'}
            </h2>

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

              <select
                className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700"
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as ProjectStatus }))}
              >
                {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map(status => (
                  <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                ))}
              </select>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">Progreso</label>
                  <span className="text-xs font-bold text-gray-300">{form.progress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  className="w-full accent-red-600"
                  value={form.progress}
                  onChange={e => setForm(p => ({ ...p, progress: Number(e.target.value) }))}
                />
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
      )}
    </div>
  );
}
