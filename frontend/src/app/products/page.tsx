'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import { useAuthStore } from '@/store/authStore';
import { Plus, Search, Edit2, Trash2, X, Package, Layers, ChevronDown, Check, Filter } from 'lucide-react';
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
  is_quick_access: boolean;
  preparation_time: number;
}

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  product_count: number;
}

const ICON_FALLBACKS: [RegExp, string][] = [
  [/kah|espr|latte|cappuc|flat|turk|filtre/i, '☕'],
  [/çay|tea|bitki/i, '🍵'],
  [/tatlı|kek|pasta|cheese|brownie|waffle/i, '🍰'],
  [/soğuk|ice|buz|smoothie|milkshake|frozen/i, '🧊'],
  [/pizza/i, '🍕'],
  [/burger|sandwich|sandviç|dürüm|tost/i, '🍔'],
  [/salat|green/i, '🥗'],
  [/meyve|juice/i, '🧃'],
  [/kahvaltı|breakfast|yumurt|menemen/i, '🍳'],
  [/ekmek|börek|simit|kruvasan/i, '🥐'],
  [/dondurma|ice cream/i, '🍦'],
  [/çikolata|chocolate/i, '🍫'],
  [/alkol|bira|wine/i, '🍺'],
  [/su|water/i, '💧'],
  [/kokteyl|milkshake/i, '🥤'],
];

function getProductIcon(product: Product): string {
  if (product.category_icon) return product.category_icon;
  for (const [pattern, icon] of ICON_FALLBACKS) {
    if (pattern.test(product.name) || pattern.test(product.category_name)) return icon;
  }
  return '☕';
}

function getCategoryIcon(category: Category): string {
  if (category.icon) return category.icon;
  for (const [pattern, icon] of ICON_FALLBACKS) {
    if (pattern.test(category.name)) return icon;
  }
  return '🍽';
}

