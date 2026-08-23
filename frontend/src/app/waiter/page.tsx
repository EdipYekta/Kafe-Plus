'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  Coffee, CreditCard, ChefHat, BarChart3, Package,
  Users, Settings, LogOut, Menu, X, MapPin, Receipt,
  Plus, LayoutGrid, Trash2, Play, Clock, ChevronDown,
  Layers, Hash
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Table {
  id: number;
  name: string;
  area_id: number;
  area_name: string;
  capacity: number;
  type: string;
  status: string;
  current_session_id: number | null;
  total_amount: number;
  order_count?: number;
  waiter_name?: string;
  session_opened_at?: string | null;
}

interface Area {
  id: number;
  name: string;
  table_count: number;
}

const ALL_NAV_ITEMS = [
  { icon: MapPin,     label: 'Masa Haritası',          href: '/waiter',   roles: null },
  { icon: CreditCard, label: 'Kasa, Ciro & Masraflar', href: '/cashier',  roles: ['Admin','Manager','Cashier'] },
  { icon: ChefHat,    label: 'Mutfak Ekranı (KDS)',    href: '/kitchen',  roles: ['Admin','Manager','Cashier','Kitchen'] },
  { icon: Package,    label: 'Ürünler & Menü',         href: '/products', roles: ['Admin','Manager'] },
  { icon: Users,      label: 'Personel & Garsonlar',   href: '/staff',    roles: ['Admin','Manager'] },
  { icon: Settings,   label: 'Sistem Ayarları',        href: '/settings', roles: ['Admin','Manager'] },
  { icon: LayoutGrid, label: 'Genel Dashboard',        href: '/dashboard',roles: ['Admin','Manager','Cashier'] },
];

// Elapsed time helper
function useElapsedTime(openedAt: string | null | undefined) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!openedAt) { setElapsed(''); return; }
    const calc = () => {
      const diff = Date.now() - new Date(openedAt).getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) setElapsed(`${hrs}s ${mins % 60}d`);
      else setElapsed(`${mins}d`);
    };
    calc();
    const t = setInterval(calc, 30000);
    return () => clearInterval(t);
  }, [openedAt]);
  return elapsed;
}

