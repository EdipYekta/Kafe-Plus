'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import { useAuthStore } from '@/store/authStore';
import { Plus, Search, Edit2, Trash2, X, Package, Layers } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  cost: number;
  category_id: number;
  category_name: string;
  category_color: string;
  category_icon: string;
  stock_quantity: number;
  track_stock: boolean;
  is_active: boolean;
  preparation_time: number;
}

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  product_count: number;
}

// Smart icon picker – returns category's icon, or auto-picks based on name keywords
const ICON_FALLBACKS: [RegExp, string][] = [
  [/kah|espr|latte|cappuc|flat|turk|filtre/i, '☕'],
  [/çay|tea|bitki/i, '🍵'],
  [/tatlı|kek|pasta|cheese|brownie|waffle/i, '🍰'],
  [/soğuk|ice|buz|smoothie|milkshake/i, '🧊'],
  [/pizza/i, '🍕'],
  [/burger|sandwich|sandviç|dürüm/i, '🍔'],
  [/salat|green/i, '🥗'],
  [/meyve|juice|meyve/i, '🧃'],
  [/kahvaltı|breakfast|yumurt/i, '🍳'],
  [/ekmek|börek|simit/i, '🥐'],
  [/dondurma|ice cream/i, '🍦'],
  [/çikolata|chocolate/i, '🍫'],
  [/alkol|bira|wine/i, '🍺'],
  [/su|water/i, '💧'],
];

function getProductIcon(product: Product): string {
  if (product.category_icon) return product.category_icon;
  // Try to match by product name
  for (const [pattern, icon] of ICON_FALLBACKS) {
    if (pattern.test(product.name) || pattern.test(product.category_name)) return icon;
  }
  return '☕'; // Default
}

function getCategoryIcon(category: Category): string {
  if (category.icon) return category.icon;
  for (const [pattern, icon] of ICON_FALLBACKS) {
    if (pattern.test(category.name)) return icon;
  }
  return '🍽';
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', selectedCat, search],
    queryFn: () =>
      api.get('/products', { params: { category_id: selectedCat, search } }).then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success('Ürün silindi');
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Silme yetkisi yok'),
  });

  const openEdit = (p: Product) => {
    if (!isAdmin) { toast.error('Sadece Admin ürünleri düzenleyebilir'); return; }
    setEditProduct(p);
    setShowModal(true);
  };

  const openCreate = () => {
    if (!isAdmin) { toast.error('Sadece Admin yeni ürün/kahve ekleyebilir'); return; }
    setEditProduct(null);
    setShowModal(true);
  };

  return (
    <MainLayout>
      <div className="space-y-4 max-w-6xl mx-auto">
        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#ede9e3] p-4 rounded-3xl border border-slate-300 shadow-xs">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Ürün &amp; Menü Yönetimi</span>
              {!isAdmin && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                  Salt Okunur
                </span>
              )}
            </h1>
            <p className="text-slate-500 text-xs font-semibold mt-0.5">
              {products.length} ürün listeleniyor · {categories.length} kategori mevcut
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-800 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xs border border-slate-300 transition-all active:scale-95"
              >
                <Layers className="w-3.5 h-3.5 text-orange-500" />
                <span>Kategori Yönetimi</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-xs transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Ürün Ekle</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── Search + Category Pills ─── */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ürün adı veya açıklama ile ara..."
              className="w-full bg-white border border-slate-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto custom-scrollbar pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCat(null)}
              className={clsx(
                'px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-xs border',
                selectedCat === null
                  ? 'bg-white text-slate-900 border-slate-300 shadow-sm ring-1 ring-orange-500/20'
                  : 'bg-white/60 text-slate-600 border-transparent hover:bg-white/80'
              )}
            >
              Tümü ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={clsx(
                  'px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-xs border flex items-center gap-1.5',
                  selectedCat === cat.id
                    ? 'bg-white text-slate-900 border-slate-300 shadow-sm ring-1 ring-orange-500/20'
                    : 'bg-white/60 text-slate-600 border-transparent hover:bg-white/80'
                )}
              >
                <span className="text-sm">{getCategoryIcon(cat)}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── Products Grid ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {products.map((p) => {
            const icon = getProductIcon(p);
            return (
              <div
                key={p.id}
                className="bg-white rounded-3xl p-4 border border-slate-300/80 shadow-sm flex flex-col justify-between h-44 hover:border-orange-400 hover:shadow-md transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    {/* ─ Icon – always present ─ */}
                    <span className="text-2xl leading-none">{icon}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 ml-1 truncate max-w-[70px]">
                      {p.category_name}
                    </span>
                  </div>

                  <h3 className="font-bold text-xs text-slate-900 line-clamp-2 leading-snug">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{p.description}</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-base font-black text-slate-900">
                    ₺{Number(p.price).toFixed(0)}
                  </span>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                        title="Düzenle"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`${p.name} ürününü silmek istediğinize emin misiniz?`)) {
                            deleteMutation.mutate(p.id);
                          }
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {products.length === 0 && !isLoading && (
            <div className="col-span-5 bg-white/80 rounded-3xl p-16 text-center border border-slate-300">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-600" />
              <p className="font-bold text-sm text-slate-700">Eşleşen ürün bulunamadı</p>
              <p className="text-xs text-slate-400 mt-1">
                {isAdmin ? 'Yeni ürün ekleyebilir veya filtreyi değiştirebilirsiniz' : 'Farklı bir kategori veya arama terimi deneyin'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={editProduct}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['products'] });
          }}
        />
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <CategoryManagementModal
          categories={categories}
          onClose={() => setShowCategoryModal(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['categories'] });
            qc.invalidateQueries({ queryKey: ['products'] });
          }}
        />
      )}
    </MainLayout>
  );
}

