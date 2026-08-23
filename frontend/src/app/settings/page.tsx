'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import { Store, Map, Palette, Plus, X, Trash2, CheckCircle2, ArrowLeft, ChefHat } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import Link from 'next/link';

export default function SettingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'cafe' | 'areas' | 'categories'>('cafe');

  const { data: cafe } = useQuery({
    queryKey: ['cafe'],
    queryFn: () => api.get('/cafes').then((r) => r.data),
  });

  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: () => api.get('/areas').then((r) => r.data),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-panel p-4 sm:p-5 rounded-3xl border border-theme shadow-theme">
          <div>
            <h1 className="text-xl font-black text-main tracking-tight">Sistem Ayarları</h1>
            <p className="text-muted text-xs font-semibold mt-0.5">
              Kafe profil detayları, mutfak KDS modu, oturma alanları ve menü kategorileri
            </p>
          </div>

          <div className="flex gap-1.5 bg-card p-1 rounded-2xl border border-theme shadow-xs">
            {[
              { key: 'cafe', label: 'Kafe & Tercihler', icon: Store },
              { key: 'areas', label: 'Alanlar', icon: Map },
              { key: 'categories', label: 'Kategoriler', icon: Palette },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key as any)}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95',
                  tab === key
                    ? 'bg-[#38bdf8] text-white shadow-xs'
                    : 'text-muted hover:text-main'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Contents */}
        {tab === 'cafe' && cafe && <CafeSettings cafe={cafe} qc={qc} />}
        {tab === 'areas' && <AreasSettings areas={areas} qc={qc} />}
        {tab === 'categories' && <CategoriesSettings categories={categories} qc={qc} />}
      </div>
    </MainLayout>
  );
}

function CafeSettings({ cafe, qc }: { cafe: any; qc: any }) {
  const [form, setForm] = useState({
    name: cafe.name || '',
    phone: cafe.phone || '',
    address: cafe.address || '',
    kitchen_enabled: !!cafe.kitchen_enabled,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.patch(`/cafes/${cafe.id}`, data),
    onSuccess: () => {
      toast.success('Ayarlar güncellendi');
      qc.invalidateQueries({ queryKey: ['cafe'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Güncellenemedi'),
  });

  const toggleKitchen = (val: boolean) => {
    setForm((prev) => ({ ...prev, kitchen_enabled: val }));
    mutation.mutate({ kitchen_enabled: val });
  };

  const inputClass =
    'w-full bg-panel-subtle border border-theme rounded-2xl px-4 py-3 text-main text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-all';

  return (
    <div className="space-y-4">
      {/* Kitchen Toggle Box */}
      <div className="bg-card rounded-3xl p-5 border border-theme shadow-theme flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-orange-100  text-orange-600 flex items-center justify-center">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-main">Mutfak Ekranı (KDS) ve Onay Akışı</h3>
            <p className="text-xs text-muted mt-0.5">
              {form.kitchen_enabled
                ? 'Aktif: Garsonların siparişleri aşçı onayına düşer'
                : 'Kapalı (Varsayılan): Masadan eklenen ürünler doğrudan masaya kesinleşir'}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          onClick={() => toggleKitchen(!form.kitchen_enabled)}
          className={clsx(
            'w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none shadow-xs',
            form.kitchen_enabled ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-700'
          )}
        >
          <div
            className={clsx(
              'w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out',
              form.kitchen_enabled ? 'translate-x-6' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {/* Cafe Profile Form */}
      <div className="bg-card rounded-3xl p-5 border border-theme shadow-theme">
        <h3 className="font-bold text-sm text-main mb-4">Kafe Bilgileri</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-bold text-main mb-1">Kafe / İşletme Adı</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-main mb-1">Telefon</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0212 555 0000"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-main mb-1">Adres</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Kadıköy, İstanbul"
                className={inputClass}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-6 py-2.5 rounded-2xl text-xs shadow-xs disabled:opacity-50 transition-all active:scale-95"
            >
              {mutation.isPending ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AreasSettings({ areas, qc }: { areas: any[]; qc: any }) {
  const [name, setName] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/areas', data),
    onSuccess: () => {
      toast.success('Alan eklendi');
      setName('');
      qc.invalidateQueries({ queryKey: ['areas'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Alan eklenemedi'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/areas/${id}`),
    onSuccess: () => {
      toast.success('Alan silindi');
      qc.invalidateQueries({ queryKey: ['areas'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Alan silinemedi'),
  });

  return (
    <div className="bg-card rounded-3xl p-5 border border-theme shadow-theme space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-main">Oturma Alanları / Salonlar</h3>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          createMutation.mutate({ name: name.trim() });
        }}
        className="flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Yeni alan adı (Örn: Teras, Bahçe, Üst Kat)"
          className="flex-1 bg-panel-subtle border border-theme rounded-2xl px-4 py-2.5 text-main text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-orange-500"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-2xl text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50"
        >
          Ekle
        </button>
      </form>

      <div className="space-y-2">
        {areas.map((a: any) => (
          <div
            key={a.id}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-panel border border-theme-subtle text-xs"
          >
            <span className="font-bold text-main">{a.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-muted">{a.table_count || 0} masa</span>
              <button
                onClick={() => {
                  if (confirm(`${a.name} alanını silmek istediğinize emin misiniz?`)) {
                    deleteMutation.mutate(a.id);
                  }
                }}
                className="p-1.5 text-muted hover:text-red-500 rounded-lg transition-colors"
                title="Sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriesSettings({ categories, qc }: { categories: any[]; qc: any }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('☕');

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/categories', data),
    onSuccess: () => {
      toast.success('Kategori eklendi');
      setName('');
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kategori eklenemedi'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast.success('Kategori silindi');
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kategori silinemedi'),
  });

  const icons = ['☕', '🍽', '🍰', '🧃', '🥪', '🍳', '🥤', '🍕', '🍦', '🍩', '🥐', '🥗', '🍺', '🍵'];

  return (
    <div className="bg-card rounded-3xl p-5 border border-theme shadow-theme space-y-4">
      <h3 className="font-bold text-sm text-main">Menü Kategorileri</h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          createMutation.mutate({ name: name.trim(), icon, color: '#f97316' });
        }}
        className="space-y-3 bg-panel p-4 rounded-2xl border border-theme"
      >
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Yeni Kategori Adı"
            className="flex-1 bg-card border border-theme rounded-xl px-3 py-2 text-xs font-semibold text-main placeholder-slate-400 focus:outline-none focus:border-orange-500"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            Ekle
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {icons.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              className={clsx(
                'w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all border',
                icon === ic
                  ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                  : 'bg-card text-main hover:bg-panel border-theme'
              )}
            >
              {ic}
            </button>
          ))}
        </div>
      </form>

      <div className="space-y-2">
        {categories.map((c: any) => (
          <div
            key={c.id}
            className="flex items-center justify-between p-3 rounded-2xl bg-panel border border-theme-subtle text-xs"
          >
            <div className="flex items-center gap-2">
              <span>{c.icon || '☕'}</span>
              <span className="font-bold text-main">{c.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-muted">{c.product_count || 0} ürün</span>
              <button
                onClick={() => {
                  if (confirm(`${c.name} kategorisini silmek istediğinize emin misiniz?`)) {
                    deleteMutation.mutate(c.id);
                  }
                }}
                className="p-1.5 text-muted hover:text-red-500 rounded-lg transition-colors"
                title="Sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