export default function WaiterTableGridPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedArea, setSelectedArea] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [selectedTableForAction, setSelectedTableForAction] = useState<Table | null>(null);
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false);

  // Role-filtered nav
  const navItems = ALL_NAV_ITEMS.filter(item =>
    item.roles === null || item.roles.includes(user?.role || '')
  );

  const isAdmin = user?.role === 'Admin' || user?.role === 'Manager';

  // Fetch Areas
  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ['areas'],
    queryFn: () => api.get('/areas').then((r) => r.data),
  });

  // Fetch Tables
  const { data: tables = [], isLoading } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: () => api.get('/tables').then((r) => r.data),
    refetchInterval: 10000,
  });

  // Open Session Mutation
  const openSessionMutation = useMutation({
    mutationFn: ({ tableId, guestCount }: { tableId: number; guestCount: number }) =>
      api.post('/sessions', { table_id: tableId, guest_count: guestCount }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setSelectedTableForAction(null);
      router.push(`/waiter/session/${res.data.id}`);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Masa başlatılamadı'),
  });

  // Open Session WITHOUT navigating
  const openSessionOnlyMutation = useMutation({
    mutationFn: ({ tableId, guestCount }: { tableId: number; guestCount: number }) =>
      api.post('/sessions', { table_id: tableId, guest_count: guestCount }),
    onSuccess: () => {
      toast.success('Masa açıldı');
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setSelectedTableForAction(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Masa açılamadı'),
  });

  // Cancel / Free Table Mutation
  const cancelSessionMutation = useMutation({
    mutationFn: (sessionId: number) => api.post(`/sessions/${sessionId}/cancel`),
    onSuccess: () => {
      toast.success('Masa kapatıldı');
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setSelectedTableForAction(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Masa iptal edilemedi'),
  });

  const filteredTables = useMemo(() => {
    const list = selectedArea
      ? tables.filter((t) => t.area_id === selectedArea)
      : [...tables];
    return list.sort((a, b) => {
      if ((a.area_id || 0) !== (b.area_id || 0)) {
        return (a.area_id || 0) - (b.area_id || 0);
      }
      return (a.name || '').localeCompare(b.name || '', 'tr', { numeric: true, sensitivity: 'base' });
    });
  }, [tables, selectedArea]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const initials =
    user?.full_name
      ?.split(' ')
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'K+';

  const occupiedCount = tables.filter((t) => t.status === 'occupied' || !!t.current_session_id).length;
  const selectedAreaName = selectedArea ? areas.find(a => a.id === selectedArea)?.name || 'Seçili Alan' : 'Tüm Masalar';

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-[#dde6ed] text-slate-800 flex flex-col font-sans select-none">
      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Slide-out Sidebar ─── */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 bg-[#dde6ed] border-r border-slate-300/60 flex flex-col transition-transform duration-250 ease-out shadow-2xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-white/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-sm text-white">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-0.5">
                Kafe<span className="text-orange-600">+</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold truncate max-w-[150px]">
                {user?.cafe_name || 'Restoran Sistemi'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl shadow-xs border border-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto custom-scrollbar">
          <div className="px-3 py-1 text-[10px] font-black tracking-wider text-slate-400 uppercase">Sayfalar</div>
          {navItems.map(({ icon: Icon, label, href }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all',
                  active
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200 ring-1 ring-orange-400/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                )}
              >
                <Icon className={clsx('w-4 h-4', active ? 'text-orange-500' : 'text-slate-400')} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-200 bg-white/60 space-y-2">
          <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-xs"
              style={{ background: user?.avatar_color || '#f97316' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-xs font-black truncate">{user?.full_name}</p>
              <p className="text-[10px] font-bold text-slate-500">{user?.role}</p>
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

      {/* ─── Top Bar ─── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 flex-shrink-0 bg-[#dde6ed]">
        {/* Menu Toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300/80 text-slate-800 px-3 py-2.5 rounded-2xl text-xs font-black shadow-xs transition-all active:scale-95 flex-shrink-0"
          aria-label="Menü"
        >
          <Menu className="w-4 h-4 text-orange-500" />
          <span className="hidden sm:inline">Menü</span>
        </button>

        {/* Area Filter - Desktop: buttons, Mobile: dropdown */}
        <div className="flex-1 overflow-hidden">
          {/* Desktop area buttons */}
          <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setSelectedArea(null)}
              className={clsx(
                'px-3 py-2.5 rounded-2xl font-bold text-xs shadow-xs transition-all active:scale-95 border flex-shrink-0',
                selectedArea === null
                  ? 'bg-white text-slate-900 border-slate-300 shadow-sm ring-1 ring-orange-500/20'
                  : 'bg-white/60 text-slate-600 border-transparent hover:bg-white/80'
              )}
            >
              Tümü ({tables.length})
            </button>
            {areas.map((area) => {
              const count = tables.filter((t) => t.area_id === area.id).length;
              return (
                <button
                  key={area.id}
                  onClick={() => setSelectedArea(area.id)}
                  className={clsx(
                    'px-3 py-2.5 rounded-2xl font-bold text-xs shadow-xs transition-all active:scale-95 border whitespace-nowrap flex-shrink-0',
                    selectedArea === area.id
                      ? 'bg-white text-slate-900 border-slate-300 shadow-sm ring-1 ring-orange-500/20'
                      : 'bg-white/60 text-slate-600 border-transparent hover:bg-white/80'
                  )}
                >
                  {area.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Mobile area dropdown */}
          <div className="relative sm:hidden">
            <button
              onClick={() => setAreaDropdownOpen(!areaDropdownOpen)}
              className="w-full flex items-center justify-between bg-white border border-slate-300/80 px-3 py-2.5 rounded-2xl text-xs font-black text-slate-800 shadow-xs"
            >
              <span>{selectedAreaName} ({filteredTables.length})</span>
              <ChevronDown className={clsx('w-3.5 h-3.5 text-slate-400 transition-transform', areaDropdownOpen && 'rotate-180')} />
            </button>
            {areaDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 overflow-hidden">
                <button
                  onClick={() => { setSelectedArea(null); setAreaDropdownOpen(false); }}
                  className={clsx('w-full text-left px-4 py-3 text-xs font-bold transition-colors', selectedArea === null ? 'bg-orange-50 text-orange-600' : 'text-slate-700 hover:bg-slate-50')}
                >
                  Tüm Masalar ({tables.length})
                </button>
                {areas.map(area => {
                  const count = tables.filter(t => t.area_id === area.id).length;
                  return (
                    <button
                      key={area.id}
                      onClick={() => { setSelectedArea(area.id); setAreaDropdownOpen(false); }}
                      className={clsx('w-full text-left px-4 py-3 text-xs font-bold border-t border-slate-100 transition-colors', selectedArea === area.id ? 'bg-orange-50 text-orange-600' : 'text-slate-700 hover:bg-slate-50')}
                    >
                      {area.name} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Occupied counter */}
          <div className="bg-white/80 border border-slate-200 px-2.5 py-2 rounded-xl shadow-xs text-center hidden xs:flex flex-col items-center">
            <span className="text-[10px] font-black text-slate-900 leading-none">{occupiedCount}</span>
            <span className="text-[8px] font-bold text-slate-400 leading-none mt-0.5">/{tables.length}</span>
          </div>
          <button
            onClick={() => setShowAddTableModal(true)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-3 py-2.5 rounded-2xl shadow-xs text-xs flex items-center gap-1.5 active:scale-95"
            title="Masa Ekle"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Masa Ekle</span>
          </button>
        </div>
      </div>

      {/* Backdrop for area dropdown */}
      {areaDropdownOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setAreaDropdownOpen(false)} />
      )}

      {/* ─── Main Table Grid ─── */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5 pt-1">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/40 animate-pulse" />
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <Coffee className="w-12 h-12 opacity-30" />
            <p className="text-sm font-bold">Bu alanda masa yok</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5 pt-1 content-start">
            {filteredTables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                onClick={() => setSelectedTableForAction(table)}
                onQuickOpen={() =>
                  openSessionOnlyMutation.mutate({ tableId: table.id, guestCount: 2 })
                }
                onQuickClose={() => {
                  if (table.current_session_id) {
                    if (Number(table.total_amount) > 0) {
                      if (confirm('Bu masada ürün var. Masayı yine de kapatmak istiyor musunuz?')) {
                        cancelSessionMutation.mutate(table.current_session_id);
                      }
                    } else {
                      cancelSessionMutation.mutate(table.current_session_id);
                    }
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Table Action Modal ─── */}
      {selectedTableForAction && (
        <TableControlModal
          table={selectedTableForAction}
          onClose={() => setSelectedTableForAction(null)}
          onStart={(guestCount) => {
            openSessionMutation.mutate({
              tableId: selectedTableForAction.id,
              guestCount,
            });
          }}
          onStartOnly={(guestCount) => {
            openSessionOnlyMutation.mutate({
              tableId: selectedTableForAction.id,
              guestCount,
            });
          }}
          onGoToSession={() => {
            if (selectedTableForAction.current_session_id) {
              router.push(`/waiter/session/${selectedTableForAction.current_session_id}`);
            }
          }}
          onGoToPayment={() => {
            if (selectedTableForAction.current_session_id) {
              router.push(`/cashier/session/${selectedTableForAction.current_session_id}`);
            }
          }}
          onCancelSession={() => {
            if (selectedTableForAction.current_session_id) {
              cancelSessionMutation.mutate(selectedTableForAction.current_session_id);
            }
          }}
          isPending={
            openSessionMutation.isPending ||
            openSessionOnlyMutation.isPending ||
            cancelSessionMutation.isPending
          }
        />
      )}

      {/* ─── Add Table Modal ─── */}
      {showAddTableModal && (
        <AddTableModal
          areas={areas}
          defaultAreaId={selectedArea || areas[0]?.id}
          onClose={() => setShowAddTableModal(false)}
          onSuccess={() => {
            setShowAddTableModal(false);
            queryClient.invalidateQueries({ queryKey: ['tables'] });
            queryClient.invalidateQueries({ queryKey: ['areas'] });
          }}
        />
      )}
    </div>
  );
}

// ─── Individual Table Card ───
function TableCard({
  table,
  onClick,
  onQuickOpen,
  onQuickClose,
}: {
  table: Table;
  onClick: () => void;
  onQuickOpen: () => void;
  onQuickClose: () => void;
}) {
  const router = useRouter();
  const isOccupied = table.status === 'occupied' || !!table.current_session_id;
  const elapsed = useElapsedTime(isOccupied ? table.session_opened_at : null);
  const amount = Number(table.total_amount || 0);
  const hasItems = amount > 0;

  return (
    <div
      className={clsx(
        'rounded-2xl border flex flex-col shadow-sm transition-all relative overflow-hidden',
        isOccupied
          ? 'bg-[#38bdf8] border-[#0284c7]/30 shadow-sky-200'
          : 'bg-white border-slate-200'
      )}
    >
      {/* Main clickable area */}
      <button
        onClick={onClick}
        className="flex-1 flex flex-col items-center justify-center py-3 px-1.5 active:opacity-80 min-h-[56px]"
      >
        <span
          className={clsx(
            'font-black text-sm sm:text-base leading-none',
            isOccupied ? 'text-white' : 'text-slate-800'
          )}
        >
          {table.name}
        </span>

        {/* Elapsed time */}
        {isOccupied && elapsed && (
          <span className="text-[9px] font-bold text-white/80 mt-0.5 flex items-center gap-0.5">
            <Clock className="w-2 h-2" />
            {elapsed}
          </span>
        )}

        {/* Amount */}
        {isOccupied && (
          <span className="text-[10px] font-bold text-white/90 mt-0.5">
            ₺{Math.round(amount)}
          </span>
        )}
      </button>

      {/* Quick Action Row */}
      <div
        className={clsx(
          'flex border-t',
          isOccupied ? 'border-white/20' : 'border-slate-100'
        )}
      >
        {isOccupied ? (
          hasItems ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (table.current_session_id) {
                  router.push(`/cashier/session/${table.current_session_id}`);
                }
              }}
              className="flex-1 py-1.5 text-[9px] font-black text-white/95 hover:bg-white/15 active:bg-white/25 flex items-center justify-center gap-0.5 transition-colors"
              title="Ödeme Ekranına Git"
            >
              <CreditCard className="w-2.5 h-2.5" />
              Ödeme
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickClose(); }}
              className="flex-1 py-1.5 text-[9px] font-black text-white/90 hover:bg-white/15 active:bg-white/25 flex items-center justify-center gap-0.5 transition-colors"
              title="Boş Masayı Kapat"
            >
              <X className="w-2.5 h-2.5" />
              Kapat
            </button>
          )
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onQuickOpen(); }}
            className="flex-1 py-1.5 text-[9px] font-black text-slate-600 hover:bg-orange-50 hover:text-orange-600 active:bg-orange-100 flex items-center justify-center gap-0.5 transition-colors"
            title="Masayı Aç"
          >
            <Play className="w-2.5 h-2.5" />
            Aç
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Table Control Modal ───
function TableControlModal({
  table,
  onClose,
  onStart,
  onStartOnly,
  onGoToSession,
  onGoToPayment,
  onCancelSession,
  isPending,
}: {
  table: Table;
  onClose: () => void;
  onStart: (guestCount: number) => void;
  onStartOnly: (guestCount: number) => void;
  onGoToSession: () => void;
  onGoToPayment: () => void;
  onCancelSession: () => void;
  isPending: boolean;
}) {
  const isOccupied = table.status === 'occupied' || !!table.current_session_id;
  const [guestCount, setGuestCount] = useState(2);
  const elapsed = useElapsedTime(isOccupied ? table.session_opened_at : null);
  const amount = Number(table.total_amount || 0);
  const hasItems = amount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px]">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-sm shadow-2xl border border-slate-200 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div
              className={clsx(
                'w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-xs',
                isOccupied ? 'bg-[#38bdf8]' : 'bg-slate-700'
              )}
            >
              {table.name}
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">{table.name} Masası</h2>
              <p className="text-xs text-slate-500 font-semibold">{table.area_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status */}
        <div
          className={clsx(
            'p-3.5 rounded-2xl border mb-4 flex items-center justify-between',
            isOccupied
              ? 'bg-sky-50 border-sky-200 text-sky-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          )}
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider block opacity-70">Durum</span>
            <span className="text-sm font-black mt-0.5 flex items-center gap-1">
              {isOccupied ? '● Dolu' : '○ Boş'}
            </span>
            {isOccupied && elapsed && (
              <span className="text-xs font-bold text-sky-600 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {elapsed} açık
              </span>
            )}
          </div>
          {isOccupied && (
            <div className="text-right">
              <span className="text-[10px] font-bold text-sky-700 block uppercase">Tutar</span>
              <span className="text-xl font-black text-sky-900">₺{amount.toFixed(0)}</span>
            </div>
          )}
        </div>

        {/* Empty table controls */}
        {!isOccupied && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Kişi Sayısı</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setGuestCount(num)}
                    className={clsx(
                      'py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 border',
                      guestCount === num
                        ? 'bg-orange-500 text-white border-orange-600'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    )}
                  >
                    {num}k
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onStartOnly(guestCount)}
                disabled={isPending}
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-98 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Sadece Aç
              </button>
              <button
                onClick={() => onStart(guestCount)}
                disabled={isPending}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Aç &amp; Sipariş
              </button>
            </div>
          </div>
        )}

        {/* Occupied table controls */}
        {isOccupied && (
          <div className="space-y-2.5">
            <button
              onClick={onGoToSession}
              className="w-full bg-[#38bdf8] hover:bg-[#0284c7] text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-98 transition-colors"
            >
              <Coffee className="w-4 h-4" />
              Sipariş Ekranına Git
            </button>

            <button
              onClick={onGoToPayment}
              className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xs active:scale-98 transition-colors"
            >
              <CreditCard className="w-4 h-4 text-orange-500" />
              Hesap Al / Ödeme Ekranı
            </button>

            {hasItems ? (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs font-semibold text-center">
                Masada ₺{amount.toFixed(0)} tutarında ürün bulunuyor. Masayı kapatmak için önce ödeme alınız.
              </div>
            ) : (
              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={() => {
                    if (confirm(`${table.name} masasını kapatmak istediğinize emin misiniz?`)) {
                      onCancelSession();
                    }
                  }}
                  disabled={isPending}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 border border-red-200 active:scale-98 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Boş Masayı Kapat &amp; Bırak
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Table Modal (Single & Bulk) ───
function AddTableModal({
  areas,
  defaultAreaId,
  onClose,
  onSuccess,
}: {
  areas: Area[];
  defaultAreaId?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  
  // Single mode state
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState<string>(String(defaultAreaId || areas[0]?.id || ''));
  const [capacity, setCapacity] = useState('4');

  // Bulk mode state
  const [prefix, setPrefix] = useState('M');
  const [startNum, setStartNum] = useState(1);
  const [count, setCount] = useState(10);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/tables', data),
    onSuccess: () => {
      toast.success('Masa başarıyla eklendi');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Masa eklenemedi'),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (data: any) => api.post('/tables/bulk', data),
    onSuccess: (res) => {
      toast.success(`${res.data.count || count} adet masa başarıyla oluşturuldu!`);
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Toplu masa eklenemedi'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'single') {
      if (!name.trim()) return toast.error('Masa adı giriniz');
      createMutation.mutate({
        name: name.trim(),
        area_id: parseInt(areaId) || null,
        capacity: parseInt(capacity) || 4,
      });
    } else {
      if (count <= 0) return toast.error('Geçerli bir adet giriniz');
      bulkCreateMutation.mutate({
        prefix: prefix.trim(),
        start_number: startNum,
        count: Math.min(count, 100),
        area_id: parseInt(areaId) || null,
        capacity: parseInt(capacity) || 4,
      });
    }
  };

  // Preview generated table names for bulk mode
  const previewNames = useMemo(() => {
    if (mode !== 'bulk') return [];
    const list: string[] = [];
    const total = Math.min(Math.max(1, count), 100);
    const pfx = prefix;
    for (let i = 0; i < total; i++) {
      list.push(`${pfx}${startNum + i}`);
    }
    return list;
  }, [mode, prefix, startNum, count]);

  const inputClass =
    'w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-2.5 text-slate-800 text-sm font-semibold placeholder-slate-400 focus:outline-none focus:border-orange-500';

  const isPending = createMutation.isPending || bulkCreateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] p-2 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-orange-500" />
            <span>Masa Ekle</span>
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector (Tekli / Toplu) */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={clsx(
              'py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
              mode === 'single'
                ? 'bg-white text-slate-900 shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Tekli Masa</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={clsx(
              'py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
              mode === 'bulk'
                ? 'bg-white text-orange-600 shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Toplu Masa Ekle</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Mode 1: Single Table Form */}
          {mode === 'single' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Masa Adı / Kodu *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Örn: B43, Teras 5, VIP 2"
                  className={inputClass}
                  autoFocus
                  required
                />
              </div>
            </>
          )}

          {/* Mode 2: Bulk Table Form */}
          {mode === 'bulk' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Ön Ek (Harf/Kod)</label>
                  <input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="M, A, B-"
                    className={inputClass}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Başlangıç No</label>
                  <input
                    type="number"
                    min="1"
                    value={startNum}
                    onChange={(e) => setStartNum(Math.max(1, parseInt(e.target.value) || 1))}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Adet</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={count}
                    onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              {/* Quick Count Add Pills */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-semibold text-slate-400">Hızlı Seçim:</span>
                {[5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={clsx(
                      'px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all',
                      count === n
                        ? 'bg-orange-50 text-orange-700 border-orange-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    {n} Masa
                  </button>
                ))}
              </div>

              {/* Live Preview of generated names */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>Oluşturulacak Masalar</span>
                  <span className="text-orange-600 font-black">{previewNames.length} Adet</span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar pt-0.5">
                  {previewNames.slice(0, 18).map((pName, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-[10px] font-mono font-bold shadow-2xs"
                    >
                      {pName}
                    </span>
                  ))}
                  {previewNames.length > 18 && (
                    <span className="px-2 py-0.5 text-slate-400 text-[10px] font-bold">
                      +{previewNames.length - 18} daha...
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Common fields: Area & Capacity */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bulunduğu Alan *</label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className={inputClass + ' cursor-pointer'}
                required
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kapasite (Kişi)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-2xl text-xs"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3 rounded-2xl text-xs shadow-md disabled:opacity-50 transition-all active:scale-98"
            >
              {isPending ? 'Ekleniyor...' : mode === 'bulk' ? `${count} Masayı Oluştur` : 'Masa Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
