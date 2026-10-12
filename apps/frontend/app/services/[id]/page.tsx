'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock, Activity, Shield, ShieldAlert, MapPin, Server, Edit2, Save, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface CheckLog {
  timestamp: string;
  status: 'up' | 'down';
  response: number | null;
  httpCode: number | null;
}

interface MonitorService {
  id: number;
  name: string;
  url: string;
  status: 'up' | 'down' | 'checking';
  response: number | null;
  uptime: number;
  downSince: string | null;
  history: string[];
  logs: CheckLog[];
  privateIp: string | null;
  notes: string | null;
}

interface ServerInfo {
  hostname: string;
  port: number;
  protocol: string;
  ip: { address: string; family: string; rdns: string | null } | null;
  ssl: { valid: boolean; validFrom: string; validTo: string; daysLeft: number; issuer: string; subject: string } | null;
  geo: { country: string; region: string; city: string; isp: string; org: string; as: string } | null;
  tech: { server: string | null; poweredBy: string | null; cdn: string | null; technologies: string[]; allHeaders: Record<string, any> } | null;
}

function getToken() {
  try { return localStorage.getItem('monitor_token'); } catch { return null; }
}

export default function ServiceDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [service, setService] = useState<MonitorService | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [activeTab, setActiveTab] = useState<'response' | 'uptime' | 'logs' | 'http' | 'server'>('response');
  const [loading, setLoading] = useState(true);
  const [editingIp, setEditingIp] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [privateIpVal, setPrivateIpVal] = useState('');
  const [notesVal, setNotesVal] = useState('');

  const authFetch = (url: string, opts: RequestInit = {}) => {
    const token = getToken();
    return fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers ?? {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
    });
  };

  const fetchService = async () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      const res = await authFetch(API + '/api/services/' + id);
      const data = await res.json();
      setService(data);
      setPrivateIpVal(data.privateIp ?? '');
      setNotesVal(data.notes ?? '');
    } catch {}
    setLoading(false);
  };

  const fetchServerInfo = async () => {
    setLoadingInfo(true);
    try {
      const res = await authFetch(API + '/api/services/' + id + '/server-info');
      const data = await res.json();
      setServerInfo(data);
    } catch {}
    setLoadingInfo(false);
  };

  const saveField = async (field: 'privateIp' | 'notes', value: string) => {
    await authFetch(API + '/api/services/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value }),
    });
    setService(prev => prev ? { ...prev, [field]: value } : prev);
    if (field === 'privateIp') setEditingIp(false);
    if (field === 'notes') setEditingNotes(false);
  };

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    fetchService();
    const t = setInterval(fetchService, 10000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    if (activeTab === 'server' && !serverInfo) fetchServerInfo();
  }, [activeTab]);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400 flex items-center gap-3">
        <Clock className="w-5 h-5 animate-spin" /> Cargando...
      </div>
    </div>
  );

  if (!service) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Servicio no encontrado</p>
    </div>
  );

  const logs = service.logs ?? [];
  const chartData = logs.slice(-120).map(l => ({
    time: new Date(l.timestamp).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
    response: l.response,
    uptime: l.status === 'up' ? 100 : 0,
    httpCode: l.httpCode,
  }));
  const downEvents = logs.filter((l, i) => l.status === 'down' && (i === 0 || logs[i - 1].status === 'up'));
  const validLogs = logs.filter(l => l.response);
  const avgResponse = validLogs.length > 0 ? Math.round(validLogs.reduce((a, l) => a + (l.response ?? 0), 0) / validLogs.length) : null;
  const minResponse = validLogs.length > 0 ? Math.min(...validLogs.map(l => l.response ?? 0)) : null;
  const maxResponse = validLogs.length > 0 ? Math.max(...validLogs.map(l => l.response ?? 0)) : null;

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white transition flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" /> Volver
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-red-700 p-2 rounded-lg"><Activity className="w-5 h-5 text-white" /></div>
              <div>
                <h1 className="text-lg font-bold text-white">{service.name}</h1>
                <a href={service.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-300">{service.url}</a>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${service.status === 'up' ? 'bg-green-900 text-green-300' : service.status === 'down' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'}`}>
              {service.status === 'up' ? <CheckCircle className="w-3 h-3" /> : service.status === 'down' ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {service.status === 'up' ? 'EN LINEA' : service.status === 'down' ? 'CAIDO' : 'VERIFICANDO'}
            </div>
            <button onClick={fetchService} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition">
              <RefreshCw className="w-4 h-4" /> Actualizar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Uptime 30 dias', value: service.uptime + '%', color: service.uptime >= 99 ? 'text-green-400' : service.uptime >= 90 ? 'text-yellow-400' : 'text-red-400' },
            { label: 'Respuesta actual', value: service.response ? service.response + 'ms' : 'N/A', color: service.response && service.response < 500 ? 'text-green-400' : 'text-yellow-400' },
            { label: 'Promedio', value: avgResponse ? avgResponse + 'ms' : 'N/A', color: 'text-blue-400' },
            { label: 'Minimo', value: minResponse ? minResponse + 'ms' : 'N/A', color: 'text-green-400' },
            { label: 'Maximo', value: maxResponse ? maxResponse + 'ms' : 'N/A', color: 'text-red-400' },
          ].map((m, i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-xs mb-1">{m.label}</p>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {service.downSince && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-6 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300">Caido desde: <span className="font-bold">{new Date(service.downSince).toLocaleString('es-DO')}</span></p>
          </div>
        )}

        <div className="bg-gray-900 rounded-xl border border-gray-800 mb-6">
          <div className="flex border-b border-gray-800 overflow-x-auto">
            {[
              { key: 'response', label: 'Tiempo de respuesta' },
              { key: 'uptime', label: 'Uptime %' },
              { key: 'http', label: 'Codigo HTTP' },
              { key: 'logs', label: 'Logs' },
              { key: 'server', label: 'Info del servidor' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`px-5 py-3 text-sm font-medium transition border-b-2 whitespace-nowrap ${activeTab === tab.key ? 'border-red-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'response' && (
              <div>
                <h3 className="text-sm text-gray-400 mb-4">Tiempo de respuesta - ultimos 120 chequeos</h3>
                {chartData.length === 0 ? <p className="text-gray-500 text-center py-12">Acumulando datos...</p> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} unit="ms" />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#F9FAFB' }} formatter={(v: any) => [v + 'ms', 'Respuesta']} />
                      <Line type="monotone" dataKey="response" stroke="#22C55E" strokeWidth={2} dot={false} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {activeTab === 'uptime' && (
              <div>
                <h3 className="text-sm text-gray-400 mb-4">Uptime - ultimos 120 chequeos</h3>
                {chartData.length === 0 ? <p className="text-gray-500 text-center py-12">Acumulando datos...</p> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} domain={[0, 100]} unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#F9FAFB' }} formatter={(v: any) => [v + '%', 'Uptime']} />
                      <ReferenceLine y={90} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: '90%', fill: '#F59E0B', fontSize: 11 }} />
                      <Line type="stepAfter" dataKey="uptime" stroke="#3B82F6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {activeTab === 'http' && (
              <div>
                <h3 className="text-sm text-gray-400 mb-4">Codigo HTTP - ultimos 120 chequeos</h3>
                {chartData.length === 0 ? <p className="text-gray-500 text-center py-12">Acumulando datos...</p> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} domain={[100, 600]} />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#F9FAFB' }} formatter={(v: any) => [v, 'HTTP Code']} />
                      <ReferenceLine y={500} stroke="#EF4444" strokeDasharray="4 4" label={{ value: '500', fill: '#EF4444', fontSize: 11 }} />
                      <ReferenceLine y={200} stroke="#22C55E" strokeDasharray="4 4" label={{ value: '200', fill: '#22C55E', fontSize: 11 }} />
                      <Line type="stepAfter" dataKey="httpCode" stroke="#A78BFA" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <div>
                <h3 className="text-sm text-gray-400 mb-4">Log de eventos - {logs.length} registros</h3>
                <div className="overflow-auto max-h-96 rounded-lg border border-gray-800">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Timestamp</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Estado</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">HTTP</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Respuesta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...logs].reverse().map((log, i) => (
                        <tr key={i} className={`border-t border-gray-800 ${log.status === 'down' ? 'bg-red-950/30' : ''}`}>
                          <td className="px-4 py-2 text-gray-300 font-mono text-xs">{new Date(log.timestamp).toLocaleString('es-DO')}</td>
                          <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-bold ${log.status === 'up' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>{log.status === 'up' ? 'UP' : 'DOWN'}</span></td>
                          <td className="px-4 py-2"><span className={`font-mono text-xs ${log.httpCode && log.httpCode < 300 ? 'text-green-400' : log.httpCode && log.httpCode < 500 ? 'text-yellow-400' : 'text-red-400'}`}>{log.httpCode ?? 'timeout'}</span></td>
                          <td className="px-4 py-2 font-mono text-xs text-gray-300">{log.response ? log.response + 'ms' : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'server' && (
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm text-gray-400">Informacion del servidor</h3>
                  <button onClick={fetchServerInfo} disabled={loadingInfo} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50">
                    <RefreshCw className={`w-3 h-3 ${loadingInfo ? 'animate-spin' : ''}`} />
                    {loadingInfo ? 'Consultando...' : 'Actualizar'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                    <div className="flex items-center gap-2 mb-4">
                      <Server className="w-4 h-4 text-blue-400" />
                      <h4 className="text-sm font-semibold text-white">Red y Conexion</h4>
                    </div>
                    <div className="grid gap-2">
                      {[
                        { label: 'Hostname', value: serverInfo?.hostname ?? '...' },
                        { label: 'IP Publica', value: serverInfo?.ip?.address ?? '...' },
                        { label: 'Familia IP', value: serverInfo?.ip?.family ?? '...' },
                        { label: 'DNS Inverso', value: serverInfo?.ip?.rdns ?? 'No disponible' },
                        { label: 'Puerto', value: serverInfo?.port ? String(serverInfo.port) : '...' },
                        { label: 'Protocolo', value: serverInfo?.protocol ? serverInfo.protocol.toUpperCase() : '...' },
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                          <span className="text-gray-400 text-xs">{item.label}</span>
                          <span className="text-white text-xs font-mono">{item.value}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center py-2 border-b border-gray-700">
                        <span className="text-gray-400 text-xs">IP Privada</span>
                        <div className="flex items-center gap-2">
                          {editingIp ? (
                            <>
                              <input value={privateIpVal} onChange={e => setPrivateIpVal(e.target.value)} placeholder="192.168.x.x" className="bg-gray-700 text-white text-xs font-mono px-2 py-1 rounded border border-gray-600 focus:border-red-500 outline-none w-36" />
                              <button onClick={() => saveField('privateIp', privateIpVal)} className="text-green-400 hover:text-green-300"><Save className="w-3 h-3" /></button>
                              <button onClick={() => setEditingIp(false)} className="text-gray-400 hover:text-white"><X className="w-3 h-3" /></button>
                            </>
                          ) : (
                            <>
                              <span className="text-white text-xs font-mono">{service.privateIp ?? 'No configurada'}</span>
                              <button onClick={() => setEditingIp(true)} className="text-gray-500 hover:text-blue-400"><Edit2 className="w-3 h-3" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="w-4 h-4 text-green-400" />
                      <h4 className="text-sm font-semibold text-white">Ubicacion Geografica</h4>
                    </div>
                    {serverInfo?.geo ? (
                      <div className="grid gap-2">
                        {[
                          { label: 'Pais', value: serverInfo.geo.country },
                          { label: 'Region', value: serverInfo.geo.region },
                          { label: 'Ciudad', value: serverInfo.geo.city },
                          { label: 'ISP', value: serverInfo.geo.isp },
                          { label: 'Organizacion', value: serverInfo.geo.org },
                          { label: 'AS', value: serverInfo.geo.as },
                        ].map((item, i) => (
                          <div key={i} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                            <span className="text-gray-400 text-xs">{item.label}</span>
                            <span className="text-white text-xs text-right max-w-48 truncate">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-gray-500 text-sm">{loadingInfo ? 'Consultando...' : 'No disponible'}</p>}
                  </div>

                  <div className="col-span-2 bg-gray-800 rounded-xl p-5 border border-gray-700">
                    <div className="flex items-center gap-2 mb-4">
                      {serverInfo?.ssl?.valid ? <Shield className="w-4 h-4 text-green-400" /> : <ShieldAlert className="w-4 h-4 text-red-400" />}
                      <h4 className="text-sm font-semibold text-white">Certificado SSL</h4>
                      {serverInfo?.ssl && (
                        <span className={`ml-auto px-2 py-0.5 rounded text-xs font-bold ${serverInfo.ssl.daysLeft > 30 ? 'bg-green-900 text-green-300' : serverInfo.ssl.daysLeft > 7 ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                          {serverInfo.ssl.daysLeft > 0 ? serverInfo.ssl.daysLeft + ' dias' : 'EXPIRADO'}
                        </span>
                      )}
                    </div>
                    {serverInfo?.ssl ? (
                      <div className="grid grid-cols-4 gap-4">
                        {[
                          { label: 'Sujeto', value: serverInfo.ssl.subject },
                          { label: 'Emisor', value: serverInfo.ssl.issuer },
                          { label: 'Valido desde', value: new Date(serverInfo.ssl.validFrom).toLocaleDateString('es-DO') },
                          { label: 'Expira', value: new Date(serverInfo.ssl.validTo).toLocaleDateString('es-DO') },
                        ].map((item, i) => (
                          <div key={i} className="bg-gray-700/50 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">{item.label}</p>
                            <p className="text-white text-xs font-medium truncate">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-gray-500 text-sm">{loadingInfo ? 'Consultando...' : 'No aplica o no disponible'}</p>}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-white">Notas del servidor</h4>
                    {!editingNotes && <button onClick={() => setEditingNotes(true)} className="text-gray-500 hover:text-blue-400"><Edit2 className="w-4 h-4" /></button>}
                  </div>
                  {editingNotes ? (
                    <div className="grid gap-2">
                      <textarea value={notesVal} onChange={e => setNotesVal(e.target.value)} placeholder="Rack, ubicacion fisica, contacto del administrador..." className="bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:border-red-500 outline-none w-full h-28 resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => saveField('notes', notesVal)} className="flex items-center gap-1 bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs"><Save className="w-3 h-3" /> Guardar</button>
                        <button onClick={() => setEditingNotes(false)} className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs"><X className="w-3 h-3" /> Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm whitespace-pre-wrap">{service.notes || 'Sin notas. Haz clic en editar para agregar informacion del servidor.'}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Historial de caidas ({downEvents.length})</h3>
          {downEvents.length === 0 ? <p className="text-gray-500 text-sm">Sin caidas registradas</p> : (
            <div className="grid gap-2">
              {[...downEvents].reverse().map((e, i) => (
                <div key={i} className="flex items-center gap-3 text-sm bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-2">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-gray-300 font-mono text-xs">{new Date(e.timestamp).toLocaleString('es-DO')}</span>
                  <span className="text-red-400 text-xs">HTTP {e.httpCode ?? 'timeout'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}