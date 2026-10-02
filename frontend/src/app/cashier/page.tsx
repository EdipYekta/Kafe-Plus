'use client';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import MainLayout from '@/components/layout/MainLayout';
import {
  CreditCard, Banknote, ShoppingBag, TrendingUp, TrendingDown,
  Calendar, Search, X, FileText, Printer, Check, AlertTriangle,
  ArrowRight, Repeat, Plus, Trash2, Tag, Coffee, Layers, DollarSign, Receipt, Users as UsersIcon
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

function CashierContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();

  const perms = user?.permissions || ({} as any);
  const isAdmin = user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'SuperAdmin' || user?.role === 'Owner';
  const canSeeWeeklyMonthly = isAdmin || Boolean(perms.can_view_weekly_monthly);
  const canViewRevenue = isAdmin || Boolean(perms.can_view_revenue);
  const canPrintZ = isAdmin || Boolean(perms.can_print_z_report);
  const canManageExpenses = isAdmin || Boolean(perms.can_manage_expenses);
  const canSeeHistory = isAdmin || perms.can_view_history !== false;
  const canTakePayment = isAdmin || Boolean(perms.can_take_payment);

  const canAccessCashier = canTakePayment || canViewRevenue || canManageExpenses;

  // Redirect users who do not have any cashier/financial rights
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (user && !canAccessCashier) {
      if (perms.can_view_kitchen || user.role === 'Kitchen') {
        router.replace('/kitchen');
      } else {
        router.replace('/waiter');
      }
    }
  }, [user, isAuthenticated, canAccessCashier, router, perms]);

  // Tab State: 'kasa' | 'gecmis' | 'ciro' | 'giderler'
  const paramTab = searchParams.get('tab');
  const allowedTabs: ('kasa' | 'gecmis' | 'ciro' | 'giderler')[] = [];
  if (canTakePayment) allowedTabs.push('kasa');
  if (canSeeHistory) allowedTabs.push('gecmis');
  if (canSeeWeeklyMonthly && canViewRevenue) allowedTabs.push('ciro');
  if (canManageExpenses) allowedTabs.push('giderler');

  const defaultTab = allowedTabs[0] || 'kasa';
  const initialTab = (paramTab && allowedTabs.includes(paramTab as any))
    ? (paramTab as 'kasa' | 'gecmis' | 'ciro' | 'giderler')
    : defaultTab;

  const [activeTab, setActiveTab] = useState<'kasa' | 'gecmis' | 'ciro' | 'giderler'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Sub-states for Geçmiş ───
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [listDate, setListDate] = useState(''); // '' = all time, else a YYYY-MM-DD day filter
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
    enabled: Boolean(canAccessCashier && canTakePayment),
  });

  // 2. Payment History Query (Geçmiş) — grouped per session/bill, paginated
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['payment-history', listDate, historyPage, searchQuery, paymentTypeFilter],
    queryFn: () =>
      api.get('/payments/history', {
        params: {
          date: listDate || undefined,
          page: historyPage,
          limit: 8,
          search: searchQuery.trim() || undefined,
          payment_type: paymentTypeFilter !== 'all' ? paymentTypeFilter : undefined,
        },
      }).then((r) => r.data),
    refetchInterval: 15000,
    enabled: Boolean(canAccessCashier && canSeeHistory),
  });

  // 3. Reports Range Query (Ciro Raporları)
  const reportEnd = new Date().toISOString().split('T')[0];
  const reportStart = reportPeriod === 0 ? reportEnd : format(subDays(new Date(), reportPeriod), 'yyyy-MM-dd');

  const { data: rangeData = [] } = useQuery({
    queryKey: ['reports-range', reportStart, reportEnd],
    queryFn: () => api.get('/reports/range', { params: { start: reportStart, end: reportEnd } }).then((r) => r.data),
    enabled: Boolean(canAccessCashier && canSeeWeeklyMonthly && canViewRevenue),
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then((r) => r.data),
    refetchInterval: 30000,
    enabled: Boolean(canAccessCashier && canViewRevenue),
  });

  // 4. Expenses Queries
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get('/expenses').then((r) => r.data),
    enabled: Boolean(canAccessCashier && canManageExpenses),
  });

  const { data: structures = [] } = useQuery({
    queryKey: ['expense-structures'],
    queryFn: () => api.get('/expenses/structures').then((r) => r.data),
    enabled: Boolean(canAccessCashier && canManageExpenses),
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
  const totalHistoryPages = Math.max(1, Math.ceil(totalHistoryCount / 8));

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

  if (!isAuthenticated || !canAccessCashier) {
    return null;
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        {/* ─── Top Header & Universal Navigation Tabs ─── */}
        <div className="p-4 sm:p-5 rounded-3xl border space-y-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-500" />
                <span>Kasa, Ciro &amp; Masraflar Merkezi</span>
              </h1>
              <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Tüm kasa işlemleri, ödeme geçmişi, ciro raporları ve gider takibi tek ekranda
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              {canPrintZ && (
                <button
                  onClick={() => setShowZReportModal(true)}
                  className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                >
                  <FileText className="w-4 h-4" />
                  <span>Günü Bitir (Z-Raporu)</span>
                </button>
              )}
              <Link
                href="/waiter"
                className="border text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 hover:bg-white/5"
                style={{ background: 'var(--app)', borderColor: 'var(--border)' }}
              >
                <Coffee className="w-4 h-4 text-orange-500" />
                <span>Masa Haritası</span>
              </Link>
            </div>
          </div>

          {/* 4 Unified Hub Tabs - Filtered by Permissions */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 pt-1">
            {[
              { id: 'kasa', label: 'Açık Masalar & Kasa', count: occupiedTables.length, icon: CreditCard, show: true },
              { id: 'gecmis', label: 'Ödeme & İşlem Geçmişi', count: totalHistoryCount, icon: Receipt, show: canSeeHistory },
              { id: 'ciro', label: 'Ciro & Satış Raporları', icon: TrendingUp, show: canSeeWeeklyMonthly && canViewRevenue },
              { id: 'giderler', label: 'Giderler & Masraflar', count: expenses.length, icon: TrendingDown, show: canManageExpenses },
            ].filter(t => t.show).map(({ id, label, count, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setActiveTab(id as any);
                  setSearchQuery('');
                }}
                className={clsx(
                  'px-4 py-2.5 rounded-xl font-bold text-xs transition-all duration-150 flex items-center gap-2 whitespace-nowrap border flex-shrink-0 active:scale-95',
                  activeTab === id
                    ? 'bg-white/10 text-white border-white/20 shadow-sm'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className={clsx('w-4 h-4', activeTab === id ? 'text-orange-500' : 'text-slate-400')} />
                <span>{label}</span>
                {count !== undefined && count > 0 && (
                  <span className={clsx(
                    'text-[10px] px-2 py-0.2 rounded-full font-black',
                    activeTab === id ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-300'
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
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-theme shadow-theme">
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

              {/* Date Filter: Tüm Zaman / specific day */}
              <div className="flex items-center gap-2">
                {canSeeWeeklyMonthly && perms.can_view_history !== 'today_only' ? (
                  <div className="flex items-center gap-1 bg-panel p-1 rounded-2xl border border-theme text-xs font-bold">
                    <button
                      onClick={() => { setListDate(''); setHistoryPage(1); }}
                      className={clsx(
                        'px-3 py-1.5 rounded-xl transition-all',
                        listDate === '' ? 'bg-card text-main shadow-xs font-black' : 'text-muted hover:text-main'
                      )}
                    >
                      Tüm Zaman
                    </button>
                    <input
                      type="date"
                      value={listDate}
                      onChange={(e) => { setListDate(e.target.value); setHistoryPage(1); }}
                      className="bg-card border border-theme rounded-xl px-2 py-1 text-[10px] font-bold text-main cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-panel border border-theme text-xs font-bold text-muted">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Sadece Bugün</span>
                  </div>
                )}
              </div>

              {/* Payment Type Filters */}
              <div className="flex items-center gap-1 bg-panel p-1 rounded-2xl border border-theme text-xs font-bold w-fit">
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
                      'px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap',
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
                      const d = tx.paid_at ? new Date(tx.paid_at) : new Date();
                      const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                      const discount = Number(tx.discount_amount || 0);
                      const cardAmt = Number(tx.card_amount || 0);
                      const cashAmt = Number(tx.cash_amount || 0);
                      const mealAmt = Number(tx.meal_amount || 0);
                      const paidAmt = Number(tx.paid_amount || 0);
                      const totalAmt = Number(tx.session_total || paidAmt || 0);

                      // Show only payment types that were actually used
                      const breakdown = [
                        { label: 'Nakit', value: cashAmt, color: 'text-emerald-600' },
                        { label: 'Kart', value: cardAmt, color: 'text-sky-600' },
                        { label: 'Yemek', value: mealAmt, color: 'text-purple-600' },
                        { label: 'İndirim', value: discount, color: 'text-orange-600', isDisc: true },
                      ].filter((b) => b.isDisc || b.value > 0);

                      return (
                        <div
                          key={tx.session_id}
                          className="bg-panel rounded-2xl p-3.5 shadow-xs border border-theme-subtle space-y-2.5 hover:border-orange-400 transition-all"
                        >
                          {/* Header: table + time */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-9 h-9 rounded-xl bg-card border border-theme-subtle flex items-center justify-center text-[13px] font-black text-main flex-shrink-0">
                                {tx.table_name || 'Hızlı'}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-main truncate">
                                  Masa {tx.table_name}{tx.area_name ? ` · ${tx.area_name}` : ''}
                                </p>
                                <p className="text-[10px] text-muted font-mono flex items-center gap-1 mt-0.5">
                                  <Calendar className="w-2.5 h-2.5" />
                                  {dateStr} · {tx.payment_count} ödeme
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-black text-main">₺{paidAmt.toFixed(2)}</p>
                              <p className="text-[10px] text-muted font-semibold">Tahsilat</p>
                            </div>
                          </div>

                          {/* Payment method breakdown */}
                          <div className="flex flex-wrap gap-1.5">
                            {breakdown.map((b) => (
                              <span
                                key={b.label}
                                className={clsx('px-2 py-0.5 rounded-full text-[10px] font-black border border-theme-subtle', b.isDisc ? 'text-orange-600' : b.color)}
                                style={{ background: 'var(--card)' }}
                              >
                                {b.label}: ₺{Number(b.value).toFixed(0)}
                              </span>
                            ))}
                            {totalAmt > paidAmt && (
                              <span className="text-[10px] font-semibold text-muted ml-auto">
                                Adisyon ₺{totalAmt.toFixed(0)}
                              </span>
                            )}
                          </div>

                          {/* Cashier(s) */}
                          {tx.cashier_names && (
                            <div className="flex items-center gap-1.5 text-[10px] text-muted font-semibold pt-1 border-t border-theme-subtle">
                              <UsersIcon className="w-3 h-3" />
                              <span className="truncate">{tx.cashier_names}</span>
                            </div>
                          )}
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
                  <div className="flex items-center justify-between pt-2 border-t border-theme-subtle">
                    <span className="text-[10px] text-muted font-semibold">
                      {totalHistoryCount} kayıt · {totalHistoryPages} sayfa
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={historyPage <= 1}
                        className="px-3 py-1.5 rounded-xl bg-panel hover:bg-panel-subtle border border-theme font-bold text-main text-xs disabled:opacity-40 shadow-xs active:scale-95"
                      >
                        &lt; Önceki
                      </button>
                      <div className="flex items-center gap-0.5 px-1 overflow-x-auto custom-scrollbar">
                        {Array.from({ length: totalHistoryPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setHistoryPage(i + 1)}
                            className={clsx(
                              'min-w-[28px] h-7 px-1 flex items-center justify-center rounded-lg text-xs font-bold transition-all active:scale-95',
                              historyPage === i + 1 ? 'bg-orange-500 text-white shadow-xs' : 'bg-panel text-muted hover:text-main border border-theme'
                            )}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                        disabled={historyPage >= totalHistoryPages}
                        className="px-3 py-1.5 rounded-xl bg-panel hover:bg-panel-subtle border border-theme font-bold text-main text-xs disabled:opacity-40 shadow-xs active:scale-95"
                      >
                        Sonraki &gt;
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: 4 Summary Groups */}
              <div className="col-span-12 lg:col-span-5 space-y-3.5">
                {canViewRevenue && (
                  <div className={clsx('grid gap-3', canSeeWeeklyMonthly ? 'grid-cols-2' : 'grid-cols-1')}>
                    {canSeeWeeklyMonthly && (
                      <>
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
                      </>
                    )}

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
                )}

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
                    className="w-full text-white font-black py-3 rounded-2xl text-xs shadow-md tracking-wide active:scale-98 transition-all flex items-center justify-center gap-2"
                    style={{ background: 'var(--sky-d)' }}
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
                        ? 'text-white shadow-xs font-black'
                        : 'text-muted hover:text-main'
                    )}
                    style={reportPeriod === days ? { background: 'var(--sky)' } : undefined}
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
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => `₺${v}`}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(val: any) => [`₺${Number(val).toFixed(2)}`, 'Ciro']}
                        contentStyle={{
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: 'var(--text)',
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
      {/* ─── Professional Thermal Z-Report Modal ─── */}
      {showZReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          {/* Dedicated Thermal Print Styles */}
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #thermal-z-report, #thermal-z-report * {
                visibility: visible;
              }
              #thermal-z-report {
                position: fixed;
                left: 0;
                top: 0;
                width: 80mm !important;
                max-width: 80mm !important;
                background: white !important;
                color: black !important;
                padding: 10px !important;
                font-family: 'Courier New', Courier, monospace !important;
                font-size: 11px !important;
                border: none !important;
                box-shadow: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div
            className="rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border space-y-4 my-8"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 no-print">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-black text-white">Mali Gün Sonu (Z-Raporu)</h3>
              </div>
              <button
                onClick={() => setShowZReportModal(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ─── Realistic Thermal Receipt Container ─── */}
            <div
              id="thermal-z-report"
              className="bg-white text-slate-900 rounded-2xl p-5 font-mono text-xs shadow-inner border border-slate-300 space-y-3"
            >
              {/* Receipt Header */}
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-3">
                <p className="text-base font-black tracking-wider uppercase text-slate-950">
                  {user?.cafe_name || 'KAFE+ OTOMASYON'}
                </p>
                <p className="text-[11px] font-bold text-slate-600">GÜN SONU MALİ RAPORU (Z-RAPORU)</p>
                <p className="text-[10px] text-slate-500">Kasa Kapanış &amp; Hasılat Dökümü</p>
                <div className="pt-1 text-[10px] text-slate-600 flex justify-between">
                  <span>TARİH: {new Date().toLocaleDateString('tr-TR')}</span>
                  <span>SAAT: {new Date().toLocaleTimeString('tr-TR')}</span>
                </div>
                <div className="text-[10px] text-slate-600 flex justify-between">
                  <span>YETKİLİ: {user?.full_name}</span>
                  <span>Z-SAYAÇ: #{Math.floor(Date.now() / 86400000) % 9999}</span>
                </div>
              </div>

              {/* Revenue Breakdown */}
              <div className="space-y-1.5 py-1 text-xs">
                <div className="flex justify-between font-bold">
                  <span>NAKİT TAHSİLAT:</span>
                  <span className="font-mono font-black text-slate-950">₺{Number(metrics.today_cash || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>KREDİ KARTI / POS:</span>
                  <span className="font-mono font-black text-slate-950">₺{Number(metrics.today_card || 0).toFixed(2)}</span>
                </div>
                {Number(metrics.today_meal || 0) > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>YEMEK KARTI:</span>
                    <span className="font-mono font-black text-slate-950">₺{Number(metrics.today_meal || 0).toFixed(2)}</span>
                  </div>
                )}
                {Number(metrics.today_discount || 0) > 0 && (
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>TOPLAM İNDİRİM / İKRAM:</span>
                    <span className="font-mono">-₺{Number(metrics.today_discount || 0).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Total Summary */}
              <div className="border-t-2 border-b-2 border-dashed border-slate-900 py-2 my-1">
                <div className="flex justify-between text-sm font-black text-slate-950">
                  <span>NET GÜNLÜK CİRO:</span>
                  <span className="font-mono text-base">₺{Number(metrics.today_total || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Statistical Breakdown */}
              <div className="space-y-1 text-[10px] text-slate-600 pt-1">
                <div className="flex justify-between">
                  <span>KAPATILAN MASA / ADİSYON:</span>
                  <span className="font-bold font-mono">{occupiedTables.length === 0 ? 'TÜMÜ KAPALI' : `${occupiedTables.length} AÇIK`}</span>
                </div>
                <div className="flex justify-between">
                  <span>DURUM:</span>
                  <span className="font-bold text-emerald-700">KASA MUTABIK</span>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="text-center pt-3 border-t border-dashed border-slate-400 space-y-0.5 text-[9px] text-slate-500">
                <p>*** MALİ DEĞERİ OLAN GÜN SONU BELGESİDİR ***</p>
                <p>Kafe+ Restoran &amp; POS Otomasyon Sistemi</p>
              </div>
            </div>

            {/* Warning Box */}
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 no-print">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-200">
                &ldquo;Günü Bitir&rdquo; butonuna bastığınızda bugünkü kasa arşivlenecek ve yeni gün başlatılacaktır.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-white/10 hover:bg-white/15 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-white/10"
              >
                <Printer className="w-4 h-4 text-sky-400" />
                <span>Yazdır (80mm Fiş)</span>
              </button>
              <button
                onClick={() => endOfDayMutation.mutate()}
                disabled={endOfDayMutation.isPending}
                className="flex-1 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black py-3 rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                <Check className="w-4 h-4" />
                <span>{endOfDayMutation.isPending ? 'Kapatılıyor...' : 'Günü Bitir & Arşivle'}</span>
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

export default function UnifiedCashierAndFinancePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Yükleniyor...</div>}>
      <CashierContent />
    </Suspense>
  );
}
