'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  Coffee, CreditCard, ChefHat, LayoutGrid, Settings, LogOut,
  Menu, X, MoreHorizontal,
} from 'lucide-react';
import clsx from 'clsx';

function useNavItems() {
  const { user } = useAuthStore();
  if (!user) return [];

  const p = user.permissions || ({} as any);
  const role = user.role;
  const isManagement = role === 'SuperAdmin' || role === 'Owner' || role === 'Admin' || role === 'Manager';
  const canDashboard = (p.can_view_dashboard !== undefined ? p.can_view_dashboard : isManagement) && (p.can_view_revenue || isManagement);

  return [
    { icon: Coffee, label: 'Masalar', href: '/waiter', show: true },
    { icon: CreditCard, label: 'Kasa', href: '/cashier', show: p.can_take_payment || p.can_view_revenue || isManagement },
    { icon: ChefHat, label: 'Mutfak', href: '/kitchen', show: p.can_view_kitchen || isManagement },
    { icon: LayoutGrid, label: 'Panel', href: '/dashboard', show: canDashboard },
    { icon: Settings, label: 'Yönetim', href: '/manage', show: isManagement },
  ].filter(item => item.show);
}

function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-2)' }}>
      {time}
    </span>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }, []);

  const navItems = useNavItems();

  if (!user) return null;

  const handleLogout = () => { logout(); router.push('/login'); };

  const initials = user.full_name
    ?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'K+';

  const bottomNavItems = navItems.slice(0, 4);
  const sidebarWidth = collapsed ? '72px' : '220px';

  const NavLink = ({ item, onClick, mode }: { item: typeof navItems[0]; onClick?: () => void; mode: 'sidebar' | 'mobile-drawer' | 'bottom' }) => {
    const active = pathname === item.href
      || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
      || (item.href === '/manage' && ['/products', '/staff', '/settings', '/expenses', '/reports'].includes(pathname));
    const Icon = item.icon;

    if (mode === 'bottom') {
      return (
        <Link
          href={item.href}
          onClick={onClick}
          className={clsx(
            'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors relative',
            active ? 'text-orange-400' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          {active && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-orange-500" />
          )}
          <Icon className="w-5 h-5" />
          <span className="text-[10px] font-semibold leading-none">{item.label}</span>
        </Link>
      );
    }

    if (mode === 'mobile-drawer') {
      return (
        <Link
          href={item.href}
          onClick={onClick}
          className={clsx(
            'flex items-center gap-4 px-5 py-3.5 text-sm font-medium transition-all',
            active
              ? 'text-white bg-white/10 border-l-2 border-orange-500'
              : 'text-slate-300 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
          )}
        >
          <Icon className="w-5 h-5 flex-shrink-0" style={{ color: active ? 'var(--brand)' : undefined }} />
          <span>{item.label}</span>
        </Link>
      );
    }

    // sidebar mode — title attribute only (no absolute tooltip to avoid horizontal scroll)
    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={clsx(
          'flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 group relative',
          collapsed ? 'justify-center px-0 py-3 mx-0' : 'px-3 py-2.5',
          active ? 'bg-white/10 font-semibold' : 'hover:bg-white/10'
        )}
        style={{ color: active ? 'var(--text)' : 'var(--text-2)' }}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
            style={{ background: 'var(--brand)' }}
          />
        )}
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color: active ? 'var(--text)' : 'var(--text-2)' }} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <div
      className="flex h-[100dvh] overflow-hidden select-none"
      style={{ background: 'var(--app)', color: 'var(--text)' }}
    >
      {/* ─── Desktop Sidebar (hidden on mobile) ─── */}
      <aside
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          background: 'var(--app)',
          borderRight: '1px solid var(--border)',
          transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1), min-width 0.2s cubic-bezier(0.4,0,0.2,1)',
        }}
        className="hidden md:flex flex-col h-full flex-shrink-0 z-40 overflow-hidden"
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 flex-shrink-0" style={{ height: '56px' }}>
          <button
            onClick={toggleCollapsed}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all hover:bg-white/10 active:scale-95 flex-shrink-0"
            title={collapsed ? 'Genişlet' : 'Daralt'}
          >
            <Menu className="w-5 h-5" style={{ color: 'var(--text)' }} />
          </button>
          {!collapsed && (
            <Link href="/waiter" className="flex items-center gap-2 overflow-hidden">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--brand), #ff9500)' }}
              >
                <Coffee className="w-4 h-4" />
              </div>
              <span className="text-base font-black tracking-tight whitespace-nowrap" style={{ color: 'var(--text)' }}>
                Kafe<span style={{ color: 'var(--brand)' }}>+</span>
              </span>
            </Link>
          )}
        </div>

        {/* Nav — overflow-x clipped so no horizontal scroll; overflow-y auto for vertical */}
        <nav
          className="flex-1 px-2 py-2 space-y-0.5"
          style={{ overflowY: 'auto', overflowX: 'hidden' }}
        >
          {!collapsed && (
            <p className="text-[10px] font-semibold uppercase tracking-widest px-3 py-2" style={{ color: 'var(--text-muted)' }}>
              {user.cafe_name || 'Kafe Sistemi'}
            </p>
          )}
          {navItems.map(item => (
            <NavLink key={item.href} item={item} mode="sidebar" />
          ))}
        </nav>

        {/* User footer */}
        <div className="p-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <div className={clsx('flex items-center rounded-xl transition-all', collapsed ? 'justify-center p-2' : 'gap-2.5 p-2 hover:bg-white/5 cursor-default')}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
              style={{ background: user.avatar_color || 'var(--brand)' }}
            >
              {initials}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{user.full_name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.role}</p>
                </div>
                <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Çıkış" style={{ color: 'var(--text-muted)' }}>
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          {collapsed && (
            <button onClick={handleLogout} className="w-full flex justify-center p-2 rounded-xl hover:bg-white/10 mt-1" title="Çıkış" style={{ color: 'var(--text-muted)' }}>
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ─── Mobile Drawer Overlay ─── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="absolute left-0 top-0 bottom-0 w-72 flex flex-col z-10"
            style={{ background: 'var(--app)', borderRight: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--brand), #ff9500)' }}
                >
                  <Coffee className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-base font-black" style={{ color: 'var(--text)' }}>
                    Kafe<span style={{ color: 'var(--brand)' }}>+</span>
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {user.cafe_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-2)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                style={{ background: user.avatar_color || 'var(--brand)' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{user.full_name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.role}</p>
              </div>
              <LiveClock />
            </div>

            <nav className="flex-1 overflow-y-auto py-2">
              {navItems.map(item => (
                <NavLink key={item.href} item={item} mode="mobile-drawer" onClick={() => setMobileOpen(false)} />
              ))}
            </nav>

            <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => { setMobileOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                style={{ color: 'var(--text-2)', background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <LogOut className="w-4 h-4" />
                <span>Çıkış Yap</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header
          style={{
            background: 'var(--header)',
            borderBottom: '1px solid var(--border)',
            height: '52px',
          }}
          className="flex items-center px-3 sm:px-5 gap-3 flex-shrink-0 z-30 justify-between"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors flex-shrink-0"
              style={{ color: 'var(--text)' }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
              {user.cafe_name || 'Kafe+'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><LiveClock /></div>
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl cursor-default"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
                style={{ background: user.avatar_color || 'var(--brand)' }}
              >
                {initials}
              </div>
              <span className="text-sm font-medium hidden sm:block" style={{ color: 'var(--text)' }}>{user.full_name}</span>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main
          className="flex-1 overflow-y-auto p-3 sm:p-5 pb-20 md:pb-5"
          style={{ background: 'var(--app)' }}
        >
          {children}
        </main>

        {/* ─── Mobile Bottom Tab Bar ─── */}
        <nav
          className="md:hidden flex-shrink-0 flex items-stretch"
          style={{
            background: 'var(--app)',
            borderTop: '1px solid var(--border)',
            height: '64px',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {bottomNavItems.map(item => (
            <NavLink key={item.href} item={item} mode="bottom" />
          ))}
          {navItems.length > 4 && (
            <button
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-semibold leading-none">Daha Fazla</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
