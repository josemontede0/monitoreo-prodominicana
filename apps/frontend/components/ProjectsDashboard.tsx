'use client';
import type { Project, ProjectStatus } from '../hooks/useProjects';
import {
  STATUS_LABEL,
  progressBarClass,
  progressOf,
  progressTextClass,
} from '../hooks/useProjects';

// Tarjetas de resumen, en el mismo orden en que avanza un proyecto.
const RESUMEN: { status: ProjectStatus; color: string }[] = [
  { status: 'iniciado', color: 'text-gray-300' },
  { status: 'en_curso', color: 'text-blue-400' },
  { status: 'en_pausa', color: 'text-yellow-400' },
];

export default function ProjectsDashboard({ projects }: { projects: Project[] }) {
  // El avance general se pesa por modulos, no por el promedio de los porcentajes:
  // un proyecto de 12 modulos no deberia contar igual que uno de 2.
  const todosLosModulos = projects.flatMap(p => p.modules ?? []);
  const modulosHechos = todosLosModulos.filter(m => m.done).length;
  const avanceGeneral = progressOf(todosLosModulos);
  const alCien = projects.filter(p => p.progress === 100).length;

  return (
    <div className="mb-8">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-1">Total proyectos</p>
          <p className="text-3xl font-bold text-white">{projects.length}</p>
        </div>
        {RESUMEN.map(({ status, color }) => (
          <div key={status} className="bg-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">{STATUS_LABEL[status]}</p>
            <p className={`text-3xl font-bold ${color}`}>
              {projects.filter(p => p.status === status).length}
            </p>
          </div>
        ))}
      </div>

      {/* Sin modulos no hay razon que medir, y los textos quedarian en "0 de 0". */}
      {todosLosModulos.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6 mt-4">
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <p className="text-gray-400 text-sm mb-1">Avance general</p>
              <p className={`text-3xl font-bold ${progressTextClass(avanceGeneral)}`}>{avanceGeneral}%</p>
            </div>
            <div className="text-xs text-gray-400 text-right">
              <p>{modulosHechos} de {todosLosModulos.length} modulos completados</p>
              <p>{alCien} de {projects.length} proyectos al 100%</p>
            </div>
          </div>
          <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressBarClass(avanceGeneral)}`}
              style={{ width: avanceGeneral + '%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