// ─── Product Create / Edit Modal ───
function ProductModal({
  product,
  categories,
  onClose,
  onSuccess,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [cost, setCost] = useState(product?.cost ? String(product.cost) : '0');
  const [categoryId, setCategoryId] = useState<string>(
    product?.category_id ? String(product.category_id) : String(categories[0]?.id || '')
  );

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      product ? api.patch(`/products/${product.id}`, data) : api.post('/products', data),
    onSuccess: () => {
      toast.success(product ? 'Ürün güncellendi' : 'Yeni ürün eklendi');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kayıt başarısız'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return toast.error('Ürün adı ve fiyatı zorunludur');
    saveMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      cost: parseFloat(cost) || 0,
      category_id: parseInt(categoryId) || categories[0]?.id,
    });
  };

  const ic =
    'w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-2.5 text-slate-800 text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-orange-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-slide-up">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-900">
            {product ? 'Ürünü Düzenle' : 'Yeni Ürün / Kahve Ekle'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ürün Adı *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Flat White, Cheesecake"
              className={ic}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Kategori *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={ic + ' cursor-pointer'}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon || '☕'} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Satış Fiyatı (₺) *</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className={ic}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Maliyet (₺)</label>
              <input
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className={ic}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Açıklama / Detay</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Örn: Çift shot espresso, organik yulaf sütü"
              className={ic}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-2xl text-xs"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-2.5 rounded-2xl text-xs shadow-xs disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Kaydediliyor...' : product ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Category Management Modal ───
const ALL_ICONS = ['☕', '🍽', '🍰', '🧃', '🥪', '🍳', '🥤', '🍕', '🍦', '🍩', '🥐', '🥗', '🍔', '🍵', '🍫', '💧', '🧁', '🌮'];

function CategoryManagementModal({
  categories,
  onClose,
  onSuccess,
}: {
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('☕');

  const createCatMutation = useMutation({
    mutationFn: (data: any) => api.post('/categories', data),
    onSuccess: () => {
      toast.success('Kategori eklendi');
      setName('');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kategori eklenemedi'),
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast.success('Kategori kaldırıldı');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kategori silinemedi'),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Kategori adı giriniz');
    createCatMutation.mutate({ name: name.trim(), icon, color: '#f97316' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-slide-up space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-black text-slate-900">Kategori Yönetimi</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add form */}
        <form onSubmit={handleCreate} className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <h3 className="text-xs font-bold text-slate-800">Yeni Kategori Ekle</h3>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kategori Adı"
              className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500"
              required
            />
            <button
              type="submit"
              disabled={createCatMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs active:scale-95 disabled:opacity-50"
            >
              Ekle
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1.5">İkon Seçimi</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={clsx(
                    'w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all border',
                    icon === ic
                      ? 'bg-orange-500 text-white border-orange-600 shadow-xs scale-110'
                      : 'bg-white text-slate-800 hover:bg-slate-100 border-slate-200'
                  )}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Existing categories */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 mb-2">Mevcut Kategoriler ({categories.length})</h3>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{getCategoryIcon(c)}</span>
                  <span className="font-bold text-xs text-slate-800">{c.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-500">{c.product_count || 0} ürün</span>
                  <button
                    onClick={() => {
                      if (confirm(`${c.name} kategorisini kaldırmak istediğinize emin misiniz?`)) {
                        deleteCatMutation.mutate(c.id);
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
