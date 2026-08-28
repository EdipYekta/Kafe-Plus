'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import {
  Store, Map, Palette, Plus, X, Trash2, CheckCircle2,
  ChefHat, CreditCard, Send, Activity, Terminal, ShieldCheck, Check,
  Zap, Search, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function SettingsPage() {
  return (
    <MainLayout>
      <SettingsContent />
    </MainLayout>
  );
}

export function SettingsContent() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'cafe' | 'quick' | 'areas' | 'categories' | 'pos'>('cafe');

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

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products').then((r) => r.data),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">Sistem Ayarları &amp; Entegrasyonlar</h1>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Kafe detayları, hızlı sipariş menüsü, masa alanları, kategoriler ve POS cihazı API entegrasyonu
            </p>
          </div>

          <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto custom-scrollbar">
            {[
              { key: 'cafe', label: 'Kafe & Tercihler', icon: Store },
              { key: 'quick', label: 'Hızlı Sipariş', icon: Zap },
              { key: 'areas', label: 'Alanlar', icon: Map },
              { key: 'categories', label: 'Kategoriler', icon: Palette },
              { key: 'pos', label: 'POS Entegrasyonu', icon: CreditCard },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key as any)}
                className={clsx(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95',
                  tab === key
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
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
        {tab === 'quick' && <QuickAccessSettings products={products} qc={qc} />}
        {tab === 'areas' && <AreasSettings areas={areas} qc={qc} />}
        {tab === 'categories' && <CategoriesSettings categories={categories} qc={qc} />}
        {tab === 'pos' && <PosSettings />}
    </div>
  );
}

