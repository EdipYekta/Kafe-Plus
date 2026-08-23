'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  Coffee, LayoutGrid, CreditCard, ChefHat,
  BarChart3, Package, Users, Settings, LogOut,
  Menu, X, MapPin, Receipt
} from 'lucide-react';
import clsx from 'clsx';

const ALL_NAV_ITEMS = [
  { icon: MapPin,     label: 'Masa Haritası',          href: '/waiter',   roles: null },
  { icon: CreditCard, label: 'Kasa, Ciro & Masraflar', href: '/cashier',  roles: ['Admin','Manager','Cashier'] },
  { icon: ChefHat,    label: 'Mutfak Ekranı (KDS)',    href: '/kitchen',  roles: ['Admin','Manager','Cashier','Kitchen'] },
  { icon: Package,    label: 'Ürünler & Menü',         href: '/products', roles: ['Admin','Manager'] },
  { icon: Users,      label: 'Personel & Garsonlar',   href: '/staff',    roles: ['Admin','Manager'] },
  { icon: Settings,   label: 'Sistem Ayarları',        href: '/settings', roles: ['Admin','Manager'] },
  { icon: LayoutGrid, label: 'Genel Dashboard',        href: '/dashboard',roles: ['Admin','Manager','Cashier'] },
];

function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-white/70 border border-black/10 text-xs font-mono font-bold text-slate-700 shadow-xs">
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      {time}
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => { logout(); router.push('/login'); };

  // Filter nav based on role
  const navItems = ALL_NAV_ITEMS.filter(item =>
    item.roles === null || item.roles.includes(user.role)
  );

  const initials = user.full_name
    ?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'K+';

  /* ── consistent tokens (same values as waiter/cashier standalone pages) ── */
  const APP  = '#dde6ed';   // page body
  const SIDE = '#c4d4dc';   // sidebar
  const HDR  = '#b8c9d4';   // top header
  const CARD = '#ffffff';
  const BORD = 'rgba(0,0,0,0.10)';

  return (
    <div className="flex h-screen overflow-hidden font-sans select-none relative" style={{ background: APP, color: '#1e293b' }}>
      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Sidebar Drawer ─── */}
      <aside
        style={{ background: SIDE, borderRight: `1px solid ${BORD}` }}
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-250 ease-out shadow-2xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORD}`, background: CARD + 'aa' }}>
          <Link href="/waiter" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-sm text-white">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-0.5">
                Kafe<span className="text-orange-600">+</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold truncate max-w-[150px]">
                {user.cafe_name || 'Restoran Sistemi'}
              </p>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ background: CARD, border: `1px solid ${BORD}` }}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-xl shadow-xs transition-all active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick jump */}
        <div className="p-3">
          <Link
            href="/waiter"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#38bdf8] hover:bg-[#0284c7] text-white font-black text-xs shadow-xs transition-all active:scale-98"
          >
            <MapPin className="w-4 h-4" />
            <span>Masa Haritasına Git</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="px-3 py-1 text-[10px] font-black tracking-wider text-slate-500 uppercase">Sayfalar</div>
          {navItems.map(({ icon: Icon, label, href }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                style={active ? { background: CARD, border: `1px solid ${BORD}` } : {}}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-150',
                  active
                    ? 'text-slate-900 shadow-xs ring-1 ring-orange-400/30 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                )}
              >
                <Icon className={clsx('w-4 h-4', active ? 'text-orange-500' : 'text-slate-400')} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 space-y-2" style={{ borderTop: `1px solid ${BORD}`, background: CARD + '99' }}>
          <div className="flex items-center gap-2.5 p-2.5 rounded-2xl shadow-xs" style={{ background: CARD, border: `1px solid ${BORD}` }}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black"
              style={{ background: user.avatar_color || '#f97316' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-xs font-black truncate">{user.full_name}</p>
              <p className="text-[10px] font-bold text-slate-500">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Çıkış Yap"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header
          style={{ background: HDR, borderBottom: `1px solid ${BORD}` }}
          className="h-14 flex items-center px-4 lg:px-6 gap-3 flex-shrink-0 z-30 justify-between shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: CARD, border: `1px solid ${BORD}` }}
              className="flex items-center gap-2 text-slate-800 px-3.5 py-2 rounded-2xl text-xs font-bold shadow-xs transition-all active:scale-95"
            >
              <Menu className="w-4 h-4 text-orange-500" />
              <span className="hidden sm:inline">Menü</span>
            </button>

            <Link
              href="/waiter"
              style={{ background: CARD, border: `1px solid ${BORD}` }}
              className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-2xl shadow-xs text-slate-800 transition-all active:scale-95 hover:bg-slate-50"
            >
              <MapPin className="w-3.5 h-3.5 text-sky-500" />
              <span>Masalar</span>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <LiveClock />
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl shadow-xs"
              style={{ background: CARD, border: `1px solid ${BORD}` }}
            >
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
                style={{ background: user.avatar_color || '#f97316' }}
              >
                {initials}
              </div>
              <span className="text-xs font-bold text-slate-800 hidden md:block">{user.full_name}</span>
            </div>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5" style={{ background: APP }}>
          {children}
        </main>
      </div>
    </div>
  );
}