// ─── Category Dropdown Component ───
function CategoryDropdown({
  categories,
  selectedCat,
  onSelect,
  totalProductsCount,
}: {
  categories: Category[];
  selectedCat: number | null;
  onSelect: (catId: number | null) => void;
  totalProductsCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCategoryObj = categories.find((c) => c.id === selectedCat);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  return (
    <div className="relative flex-shrink-0 w-full sm:w-auto" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full sm:w-auto flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border shadow-sm sm:min-w-[220px]',
          isOpen ? 'ring-2 ring-orange-500/30' : ''
        )}
        style={{
          background: 'var(--card)',
          borderColor: selectedCat !== null ? 'var(--brand)' : 'var(--border)',
          color: 'var(--text)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none">
            {selectedCategoryObj ? getCategoryIcon(selectedCategoryObj) : '🍽'}
          </span>
          <span className="truncate">
            {selectedCategoryObj ? selectedCategoryObj.name : 'Tüm Kategoriler'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{
              background: selectedCat !== null ? 'rgba(255,102,0,0.18)' : 'var(--card-hover)',
              color: selectedCat !== null ? 'var(--brand)' : 'var(--text-2)',
            }}
          >
            {selectedCat !== null ? 'Seçili' : totalProductsCount}
          </span>
          <ChevronDown
            className={clsx('w-4 h-4 transition-transform duration-200', isOpen && 'rotate-180')}
            style={{ color: 'var(--text-muted)' }}
          />
        </div>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-full sm:w-72 rounded-2xl p-2 z-50 border shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Search within dropdown if more than 5 categories */}
          {categories.length > 5 && (
            <div className="relative mb-2 px-1">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                placeholder="Kategori filtrele..."
                className="w-full rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-orange-500"
                style={{
                  background: 'var(--card-hover)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
                autoFocus
              />
            </div>
          )}

          <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1 pr-0.5">
            {/* All categories option */}
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all',
                selectedCat === null ? 'shadow-sm' : 'hover:opacity-90'
              )}
              style={
                selectedCat === null
                  ? { background: 'rgba(255,102,0,0.18)', color: 'var(--brand)', border: '1px solid rgba(255,102,0,0.35)' }
                  : { background: 'transparent', color: 'var(--text)', border: '1px solid transparent' }
              }
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🍽</span>
                <span>Tüm Kategoriler</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {totalProductsCount}
                </span>
                {selectedCat === null && <Check className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />}
              </div>
            </button>

            <div className="h-px my-1" style={{ background: 'var(--border)' }} />

            {/* Filtered categories */}
            {filteredCategories.map((cat) => {
              const isSelected = selectedCat === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onSelect(cat.id);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-all',
                    isSelected ? 'shadow-sm' : 'hover:opacity-90'
                  )}
                  style={
                    isSelected
                      ? { background: 'rgba(255,102,0,0.18)', color: 'var(--brand)', border: '1px solid rgba(255,102,0,0.35)' }
                      : { background: 'transparent', color: 'var(--text)', border: '1px solid transparent' }
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm flex-shrink-0">{getCategoryIcon(cat)}</span>
                    <span className="truncate">{cat.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0 ml-2" style={{ color: 'var(--brand)' }} />}
                </button>
              );
            })}

            {filteredCategories.length === 0 && (
              <p className="text-center py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                Kategori bulunamadı
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <MainLayout>
      <ProductsContent />
    </MainLayout>
  );
}

export function ProductsContent({
  hideHeader = false,
  onRegisterActions,
}: {
  hideHeader?: boolean;
  onRegisterActions?: (actions: { openCreate: () => void; openCategories: () => void }) => void;
} = {}) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Owner' || user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'SuperAdmin' || user?.permissions?.can_view_products;
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
    if (!isAdmin) { toast.error('Sadece yetkili kullanıcı ürünleri düzenleyebilir'); return; }
    setEditProduct(p);
    setShowModal(true);
  };

  const openCreate = useCallback(() => {
    if (!isAdmin) { toast.error('Sadece yetkili kullanıcı yeni ürün ekleyebilir'); return; }
    setEditProduct(null);
    setShowModal(true);
  }, [isAdmin]);

  const openCategories = useCallback(() => {
    setShowCategoryModal(true);
  }, []);

  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({ openCreate, openCategories });
    }
  }, [onRegisterActions, openCreate, openCategories]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header - shown only if not hidden */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Package className="w-5 h-5" style={{ color: 'var(--brand)' }} />
              <span>Ürün &amp; Menü Yönetimi</span>
              {!isAdmin && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--brand)', border: '1px solid rgba(245,158,11,0.30)' }}>
                  Salt Okunur
                </span>
              )}
            </h1>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {products.length} ürün listeleniyor · {categories.length} kategori mevcut
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={openCategories}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all active:scale-95"
                style={{ background: 'var(--card-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                <Layers className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />
                <span>Kategoriler</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all active:scale-95"
                style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Ürün</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search + Category Dropdown */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün adı veya açıklama ile ara..."
            className="w-full rounded-2xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-orange-500"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>

        <CategoryDropdown
          categories={categories}
          selectedCat={selectedCat}
          onSelect={setSelectedCat}
          totalProductsCount={products.length}
        />
      </div>

      {/* Products Grid - Net orantılı ve eşit boyutlu kartlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {products.map((p) => {
          const icon = getProductIcon(p);
          return (
            <div
              key={p.id}
              className="w-full h-[106px] rounded-xl p-3 border flex flex-col justify-between transition-all hover:border-white/25 group relative shadow-xs min-w-0"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl select-none"
                  style={{ background: 'var(--card-hover)', border: '1px solid var(--border-sub)' }}
                >
                  <span className="inline-flex items-center justify-center leading-none">
                    {icon}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate max-w-[110px]"
                      style={{ background: 'var(--card-hover)', color: 'var(--text-muted)' }}
                    >
                      {p.category_name}
                    </span>
                    {p.is_quick_access && (
                      <span
                        className="text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.18)', color: 'var(--brand)' }}
                        title="Hızlı Menüde"
                      >
                        ⚡ HIZLI
                      </span>
                    )}
                  </div>
                  <h3
                    className="font-bold text-xs mt-1 truncate group-hover:text-orange-400 transition-colors"
                    style={{ color: 'var(--text)' }}
                    title={p.name}
                  >
                    {p.name}
                  </h3>
                  {p.description ? (
                    <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {p.description}
                    </p>
                  ) : (
                    <p className="text-[10px] truncate mt-0.5 opacity-0 select-none">-</p>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t flex-shrink-0" style={{ borderColor: 'var(--border-sub)' }}>
                <span className="text-sm font-black" style={{ color: 'var(--brand)' }}>
                  ₺{Number(p.price).toFixed(0)}
                </span>
                {isAdmin && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                      style={{ color: 'var(--text-2)' }}
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
                      className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                      style={{ color: 'var(--danger)' }}
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
          <div className="col-span-full rounded-3xl p-16 text-center border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <Package className="w-12 h-12 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <p className="font-bold text-sm" style={{ color: 'var(--text-2)' }}>Eşleşen ürün bulunamadı</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {isAdmin ? 'Yeni ürün ekleyebilir veya filtreyi değiştirebilirsiniz' : 'Farklı bir kategori veya arama terimi deneyin'}
            </p>
          </div>
        )}
      </div>

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
    </div>
  );
}

function ProductModal({ product, categories, onClose, onSuccess }: { product: Product | null; categories: Category[]; onClose: () => void; onSuccess: () => void; }) {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [cost, setCost] = useState(product?.cost ? String(product.cost) : '0');
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ? String(product.category_id) : String(categories[0]?.id || ''));
  const [isQuick, setIsQuick] = useState(product?.is_quick_access || false);

  const saveMutation = useMutation({
    mutationFn: (data: any) => product ? api.patch(`/products/${product.id}`, data) : api.post('/products', data),
    onSuccess: () => { toast.success(product ? 'Ürün güncellendi' : 'Yeni ürün eklendi'); onSuccess(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kayıt başarısız'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return toast.error('Ürün adı ve fiyatı zorunludur');
    saveMutation.mutate({ name: name.trim(), description: description.trim(), price: parseFloat(price), cost: parseFloat(cost) || 0, category_id: parseInt(categoryId) || categories[0]?.id, is_quick_access: isQuick });
  };

  const inputClass = 'w-full rounded-2xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:border-orange-500';
  const inputStyle = { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
      <div className="rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-black" style={{ color: 'var(--text)' }}>{product ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10" style={{ color: 'var(--text-2)' }}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-2)' }}>Ürün Adı *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Flat White, Cheesecake" className={inputClass} style={inputStyle} autoFocus required />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-2)' }}>Kategori *</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass + ' cursor-pointer'} style={inputStyle} required>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon || '☕'} {c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-2)' }}>Satış Fiyatı (₺) *</label>
              <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className={inputClass} style={inputStyle} required />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-2)' }}>Maliyet (₺)</label>
              <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" className={inputClass} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-2)' }}>Açıklama</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Örn: Çift shot espresso, organik yulaf sütü" className={inputClass} style={inputStyle} />
          </div>
          <label className={clsx('flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all', isQuick ? '' : '')} style={isQuick ? { background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.35)' } : { background: 'var(--card)', borderColor: 'var(--border)' }}>
            <input type="checkbox" checked={isQuick} onChange={() => setIsQuick(!isQuick)} className="rounded text-orange-500 focus:ring-0" />
            <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>Hızlı Sipariş Menüsüne Ekle</span>
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 font-bold py-2.5 rounded-2xl text-xs" style={{ background: 'var(--app)', color: 'var(--text-2)' }}>İptal</button>
            <button type="submit" disabled={saveMutation.isPending} className="flex-1 text-white font-bold py-2.5 rounded-2xl text-xs disabled:opacity-50" style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}>
              {saveMutation.isPending ? 'Kaydediliyor...' : product ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ALL_ICONS = ['☕', '🍽', '🍰', '🧃', '🥪', '🍳', '🥤', '🍕', '🍦', '🍩', '🥐', '🥗', '🍔', '🍵', '🍫', '💧', '🧁', '🌮'];
const sharedInputStyle = { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' };

function CategoryManagementModal({ categories, onClose, onSuccess }: { categories: Category[]; onClose: () => void; onSuccess: () => void; }) {
  // Create form state
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('☕');

  // Edit state — null when not editing, or the category being edited
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('☕');

  const createCatMutation = useMutation({
    mutationFn: (data: any) => api.post('/categories', data),
    onSuccess: () => { toast.success('Kategori eklendi'); setName(''); setIcon('☕'); onSuccess(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kategori eklenemedi'),
  });

  const updateCatMutation = useMutation({
    mutationFn: (data: { id: number; name: string; icon: string }) =>
      api.patch(`/categories/${data.id}`, { name: data.name, icon: data.icon }),
    onSuccess: () => {
      toast.success('Kategori güncellendi');
      setEditingCat(null);
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kategori güncellenemedi'),
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/categories/${id}`),
    onSuccess: () => { toast.success('Kategori kaldırıldı'); onSuccess(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kategori silinemedi'),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Kategori adı giriniz');
    createCatMutation.mutate({ name: name.trim(), icon, color: '#f97316' });
  };

  const startEdit = (c: Category) => {
    setEditingCat(c);
    setEditName(c.name);
    setEditIcon(c.icon || '☕');
  };

  const handleSaveEdit = () => {
    if (!editingCat) return;
    if (!editName.trim()) return toast.error('Kategori adı boş olamaz');
    updateCatMutation.mutate({ id: editingCat.id, name: editName.trim(), icon: editIcon });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
      <div className="rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5" style={{ color: 'var(--brand)' }} />
            <h2 className="text-base font-black" style={{ color: 'var(--text)' }}>Kategori Yönetimi</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10" style={{ color: 'var(--text-2)' }}><X className="w-5 h-5" /></button>
        </div>

        {/* Create new category form */}
        <form onSubmit={handleCreate} className="space-y-3 p-3.5 rounded-2xl" style={{ background: 'var(--app)', border: '1px solid var(--border)' }}>
          <h3 className="text-xs font-bold" style={{ color: 'var(--text)' }}>Yeni Kategori Ekle</h3>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kategori Adı" className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-orange-500" style={sharedInputStyle} required />
            <button type="submit" disabled={createCatMutation.isPending} className="text-white font-bold px-4 py-2 rounded-xl text-xs active:scale-95 disabled:opacity-50" style={{ background: 'var(--brand)' }}>Ekle</button>
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>İkon Seçimi</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_ICONS.map((ic) => (
                <button key={ic} type="button" onClick={() => setIcon(ic)} className={clsx('w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all border', icon === ic ? 'scale-110' : 'opacity-60 hover:opacity-100')} style={icon === ic ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : { background: 'var(--card)', borderColor: 'var(--border)' }}>{ic}</button>
              ))}
            </div>
          </div>
        </form>

        {/* Edit panel (shown when editingCat is set) */}
        {editingCat && (
          <div className="space-y-3 p-3.5 rounded-2xl" style={{ background: 'rgba(255,102,0,0.08)', border: '1px solid rgba(255,102,0,0.25)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold" style={{ color: 'var(--brand)' }}>Kategoriyi Düzenle</h3>
              <button onClick={() => setEditingCat(null)} className="p-1 rounded-lg hover:bg-white/10" style={{ color: 'var(--text-2)' }}><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex gap-2">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Kategori Adı"
                className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-orange-500"
                style={sharedInputStyle}
                autoFocus
              />
              <button
                onClick={handleSaveEdit}
                disabled={updateCatMutation.isPending}
                className="text-white font-bold px-4 py-2 rounded-xl text-xs active:scale-95 disabled:opacity-50"
                style={{ background: 'var(--brand)' }}
              >
                Kaydet
              </button>
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>İkon Değiştir</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ICONS.map((ic) => (
                  <button key={ic} type="button" onClick={() => setEditIcon(ic)} className={clsx('w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all border', editIcon === ic ? 'scale-110' : 'opacity-60 hover:opacity-100')} style={editIcon === ic ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : { background: 'var(--card)', borderColor: 'var(--border)' }}>{ic}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Existing categories list */}
        <div>
          <h3 className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Mevcut Kategoriler ({categories.length})</h3>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: 'var(--app)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{getCategoryIcon(c)}</span>
                  <span className="font-bold text-xs" style={{ color: 'var(--text)' }}>{c.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{c.product_count || 0} ürün</span>
                  <button
                    onClick={() => startEdit(c)}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    title="Düzenle"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`${c.name} kategorisini kaldırmak istediğinize emin misiniz?`)) deleteCatMutation.mutate(c.id); }}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    title="Sil"
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
