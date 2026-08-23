'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coffee, Lock, ShieldCheck, ArrowRight, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);

    try {
      const res = await api.post('/auth/admin-login', { password });
      sessionStorage.setItem('admin-token', res.data.token);
      toast.success('Sistem Yöneticisi girişi başarılı');
      router.push('/admin');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Hatalı şifre');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background */}
      <div className="absolute -top-60 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff06_1px,transparent_1px)] [background-size:28px_28px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Card */}
        <div className="bg-[#12131c]/95 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center shadow-2xl shadow-red-500/30 ring-1 ring-white/10 mb-4">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Coffee className="w-4 h-4 text-orange-500" />
              <span className="text-lg font-black text-white">Kafe<span className="text-orange-500">+</span></span>
            </div>
            <h1 className="text-base font-black text-white text-center">Sistem Yöneticisi</h1>
            <p className="text-xs text-slate-400 text-center mt-1 font-medium">Admin Paneli Erişimi</p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 mb-6">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300 font-medium leading-relaxed">
              Bu bölüm yalnızca sistem yöneticileri içindir. Kafe yönetimi ve kullanıcı ekleme buradan yapılır.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Yönetici Şifresi
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full bg-[#181a24] border border-white/10 rounded-2xl pl-10 pr-11 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-red-500/25 transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin Paneline Gir</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Back link */}
          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <a
              href="/login"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Personel Girişine Dön
            </a>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-4">
          Kafe+ v2.0 · Sistem Yönetimi
        </p>
      </div>
    </div>
  );
}
