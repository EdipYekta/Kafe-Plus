'use client';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import MainLayout from '@/components/layout/MainLayout';
import {
  CreditCard, Banknote, ShoppingBag, TrendingUp, TrendingDown,
  Calendar, Search, X, FileText, Printer, Check, AlertTriangle,
  ArrowRight, Repeat, Plus, Trash2, Tag, Coffee, Layers, DollarSign, Receipt
} from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import Link from 'next/link';

const REPORT_PERIODS = [
  { label: 'Bugün', days: 0 },
  { label: '7 Gün', days: 7 },
  { label: '30 Gün', days: 30 },
  { label: '90 Gün', days: 90 },
];

const EXPENSE_TYPES = ['Kira', 'Fatura', 'Tedarik', 'Personel', 'Temizlik', 'Bakım', 'Diğer'];

const RECURRENCE_LABELS: Record<string, string> = {
  monthly: 'Aylık',
  weekly: 'Haftalık',
  yearly: 'Yıllık',
  one_time: 'Tek Seferlik',
};

export default function UnifiedCashierAndFinancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { user } = useAuthStore();

  // Redirect Waiter role away from financial hub
  useEffect(() => {
    if (user && user.role === 'Waiter') {
      router.replace('/waiter');
    }
  }, [user, router]);

  // Tab State: 'kasa' | 'gecmis' | 'ciro' | 'giderler'
  const paramTab = searchParams.get('tab');
  const initialTab = (paramTab && ['kasa', 'gecmis', 'ciro', 'giderler'].includes(paramTab))
    ? (paramTab as 'kasa' | 'gecmis' | 'ciro' | 'giderler')
    : 'kasa';

  const [activeTab, setActiveTab] = useState<'kasa' | 'gecmis' | 'ciro' | 'giderler'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Sub-states for Geçmiş ───
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'cash' | 'credit_card' | 'meal_card'>('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [showZReportModal, setShowZReportModal] = useState(false);

  // ─── Sub-states for Ciro / Raporlar ───
  const [reportPeriod, setReportPeriod] = useState(7);

  // ─── Sub-states for Giderler ───
  const [expenseSubTab, setExpenseSubTab] = useState<'expenses' | 'structures'>('expenses');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);

  // ═══════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════

  // 1. Tables Query (Açık Kasa)
  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: () => api.get('/tables').then((r) => r.data),
    refetchInterval: 10000,
  });

  // 2. Payment History Query (Geçmiş)
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['payment-history', selectedDate, historyPage, searchQuery, paymentTypeFilter],
    queryFn: () =>
      api.get('/payments/history', {
        params: {
          date: selectedDate,
          page: historyPage,
          limit: 6,
          search: searchQuery.trim() || undefined,
          payment_type: paymentTypeFilter !== 'all' ? paymentTypeFilter : undefined,
        },
      }).then((r) => r.data),
    refetchInterval: 15000,
  });

  // 3. Reports Range Query (Ciro Raporları)
  const reportEnd = new Date().toISOString().split('T')[0];
  const reportStart = reportPeriod === 0 ? reportEnd : format(subDays(new Date(), reportPeriod), 'yyyy-MM-dd');

  const { data: rangeData = [] } = useQuery({
    queryKey: ['reports-range', reportStart, reportEnd],
    queryFn: () => api.get('/reports/range', { params: { start: reportStart, end: reportEnd } }).then((r) => r.data),
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then((r) => r.data),
    refetchInterval: 30000,
  });

  // 4. Expenses Queries
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get('/expenses').then((r) => r.data),
  });

  const { data: structures = [] } = useQuery({
    queryKey: ['expense-structures'],
    queryFn: () => api.get('/expenses/structures').then((r) => r.data),
  });

  // ═══════════════════════════════════════════════
  // MUTATIONS
  // ═══════════════════════════════════════════════

  // End of Day (Z-Report)
  const endOfDayMutation = useMutation({
    mutationFn: () => api.post('/reports/end-of-day', { notes: 'Kasa gün sonu kapatıldı' }),
    onSuccess: () => {
      toast.success('Gün sonu başarıyla tamamlandı!');
      qc.invalidateQueries({ queryKey: ['payment-history'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setShowZReportModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Gün sonu işlemi başarısız'),
  });

  // Delete Expense
  const deleteExpenseMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      toast.success('Masraf kaydı silindi');
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Masraf silinemedi'),
  });

  // ═══════════════════════════════════════════════
  // CALCULATIONS
  // ═══════════════════════════════════════════════

  // Filtered Occupied Tables with Natural Numeric Sort
  const occupiedTables = useMemo(() => {
    return tables
      .filter((t: any) => {
        const isOccupied = t.status === 'occupied' && t.current_session_id;
        if (!isOccupied) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.name?.toLowerCase().includes(q) ||
          t.area_name?.toLowerCase().includes(q) ||
          t.waiter_name?.toLowerCase().includes(q)
        );
      })
      .sort((a: any, b: any) => {
        if ((a.area_id || 0) !== (b.area_id || 0)) {
          return (a.area_id || 0) - (b.area_id || 0);
        }
        return (a.name || '').localeCompare(b.name || '', 'tr', { numeric: true, sensitivity: 'base' });
      });
  }, [tables, searchQuery]);

  const totalPendingAmount = occupiedTables.reduce((s: number, t: any) => s + Number(t.total_amount || 0), 0);

  // History calculations
  const transactions = historyData?.transactions || [];
  const metrics = historyData?.metrics || {};
  const totalHistoryCount = historyData?.totalCount || 0;
  const totalHistoryPages = Math.max(1, Math.ceil(totalHistoryCount / 6));

  // Report calculations
  const totalRevenue = rangeData.reduce((s: number, d: any) => s + Number(d.revenue || 0), 0);
  const totalCash = rangeData.reduce((s: number, d: any) => s + Number(d.cash || 0), 0);
  const totalCard = rangeData.reduce((s: number, d: any) => s + Number(d.card || 0), 0);
  const totalMeal = rangeData.reduce((s: number, d: any) => s + Number(d.meal_card || 0), 0);
  const totalSessions = rangeData.reduce((s: number, d: any) => s + Number(d.sessions || 0), 0);

  // Expense calculations
  const totalThisMonthExpenses = expenses
    .filter((e: any) => new Date(e.created_at || e.expense_date).getMonth() === new Date().getMonth())
    .reduce((s: number, e: any) => s + Number(e.amount), 0);

  const totalRecurringMonthly = structures
    .filter((s: any) => s.recurrence_type === 'monthly')
    .reduce((s: number, e: any) => s + Number(e.amount), 0);

  const netIncomeThisMonth = Number(metrics.month_total || 0) - totalThisMonthExpenses;

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        {/* ─── Top Header & Universal Navigation Tabs ─── */}
        <div className="bg-panel p-4 sm:p-5 rounded-3xl border border-theme shadow-theme space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-main tracking-tight flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-500" />
                <span>Kasa, Ciro &amp; Masraflar Merkezi</span>
              </h1>
              <p className="text-muted text-xs font-semibold mt-0.5">
                Tüm kasa işlemleri, ödeme geçmişi, ciro raporları ve gider takibi tek ekranda
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowZReportModal(true)}
                className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold px-4 py-2 rounded-2xl text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <FileText className="w-4 h-4" />
                <span>Günü Bitir (Z-Raporu)</span>
              </button>
              <Link
                href="/waiter"
                className="bg-card hover:bg-card-hover border border-theme text-main font-bold px-4 py-2 rounded-2xl text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <Coffee className="w-4 h-4 text-sky-500" />
                <span>Masa Haritası</span>
              </Link>
            </div>
          </div>

          {/* 4 Unified Hub Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 pt-1">
            {[
              { id: 'kasa', label: 'Açık Masalar & Kasa', count: occupiedTables.length, icon: CreditCard },
              { id: 'gecmis', label: 'Ödeme & İşlem Geçmişi', count: totalHistoryCount, icon: Receipt },
              { id: 'ciro', label: 'Ciro & Satış Raporları', icon: TrendingUp },
              { id: 'giderler', label: 'Giderler & Masraflar', count: expenses.length, icon: TrendingDown },
            ].map(({ id, label, count, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setActiveTab(id as any);
                  setSearchQuery('');
                }}
                className={clsx(
                  'px-4 py-2.5 rounded-2xl font-bold text-xs transition-all duration-150 flex items-center gap-2 whitespace-nowrap shadow-xs border flex-shrink-0 active:scale-95',
                  activeTab === id
                    ? 'bg-card text-main border-theme ring-2 ring-orange-400/30 shadow-sm font-black'
                    : 'bg-card/60 text-muted border-transparent hover:bg-card hover:text-main'
                )}
              >
                <Icon className={clsx('w-4 h-4', activeTab === id ? 'text-orange-500' : 'text-muted')} />
                <span>{label}</span>
                {count !== undefined && count > 0 && (
                  <span className={clsx(
                    'text-[10px] px-2 py-0.2 rounded-full font-black',
                    activeTab === id ? 'bg-orange-500 text-white' : 'bg-panel text-muted'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            TAB 1: AÇIK MASALAR & KASA
        ═══════════════════════════════════════════════ */}
        {activeTab === 'kasa' && (
          <div className="space-y-3">
            {/* Search and Summary Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-theme shadow-theme">
              <div className="flex-1 max-w-md relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Masa adı, salon veya garson ara..."
                  className="w-full bg-panel-subtle border border-theme rounded-2xl pl-10 pr-9 py-2 text-xs font-bold text-main placeholder-slate-400 focus:outline-none focus:border-orange-500 shadow-xs"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted">
                  Açık Masalar: <strong className="text-main">{occupiedTables.length}</strong>
                </span>
                <span className="text-sm font-black text-orange-600 bg-orange-50 px-3.5 py-1.5 rounded-2xl border border-orange-200">
                  Toplam Bekleyen: ₺{totalPendingAmount.toFixed(0)}
                </span>
              </div>
            </div>

            {/* Occupied Tables Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {occupiedTables.map((table: any) => (
                <div
                  key={table.id}
                  className="bg-card rounded-3xl p-4 border border-theme shadow-theme flex flex-col justify-between h-40 hover:border-orange-400 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-lg font-black text-main group-hover:text-orange-600 transition-colors">
                        {table.name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                        {table.area_name}
                      </span>
                    </div>
                    {table.waiter_name && (
                      <p className="text-[11px] text-muted font-medium truncate">
                        Garson: {table.waiter_name}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-theme-subtle flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted font-bold block uppercase">Tutar</span>
                      <span className="text-base font-black text-main">
                        ₺{Number(table.total_amount || 0).toFixed(0)}
                      </span>
                    </div>
                    <Link
                      href={`/cashier/session/${table.current_session_id}`}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all"
                    >
                      <span>Ödeme</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}

              {occupiedTables.length === 0 && !tablesLoading && (
                <div className="col-span-5 bg-card rounded-3xl p-16 text-center border border-theme text-muted text-xs font-bold">
                  {searchQuery ? 'Aramanıza uygun açık masa bulunamadı' : 'Şu anda ödeme bekleyen açık masa bulunmuyor'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 2: ÖDEME & İŞLEM GEÇMİŞİ
        ═══════════════════════════════════════════════ */}
        {activeTab === 'gecmis' && (
          <div className="space-y-4">
            {/* Top Filter and Search Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-theme shadow-theme">
              <div className="flex-1 max-w-md relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setHistoryPage(1); }}
                  placeholder="Geçmişte ara (Masa, kasiyer, not)..."
                  className="w-full bg-panel-subtle border border-theme rounded-2xl pl-10 pr-9 py-2 text-xs font-bold text-main placeholder-slate-400 focus:outline-none focus:border-orange-500 shadow-xs"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setHistoryPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Payment Type Filters */}
              <div className="flex items-center gap-1 bg-panel p-1 rounded-2xl border border-theme text-xs font-bold">
                {[
                  { id: 'all', label: 'Tümü' },
                  { id: 'cash', label: 'Nakit' },
                  { id: 'credit_card', label: 'Kart' },
                  { id: 'meal_card', label: 'Yemek' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { setPaymentTypeFilter(f.id as any); setHistoryPage(1); }}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-xl transition-all',
                      paymentTypeFilter === f.id
                        ? 'bg-card text-main shadow-xs font-black'
                        : 'text-muted hover:text-main'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main 2-Column: Left History Cards, Right Summaries */}
            <div className="grid grid-cols-12 gap-4">
              {/* Left Column: Transaction Cards */}
              <div className="col-span-12 lg:col-span-7 space-y-3">
                <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-theme-subtle">
                    <h2 className="text-sm font-black text-main">İşlem Listesi</h2>
                    <span className="text-xs font-semibold text-muted">{totalHistoryCount} işlem kaydı</span>
                  </div>

                  <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                    {historyLoading && (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-28 rounded-2xl bg-panel animate-pulse" />
                        ))}
                      </div>
                    )}

                    {!historyLoading && transactions.map((tx: any) => {
                      const d = tx.created_at ? new Date(tx.created_at) : new Date();
                      const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                      const discount = Number(tx.discount_amount || 0);
                      const cardAmt = Number(tx.card_amount || 0);
                      const cashAmt = Number(tx.cash_amount || 0);
                      const paidAmt = Number(tx.amount || 0);
                      const totalAmt = Number(tx.session_total || tx.amount || 0);

                      return (
                        <div
                          key={tx.id}
                          className="bg-panel rounded-2xl p-3 shadow-xs border border-theme-subtle space-y-2 hover:border-orange-400 transition-all"
                        >
                          <div className="flex items-center justify-between text-xs font-black text-main">
                            <span>Masa: {tx.table_name || 'Hızlı Satış'}{tx.area_name ? ` (${tx.area_name})` : ''}</span>
                            {tx.cashier_name && (
                              <span className="text-[10px] font-semibold text-muted">Kasiyer: {tx.cashier_name}</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-bold text-[#0284c7]">{dateStr}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-black text-emerald-600">+{paidAmt.toFixed(0)} ₺</span>
                              {discount > 0 && (
                                <span className="font-black text-orange-600">-{discount.toFixed(0)} ₺ indirim</span>
                              )}
                            </div>
                          </div>

                          {/* 5-box breakdown */}
                          <div className="grid grid-cols-5 gap-1 text-center text-[10px] pt-1.5 border-t border-theme-subtle">
                            {[
                              { label: 'Kart', value: cardAmt > 0 ? cardAmt.toFixed(0) : '-' },
                              { label: 'Nakit', value: cashAmt > 0 ? cashAmt.toFixed(0) : '-' },
                              { label: 'Ödenen', value: paidAmt.toFixed(0) },
                              { label: 'Toplam', value: totalAmt.toFixed(0) },
                              { label: 'İndirim', value: discount > 0 ? discount.toFixed(0) : '-' },
                            ].map(({ label, value }) => (
                              <div key={label}>
                                <span className="text-muted font-bold block mb-0.5 text-[9px]">{label}</span>
                                <div className="bg-card rounded-lg py-1 px-0.5 font-black text-[11px] text-main border border-theme-subtle">
                                  {value}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {!historyLoading && transactions.length === 0 && (
                      <div className="py-16 text-center text-muted text-xs font-bold">
                        {searchQuery ? 'Aramanıza uygun işlem kaydı bulunamadı' : 'Henüz ödeme geçmişi bulunmuyor'}
                      </div>
                    )}
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-center gap-3 pt-2 border-t border-theme-subtle">
                    <button
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage <= 1}
                      className="px-3.5 py-1.5 rounded-xl bg-panel hover:bg-panel-subtle border border-theme font-bold text-main text-xs disabled:opacity-40 shadow-xs active:scale-95"
                    >
                      &lt; Önceki
                    </button>
                    <span className="text-xs font-bold text-muted">{historyPage} / {totalHistoryPages}</span>
                    <button
                      onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                      disabled={historyPage >= totalHistoryPages}
                      className="px-3.5 py-1.5 rounded-xl bg-panel hover:bg-panel-subtle border border-theme font-bold text-main text-xs disabled:opacity-40 shadow-xs active:scale-95"
                    >
                      Sonraki &gt;
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: 4 Summary Groups */}
              <div className="col-span-12 lg:col-span-5 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  {/* Bu Hafta */}
                  <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme space-y-2">
                    <h3 className="text-xs font-black text-main uppercase tracking-wide">Bu Hafta</h3>
                    <SummaryFields
                      total={metrics.week_total}
                      card={metrics.week_card}
                      cash={metrics.week_cash}
                    />
                  </div>

                  {/* Seçilen Tarih */}
                  <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-main uppercase tracking-wide">Tarih</h3>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => { setSelectedDate(e.target.value); setHistoryPage(1); }}
                        className="bg-panel border border-theme rounded-xl px-2 py-0.5 text-[10px] font-bold text-main cursor-pointer"
                      />
                    </div>
                    <SummaryFields
                      total={metrics.date_total}
                      card={metrics.date_card}
                      cash={metrics.date_cash}
                    />
                  </div>

                  {/* Bu Ay */}
                  <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme space-y-2">
                    <h3 className="text-xs font-black text-main uppercase tracking-wide">Bu Ay</h3>
                    <SummaryFields
                      total={metrics.month_total}
                      card={metrics.month_card}
                      cash={metrics.month_cash}
                    />
                  </div>

                  {/* Bugün */}
                  <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-main uppercase tracking-wide">Bugün</h3>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Canlı
                      </span>
                    </div>
                    <SummaryFields
                      total={metrics.today_total}
                      card={metrics.today_card}
                      cash={metrics.today_cash}
                    />
                  </div>
                </div>

                {/* Big Action Box */}
                <div className="bg-card rounded-3xl p-5 border border-theme shadow-theme space-y-3">
                  <div className="flex items-center gap-2 text-sm font-black text-main">
                    <FileText className="w-5 h-5 text-orange-500" />
                    <span>Gün Sonu & Kasa Kapanışı</span>
                  </div>
                  <p className="text-xs text-muted">
                    Günlük hasılatı arşivlemek ve yeni çalışma gününe geçmek için Z-Raporu alabilirsiniz.
                  </p>
                  <button
                    onClick={() => setShowZReportModal(true)}
                    className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-black py-3 rounded-2xl text-xs shadow-md tracking-wide active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Z-Raporu Yazdır & Günü Bitir</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 3: CİRO & SATIŞ RAPORLARI
        ═══════════════════════════════════════════════ */}
        {activeTab === 'ciro' && (
          <div className="space-y-4">
            {/* Period Selector Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-theme shadow-theme">
              <div>
                <h2 className="text-sm font-black text-main">Satış & Gelir Analizi</h2>
                <p className="text-xs text-muted">Seçilen döneme ait net ciro ve ödeme dağılımları</p>
              </div>

              <div className="flex items-center gap-1.5 bg-panel p-1 rounded-2xl border border-theme shadow-xs">
                {REPORT_PERIODS.map(({ label, days }) => (
                  <button
                    key={days}
                    onClick={() => setReportPeriod(days)}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95',
                      reportPeriod === days
                        ? 'bg-[#38bdf8] text-white shadow-xs font-black'
                        : 'text-muted hover:text-main'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4 Summary Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted">Toplam Ciro</span>
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-main">₺{totalRevenue.toFixed(0)}</p>
                <p className="text-[11px] text-muted font-semibold mt-1">{totalSessions} oturum tamamlandı</p>
              </div>

              <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted">Nakit Ödeme</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Banknote className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-emerald-600">₺{totalCash.toFixed(0)}</p>
                <p className="text-[11px] text-muted font-semibold mt-1">Kasadaki fiziki nakit</p>
              </div>

              <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted">Kredi Kartı</span>
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-sky-600">₺{totalCard.toFixed(0)}</p>
                <p className="text-[11px] text-muted font-semibold mt-1">POS çekimleri toplamı</p>
              </div>

              <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted">Yemek Kartı</span>
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-purple-600">₺{totalMeal.toFixed(0)}</p>
                <p className="text-[11px] text-muted font-semibold mt-1">Sodexo, Multinet vb.</p>
              </div>
            </div>

            {/* Daily Breakdown Chart */}
            <div className="bg-card rounded-3xl p-5 border border-theme shadow-theme">
              <h2 className="text-sm font-bold text-main mb-1">Günlük Satış Dağılımı</h2>
              <p className="text-xs text-muted mb-4">Seçilen periyotta günlere göre ciro grafiği</p>

              <div className="h-64 w-full">
                {rangeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rangeData}>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => d.split('-').slice(1).join('/')}
                        tick={{ fill: '#7a8fa0', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => `₺${v}`}
                        tick={{ fill: '#7a8fa0', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(val: any) => [`₺${Number(val).toFixed(2)}`, 'Ciro']}
                        contentStyle={{
                          background: '#ffffff',
                          border: '1px solid rgba(0,0,0,0.10)',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#1e293b',
                        }}
                      />
                      <Bar dataKey="revenue" fill="#f97316" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted text-xs">
                    Seçilen aralıkta satış verisi bulunamadı
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 4: GİDERLER & MASRAFLAR
        ═══════════════════════════════════════════════ */}
        {activeTab === 'giderler' && (
          <div className="space-y-4">
            {/* Top Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-theme shadow-theme">
              <div>
                <h2 className="text-sm font-black text-main">Gider &amp; Masraf Yönetimi</h2>
                <p className="text-xs text-muted">Kira, faturalar, personel ve hammadde harcamalarını takip edin</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowStructureModal(true)}
                  className="flex items-center gap-1.5 bg-panel hover:bg-panel-subtle text-main px-4 py-2 rounded-2xl text-xs font-bold shadow-xs border border-theme transition-all active:scale-95"
                >
                  <Repeat className="w-3.5 h-3.5 text-sky-500" />
                  <span>Sabit Gider Tanımla</span>
                </button>
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2 rounded-2xl text-xs font-bold shadow-xs transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Masraf Gir</span>
                </button>
              </div>
            </div>

            {/* 3 Metric Cards with Net Profit */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-muted block">Bu Ayki Gerçekleşen Masraf</span>
                  <span className="text-2xl font-black text-red-600 mt-1 block">₺{totalThisMonthExpenses.toFixed(0)}</span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 font-bold border border-red-200">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-muted block">Aylık Sabit / Periyodik Gider</span>
                  <span className="text-2xl font-black text-sky-600 mt-1 block">₺{totalRecurringMonthly.toFixed(0)}</span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600 font-bold border border-sky-200">
                  <Repeat className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-muted block">Bu Ayki Net Kasa Durumu</span>
                  <span className={clsx(
                    'text-2xl font-black mt-1 block',
                    netIncomeThisMonth >= 0 ? 'text-emerald-600' : 'text-red-600'
                  )}>
                    ₺{netIncomeThisMonth.toFixed(0)}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold border border-emerald-200">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Expenses Sub-tabs */}
            <div className="flex gap-1.5 bg-panel p-1 rounded-2xl border border-theme shadow-xs w-fit">
              <button
                onClick={() => setExpenseSubTab('expenses')}
                className={clsx(
                  'px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95',
                  expenseSubTab === 'expenses'
                    ? 'bg-card text-main shadow-xs font-black border border-theme'
                    : 'text-muted hover:text-main'
                )}
              >
                Gerçekleşen Masraflar ({expenses.length})
              </button>
              <button
                onClick={() => setExpenseSubTab('structures')}
                className={clsx(
                  'px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95',
                  expenseSubTab === 'structures'
                    ? 'bg-card text-main shadow-xs font-black border border-theme'
                    : 'text-muted hover:text-main'
                )}
              >
                Sabit Gider Yapısı ({structures.length})
              </button>
            </div>

            {/* Sub-tab 1: Expenses List */}
            {expenseSubTab === 'expenses' && (
              <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme space-y-2">
                {expenses.map((expense: any) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-panel border border-theme-subtle shadow-xs hover:border-orange-400 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-main">{expense.title}</p>
                        <p className="text-[10px] text-muted font-medium">
                          {expense.expense_type} · {new Date(expense.created_at || expense.expense_date).toLocaleDateString('tr-TR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-black text-red-600">-₺{Number(expense.amount).toFixed(2)}</p>
                        <p className="text-[10px] text-muted">{expense.payment_method || 'Nakit'}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`"${expense.title}" masraf kaydını silmek istediğinize emin misiniz?`)) {
                            deleteExpenseMutation.mutate(expense.id);
                          }
                        }}
                        className="p-1.5 text-muted hover:text-red-600 rounded-lg transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {expenses.length === 0 && (
                  <div className="py-16 text-center text-muted text-xs font-bold">
                    Henüz kayıtlı bir masraf bulunmuyor
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Structures List */}
            {expenseSubTab === 'structures' && (
              <div className="bg-card rounded-3xl p-4 border border-theme shadow-theme">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {structures.map((st: any) => (
                    <div
                      key={st.id}
                      className="bg-panel rounded-2xl p-4 border border-theme-subtle shadow-xs flex flex-col justify-between h-36"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-main">{st.title}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                            {RECURRENCE_LABELS[st.recurrence_type] || st.recurrence_type}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted font-medium">{st.expense_type}</span>
                      </div>
                      <div className="pt-2 border-t border-theme-subtle flex items-center justify-between">
                        <span className="text-base font-black text-main">₺{Number(st.amount).toFixed(0)}</span>
                        <span className="text-[10px] text-muted">Otomatik Plan</span>
                      </div>
                    </div>
                  ))}

                  {structures.length === 0 && (
                    <div className="col-span-3 py-16 text-center text-muted text-xs font-bold">
                      Henüz tanımlanmış bir sabit gider yapısı bulunmuyor
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Z-Raporu / Gün Sonu Modal ─── */}
      {showZReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-slide-up space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-500" />
                <h3 className="text-base font-black text-slate-900">Gün Sonu (Z-Raporu)</h3>
              </div>
              <button onClick={() => setShowZReportModal(false)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-2 font-mono text-xs border border-slate-200">
              <p className="text-center font-black text-slate-800 border-b border-slate-200 pb-1">
                KAFE+ GÜN SONU KAPANIŞI
              </p>
              <p className="text-slate-500 text-[10px] text-center">
                Tarih: {new Date().toLocaleDateString('tr-TR')} · Saat: {new Date().toLocaleTimeString('tr-TR')}
              </p>
              <div className="pt-2 space-y-2">
                <div className="flex justify-between font-bold text-slate-900 text-sm">
                  <span>Günlük Toplam Ciro:</span>
                  <span className="text-emerald-600 font-black">₺{Number(metrics.today_total || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sky-600 font-bold">
                  <span>Kredi Kartı / POS:</span>
                  <span>₺{Number(metrics.today_card || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Nakit Kasa:</span>
                  <span>₺{Number(metrics.today_cash || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-2xl border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-amber-900">
                Onayladığınızda günlük kasa sayaçları arşivlenecek ve yeni gün başlatılacaktır.
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Yazdır
              </button>
              <button
                onClick={() => endOfDayMutation.mutate()}
                disabled={endOfDayMutation.isPending}
                className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-black py-3 rounded-2xl text-sm shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {endOfDayMutation.isPending ? 'Kapatılıyor...' : 'Günü Bitir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Expense Modal ─── */}
      {showExpenseModal && (
        <ExpenseModal
          onClose={() => setShowExpenseModal(false)}
          onSuccess={() => {
            setShowExpenseModal(false);
            qc.invalidateQueries({ queryKey: ['expenses'] });
          }}
        />
      )}

      {/* ─── Add Structure Modal ─── */}
      {showStructureModal && (
        <StructureModal
          onClose={() => setShowStructureModal(false)}
          onSuccess={() => {
            setShowStructureModal(false);
            qc.invalidateQueries({ queryKey: ['expense-structures'] });
          }}
        />
      )}
    </MainLayout>
  );
}

// ─── Summary Group Fields Component ───
function SummaryFields({
  total,
  card,
  cash,
}: {
  total?: number | string;
  card?: number | string;
  cash?: number | string;
}) {
  const fmt = (v?: number | string) =>
    Number(v || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' ₺';

  return (
    <div className="space-y-1.5">
      <div>
        <span className="text-[10px] font-bold text-muted block px-1 mb-0.5">Toplam</span>
        <div className="bg-panel rounded-xl py-1.5 px-2.5 font-black text-sm text-main border border-theme-subtle shadow-xs">
          {fmt(total)}
        </div>
      </div>
      <div>
        <span className="text-[10px] font-bold text-muted block px-1 mb-0.5">Kart</span>
        <div className="bg-panel rounded-xl py-1.5 px-2.5 font-bold text-xs text-sky-700 border border-theme-subtle shadow-xs">
          {fmt(card)}
        </div>
      </div>
      <div>
        <span className="text-[10px] font-bold text-muted block px-1 mb-0.5">Nakit</span>
        <div className="bg-panel rounded-xl py-1.5 px-2.5 font-bold text-xs text-emerald-700 border border-theme-subtle shadow-xs">
          {fmt(cash)}
        </div>
      </div>
    </div>
  );
}

// ─── Add Expense Modal ───
function ExpenseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseType, setExpenseType] = useState(EXPENSE_TYPES[0]);
  const [paymentMethod, setPaymentMethod] = useState('Nakit');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses', data),
    onSuccess: () => {
      toast.success('Masraf kaydedildi');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kayıt başarısız'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return toast.error('Başlık ve tutar zorunludur');
    mutation.mutate({
      title: title.trim(),
      amount: parseFloat(amount),
      expense_type: expenseType,
      payment_method: paymentMethod,
      notes: notes.trim() || undefined,
    });
  };

  const inputClass =
    'w-full bg-panel border border-theme rounded-2xl px-4 py-2.5 text-main text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-orange-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-card rounded-3xl p-6 w-full max-w-md shadow-2xl border border-theme animate-slide-up">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-theme-subtle">
          <h2 className="text-base font-black text-main">Yeni Masraf Girişi</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-panel text-muted hover:text-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-main mb-1">Masraf Başlığı *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Süt &amp; Kahve Çekirdeği Alımı"
              className={inputClass}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-main mb-1">Tutar (₺) *</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-main mb-1">Kategori</label>
              <select
                value={expenseType}
                onChange={(e) => setExpenseType(e.target.value)}
                className={inputClass + ' cursor-pointer'}
              >
                {EXPENSE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-main mb-1">Ödeme Yöntemi</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={inputClass + ' cursor-pointer'}
            >
              <option value="Nakit">Nakit Kasa</option>
              <option value="Kredi Kartı">Banka / Kredi Kartı</option>
              <option value="Havale/EFT">Banka Havale/EFT</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-main mb-1">Not / Açıklama</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opsiyonel detay..."
              className={inputClass}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-theme-subtle">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-panel hover:bg-panel-subtle text-muted hover:text-main font-bold py-2.5 rounded-2xl text-xs"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-2.5 rounded-2xl text-xs shadow-xs disabled:opacity-50"
            >
              {mutation.isPending ? 'Kaydediliyor...' : 'Masrafı Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Structure Modal ───
function StructureModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseType, setExpenseType] = useState(EXPENSE_TYPES[0]);
  const [recurrenceType, setRecurrenceType] = useState('monthly');

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses/structures', data),
    onSuccess: () => {
      toast.success('Sabit gider yapısı eklendi');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kayıt başarısız'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return toast.error('Başlık ve tutar zorunludur');
    mutation.mutate({
      title: title.trim(),
      amount: parseFloat(amount),
      expense_type: expenseType,
      recurrence_type: recurrenceType,
    });
  };

  const inputClass =
    'w-full bg-panel border border-theme rounded-2xl px-4 py-2.5 text-main text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-orange-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-card rounded-3xl p-6 w-full max-w-md shadow-2xl border border-theme animate-slide-up">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-theme-subtle">
          <h2 className="text-base font-black text-main">Sabit / Periyodik Gider Tanımla</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-panel text-muted hover:text-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-main mb-1">Gider Başlığı *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Dükkan Kirası, İnternet Faturası"
              className={inputClass}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-main mb-1">Periyot Tutarı (₺) *</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-main mb-1">Tekrar Sıklığı</label>
              <select
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value)}
                className={inputClass + ' cursor-pointer'}
              >
                <option value="monthly">Aylık</option>
                <option value="weekly">Haftalık</option>
                <option value="yearly">Yıllık</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-main mb-1">Kategori</label>
            <select
              value={expenseType}
              onChange={(e) => setExpenseType(e.target.value)}
              className={inputClass + ' cursor-pointer'}
            >
              {EXPENSE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2 border-t border-theme-subtle">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-panel hover:bg-panel-subtle text-muted hover:text-main font-bold py-2.5 rounded-2xl text-xs"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-2.5 rounded-2xl text-xs shadow-xs disabled:opacity-50"
            >
              {mutation.isPending ? 'Kaydediliyor...' : 'Gider Yapısını Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
