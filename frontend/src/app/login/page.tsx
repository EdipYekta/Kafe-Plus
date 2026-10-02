'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Coffee, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const routeByUser = (u: any) => {
    const role = u?.role;
    const p = u?.permissions || {};
    const isManagement = role === 'SuperAdmin' || role === 'Owner' || role === 'Admin' || role === 'Manager';
    const canDashboard = (p.can_view_dashboard !== undefined ? p.can_view_dashboard : isManagement) && (p.can_view_revenue || isManagement);

    if (role === 'Kitchen') router.push('/kitchen');
    else if (role === 'Waiter') router.push('/waiter');
    else if (role === 'Cashier') router.push('/cashier');
    else if (canDashboard) router.push('/dashboard');
    else if (p.can_take_payment) router.push('/cashier');
    else if (p.can_view_kitchen) router.push('/kitchen');
    else router.push('/waiter');
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      toast.error('Lütfen kullanıcı adı ve şifrenizi girin');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        username: form.username.trim(),
        password: form.password,
      });

      login(res.data.token, res.data.user);
      toast.success(`Hos geldiniz, ${res.data.user.full_name}!`);
      routeByUser(res.data.user);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Kullanıcı adı veya sifre hatalı');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full border rounded-2xl pl-10 pr-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all';
  const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)' };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-3 sm:p-6 relative overflow-hidden font-sans select-none"
      style={{ background: 'var(--app)', color: 'var(--text)' }}
    >
      {/* Subtle ambient glow */}
      <div
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[140px] pointer-events-none opacity-20"
        style={{ background: 'var(--brand)' }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full blur-[140px] pointer-events-none opacity-10"
        style={{ background: 'var(--brand)' }}
      />

      {/* Single centered card */}
      <div
        className="w-full max-w-sm rounded-3xl p-7 sm:p-8 shadow-2xl relative z-10"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg mb-3"
            style={{ background: 'linear-gradient(135deg, var(--brand), #ff9500)' }}
          >
            <Coffee className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
            Kafe<span style={{ color: 'var(--brand)' }}>+</span>
          </h1>
          <p className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
            Personel Girisi
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>
              Kullanıcı Adı
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="kullanıcı adınızı girin"
                autoComplete="username"
                className={inputClass}
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>
              Sifre
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                autoComplete="current-password"
                className={inputClass + ' pr-11'}
                style={inputStyle}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                title={showPass ? 'Gizle' : 'Göster'}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Giris Yap</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Admin link */}
        <div className="mt-6 pt-5 flex items-center justify-center" style={{ borderTop: '1px solid var(--border)' }}>
          <Link
            href="/admin/login"
            className="flex items-center gap-2 text-xs transition-colors group"
            style={{ color: 'var(--text-muted)' }}
          >
            <ShieldCheck className="w-3.5 h-3.5 group-hover:text-orange-500 transition-colors" />
            <span className="group-hover:text-white transition-colors">Sistem Yöneticisi Girisi</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