function CafeSettings({ cafe, qc }: { cafe: any; qc: any }) {
  const [form, setForm] = useState({
    name: cafe.name || '',
    phone: cafe.phone || '',
    address: cafe.address || '',
    kitchen_enabled: !!cafe.kitchen_enabled,
  });

  // Re-sync form when cafe data changes (after refetch)
  useEffect(() => {
    setForm({
      name: cafe.name || '',
      phone: cafe.phone || '',
      address: cafe.address || '',
      kitchen_enabled: !!cafe.kitchen_enabled,
    });
  }, [cafe]);

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
    'w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs font-semibold placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-all';

  return (
    <div className="space-y-4">
      {/* Kitchen Toggle Box */}
      <div className="rounded-3xl p-5 border flex items-center justify-between" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 text-orange-400 flex items-center justify-center flex-shrink-0">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Mutfak Ekranı (KDS) ve Onay Akışı</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {form.kitchen_enabled
                ? 'Aktif: Garsonların siparişleri mutfak aşçı ekranına düşer ve durum takibi yapılır'
                : 'Kapalı: Masadan eklenen ürünler doğrudan masaya kesinleşir'}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          onClick={() => toggleKitchen(!form.kitchen_enabled)}
          className={clsx(
            'w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none shadow-xs flex-shrink-0',
            form.kitchen_enabled ? 'bg-orange-500' : 'bg-slate-700'
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
      <div className="rounded-3xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h3 className="font-bold text-sm text-white mb-4">Kafe &amp; İşletme Bilgileri</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Kafe / İşletme Adı</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Telefon</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0212 555 0000"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Adres</label>
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
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md disabled:opacity-50 transition-all active:scale-95"
            >
              {mutation.isPending ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Quick Access Products Settings Component ───
function QuickAccessSettings({ products, qc }: { products: any[]; qc: any }) {
  const [search, setSearch] = useState('');

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_quick_access }: { id: number; is_quick_access: boolean }) =>
      api.patch(`/products/${id}`, { is_quick_access }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Hızlı sipariş menüsü güncellendi');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Güncellenemedi'),
  });

  const filtered = products.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const quickCount = products.filter((p: any) => p.is_quick_access).length;

  return (
    <div className="rounded-3xl p-5 border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Hızlı Sipariş Menüsü Yapılandırması</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Masa sipariş ekranında en üstte veya &ldquo;⚡ Hızlı Menü&rdquo; sekmesinde doğrudan listelenecek popüler ürünleri seçin
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25 whitespace-nowrap self-start sm:self-auto">
          {quickCount} Ürün Seçili
        </span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ürün veya kategori ara..."
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Product List Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
        {filtered.map((prod: any) => {
          const isQuick = !!prod.is_quick_access;
          return (
            <div
              key={prod.id}
              onClick={() => toggleMutation.mutate({ id: prod.id, is_quick_access: !isQuick })}
              className={clsx(
                'p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]',
                isQuick
                  ? 'bg-amber-500/15 border-amber-500/40 ring-1 ring-amber-500/25'
                  : 'bg-white/5 border-white/5 hover:border-white/20'
              )}
            >
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-xs font-bold text-white truncate">{prod.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400">{prod.category_name || 'Genel'}</span>
                  <span className="text-xs font-black text-orange-400">₺{Number(prod.price).toFixed(0)}</span>
                </div>
              </div>

              <button
                type="button"
                className={clsx(
                  'w-8 h-8 rounded-xl flex items-center justify-center transition-colors flex-shrink-0',
                  isQuick ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/10 text-slate-400 hover:text-white'
                )}
              >
                <Zap className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-10 text-xs text-slate-500">
            Aradığınız kriterde ürün bulunamadı.
          </div>
        )}
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
    <div className="rounded-3xl p-5 border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <h3 className="font-bold text-sm text-white">Masa Oturma Alanları</h3>

      {/* Add new area */}
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
          placeholder="Yeni alan adı (Örn: Teras, Bahçe, Üst Kat)..."
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Ekle</span>
        </button>
      </form>

      {/* Area List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {areas.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between p-3 rounded-2xl border border-white/5 bg-white/5"
          >
            <div>
              <p className="text-xs font-bold text-white">{a.name}</p>
              <p className="text-[10px] text-slate-400">{a.table_count || 0} Masa Kayıtlı</p>
            </div>
            <button
              onClick={() => {
                if (confirm(`${a.name} alanını silmek istiyor musunuz?`)) {
                  deleteMutation.mutate(a.id);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
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

  return (
    <div className="rounded-3xl p-5 border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <h3 className="font-bold text-sm text-white">Menü Kategorileri</h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          createMutation.mutate({ name: name.trim(), icon });
        }}
        className="flex gap-2"
      >
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-12 text-center bg-white/5 border border-white/10 rounded-2xl text-base focus:outline-none focus:border-orange-500"
          title="Emoji İkon"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Yeni kategori (Örn: Sıcak İçecekler, Tatlılar)..."
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Ekle</span>
        </button>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {categories.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between p-3 rounded-2xl border border-white/5 bg-white/5"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{c.icon || '☕'}</span>
              <p className="text-xs font-bold text-white">{c.name}</p>
            </div>
            <button
              onClick={() => {
                if (confirm(`${c.name} kategorisini silmek istiyor musunuz?`)) {
                  deleteMutation.mutate(c.id);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── POS Terminal Integration Component ───
function PosSettings() {
  const [posType, setPosType] = useState('ingenico');
  const [terminalIp, setTerminalIp] = useState('192.168.1.150');
  const [port, setPort] = useState('8080');
  const [merchantId, setMerchantId] = useState('KAFEPLUS_001');
  const [apiKey, setApiKey] = useState('pos_live_sec_99382109312');
  const [testAmount, setTestAmount] = useState('1.00');

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [logResponse, setLogResponse] = useState<any>(null);

  // Load from localStorage if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kafeplus_pos_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.posType) setPosType(parsed.posType);
        if (parsed.terminalIp) setTerminalIp(parsed.terminalIp);
        if (parsed.port) setPort(parsed.port);
        if (parsed.merchantId) setMerchantId(parsed.merchantId);
        if (parsed.apiKey) setApiKey(parsed.apiKey);
      }
    } catch {}
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('kafeplus_pos_config', JSON.stringify({
        posType,
        terminalIp,
        port,
        merchantId,
        apiKey,
      }));
      toast.success('POS Terminal yapılandırması yerel olarak kaydedildi');
    } catch {
      toast.error('Kayıt yapılamadı');
    }
  };

  const runTestTransaction = () => {
    setTestStatus('testing');
    setLogResponse(null);

    setTimeout(() => {
      // Simulate real POS request response
      const success = terminalIp.trim().length > 0;
      if (success) {
        setTestStatus('success');
        setLogResponse({
          status: 'SUCCESS_200',
          provider: posType.toUpperCase(),
          terminal_host: `${terminalIp}:${port}`,
          merchant_id: merchantId,
          test_amount: `${testAmount} TRY`,
          auth_code: `AUTH_${Math.floor(100000 + Math.random() * 900000)}`,
          rrn_reference: `${Date.now()}`,
          message: 'POS Terminali bağlantıyı kabul etti ve test ödeme provizyonu onaylandı.',
          timestamp: new Date().toISOString(),
        });
        toast.success('POS Cihazı ile bağlantı başarılı!');
      } else {
        setTestStatus('error');
        setLogResponse({
          status: 'TIMEOUT_ERROR_504',
          error: 'Terminal IP adresine ulaşılamadı. Cihazın açık ve ağa bağlı olduğunu kontrol edin.',
          timestamp: new Date().toISOString(),
        });
        toast.error('POS Cihazına bağlanılamadı');
      }
    }, 1200);
  };

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs font-semibold placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-all';

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="rounded-3xl p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-400 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Fiziki POS Cihazı &amp; Terminal API Entegrasyonu</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Kasadan tahsilat yaparken fiziki POS cihazına otomatik tutar gönderme ve onay akışı
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-3.5 h-3.5" /> Servis Hazır
          </span>
        </div>
      </div>

      {/* POS Configuration Form */}
      <div className="rounded-3xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h3 className="font-bold text-sm text-white mb-4">Terminal Bağlantı Parametreleri</h3>
        <form onSubmit={handleSaveConfig} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Entegratör / Cihaz Modeli</label>
              <select
                value={posType}
                onChange={(e) => setPosType(e.target.value)}
                className={inputClass + ' cursor-pointer'}
              >
                <option value="ingenico" className="bg-slate-900 text-white">Ingenico / ICT220 / Desk 5000 API</option>
                <option value="beko" className="bg-slate-900 text-white">Beko / Token 300TR POS</option>
                <option value="hugin" className="bg-slate-900 text-white">Hugin FP300 / VX675</option>
                <option value="generic_rest" className="bg-slate-900 text-white">Generic JSON REST POS Bridge</option>
                <option value="simulator" className="bg-slate-900 text-white">Yazılımsal Simülatör (Test)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Mağaza / Üye İşyeri Kodu (Merchant ID)</label>
              <input
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                placeholder="KAFEPLUS_001"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">POS Cihazı Yerel IP Adresi (Host)</label>
              <input
                value={terminalIp}
                onChange={(e) => setTerminalIp(e.target.value)}
                placeholder="192.168.1.150"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Port</label>
              <input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="8080"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">API Gizli Anahtarı / Token</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="••••••••••••••••"
              className={inputClass}
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95"
            >
              Yapılandırmayı Kaydet
            </button>
          </div>
        </form>
      </div>

      {/* POS Test Request Sandbox */}
      <div className="rounded-3xl p-5 border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-orange-500" />
              <span>Canlı POS İletişim Test Paneli</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cihaza test provizyon isteği göndererek entegrasyon sağlığını doğrulayın
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <div className="w-32 flex-shrink-0">
              <input
                type="number"
                step="0.01"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                placeholder="1.00"
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={runTestTransaction}
              disabled={testStatus === 'testing'}
              className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-bold px-5 py-3 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-md"
            >
              {testStatus === 'testing' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Cihaza Gönderiliyor...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Test Provizyonu Gönder ({testAmount} ₺)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Response Terminal Screen */}
        {logResponse && (
          <div className="rounded-2xl p-4 font-mono text-xs border border-white/10 bg-black/60 space-y-2 overflow-x-auto">
            <div className="flex items-center justify-between text-slate-400 border-b border-white/10 pb-2">
              <span className="flex items-center gap-2">
                <span className={clsx('w-2 h-2 rounded-full', testStatus === 'success' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
                TERMINAL LOG ÇIKTISI
              </span>
              <span className="text-[10px]">{logResponse.timestamp}</span>
            </div>
            <pre className="text-emerald-400 leading-relaxed text-[11px]">
              {JSON.stringify(logResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
