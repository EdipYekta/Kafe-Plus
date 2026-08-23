'use client';
import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  X, Plus, Minus, Trash2, Send, CreditCard,
  ChevronRight, ArrowRightLeft, MessageSquare, Coffee,
  CheckCircle2, Clock, Check
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface CartItem {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  note: string;
}

export default function TableSessionDeskPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const qc = useQueryClient();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [transferTarget, setTransferTarget] = useState('');
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [kitchenNote, setKitchenNote] = useState('');

  // 1. Fetch Cafe Info
  const { data: cafe } = useQuery({
    queryKey: ['cafe'],
    queryFn: () => api.get('/cafes').then((r) => r.data),
  });

  // 2. Fetch Session Info
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.get(`/sessions/${sessionId}`).then((r) => r.data),
    refetchInterval: 10000,
  });

  // 3. Fetch Existing Orders for this Table Session
  const { data: orders = [] } = useQuery({
    queryKey: ['orders', sessionId],
    queryFn: () => api.get('/orders', { params: { session_id: sessionId } }).then((r) => r.data),
    refetchInterval: 10000,
  });

  // 4. Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  // Set default category once loaded
  useEffect(() => {
    if (categories.length > 0 && selectedCategory === null) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  // 5. Fetch Products for selected category
  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: () => api.get('/products', { params: { category_id: selectedCategory } }).then((r) => r.data),
  });

  // Send Order Mutation
  const sendOrderMutation = useMutation({
    mutationFn: () =>
      api.post('/orders', {
        session_id: sessionId,
        items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity, note: i.note })),
        kitchen_note: kitchenNote,
      }),
    onSuccess: () => {
      toast.success(cafe?.kitchen_enabled ? 'Sipariş mutfağa iletildi!' : 'Sipariş masaya eklendi!');
      setCart([]);
      setKitchenNote('');
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['orders', sessionId] });
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Sipariş kaydedilemedi'),
  });

  // Cancel / Abort Session Mutation (Frees up table)
  const cancelSessionMutation = useMutation({
    mutationFn: () => api.post(`/sessions/${sessionId}/cancel`),
    onSuccess: () => {
      toast.success('Masa boşaltıldı');
      qc.invalidateQueries({ queryKey: ['tables'] });
      router.push('/waiter');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Masa iptal edilemedi'),
  });

  // Transfer Table Mutation
  const transferMutation = useMutation({
    mutationFn: (targetName: string) =>
      api.post(`/sessions/${sessionId}/transfer`, {
        target_table_name: targetName,
      }),
    onSuccess: (res) => {
      toast.success(`Masa ${transferTarget.toUpperCase()} masasına aktarıldı`);
      qc.invalidateQueries({ queryKey: ['tables'] });
      if (res.data?.target_session_id) {
        router.push(`/waiter/session/${res.data.target_session_id}`);
      } else {
        router.push('/waiter');
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Masa taşıma başarısız'),
  });

  // Cart operations
  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) => (i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          note: '',
        },
      ];
    });
  };

  const updateQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.product_id === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const saveNote = (productId: number) => {
    setCart((prev) => prev.map((i) => (i.product_id === productId ? { ...i, note: noteText } : i)));
    setNoteFor(null);
    setNoteText('');
  };

  // Flatten delivered items from existing orders
  const deliveredItems = useMemo(() => {
    const list: any[] = [];
    orders.forEach((o: any) => {
      o.items?.forEach((it: any) => {
        list.push({ ...it, order_status: o.status, order_id: o.id });
      });
    });
    return list;
  }, [orders]);

  // Tab state for mobile view (which column is visible)
  const [mobileTab, setMobileTab] = useState<'items' | 'menu'>('menu');

  // Handle Close / Exit – ALWAYS just goes back, never auto-cancels
  const handleExit = () => {
    router.push('/waiter');
  };

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const deliveredTotal = Number(session?.total_amount || 0);
  const grandTotal = deliveredTotal + cartTotal;

  const tableName = session?.table_name || 'Masa';

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#dde6ed] text-slate-800 flex flex-col font-sans select-none p-2 sm:p-4">
      {/* ─── Top Bar ─── */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="bg-[#8faebe] text-white font-black text-base sm:text-xl px-4 sm:px-6 py-2 rounded-2xl shadow-sm tracking-wide flex-shrink-0">
            {tableName}
          </div>
          {session?.area_name && (
            <span className="text-xs font-bold px-2 sm:px-3 py-1.5 rounded-xl bg-white text-slate-700 border border-slate-300 shadow-xs truncate hidden sm:block">
              {session.area_name}
            </span>
          )}
          {/* Mobile: amount badge */}
          {grandTotal > 0 && (
            <span className="text-xs font-black px-2 py-1.5 rounded-xl bg-orange-500 text-white shadow-xs flex-shrink-0 sm:hidden">
              ₺{Math.round(grandTotal)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Mobile tab toggle */}
          <div className="flex sm:hidden bg-white/80 rounded-xl border border-slate-300 p-0.5 gap-0.5">
            <button
              onClick={() => setMobileTab('menu')}
              className={clsx('px-2.5 py-1 rounded-lg text-[11px] font-black transition-all', mobileTab === 'menu' ? 'bg-orange-500 text-white' : 'text-slate-600')}
            >Menü</button>
            <button
              onClick={() => setMobileTab('items')}
              className={clsx('px-2.5 py-1 rounded-lg text-[11px] font-black transition-all', mobileTab === 'items' ? 'bg-[#38bdf8] text-white' : 'text-slate-600')}
            >Sepet {cart.length > 0 && `(${cart.length})`}</button>
          </div>

          {/* Masayı Boşalt – only when no items */}
          {deliveredItems.length === 0 && cart.length === 0 && (
            <button
              onClick={() => cancelSessionMutation.mutate()}
              disabled={cancelSessionMutation.isPending}
              className="bg-white hover:bg-red-50 text-red-600 font-bold px-2.5 sm:px-3.5 py-2 rounded-2xl shadow-xs border border-red-200 text-xs flex items-center gap-1 transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Masayı Boşalt</span>
            </button>
          )}

          {/* Ödeme shortcut on mobile */}
          {(deliveredItems.length > 0 || cart.length > 0) && (
            <button
              onClick={() => router.push(`/cashier/session/${sessionId}`)}
              className="sm:hidden bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold px-3 py-2 rounded-2xl text-xs flex items-center gap-1 shadow-xs active:scale-95"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Ödeme
            </button>
          )}

          {/* X – always just goes back, never cancels */}
          <button
            onClick={handleExit}
            className="bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 w-10 h-10 sm:w-11 sm:h-11 rounded-2xl shadow-sm flex items-center justify-center transition-all active:scale-95 border border-slate-300/60"
            title="Masadan Çık"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* ─── Main POS Workspace ─── */}
      {/* Desktop: 3 columns. Mobile: tab-based (menu=menü, items=sepet) */}
      <div className="flex-1 grid grid-cols-12 gap-2 sm:gap-3 min-h-0">
        {/* ─── COLUMN 1: Masadaki Ürünler (Left Box) ─── */}
        <div className={clsx(
          'col-span-12 sm:col-span-4 md:col-span-3 lg:col-span-3 flex flex-col min-h-0 bg-transparent',
          // On mobile show only if mobileTab === 'items'
          mobileTab === 'items' ? 'flex' : 'hidden sm:flex'
        )}>
          <div className="flex items-center justify-between mb-1.5 px-1">
            <h2 className="text-sm font-bold text-slate-700">Masadaki Ürünler</h2>
            <span className="text-[11px] font-bold text-slate-500">
              {deliveredItems.length + cart.length} ürün
            </span>
          </div>

          <div className="flex-1 overflow-hidden bg-[#c4d4dc] rounded-3xl p-3 flex flex-col justify-between border border-slate-300/60 shadow-inner">
            {/* Scrollable Items Container */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {/* 1. Pending Cart Items */}
              {cart.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-orange-700 uppercase tracking-wider px-1">
                    Yeni Eklenecekler ({cart.length})
                  </div>
                  {cart.map((item) => (
                    <div
                      key={item.product_id}
                      className="bg-white rounded-2xl p-2.5 shadow-sm border border-orange-200 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 truncate flex-1">{item.name}</span>
                        <span className="font-bold text-xs text-orange-600 ml-2">
                          ₺{(item.price * item.quantity).toFixed(0)}
                        </span>
                      </div>

                      {item.note && (
                        <div className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 font-medium">
                          Not: {item.note}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-0.5">
                          <button
                            onClick={() => updateQty(item.product_id, -1)}
                            className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-black text-xs px-2 text-slate-800">{item.quantity}</span>
                          <button
                            onClick={() => updateQty(item.product_id, 1)}
                            className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setNoteFor(item.product_id);
                              setNoteText(item.note);
                            }}
                            className={clsx(
                              'p-1.5 rounded-xl transition-colors',
                              item.note
                                ? 'bg-amber-100 text-amber-700'
                                : 'text-slate-400 hover:text-slate-700'
                            )}
                            title="Not Ekle"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.product_id)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 2. Existing Sent Orders */}
              {deliveredItems.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
                    Masada Olan Ürünler ({deliveredItems.length})
                  </div>
                  {deliveredItems.map((it: any) => (
                    <div
                      key={it.id}
                      className="bg-white/80 rounded-2xl p-2.5 shadow-sm border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-800 truncate">{it.product_name}</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            x{it.quantity}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-600">
                          ₺{(Number(it.unit_price) * it.quantity).toFixed(0)}
                        </p>
                        {it.note && <p className="text-[10px] text-slate-500 italic">Not: {it.note}</p>}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-xl">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Siparişte</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cart.length === 0 && deliveredItems.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6">
                  <Coffee className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-xs font-semibold">Masada henüz ürün yok</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Sağdaki menüden ürün seçebilirsiniz</p>
                </div>
              )}
            </div>

            {/* Bottom Quick Action for Left Column */}
            {cart.length > 0 && (
              <div className="pt-2 mt-2 border-t border-slate-300/60">
                <button
                  onClick={() => sendOrderMutation.mutate()}
                  disabled={sendOrderMutation.isPending}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-2.5 rounded-2xl shadow-md flex items-center justify-center gap-2 text-xs transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {cafe?.kitchen_enabled ? 'Mutfağa Gönder' : 'Siparişi Onayla & Kaydet'} ({cart.length})
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── COLUMN 2: Ürün Ekle - Kategoriler (Middle Box) ─── */}
        <div className={clsx(
          'col-span-12 sm:col-span-4 md:col-span-4 lg:col-span-4 flex flex-col min-h-0 bg-transparent',
          mobileTab === 'menu' ? 'flex' : 'hidden sm:flex'
        )}>
          <div className="flex items-center justify-between mb-1.5 px-1">
            <h2 className="text-sm font-bold text-slate-700">Kategoriler</h2>
          </div>

          <div className="flex-1 overflow-hidden bg-[#c4d4dc] rounded-3xl p-3 flex flex-col border border-slate-300/60 shadow-inner">
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {categories.map((cat: any) => {
                const isSelected = selectedCategory === cat.id;
                const catIcon = cat.icon || '☕';
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={clsx(
                      'w-full py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm text-left transition-all duration-150 active:scale-98 shadow-xs border flex items-center gap-2',
                      isSelected
                        ? 'bg-white text-slate-900 border-2 border-orange-400 shadow-md ring-2 ring-orange-400/20'
                        : 'bg-white/80 hover:bg-white text-slate-700 border-slate-200/80'
                    )}
                  >
                    <span className="text-lg leading-none flex-shrink-0">{catIcon}</span>
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── COLUMN 3: Ürünler Grid + Taşı/Birleştir + Toplam Tutar (Right Box) ─── */}
        <div className={clsx(
          'col-span-12 sm:col-span-4 md:col-span-5 lg:col-span-5 flex flex-col min-h-0 justify-between gap-2',
          mobileTab === 'menu' ? 'flex' : 'hidden sm:flex'
        )}>
          {/* Top: Product Selection Grid */}
          <div className="flex-1 overflow-hidden bg-[#c4d4dc] rounded-3xl p-3 flex flex-col border border-slate-300/60 shadow-inner min-h-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-slate-600">Ürün Seçimi</span>
              <span className="text-[11px] font-semibold text-slate-500">{products.length} ürün</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {products.map((prod: any) => {
                  const icon = prod.category_icon || '☕';
                  return (
                    <button
                      key={prod.id}
                      onClick={() => addToCart(prod)}
                      className="h-20 bg-white hover:bg-slate-50 active:scale-95 rounded-2xl p-2.5 shadow-xs border border-slate-200/80 flex flex-col justify-between text-left transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <p className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight group-hover:text-orange-600 flex-1">
                          {prod.name}
                        </p>
                        <span className="text-base leading-none ml-1">{icon}</span>
                      </div>
                      <p className="font-black text-xs text-slate-900">₺{Number(prod.price).toFixed(0)}</p>
                    </button>
                  );
                })}

                {products.length === 0 && (
                  <div className="col-span-3 py-10 text-center text-slate-400 text-xs">
                    Bu kategoride henüz ürün bulunmuyor
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Controls: Taşı/Birleştir & Toplam Tutar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-shrink-0">
            {/* Taşı / Birleştir Box */}
            <div className="bg-[#c4d4dc] rounded-2xl p-2.5 border border-slate-300/60 shadow-inner flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-600 mb-1 block">Taşı / Birleştir</span>
              <div className="flex items-center gap-1.5">
                <input
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  placeholder="Masa (A7, B2)"
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 uppercase placeholder-slate-400 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={() => {
                    if (!transferTarget.trim()) return toast.error('Hedef masa adını yazın');
                    transferMutation.mutate(transferTarget.trim());
                  }}
                  disabled={transferMutation.isPending}
                  className="bg-white hover:bg-slate-50 text-slate-800 w-9 h-8 rounded-xl font-bold flex items-center justify-center shadow-xs border border-slate-300 active:scale-95"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Toplam Tutar Box & Hesap Link */}
            <div className="bg-[#c4d4dc] rounded-2xl p-2.5 border border-slate-300/60 shadow-inner flex flex-col justify-between">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-bold text-slate-600">Toplam Tutar:</span>
                <span className="text-base font-black text-slate-900">₺{grandTotal.toFixed(0)}</span>
              </div>
              <button
                onClick={() => router.push(`/cashier/session/${sessionId}`)}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-1.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-98"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Hesap / Ödeme</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Note Input Modal ─── */}
      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 mb-2">Ürün Notu Ekle</h3>
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Örn: Az şekerli, Sıcak olsun..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold mb-3 focus:outline-none focus:border-orange-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setNoteFor(null)}
                className="flex-1 bg-slate-100 text-slate-600 py-1.5 rounded-xl text-xs font-semibold"
              >
                İptal
              </button>
              <button
                onClick={() => saveNote(noteFor)}
                className="flex-1 bg-orange-500 text-white py-1.5 rounded-xl text-xs font-bold"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
