'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useMonitor } from '../hooks/useMonitor';
import { Plus, Trash2, RefreshCw, Wifi, WifiOff, CheckCircle, XCircle, Clock, Bell, ChevronRight, LogOut, User } from 'lucide-react';

export default function Home() {
  const { services, alerts, connected, user, logout, addService, removeService, checkNow } = useMonitor();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', interval: 60 });
  const [activeTab, setActiveTab] = useState('services');
  const router = useRouter();

  const total = services.length;
  const online = services.filter(s => s.status === 'up').length;
  const caidos = services.filter(s => s.status === 'down').length;
  const avgUptime = total > 0 ? (services.reduce((a, s) => a + s.uptime, 0) / total).toFixed(1) : '100.0';

  const handleAdd = async () => {
    if (!form.name || !form.url) return;
    await addService(form.name, form.url, form.interval);
    setForm({ name: '', url: '', interval: 60 });
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/favicon.png" alt="ProDominicana" width={40} height={40} className="rounded-lg" />
            <div>
              <h1 className="text-xl font-bold text-white">MonitoreoApp ProDominicana</h1>
              <p className="text-xs text-gray-400">Sistema de monitoreo en tiempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${connected ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
              {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {connected ? 'En vivo' : 'Desconectado'}
            </div>
            {user && (
              <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
                <User className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-300">{user.name || user.username}</span>
                {user.department && <span className="text-xs text-gray-500">— {user.department}</span>}
              </div>
            )}
            <button onClick={checkNow} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition">
              <RefreshCw className="w-4 h-4" /> Verificar
            </button>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition">
              <Plus className="w-4 h-4" /> Agregar
            </button>
            <button onClick={logout} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-2 rounded-lg text-sm transition border border-gray-700">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total servicios', value: total, color: 'text-white' },
            { label: 'En linea', value: online, color: 'text-green-400' },
            { label: 'Caidos', value: caidos, color: 'text-red-400' },
            { label: 'Uptime promedio', value: avgUptime + '%', color: 'text-blue-400' },
          ].map((m, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-6">
              <p className="text-gray-400 text-sm mb-1">{m.label}</p>
              <p className={`text-3xl font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('services')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'services' ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Servicios</button>
          <button onClick={() => setActiveTab('alerts')} className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'alerts' ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            <Bell className="w-4 h-4" /> Alertas {alerts.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2">{alerts.length}</span>}
          </button>
        </div>

        {activeTab === 'services' && (
          <div className="grid gap-4">
            {services.map(s => (
              <div key={s.id} onClick={() => router.push('/services/' + s.id)} className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-red-700 transition cursor-pointer group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {s.status === 'up' && <CheckCircle className="w-5 h-5 text-green-400" />}
                    {s.status === 'down' && <XCircle className="w-5 h-5 text-red-400" />}
                    {s.status === 'checking' && <Clock className="w-5 h-5 text-yellow-400 animate-spin" />}
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-red-400 transition">{s.name}</h3>
                      <p className="text-xs text-gray-400">{s.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Uptime</p>
                      <p className={`font-bold ${s.uptime >= 99 ? 'text-green-400' : s.uptime >= 90 ? 'text-yellow-400' : 'text-red-400'}`}>{s.uptime}%</p>
                    </div>
                    {s.response && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Respuesta</p>
                        <p className={`font-bold ${s.response < 500 ? 'text-green-400' : s.response < 1000 ? 'text-yellow-400' : 'text-red-400'}`}>{s.response}ms</p>
                      </div>
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.status === 'up' ? 'bg-green-900 text-green-300' : s.status === 'down' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'}`}>
                      {s.status === 'up' ? 'EN LINEA' : s.status === 'down' ? 'CAIDO' : 'VERIFICANDO'}
                    </span>
                    <button onClick={e => { e.stopPropagation(); removeService(s.id); }} className="text-gray-600 hover:text-red-400 transition"><Trash2 className="w-4 h-4" /></button>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-red-400 transition" />
                  </div>
                </div>
                <div className="flex gap-1 mt-2">
                  {(s.history.length > 0 ? s.history : Array(10).fill('checking')).map((h, i) => (
                    <div key={i} className={`h-2 flex-1 rounded-full ${h === 'up' ? 'bg-green-500' : h === 'down' ? 'bg-red-500' : 'bg-gray-700'}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="grid gap-3">
            {alerts.length === 0 && <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">No hay alertas registradas</div>}
            {alerts.map(a => (
              <div key={a.id} className={`flex items-center gap-4 p-4 rounded-xl border ${a.type === 'down' ? 'bg-red-950 border-red-800' : 'bg-green-950 border-green-800'}`}>
                {a.type === 'down' ? <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />}
                <div className="flex-1">
                  <p className="font-medium text-white">{a.service}</p>
                  <p className="text-xs text-gray-400">{new Date(a.time).toLocaleString('es-DO')}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${a.type === 'down' ? 'bg-red-800 text-red-200' : 'bg-green-800 text-green-200'}`}>
                  {a.type === 'down' ? 'CAIDO' : 'RECUPERADO'}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-lg font-bold text-white mb-4">Agregar servicio</h2>
            <div className="grid gap-3">
              <input className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700 focus:border-red-500" placeholder="Nombre del servicio" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <input className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700 focus:border-red-500" placeholder="URL (https://...)" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />
              <select className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700" value={form.interval} onChange={e => setForm(p => ({ ...p, interval: Number(e.target.value) }))}>
                <option value={30}>Cada 30 segundos</option>
                <option value={60}>Cada 1 minuto</option>
                <option value={300}>Cada 5 minutos</option>
                <option value={600}>Cada 10 minutos</option>
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition">Cancelar</button>
              <button onClick={handleAdd} className="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 rounded-lg transition font-semibold">Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}