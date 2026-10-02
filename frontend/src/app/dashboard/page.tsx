'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import { useAuthStore } from '@/store/authStore';
import { TrendingUp, Coffee, ShoppingCart, BarChart2, ArrowRight, MapPin, Users, Receipt } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const p = user?.permissions || ({} as any);
  const role = user?.role;
  const isManagement = role === 'SuperAdmin' || role === 'Owner' || role === 'Admin' || role === 'Manager';
  const canDashboard = (p.can_view_dashboard !== undefined ? p.can_view_dashboard : isManagement) && (p.can_view_revenue || isManagement);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (user && !canDashboard) {
      if (p.can_take_payment || role === 'Cashier') {
        router.replace('/cashier');
      } else if (p.can_view_kitchen || role === 'Kitchen') {
        router.replace('/kitchen');
      } else {
        router.replace('/waiter');
      }
    }
  }, [isAuthenticated, user, canDashboard, router, role, p]);

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then((r) => r.data),
    refetchInterval: 30000,
    enabled: Boolean(canDashboard),
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables'],
    queryFn: () => api.get('/tables').then((r) => r.data),
    enabled: Boolean(canDashboard),
  });

  if (!isAuthenticated || !canDashboard) {
    return null;
  }

  const todayRevenue = Number(dashboard?.today?.today_revenue || 0);
  const todaySessions = Number(dashboard?.today?.today_sessions || 0);
  const avgTicket = Number(dashboard?.today?.avg_ticket || 0);
  const topProducts = dashboard?.top_products || [];
  const hourlyData = dashboard?.hourly || [];

  const occupied = tables.filter((t: any) => t.status === 'occupied').length;
  const occupancyRate = tables.length > 0 ? Math.round((occupied / tables.length) * 100) : 0;

  const statCards = [
    {
      label: 'Bugünkü Toplam Ciro',
      value: `₺${todayRevenue.toFixed(0)}`,
      icon: TrendingUp,
      color: '#f97316',
      sub: `${todaySessions} masa hesabı tamamlandı`,
    },
    {
      label: 'Ortalama Adisyon',
      value: `₺${avgTicket.toFixed(0)}`,
      icon: ShoppingCart,
      color: '#0284c7',
      sub: 'Masa başı ortalama harcama',
    },
    {
      label: 'Dolu Masalar',
      value: `${occupied} / ${tables.length}`,
      icon: Coffee,
      color: '#16a34a',
      sub: `%${occupancyRate} salon doluluğu`,
    },
    {
      label: 'Açılan Oturumlar',
      value: todaySessions.toString(),
      icon: BarChart2,
      color: '#7c3aed',
      sub: 'Günün toplam işlem sayısı',
    },
  ];

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-panel p-4 sm:p-5 rounded-3xl border border-theme shadow-theme">
          <div>
            <h1 className="text-xl font-black text-main tracking-tight">Genel İstatistikler & Özet</h1>
            <p className="text-muted text-xs font-semibold mt-0.5">
              Anlık kafe operasyon ve satış performansı
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/waiter"
              className="text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition-all active:scale-95"
              style={{ background: 'var(--sky-d)' }}
            >
              <MapPin className="w-4 h-4" />
              <span>Masa Haritası</span>
            </Link>
            <Link
              href="/cashier"
              className="bg-card hover:bg-card-hover text-main font-bold px-4 py-2.5 rounded-2xl border border-theme shadow-xs text-xs flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Receipt className="w-4 h-4 text-orange-500" />
              <span>Kasa & Geçmiş</span>
            </Link>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {statCards.map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className="bg-card rounded-3xl p-4 border border-theme shadow-theme flex flex-col justify-between h-32">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted">{label}</span>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shadow-xs"
                  style={{ background: `${color}18`, color }}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-main tracking-tight">{value}</p>
                <p className="text-[11px] text-muted font-medium mt-0.5 truncate">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Charts & Rankings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          {/* Revenue Chart (2 cols) */}
          <div className="lg:col-span-2 bg-card rounded-3xl p-4 sm:p-5 border border-theme shadow-theme flex flex-col justify-between min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-main">Saatlik Satış Dağılımı</h2>
                <p className="text-xs text-muted">Bugün tamamlanan ödemelerin saatlik trendi</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-xl bg-panel text-main border border-theme">
                Bugün
              </span>
            </div>

            <div className="h-56 w-full">
              {hourlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(h) => `${h}:00`}
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
                      labelFormatter={(h) => `Saat ${h}:00`}
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'var(--text)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      fill="url(#revenueGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted text-xs">
                  Henüz saatlik veri oluşmadı
                </div>
              )}
            </div>
          </div>

          {/* Top 5 Products (1 col) */}
          <div className="bg-card rounded-3xl p-4 sm:p-5 border border-theme shadow-theme flex flex-col justify-between">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-main">En Çok Satanlar</h2>
              <p className="text-xs text-muted">Bugün en fazla sipariş edilen ürünler</p>
            </div>

            <div className="space-y-2 flex-1 flex flex-col justify-center">
              {topProducts.map((p: any, index: number) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between p-2 rounded-2xl bg-panel border border-theme-subtle shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-orange-500 text-white font-black text-xs flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </span>
                    <p className="text-xs font-bold text-main truncate">{p.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-black text-main">₺{Number(p.revenue).toFixed(0)}</p>
                    <p className="text-[10px] text-muted font-bold">{p.sold} adet</p>
                  </div>
                </div>
              ))}

              {topProducts.length === 0 && (
                <div className="py-12 text-center text-muted text-xs">
                  Henüz satış kaydı bulunmuyor
                </div>
              )}
            </div>

            <Link
              href="/cashier?tab=ciro"
              className="mt-3 w-full py-2 rounded-xl bg-panel hover:bg-panel-subtle text-main border border-theme text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-98"
            >
              <span>Detaylı Raporlar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
