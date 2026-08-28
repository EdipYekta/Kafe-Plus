'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  X, Plus, Minus, Trash2, Send, CreditCard,
  ChevronRight, MessageSquare, Coffee,
  CheckCircle2, ShoppingCart, ArrowLeft, Search,
  Zap, Layers, Sparkles, ArrowRightLeft
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import MainLayout from '@/components/layout/MainLayout';

interface CartItem {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  note: string;
}

// ─── Pending Cart Item Row ───
function CartItemRow({
  item,
  onUpdate,
  onRemove,
  onNote,
}: {
  item: CartItem;
  onUpdate: (delta: number) => void;
  onRemove: () => void;
  onNote: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-2 border-b last:border-0" style={{ borderColor: 'var(--border-sub)' }}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>{item.name}</p>
        {item.note && (
          <p className="text-[10px] truncate" style={{ color: 'var(--brand)' }}>📝 {item.note}</p>
        )}
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>₺{(item.price * item.quantity).toFixed(0)}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onNote}
          className={clsx(
            'w-6 h-6 rounded-lg flex items-center justify-center transition-colors',
            item.note ? 'text-amber-400' : 'hover:opacity-80'
          )}
          style={{ background: item.note ? 'rgba(245,158,11,0.20)' : 'var(--card-hover)', color: item.note ? 'var(--brand)' : 'var(--text-muted)' }}
          title="Not Ekle"
        >
          <MessageSquare className="w-3 h-3" />
        </button>
        <div className="flex items-center rounded-lg overflow-hidden" style={{ background: 'var(--card-hover)' }}>
          <button
            onClick={() => onUpdate(-1)}
            className="w-6 h-6 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
            style={{ color: 'var(--text)' }}
          >
            <Minus className="w-2.5 h-2.5" />
          </button>
          <span className="w-5 text-center text-xs font-bold" style={{ color: 'var(--text)' }}>{item.quantity}</span>
          <button
            onClick={() => onUpdate(1)}
            className="w-6 h-6 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
            style={{ color: 'var(--text)' }}
          >
            <Plus className="w-2.5 h-2.5" />
          </button>
        </div>
        <button
          onClick={onRemove}
          className="w-6 h-6 rounded-lg flex items-center justify-center hover:opacity-80 transition-colors"
          style={{ background: 'rgba(248,113,113,0.12)', color: 'var(--danger)' }}
          title="Sepetten Sil"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function TableSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | 'all' | 'quick'>('quick');
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [kitchenNote, setKitchenNote] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [mobileTab, setMobileTab] = useState<'menu' | 'cart'>('menu');
  const [showTransferModal, setShowTransferModal] = useState(false);

  const canPay = user?.permissions?.can_take_payment || user?.role === 'Owner' || user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'SuperAdmin';
  const canEditTableItems = user?.permissions?.can_edit_table_items || user?.role === 'Owner' || user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'SuperAdmin';

  const { data: cafe } = useQuery({
    queryKey: ['cafe'],
    queryFn: () => api.get('/cafes').then(r => r.data),
  });
  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.get(`/sessions/${sessionId}`).then(r => r.data),
    refetchInterval: 12000,
  });
  const { data: orders = [] } = useQuery({
    queryKey: ['orders', sessionId],
    queryFn: () => api.get('/orders', { params: { session_id: sessionId } }).then(r => r.data),
    refetchInterval: 12000,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data),
  });
  const { data: allProducts = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products').then(r => r.data),
  });
  const { data: tables = [] } = useQuery({
    queryKey: ['tables'],
    queryFn: () => api.get('/tables').then(r => r.data),
  });

  const displayedProducts = useMemo(() => {
    let list = allProducts;
    if (selectedCategory === 'quick') {
      list = allProducts.filter((p: any) => p.is_quick_access);
      if (list.length === 0) list = allProducts.slice(0, 8);
    } else if (selectedCategory !== 'all') {
      list = allProducts.filter((p: any) => p.category_id === selectedCategory);
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      list = list.filter((p: any) =>
        p.name.toLowerCase().includes(q) ||
        (p.category_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allProducts, selectedCategory, productSearch]);

  const quickProductsCount = useMemo(() => allProducts.filter((p: any) => p.is_quick_access).length, [allProducts]);

  const sendOrderMutation = useMutation({
    mutationFn: () => api.post('/orders', {
      session_id: sessionId,
      items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity, note: i.note })),
      kitchen_note: kitchenNote,
    }),
    onSuccess: () => {
      toast.success(cafe?.kitchen_enabled ? 'Sipariş mutfağa iletildi' : 'Sipariş kaydedildi');
      setCart([]);
      setKitchenNote('');
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['orders', sessionId] });
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Sipariş kaydedilemedi'),
  });

  const cancelSessionMutation = useMutation({
    mutationFn: () => api.post(`/sessions/${sessionId}/cancel`),
    onSuccess: () => { toast.success('Masa boşaltıldı'); qc.invalidateQueries({ queryKey: ['tables'] }); router.push('/waiter'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Masa iptal edilemedi'),
  });

  const transferMutation = useMutation({
    mutationFn: (targetTableId: number) => api.post(`/sessions/${sessionId}/transfer`, { target_table_id: targetTableId }),
    onSuccess: (res) => {
      toast.success('Masa aktarıldı');
      qc.invalidateQueries({ queryKey: ['tables'] });
      if (res.data?.target_session_id) router.push(`/waiter/session/${res.data.target_session_id}`);
      else router.push('/waiter');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Masa taşıma başarısız'),
  });

  // Edit quantity of an already delivered item on the table
  const updateDeliveredItemMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: number; quantity: number }) =>
      api.patch(`/orders/items/${itemId}`, { quantity }),
    onSuccess: () => {
      toast.success('Ürün adedi güncellendi');
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['orders', sessionId] });
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Güncellenemedi'),
  });

  // Delete an already delivered item from the table
  const deleteDeliveredItemMutation = useMutation({
    mutationFn: (itemId: number) => api.delete(`/orders/items/${itemId}`),
    onSuccess: () => {
      toast.success('Ürün masadan kaldırıldı');
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['orders', sessionId] });
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Silinemedi'),
  });

  const handleUpdateDeliveredQty = (item: any, delta: number) => {
    if (!canEditTableItems) return toast.error('Masadaki ürünleri düzenleme yetkiniz yok');
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      if (confirm(`${item.product_name} ürününü masadan tamamen silmek istiyor musunuz?`)) {
        deleteDeliveredItemMutation.mutate(item.id);
      }
    } else {
      updateDeliveredItemMutation.mutate({ itemId: item.id, quantity: newQty });
    }
  };

  const handleDeleteDeliveredItem = (item: any) => {
    if (!canEditTableItems) return toast.error('Masadaki ürünleri silme yetkiniz yok');
    if (confirm(`${item.product_name} ürününü masadan tamamen silmek istiyor musunuz?`)) {
      deleteDeliveredItemMutation.mutate(item.id);
    }
  };

  const addToCart = useCallback((product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product_id: product.id, name: product.name, price: Number(product.price), quantity: 1, note: '' }];
    });
  }, []);

  const updateQty = useCallback((productId: number, delta: number) => {
    setCart(prev => prev.map(i => i.product_id === productId ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0));
  }, []);

  const saveNote = useCallback((productId: number) => {
    setCart(prev => prev.map(i => i.product_id === productId ? { ...i, note: noteText } : i));
    setNoteFor(null);
    setNoteText('');
  }, [noteText]);

  const deliveredItems = useMemo(() => {
    const list: any[] = [];
    orders.forEach((o: any) => o.items?.forEach((it: any) => list.push({ ...it, order_status: o.status, order_id: o.id })));
    return list;
  }, [orders]);

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const deliveredTotal = Number(session?.total_amount || 0);
  const grandTotal = deliveredTotal + cartTotal;
  const tableName = session?.table_name || 'Masa';

  const transferableTables = tables.filter((t: any) => t.id !== session?.table_id);

  // Render product card
  const renderProductCard = (prod: any, isMobile: boolean) => {
    const cartItem = cart.find(i => i.product_id === prod.id);
    return (
      <button
        key={prod.id}
        onClick={() => addToCart(prod)}
        className={clsx(
          'rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between text-left transition-all active:scale-95 group relative border min-w-0 w-full',
          cartItem ? '' : 'hover:border-white/25'
        )}
        style={{
          minHeight: isMobile ? '80px' : '82px',
          background: cartItem ? 'rgba(255,102,0,0.18)' : 'var(--card-hover)',
          borderColor: cartItem ? 'var(--brand)' : 'var(--border)',
          boxShadow: cartItem ? `inset 0 0 0 1px var(--brand)` : undefined,
        }}
      >
        {cartItem && (
          <span
            className="absolute top-2 right-2 w-5 h-5 text-white text-[11px] font-black rounded-full flex items-center justify-center shadow-sm"
            style={{ background: 'var(--brand)' }}
          >
            {cartItem.quantity}
          </span>
        )}
        <div className="min-w-0 pr-4">
          <p className={clsx('font-bold line-clamp-2 leading-snug group-hover:opacity-90 transition-opacity', isMobile ? 'text-xs' : 'text-xs')} style={{ color: 'var(--text)' }}>
            {prod.name}
          </p>
          {prod.category_name && !isMobile && (
            <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{prod.category_name}</p>
          )}
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="font-black text-xs sm:text-sm" style={{ color: 'var(--brand)' }}>₺{Number(prod.price).toFixed(0)}</p>
          {cartItem && (
            <span className="text-[10px] font-bold" style={{ color: 'var(--text-2)' }}>+1</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100dvh-52px-1px)] overflow-hidden min-w-0 w-full">
        {/* ─── Top Bar ─── */}
        <div className="flex items-center justify-between gap-3 mb-2.5 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.push('/waiter')}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
              style={{ color: 'var(--text-2)' }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-black truncate leading-none" style={{ color: 'var(--text)' }}>{tableName}</p>
              {session?.area_name && (
                <p className="text-[11px] leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>{session.area_name}</p>
              )}
            </div>
            {grandTotal > 0 && (
              <span className="hidden sm:block text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0" style={{ background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                Toplam: ₺{grandTotal.toFixed(0)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
              title="Masayı Taşı / Aktar"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" style={{ color: 'var(--sky)' }} />
              <span className="hidden sm:inline">Masayı Taşı</span>
            </button>

            {deliveredItems.length === 0 && cart.length === 0 && (
              <button
                onClick={() => cancelSessionMutation.mutate()}
                disabled={cancelSessionMutation.isPending}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
              >
                <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--danger)' }} />
                <span className="hidden sm:inline">Boşalt</span>
              </button>
            )}

            {canPay && grandTotal > 0 && (
              <button
                onClick={() => router.push(`/cashier/session/${sessionId}`)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-sm"
                style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Ödeme</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── Desktop 3-Column Layout ─── */}
        <div className="hidden md:flex flex-1 gap-3 min-h-0 overflow-hidden min-w-0 w-full">
          {/* Col 1: Ordered items & Cart */}
          <div className="w-64 lg:w-72 flex flex-col min-h-0 flex-shrink-0">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Masadaki Ürünler</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--card-hover)', color: 'var(--text)' }}>
                {deliveredItems.length + cart.length}
              </span>
            </div>
            <div className="flex-1 rounded-2xl p-2.5 flex flex-col overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {/* Pending cart */}
                {cart.length > 0 && (
                  <div className="rounded-xl p-2" style={{ background: 'rgba(255,102,0,0.10)', border: '1px solid rgba(255,102,0,0.25)' }}>
                    <p className="text-[10px] font-black uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: 'var(--brand)' }}>
                      <Sparkles className="w-3 h-3" />
                      <span>Yeni Eklenecekler ({cart.length})</span>
                    </p>
                    {cart.map(item => (
                      <CartItemRow
                        key={item.product_id}
                        item={item}
                        onUpdate={d => updateQty(item.product_id, d)}
                        onRemove={() => setCart(p => p.filter(i => i.product_id !== item.product_id))}
                        onNote={() => { setNoteFor(item.product_id); setNoteText(item.note); }}
                      />
                    ))}
                  </div>
                )}

                {/* Delivered items on table */}
                {deliveredItems.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--text-muted)' }}>Masada Olanlar</p>
                    {deliveredItems.map((it: any) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between p-2 rounded-xl text-xs gap-1.5 transition-all"
                        style={{ background: 'var(--card-hover)', border: '1px solid var(--border-sub)' }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate text-xs" style={{ color: 'var(--text)' }}>
                            {it.product_name}
                          </p>
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            ₺{(Number(it.unit_price) * it.quantity).toFixed(0)}
                          </p>
                        </div>

                        {/* Editing buttons if user has permission */}
                        {canEditTableItems ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="flex items-center rounded-lg overflow-hidden" style={{ background: 'var(--panel)' }}>
                              <button
                                onClick={() => handleUpdateDeliveredQty(it, -1)}
                                className="w-6 h-6 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
                                style={{ color: 'var(--text)' }}
                                title="Azalt"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="w-5 text-center text-xs font-black" style={{ color: 'var(--brand)' }}>
                                {it.quantity}
                              </span>
                              <button
                                onClick={() => handleUpdateDeliveredQty(it, 1)}
                                className="w-6 h-6 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
                                style={{ color: 'var(--text)' }}
                                title="Arttır"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            <button
                              onClick={() => handleDeleteDeliveredItem(it)}
                              className="w-6 h-6 rounded-lg flex items-center justify-center hover:opacity-80 transition-colors"
                              style={{ background: 'rgba(248,113,113,0.12)', color: 'var(--danger)' }}
                              title="Masadan Sil"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="font-black text-xs" style={{ color: 'var(--brand)' }}>x{it.quantity}</span>
                            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {cart.length === 0 && deliveredItems.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center py-10" style={{ color: 'var(--text-muted)' }}>
                    <Coffee className="w-8 h-8 mb-1.5 opacity-30" />
                    <p className="text-xs font-bold" style={{ color: 'var(--text-2)' }}>Masada henüz ürün yok</p>
                    <p className="text-[10px] mt-0.5">Menüden ürün ekleyin</p>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="pt-2 mt-1 space-y-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                  <input
                    value={kitchenNote}
                    onChange={e => setKitchenNote(e.target.value)}
                    placeholder="Mutfak / Aşçı notu..."
                    className="w-full rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-orange-500"
                    style={{ background: 'var(--card-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                  <button
                    onClick={() => sendOrderMutation.mutate()}
                    disabled={sendOrderMutation.isPending}
                    className="w-full text-white font-black py-2.5 rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{cafe?.kitchen_enabled ? 'Mutfağa Gönder' : 'Siparişi Kaydet'} · ₺{cartTotal.toFixed(0)}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Col 2: Categories */}
          <div className="w-44 lg:w-48 flex flex-col min-h-0 flex-shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-wider mb-1.5 px-1" style={{ color: 'var(--text-muted)' }}>Kategoriler</h2>
            <div className="flex-1 rounded-2xl p-2 overflow-y-auto custom-scrollbar space-y-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <button
                onClick={() => setSelectedCategory('quick')}
                className={clsx('w-full py-2 px-2.5 rounded-xl font-bold text-xs text-left transition-all flex items-center gap-2 border')}
                style={selectedCategory === 'quick'
                  ? { background: 'rgba(245,158,11,0.18)', color: 'var(--brand)', borderColor: 'rgba(245,158,11,0.40)' }
                  : { color: 'var(--text-2)', borderColor: 'transparent' }}
              >
                <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                <span className="truncate flex-1">⚡ Hızlı Menü</span>
                {quickProductsCount > 0 && (
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded" style={{ background: 'rgba(245,158,11,0.20)', color: 'var(--brand)' }}>{quickProductsCount}</span>
                )}
              </button>
              <button
                onClick={() => setSelectedCategory('all')}
                className={clsx('w-full py-2 px-2.5 rounded-xl font-bold text-xs text-left transition-all flex items-center gap-2 border')}
                style={selectedCategory === 'all'
                  ? { background: 'rgba(255,102,0,0.18)', color: 'var(--brand)', borderColor: 'rgba(255,102,0,0.40)' }
                  : { color: 'var(--text-2)', borderColor: 'transparent' }}
              >
                <Layers className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                <span className="truncate flex-1">Tüm Ürünler</span>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{allProducts.length}</span>
              </button>
              <div className="h-px my-1" style={{ background: 'var(--border)' }} />
              {categories.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={clsx('w-full py-2 px-2.5 rounded-xl font-bold text-xs text-left transition-all flex items-center gap-2 border')}
                  style={selectedCategory === cat.id
                    ? { background: 'rgba(255,102,0,0.18)', color: 'var(--brand)', borderColor: 'rgba(255,102,0,0.40)' }
                    : { color: 'var(--text-2)', borderColor: 'transparent' }}
                >
                  <span className="text-sm leading-none flex-shrink-0">{cat.icon || '☕'}</span>
                  <span className="truncate flex-1">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Col 3: Products Grid + Total Bar */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-1.5 px-1 flex-shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-xs font-bold uppercase tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>
                  {selectedCategory === 'quick' ? '⚡ Hızlı Menü' : selectedCategory === 'all' ? 'Tüm Ürünler' : 'Ürünler'}
                </h2>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>({displayedProducts.length})</span>
              </div>
              <div className="relative w-40 lg:w-52 flex-shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Ara..."
                  className="w-full pl-8 pr-2.5 py-1 rounded-xl text-xs focus:outline-none focus:border-orange-500"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>

            {/* Product Cards Grid with min-w-0 */}
            <div className="flex-1 rounded-2xl p-2.5 flex flex-col overflow-hidden min-w-0" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5">
                <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
                  {displayedProducts.map((prod: any) => renderProductCard(prod, false))}
                </div>
                {displayedProducts.length === 0 && (
                  <div className="py-16 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    <p className="font-bold">Ürün bulunamadı</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Bar: Total Amount & Checkout Button */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl mt-2 flex-shrink-0 gap-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Toplam Tutar</span>
                <span className="text-base font-black" style={{ color: 'var(--text)' }}>₺{grandTotal.toFixed(0)}</span>
              </div>
              {canPay ? (
                <button
                  onClick={() => router.push(`/cashier/session/${sessionId}`)}
                  className="text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 flex-shrink-0"
                  style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Hesap &amp; Ödeme</span>
                </button>
              ) : (
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Ödeme Yetkisi Yok</span>
              )}
            </div>
          </div>
        </div>

        {/* ─── Mobile Layout ─── */}
        <div className="flex flex-col flex-1 min-h-0 md:hidden overflow-hidden">
          {/* Mobile Tab Switcher */}
          <div className="flex items-center flex-shrink-0 p-1 gap-1 rounded-xl mb-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setMobileTab('menu')}
              className={clsx('flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all')}
              style={mobileTab === 'menu'
                ? { background: 'var(--brand)', color: '#fff' }
                : { color: 'var(--text-2)' }}
            >
              <Coffee className="w-3.5 h-3.5" />
              Menü
            </button>
            <button
              onClick={() => setMobileTab('cart')}
              className={clsx('flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all relative')}
              style={mobileTab === 'cart'
                ? { background: 'var(--brand)', color: '#fff' }
                : { color: 'var(--text-2)' }}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Sepet &amp; Masa
              {cart.length > 0 && (
                <span className="min-w-[16px] h-4 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1" style={{ background: 'var(--danger)' }}>
                  {cart.length}
                </span>
              )}
            </button>
          </div>

          {/* Mobile: Menu Tab */}
          {mobileTab === 'menu' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-2">
              <div className="flex-shrink-0 overflow-x-auto custom-scrollbar flex gap-1.5 pb-0.5">
                <button
                  onClick={() => setSelectedCategory('quick')}
                  className={clsx('flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border')}
                  style={selectedCategory === 'quick'
                    ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                    : { background: 'var(--card)', color: 'var(--brand)', borderColor: 'rgba(255,102,0,0.30)' }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>⚡ Hızlı</span>
                </button>
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={clsx('flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border')}
                  style={selectedCategory === 'all'
                    ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                    : { background: 'var(--card)', color: 'var(--text-2)', borderColor: 'var(--border)' }}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Tümü</span>
                </button>
                {categories.map((cat: any) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={clsx('flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border')}
                    style={selectedCategory === cat.id
                      ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                      : { background: 'var(--card)', color: 'var(--text-2)', borderColor: 'var(--border)' }}
                  >
                    <span>{cat.icon || '☕'}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>

              <div className="relative flex-shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Ürün ara..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs focus:outline-none focus:border-orange-500"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-2 pb-2">
                  {displayedProducts.map((prod: any) => renderProductCard(prod, true))}
                </div>
              </div>
            </div>
          )}

          {/* Mobile: Cart & Table Items Tab */}
          {mobileTab === 'cart' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                {cart.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--brand)' }}>Yeni Eklenecekler</p>
                    {cart.map(item => (
                      <CartItemRow
                        key={item.product_id}
                        item={item}
                        onUpdate={d => updateQty(item.product_id, d)}
                        onRemove={() => setCart(p => p.filter(i => i.product_id !== item.product_id))}
                        onNote={() => { setNoteFor(item.product_id); setNoteText(item.note); }}
                      />
                    ))}
                  </div>
                )}
                {deliveredItems.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Masada Olanlar</p>
                    {deliveredItems.map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border-sub)' }}>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>{it.product_name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>₺{(Number(it.unit_price) * it.quantity).toFixed(0)}</p>
                        </div>

                        {canEditTableItems ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="flex items-center rounded-lg overflow-hidden" style={{ background: 'var(--card-hover)' }}>
                              <button
                                onClick={() => handleUpdateDeliveredQty(it, -1)}
                                className="w-6 h-6 flex items-center justify-center hover:bg-white/10 active:scale-90"
                                style={{ color: 'var(--text)' }}
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="w-5 text-center text-xs font-black" style={{ color: 'var(--brand)' }}>{it.quantity}</span>
                              <button
                                onClick={() => handleUpdateDeliveredQty(it, 1)}
                                className="w-6 h-6 flex items-center justify-center hover:bg-white/10 active:scale-90"
                                style={{ color: 'var(--text)' }}
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            <button
                              onClick={() => handleDeleteDeliveredItem(it)}
                              className="w-6 h-6 rounded-lg flex items-center justify-center"
                              style={{ background: 'rgba(248,113,113,0.12)', color: 'var(--danger)' }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="font-black text-xs" style={{ color: 'var(--brand)' }}>x{it.quantity}</span>
                            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {cart.length === 0 && deliveredItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10" style={{ color: 'var(--text-muted)' }}>
                    <Coffee className="w-8 h-8 mb-1.5 opacity-30" />
                    <p className="text-xs">Sepet boş</p>
                    <button onClick={() => setMobileTab('menu')} className="mt-2 text-xs font-bold" style={{ color: 'var(--brand)' }}>
                      Menüden ürün seç →
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 mt-2 space-y-1.5">
                {cart.length > 0 && (
                  <input
                    value={kitchenNote}
                    onChange={e => setKitchenNote(e.target.value)}
                    placeholder="Mutfak notu..."
                    className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                )}
                {cart.length > 0 && (
                  <button
                    onClick={() => sendOrderMutation.mutate()}
                    disabled={sendOrderMutation.isPending}
                    className="w-full text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}
                  >
                    <Send className="w-4 h-4" />
                    <span>{cafe?.kitchen_enabled ? 'Mutfağa Gönder' : 'Siparişi Kaydet'} · ₺{cartTotal.toFixed(0)}</span>
                  </button>
                )}
                {grandTotal > 0 && canPay && (
                  <button
                    onClick={() => router.push(`/cashier/session/${sessionId}`)}
                    className="w-full font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-all active:scale-[0.98]"
                    style={{ background: 'var(--card)', border: '1px solid rgba(255,102,0,0.40)', color: 'var(--brand)' }}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Hesap &amp; Ödeme · ₺{grandTotal.toFixed(0)}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Note Modal ─── */}
        {noteFor !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl p-5 shadow-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>Ürün Notu</h3>
              <input
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveNote(noteFor); }}
                placeholder="Örn: Az şekerli, sıcak olsun..."
                className="w-full rounded-xl px-3.5 py-2.5 text-xs placeholder-slate-500 focus:outline-none focus:border-orange-500 mb-3"
                style={{ background: 'var(--card-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={() => setNoteFor(null)} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: 'var(--app)', color: 'var(--text-2)' }}>
                  İptal
                </button>
                <button
                  onClick={() => saveNote(noteFor)}
                  className="flex-1 text-white py-2 rounded-xl text-xs font-bold"
                  style={{ background: 'var(--brand)' }}
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Table Transfer Modal ─── */}
        {showTransferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between pb-2.5 mb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Masayı Taşı / Aktar</h3>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <strong>{tableName}</strong> masasını başka bir masaya taşıyın
                  </p>
                </div>
                <button onClick={() => setShowTransferModal(false)} className="p-1.5 rounded-xl hover:bg-white/10" style={{ color: 'var(--text-2)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {transferableTables.map((t: any) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (confirm(`Masayı ${t.name} masasına aktarmak istediğinize emin misiniz?`)) {
                          transferMutation.mutate(t.id);
                          setShowTransferModal(false);
                        }
                      }}
                      className="p-3 rounded-xl text-left border flex flex-col justify-between transition-all hover:scale-98 active:scale-95"
                      style={{
                        background: t.status === 'occupied' ? 'rgba(62,166,255,0.12)' : 'var(--card-hover)',
                        borderColor: t.status === 'occupied' ? 'var(--sky)' : 'var(--border)',
                      }}
                    >
                      <span className="font-bold text-xs" style={{ color: 'var(--text)' }}>{t.name}</span>
                      <span className="text-[10px] mt-1" style={{ color: t.status === 'occupied' ? 'var(--sky)' : 'var(--success)' }}>
                        {t.status === 'occupied' ? 'Dolu Masa' : 'Boş Masa'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
