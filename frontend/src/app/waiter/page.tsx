'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  Coffee, CreditCard, X, Plus, Play, Clock, ChevronDown, Hash, Layers
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
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

const inputClass =
  'w-full border rounded-2xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-orange-500 transition-colors';
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' };

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
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedArea, setSelectedArea] = useState<number | null>(null);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [selectedTableForAction, setSelectedTableForAction] = useState<Table | null>(null);
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false);

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

  const occupiedCount = tables.filter((t) => t.status === 'occupied' || !!t.current_session_id).length;
  const selectedAreaName = selectedArea ? areas.find(a => a.id === selectedArea)?.name || 'Seçili Alan' : 'Tüm Masalar';

  return (
    <MainLayout>
      {/* ─── Top Bar (area filter + actions) ─── */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        {/* Area Filter */}
        <div className="flex-1 overflow-hidden">
          {/* Desktop area buttons */}
          <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setSelectedArea(null)}
              className={clsx(
                'px-3 py-2 rounded-xl font-semibold text-xs transition-all active:scale-95 border flex-shrink-0',
                selectedArea === null
                  ? 'bg-white/15 text-white border-white/20'
                  : 'bg-white/5 text-[var(--text-2)] border-transparent hover:bg-white/10'
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
                    'px-3 py-2 rounded-xl font-semibold text-xs transition-all active:scale-95 border whitespace-nowrap flex-shrink-0',
                    selectedArea === area.id
                      ? 'bg-white/15 text-white border-white/20'
                      : 'bg-white/5 text-[var(--text-2)] border-transparent hover:bg-white/10'
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
              className="w-full flex items-center justify-between bg-white/10 border border-white/10 px-3 py-2 rounded-xl text-xs font-semibold text-white"
            >
              <span>{selectedAreaName} ({filteredTables.length})</span>
              <ChevronDown className={clsx('w-3.5 h-3.5 text-[var(--text-muted)] transition-transform', areaDropdownOpen && 'rotate-180')} />
            </button>
            {areaDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-30 overflow-hidden">
                <button
                  onClick={() => { setSelectedArea(null); setAreaDropdownOpen(false); }}
                  className={clsx('w-full text-left px-4 py-3 text-xs font-semibold transition-colors', selectedArea === null ? 'text-[var(--brand)]' : 'text-[var(--text-2)] hover:bg-white/5')}
                >
                  Tüm Masalar ({tables.length})
                </button>
                {areas.map(area => {
                  const count = tables.filter(t => t.area_id === area.id).length;
                  return (
                    <button
                      key={area.id}
                      onClick={() => { setSelectedArea(area.id); setAreaDropdownOpen(false); }}
                      className={clsx('w-full text-left px-4 py-3 text-xs font-semibold border-t border-[var(--border)] transition-colors', selectedArea === area.id ? 'text-[var(--brand)]' : 'text-[var(--text-2)] hover:bg-white/5')}
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
          <div className="bg-white/10 border border-white/10 px-3 py-2 rounded-xl text-center hidden xs:flex flex-col items-center">
            <span className="text-[11px] font-bold text-white leading-none">{occupiedCount}</span>
            <span className="text-[9px] font-medium text-[var(--text-muted)] leading-none mt-0.5">/{tables.length}</span>
          </div>
          <button
            onClick={() => setShowAddTableModal(true)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 active:scale-95 shadow-sm"
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
      <div className="overflow-y-auto custom-scrollbar -mx-1">
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5 px-1">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/10 animate-pulse" />
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)] gap-3">
            <Coffee className="w-12 h-12 opacity-30" />
            <p className="text-sm font-semibold">Bu alanda masa yok</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5 px-1 content-start">
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
    </MainLayout>
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
        'rounded-2xl border flex flex-col shadow-sm transition-all relative overflow-hidden self-start',
        isOccupied
          ? 'border-transparent'
          : 'border-transparent'
      )}
      style={{
        background: isOccupied ? 'var(--card-hover)' : 'var(--card)',
        borderColor: isOccupied ? 'var(--sky)' : 'var(--border)',
        height: '88px',
        boxShadow: isOccupied ? `inset 0 0 0 1.5px var(--sky)` : undefined,
      }}
    >
      {/* Status dot */}
      <span
        className="absolute top-2 right-2 w-2 h-2 rounded-full"
        style={{ background: isOccupied ? 'var(--sky)' : 'var(--text-muted)' }}
      />

      {/* Main clickable area */}
      <button
        onClick={onClick}
        className="flex-1 flex flex-col items-center justify-center py-2 px-1.5 active:opacity-80"
      >
        <span
          className="font-black text-sm sm:text-base leading-none"
          style={{ color: 'var(--text)' }}
        >
          {table.name}
        </span>

        {isOccupied && (
          <>
            {elapsed && (
              <span className="text-[9px] font-bold mt-0.5 flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
                <Clock className="w-2 h-2" />
                {elapsed}
              </span>
            )}
            <span className="text-[10px] font-black mt-0.5" style={{ color: 'var(--brand)' }}>
              ₺{Math.round(amount)}
            </span>
          </>
        )}
      </button>

      {/* Quick Action Row */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        {isOccupied ? (
          hasItems ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (table.current_session_id) {
                  router.push(`/cashier/session/${table.current_session_id}`);
                }
              }}
              className="w-full py-1.5 text-[9px] font-black hover:bg-white/10 active:bg-white/20 flex items-center justify-center gap-0.5 transition-colors"
              style={{ color: 'var(--text)' }}
              title="Ödeme Ekranına Git"
            >
              <CreditCard className="w-2.5 h-2.5" />
              Ödeme
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickClose(); }}
              className="w-full py-1.5 text-[9px] font-black hover:bg-white/10 active:bg-white/20 flex items-center justify-center gap-0.5 transition-colors"
              style={{ color: 'var(--text-2)' }}
              title="Boş Masayı Kapat"
            >
              <X className="w-2.5 h-2.5" />
              Kapat
            </button>
          )
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onQuickOpen(); }}
            className="w-full py-1.5 text-[9px] font-black hover:bg-white/10 active:bg-white/20 flex items-center justify-center gap-0.5 transition-colors"
            style={{ color: 'var(--brand)' }}
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
      <div className="rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-sm shadow-2xl animate-slide-up" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-xs"
              style={{ background: isOccupied ? 'var(--sky)' : 'var(--card-hover)' }}
            >
              {table.name}
            </div>
            <div>
              <h2 className="text-sm font-black" style={{ color: 'var(--text)' }}>{table.name} Masası</h2>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{table.area_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 transition-colors" style={{ color: 'var(--text-2)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status */}
        <div
          className="p-3.5 rounded-2xl border mb-4 flex items-center justify-between"
          style={{
            background: isOccupied ? 'rgba(62,166,255,0.08)' : 'rgba(74,222,128,0.08)',
            borderColor: isOccupied ? 'rgba(62,166,255,0.25)' : 'rgba(74,222,128,0.25)',
          }}
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider block opacity-70" style={{ color: 'var(--text-2)' }}>Durum</span>
            <span className="text-sm font-black mt-0.5 flex items-center gap-1" style={{ color: 'var(--text)' }}>
              {isOccupied ? '● Dolu' : '○ Bos'}
            </span>
            {isOccupied && elapsed && (
              <span className="text-xs font-bold flex items-center gap-1 mt-0.5" style={{ color: 'var(--sky)' }}>
                <Clock className="w-3 h-3" />
                {elapsed} açık
              </span>
            )}
          </div>
          {isOccupied && (
            <div className="text-right">
              <span className="text-[10px] font-bold block uppercase" style={{ color: 'var(--sky)' }}>Tutar</span>
              <span className="text-xl font-black" style={{ color: 'var(--text)' }}>₺{amount.toFixed(0)}</span>
            </div>
          )}
        </div>

        {/* Empty table controls */}
        {!isOccupied && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-2)' }}>Kisi Sayısı</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setGuestCount(num)}
                    className={clsx(
                      'py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 border',
                      guestCount === num
                        ? 'text-white'
                        : 'hover:bg-white/10'
                    )}
                    style={guestCount === num
                      ? { background: 'var(--brand)', borderColor: 'var(--brand)' }
                      : { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
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
                className="text-white font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-98 disabled:opacity-50"
                style={{ background: 'var(--card-hover)' }}
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Sadece Aç
              </button>
              <button
                onClick={() => onStart(guestCount)}
                disabled={isPending}
                className="text-white font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 disabled:opacity-50"
                style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}
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
              className="w-full text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-98 transition-colors"
              style={{ background: 'var(--sky-d)' }}
            >
              <Coffee className="w-4 h-4" />
              Sipariş Ekranına Git
            </button>

            <button
              onClick={onGoToPayment}
              className="w-full font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xs active:scale-98 transition-colors"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <CreditCard className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              Hesap Al / Ödeme Ekranı
            </button>

            {hasItems ? (
              <div className="p-3 rounded-2xl border text-xs font-semibold text-center" style={{ background: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.30)', color: 'var(--brand)' }}>
                Masada ₺{amount.toFixed(0)} tutarında ürün bulunuyor. Masayı kapatmak için önce ödeme alınız.
              </div>
            ) : (
              <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => {
                    if (confirm(`${table.name} masasını kapatmak istediğinize emin misiniz?`)) {
                      onCancelSession();
                    }
                  }}
                  disabled={isPending}
                  className="w-full font-bold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 border active:scale-98 disabled:opacity-50"
                  style={{ background: 'rgba(248,113,113,0.10)', borderColor: 'rgba(248,113,113,0.30)', color: 'var(--danger)' }}
                >
                  <X className="w-4 h-4" />
                  Bos Masayı Kapat &amp; Bırak
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

  const inputClassDark =
    'w-full border rounded-2xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-orange-500 transition-colors';

  const isPending = createMutation.isPending || bulkCreateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] p-2 sm:p-4">
      <div className="rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl animate-slide-up" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-black flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Plus className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            <span>Masa Ekle</span>
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 transition-colors" style={{ color: 'var(--text-2)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector (Tekli / Toplu) */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl mb-4 text-xs font-bold" style={{ background: 'var(--app)' }}>
          <button
            type="button"
            onClick={() => setMode('single')}
            className={clsx(
              'py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
              mode === 'single' ? 'shadow-xs font-black' : 'hover:bg-white/5'
            )}
            style={mode === 'single'
              ? { background: 'var(--card)', color: 'var(--text)' }
              : { color: 'var(--text-2)' }}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Tekli Masa</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={clsx(
              'py-2 rounded-xl transition-all flex items-center justify-center gap-1.5',
              mode === 'bulk' ? 'shadow-xs font-black' : 'hover:bg-white/5'
            )}
            style={mode === 'bulk'
              ? { background: 'var(--card)', color: 'var(--brand)' }
              : { color: 'var(--text-2)' }}
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
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-2)' }}>Masa Adı / Kodu *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Örn: B43, Teras 5, VIP 2"
                  className={inputClassDark}
                  style={inputStyle}
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
                  <label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--text-2)' }}>Ön Ek (Harf/Kod)</label>
                  <input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="M, A, B-"
                    className={inputClassDark}
                    style={inputStyle}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--text-2)' }}>Baslangıç No</label>
                  <input
                    type="number"
                    min="1"
                    value={startNum}
                    onChange={(e) => setStartNum(Math.max(1, parseInt(e.target.value) || 1))}
                    className={inputClassDark}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--text-2)' }}>Adet</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={count}
                    onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                    className={inputClassDark}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              {/* Quick Count Add Pills */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Hızlı Secim:</span>
                {[5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={clsx(
                      'px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all',
                      count === n ? 'shadow-2xs' : 'hover:bg-white/10'
                    )}
                    style={count === n
                      ? { background: 'rgba(255,102,0,0.12)', color: 'var(--brand)', borderColor: 'rgba(255,102,0,0.35)' }
                      : { background: 'var(--card)', color: 'var(--text-2)', borderColor: 'var(--border)' }}
                  >
                    {n} Masa
                  </button>
                ))}
              </div>

              {/* Live Preview of generated names */}
              <div className="p-3 rounded-2xl border space-y-1.5" style={{ background: 'var(--app)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: 'var(--text-2)' }}>
                  <span>Olusturulacak Masalar</span>
                  <span className="font-black" style={{ color: 'var(--brand)' }}>{previewNames.length} Adet</span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar pt-0.5">
                  {previewNames.slice(0, 18).map((pName, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border"
                      style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    >
                      {pName}
                    </span>
                  ))}
                  {previewNames.length > 18 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
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
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-2)' }}>Bulunduğu Alan *</label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className={inputClassDark + ' cursor-pointer'}
                style={inputStyle}
                required
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-2)' }}>Kapasite (Kisi)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className={inputClassDark}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 font-bold py-3 rounded-2xl text-xs hover:bg-white/10 transition-colors"
              style={{ background: 'var(--app)', color: 'var(--text-2)' }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 text-white font-bold py-3 rounded-2xl text-xs shadow-md disabled:opacity-50 transition-all active:scale-98"
              style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}
            >
              {isPending ? 'Ekleniyor...' : mode === 'bulk' ? `${count} Masayı Olustur` : 'Masa Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
