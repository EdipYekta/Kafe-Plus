'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { ProductsContent } from '@/app/products/page';
import { StaffContent } from '@/app/staff/page';
import { SettingsContent } from '@/app/settings/page';
import { useAuthStore, UserPermissions } from '@/store/authStore';
import { Package, Users, Settings as SettingsIcon, TrendingDown, ArrowRight, Layers, Plus } from 'lucide-react';
import clsx from 'clsx';

type Tab = 'products' | 'staff' | 'expenses' | 'settings';

export default function ManageHubPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('products');
  const [productActions, setProductActions] = useState<{
    openCreate: () => void;
    openCategories: () => void;
  } | null>(null);

  const perms: UserPermissions = user?.permissions || { can_take_payment: false, can_view_revenue: false, can_view_history: 'today_only', can_view_products: false, can_view_kitchen: false, can_view_staff: false, can_manage_expenses: false, can_print_z_report: false, can_view_weekly_monthly: false, can_edit_table_items: false, can_view_dashboard: false };
  const isAdmin = user?.role === 'Owner' || user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'SuperAdmin';

  const tabs: { key: Tab; label: string; icon: any; show: boolean }[] = [
    { key: 'products', label: 'Ürünler & Menü', icon: Package, show: isAdmin || perms.can_view_products },
    { key: 'staff', label: 'Personel & Yetki', icon: Users, show: isAdmin || perms.can_view_staff },
    { key: 'expenses', label: 'Giderler & Masraf', icon: TrendingDown, show: isAdmin || perms.can_manage_expenses },
    { key: 'settings', label: 'Ayarlar', icon: SettingsIcon, show: isAdmin },
  ].filter(t => t.show) as any;

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-3">
        {/* Compact Single Horizontal Bar (No bulky header or description) */}
        <div
          className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2 sm:p-2.5 rounded-2xl border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {/* Left: Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-1 min-w-0 pb-1 sm:pb-0">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={clsx(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap border flex-shrink-0 active:scale-95',
                )}
                style={tab === key
                  ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                  : { color: 'var(--text-2)', borderColor: 'var(--border)', background: 'transparent' }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Right: Action Buttons when in Products tab */}
          {tab === 'products' && isAdmin && productActions && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={productActions.openCategories}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border"
                style={{ background: 'var(--card-hover)', color: 'var(--text)', borderColor: 'var(--border)' }}
              >
                <Layers className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />
                <span>Kategoriler</span>
              </button>
              <button
                onClick={productActions.openCreate}
                className="flex items-center gap-1.5 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Ürün</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab Content */}
        {tab === 'products' && (
          <ProductsContent hideHeader={true} onRegisterActions={setProductActions} />
        )}
        {tab === 'staff' && <StaffContent />}

        {tab === 'expenses' && (
          <div className="rounded-3xl p-10 border text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-40" style={{ color: 'var(--brand)' }} />
            <h2 className="text-base font-black text-white mb-1">Gider & Masraf Yönetimi</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
              Tüm masraf kayıtları, sabit gider yapıları ve net kasa durumu Kasa merkezinde
            </p>
            <button
              onClick={() => router.push('/cashier?tab=giderler')}
              className="inline-flex items-center gap-2 text-white font-bold px-6 py-3 rounded-2xl text-xs transition-all active:scale-95"
              style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}
            >
              <span>Kasa & Gider Merkezine Git</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {tab === 'settings' && <SettingsContent />}
      </div>
    </MainLayout>
  );
}
