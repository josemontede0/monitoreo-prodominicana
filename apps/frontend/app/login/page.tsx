'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Eye, EyeOff, LogIn } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!form.username || !form.password) { setError('Completa todos los campos'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Credenciales incorrectas');
        setLoading(false);
        return;
      }
      const data = await res.json();
      localStorage.setItem('monitor_token', data.token);
      localStorage.setItem('monitor_user', JSON.stringify(data.user));
      router.push('/');
    } catch {
      setError('Error de conexion con el servidor');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-red-700 p-4 rounded-2xl mb-4">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">MonitoreoApp</h1>
          <p className="text-gray-400 text-sm mt-1">ProDominicana — Acceso interno</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 mb-5">Inicia sesion con tu cuenta institucional</h2>

          <div className="grid gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Usuario</label>
              <input
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none border border-gray-700 focus:border-red-500 transition text-sm"
                placeholder="usuario.apellido"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoComplete="username"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Contrasena</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 pr-10 outline-none border border-gray-700 focus:border-red-500 transition text-sm"
                  placeholder="Tu contrasena de red"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  autoComplete="current-password"
                />
                <button onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-2.5 text-red-300 text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white py-2.5 rounded-lg transition font-semibold text-sm"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LogIn className="w-4 h-4" />}
              {loading ? 'Verificando...' : 'Iniciar sesion'}
            </button>
          </div>

          <p className="text-center text-xs text-gray-500 mt-5">
            Usa tu usuario y contrasena de red institucional
          </p>
        </div>
      </div>
    </div>
  );
}