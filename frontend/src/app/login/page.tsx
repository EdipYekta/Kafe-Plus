'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Coffee, Lock, User, Eye, EyeOff,
  UtensilsCrossed, ShieldCheck, ChefHat, Wallet,
  ArrowRight, Sparkles, Settings
} from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const routeByRole = (role: string) => {
    if (role === 'Kitchen') router.push('/kitchen');
    else if (role === 'Waiter') router.push('/waiter');
    else if (role === 'Cashier') router.push('/cashier');
    else router.push('/dashboard');
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
      toast.success(`Hoş geldiniz, ${res.data.user.full_name}!`);
      routeByRole(res.data.user.role);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Kullanıcı adı veya şifre hatalı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex items-center justify-center p-3 sm:p-6 lg:p-10 relative overflow-hidden font-sans select-none">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-40" />

      {/* Main Glass Card */}
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden bg-[#12131c]/90 border border-white/10 shadow-2xl backdrop-blur-2xl relative z-10">
        
        {/* Left Side: Brand Visual (Visible on Desktop) */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-[#1b120c] via-[#14141e] to-[#0c0d14] p-8 flex-col justify-between border-r border-white/5 relative">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-xl shadow-orange-500/25 ring-1 ring-white/20">
                <Coffee className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-0.5">
                  Kafe<span className="text-orange-500">+</span>
                </h1>
                <p className="text-[11px] text-slate-400 font-medium tracking-wide">
                  Restoran &amp; Kafe Otomasyonu
                </p>
              </div>
            </div>

            {/* Tagline */}
            <div className="mt-10 space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <Sparkles className="w-3.5 h-3.5" /> Hızlı ve Kolay Yönetim
              </span>
              <h2 className="text-2xl font-black text-white leading-tight">
                Garson, Kasa ve Mutfak <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-300">Tek Noktada</span>
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed pt-1">
                Kafenin eklediği garsonlar kullanıcı adı ve şifreleriyle anında masalara bağlanıp sipariş alabilir.
              </p>
            </div>
          </div>

          {/* Quick Role Highlights */}
          <div className="my-6 space-y-2.5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Yetkili Roller
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-red-500/15 flex items-center justify-center text-red-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Admin</p>
                  <p className="text-[10px] text-slate-400">Kafe Yönetimi</p>
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-green-500/15 flex items-center justify-center text-green-400">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Garson</p>
                  <p className="text-[10px] text-slate-400">Masa &amp; Sipariş</p>
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Kasiyer</p>
                  <p className="text-[10px] text-slate-400">Hesap &amp; Ödeme</p>
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400">
                  <ChefHat className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Mutfak</p>
                  <p className="text-[10px] text-slate-400">KDS Ekranı</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-white/5 pt-4">
            <span>Kafe+ v2.0</span>
            <span>Güvenli Oturum</span>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center justify-between pb-6 mb-6 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20">
                <Coffee className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-black text-white">Kafe<span className="text-orange-500">+</span></h1>
            </div>
            <span className="text-xs text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/10 font-medium">
              Personel Girişi
            </span>
          </div>

          {/* Login Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-white mb-1">Hoş Geldiniz</h2>
            <p className="text-slate-400 text-sm">Kafenizin verdiği kullanıcı adı ve şifrenizle giriş yapın.</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                  className="w-full bg-[#181a24] border border-white/10 rounded-2xl pl-10 pr-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Şifre
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-[#181a24] border border-white/10 rounded-2xl pl-10 pr-11 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
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
              className="w-full mt-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-orange-500/25 transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Giriş Yap</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Admin Link */}
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center">
            <Link
              href="/admin/login"
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors group"
            >
              <Settings className="w-3.5 h-3.5 group-hover:text-orange-500 transition-colors" />
              <span>Sistem Yöneticisi Girişi</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
