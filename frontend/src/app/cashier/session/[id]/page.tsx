'use client';
import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  CreditCard, Banknote, ShoppingBag, Check, X,
  Percent, ArrowLeft, Tag, Trash2, RotateCcw,
  Calculator, ListChecks, Minus, Plus,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import MainLayout from '@/components/layout/MainLayout';
import { useAuthStore } from '@/store/authStore';

const PAYMENT_TYPES = [
  { id: 'cash', label: 'Nakit', icon: Banknote, color: '#16a34a' },
  { id: 'credit_card', label: 'Kredi Kartı', icon: CreditCard, color: '#2563eb' },
  { id: 'meal_card', label: 'Yemek Kartı', icon: ShoppingBag, color: '#7c3aed' },
];

const QUICK_AMOUNTS = [50, 100, 150, 200, 500];

const DISCOUNT_REASONS = [
  'Personel İndirimi',
  'Müdür İkramı',
  'Müşteri Memnuniyeti',
  'Özel İskonto',
  'Grup / Toplu İndirim',
];

const sharedInputStyle = { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' };

export default function CashierSessionPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const sessionId = params.id as string;
  const { user, isAuthenticated } = useAuthStore();

  const canPay = user?.permissions?.can_take_payment || user?.role === 'Owner' || user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'SuperAdmin';

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (user && !canPay) {
      if (user?.permissions?.can_view_kitchen || user.role === 'Kitchen') {
        router.replace('/kitchen');
      } else {
        router.replace('/waiter');
      }
    }
  }, [user, isAuthenticated, canPay, router]);

  const [paymentType, setPaymentType] = useState('cash');
  const [amount, setAmount] = useState('');
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [numpadInput, setNumpadInput] = useState('');

  // Payment mode: 'calc' = calculator/numpad, 'items' = pay per item units
  const [payMode, setPayMode] = useState<'calc' | 'items'>('calc');
  // Units to pay now per order item: { [order_item_id]: count }
  const [payQty, setPayQty] = useState<Record<number, number>>({});

  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.get(`/sessions/${sessionId}`).then((r) => r.data),
    refetchInterval: 5000,
    enabled: Boolean(canPay),
  });
  const { data: orders = [] } = useQuery({
    queryKey: ['session-orders', sessionId],
    queryFn: () => api.get('/orders', { params: { session_id: sessionId } }).then((r) => r.data),
    refetchInterval: 5000,
    enabled: Boolean(canPay),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['session-payments', sessionId],
    queryFn: () => api.get(`/payments/session/${sessionId}`).then((r) => r.data),
    refetchInterval: 5000,
    enabled: Boolean(canPay),
  });

  if (!isAuthenticated || !canPay) {
    return null;
  }

  const totalAmount = Number(session?.total_amount || 0);
  const paidAmount = Number(session?.paid_amount || payments.reduce((s: number, p: any) => s + Number(p.amount), 0));
  const sessionDiscount = Number(session?.total_discount || session?.discount_amount || 0);
  const sessionDiscountReason = session?.discount_reason || '';

  const remaining = Math.max(0, totalAmount - sessionDiscount - paidAmount);

  // Flatten all order items, including how many units are already paid / still unpaid
  const allOrderItems = useMemo(() => {
    const list: { id: number; product_name: string; quantity: number; paid_quantity: number; unit_price: number; note: string; order_id: number }[] = [];
    orders.forEach((o: any) => {
      o.items?.forEach((it: any) => {
        if (it.status !== 'cancelled') {
          list.push({
            id: it.id,
            product_name: it.product_name,
            quantity: it.quantity,
            paid_quantity: Number(it.paid_quantity || 0),
            unit_price: Number(it.unit_price),
            note: it.note,
            order_id: o.id,
          });
        }
      });
    });
    return list;
  }, [orders]);

  // Remaining unpaid units for an item
  const remainingUnits = (it: any) => Math.max(0, it.quantity - it.paid_quantity);

  // Amount contributed by the units chosen on each item
  const itemsPayable = useMemo(() => {
    let s = 0;
    Object.entries(payQty).forEach(([id, q]) => {
      const it = allOrderItems.find((x) => x.id === Number(id));
      if (it && q > 0) s += q * it.unit_price;
    });
    return s;
  }, [payQty, allOrderItems]);

  const totalPayUnits = useMemo(() => Object.values(payQty).reduce((s, q) => s + (q || 0), 0), [payQty]);

  // Manual amount typed on the numpad (0 if none)
  const manualAmount = parseFloat(numpadInput || amount) || 0;
  // Amount to pay: in items mode = selected units; in calc mode = manual + selected units (falls back to remaining)
  const payableAmount = (payMode === 'items' ? itemsPayable : (manualAmount + itemsPayable)) || remaining;

  // Increment / decrement how many units of an item to pay now (0..remaining unpaid units)
  const adjustPayQty = (itemId: number, delta: number) => {
    setPayQty((prev) => {
      const cur = prev[itemId] || 0;
      const it = allOrderItems.find((x) => x.id === itemId);
      const max = it ? remainingUnits(it) : 0;
      const next = Math.min(Math.max(0, cur + delta), max);
      const copy = { ...prev };
      if (next > 0) copy[itemId] = next;
      else delete copy[itemId];
      return copy;
    });
  };

  const selectAllItems = () => {
    const next: Record<number, number> = {};
    allOrderItems.forEach((it) => {
      const rem = remainingUnits(it);
      if (rem > 0) next[it.id] = rem;
    });
    setPayQty(next);
  };

  const clearItemSelection = () => {
    setPayQty({});
  };

  const applyDiscountMutation = useMutation({
    mutationFn: (data: { discount_amount: number; discount_reason: string }) =>
      api.patch(`/sessions/${sessionId}/discount`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'İndirim uygulanamadı'),
  });

  const payMutation = useMutation({
    mutationFn: (data: any) => api.post('/payments', { ...data, session_id: sessionId }),
    onSuccess: () => {
      toast.success('Ödeme başarıyla kaydedildi');
      setAmount('');
      setNumpadInput('');
      setPayQty({});
      qc.invalidateQueries({ queryKey: ['session-payments', sessionId] });
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['session-orders', sessionId] });
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['payment-history'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Ödeme alınırken hata oluştu'),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: number) => api.delete(`/payments/${paymentId}`),
    onSuccess: () => {
      toast.success('Ödeme geri alındı');
      qc.invalidateQueries({ queryKey: ['session-payments', sessionId] });
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['payment-history'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Ödeme geri alınamadı'),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.post(`/sessions/${sessionId}/close`),
    onSuccess: () => {
      toast.success('Masa hesabı kapatıldı');
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['payment-history'] });
      router.push('/waiter');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Masa kapatılamadı'),
  });

  const cancelSessionMutation = useMutation({
    mutationFn: () => api.post(`/sessions/${sessionId}/cancel`),
    onSuccess: () => {
      toast.success('Masa iptal edildi');
      qc.invalidateQueries({ queryKey: ['tables'] });
      router.push('/waiter');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Masa iptal edilemedi'),
  });

  const handleNumpad = (key: string) => {
    if (key === 'del') {
      setNumpadInput((prev) => prev.slice(0, -1));
    } else if (key === '.') {
      if (!numpadInput.includes('.')) setNumpadInput((prev) => prev + '.');
    } else {
      setNumpadInput((prev) => {
        const next = prev + key;
        setAmount(next);
        return next;
      });
    }
  };

  const handlePay = () => {
    if (!canPay) return toast.error('Ödeme alma yetkiniz bulunmuyor!');
    if (payableAmount <= 0) return toast.error('Geçerli bir tutar girin veya ürün seçin');
    // Send per-item units so the backend records how much of each product was paid.
    const items = Object.entries(payQty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => ({ order_item_id: Number(id), quantity: q }));
    payMutation.mutate({ amount: payableAmount, payment_type: paymentType, items });
  };

  const tableName = session?.table_name || 'Masa';

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100dvh-52px-1px)] overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.push('/waiter')}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
              style={{ color: 'var(--text-2)' }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="font-black text-base px-4 py-2 rounded-2xl tracking-wide flex-shrink-0" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              {tableName} · Kasa
            </div>
            {session?.area_name && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs" style={{ background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                {session.area_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {orders.length === 0 && (
              <button
                onClick={() => cancelSessionMutation.mutate()}
                disabled={cancelSessionMutation.isPending}
                className="font-bold px-2.5 sm:px-3.5 py-2 rounded-2xl text-xs flex items-center gap-1 transition-all active:scale-95"
                style={{ background: 'rgba(248,113,113,0.10)', color: 'var(--danger)', border: '1px solid rgba(248,113,113,0.30)' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Masayı Bosalt</span>
              </button>
            )}
            <Link
              href="/waiter"
              className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-95 hover:bg-white/10"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
              title="Masalara Dön"
            >
              <X className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Mode Toggle: Ürün Seç / Hesap Makinesi */}
        {canPay && orders.length > 0 && (
          <div className="flex items-center gap-1 p-1 rounded-2xl mb-3 flex-shrink-0 w-fit" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => { setPayMode('items'); setNumpadInput(''); setAmount(''); }}
              className={clsx('flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all')}
              style={payMode === 'items'
                ? { background: 'var(--brand)', color: '#fff' }
                : { color: 'var(--text-2)' }}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Ürün Seç</span>
            </button>
            <button
              onClick={() => { setPayMode('calc'); setPayQty({}); }}
              className={clsx('flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all')}
              style={payMode === 'calc'
                ? { background: 'var(--brand)', color: '#fff' }
                : { color: 'var(--text-2)' }}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Hesap Makinesi</span>
            </button>
          </div>
        )}

        {/* Main 2-Column POS Layout */}
        <div className="flex-1 grid grid-cols-12 gap-2 sm:gap-3 min-h-0">
          {/* Left: Orders & Payments Summary */}
          <div className="col-span-12 md:col-span-7 flex flex-col min-h-0 rounded-3xl p-3 sm:p-4" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                {payMode === 'items' ? 'Ödenecek Ürünleri Seçin' : 'Ürünlere Dokunarak Tutar Girin'}
              </h2>
              <div className="flex items-center gap-2">
                {/* Select all / clear — works in both modes */}
                {canPay && allOrderItems.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={selectAllItems}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors"
                      style={{ background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                    >
                      Tümünü Seç
                    </button>
                    <button
                      onClick={clearItemSelection}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors"
                      style={{ background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                    >
                      Temizle
                    </button>
                  </div>
                )}
                {/* Discount button — gated by canPay */}
                {canPay && (
                  <button
                    onClick={() => setShowDiscountModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                    style={{ background: 'var(--card)', color: 'var(--brand)', border: '1px solid rgba(255,102,0,0.30)' }}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>{sessionDiscount > 0 ? `İndirim (₺${sessionDiscount.toFixed(0)})` : 'İndirim / İkram'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Orders List — items are clickable in 'items' mode */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {orders.map((order: any) => (
                <div key={order.id} className="rounded-2xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--border-sub)' }}>
                  <div className="flex items-center justify-between mb-1.5 pb-1" style={{ borderBottom: '1px solid var(--border-sub)' }}>
                    <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>Siparis #{order.id}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--card-hover)', color: 'var(--text-2)' }}>
                      {order.waiter_name}
                    </span>
                  </div>
                  {order.items?.map((item: any, i: number) => {
                    if (item.status === 'cancelled') return null;
                    const rem = remainingUnits(item);
                    const qty = payQty[item.id] || 0;
                    const isSelected = qty > 0;
                    const lineTotal = (item.quantity * item.unit_price).toFixed(2);
                    const contributes = (qty * item.unit_price).toFixed(2);
                    return (
                      <div
                        key={i}
                        className={clsx(
                          'flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg text-xs transition-all',
                        )}
                        style={isSelected
                          ? { background: 'rgba(255,102,0,0.15)', border: '1px solid rgba(255,102,0,0.40)' }
                          : { border: '1px solid transparent' }}
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>
                            {item.product_name}
                            {item.note && <span style={{ color: 'var(--brand)' }} className="text-[10px] ml-1">({item.note})</span>}
                          </span>
                          <span className="text-[10px] font-medium text-muted truncate" style={{ color: 'var(--text-muted)' }}>
                            {item.quantity}x · ünite ₺{Number(item.unit_price).toFixed(0)}
                            {item.paid_quantity > 0 && ` · ödenen ${item.paid_quantity}`} · kalan {rem}
                          </span>
                        </div>

                        {/* Units-to-pay stepper */}
                        {canPay ? (
                          <div
                            className="flex items-center rounded-lg overflow-hidden flex-shrink-0"
                            style={{ background: 'var(--card-hover)' }}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); adjustPayQty(item.id, -1); }}
                              disabled={qty <= 0}
                              className="w-7 h-7 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all disabled:opacity-40"
                              style={{ color: 'var(--text)' }}
                              title="Azalt"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-sm font-black" style={{ color: qty > 0 ? 'var(--brand)' : 'var(--text-2)' }}>
                              {qty}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); adjustPayQty(item.id, 1); }}
                              disabled={rem <= 0 || qty >= rem}
                              className="w-7 h-7 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all disabled:opacity-40"
                              style={{ color: 'var(--text)' }}
                              title="Arttır"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--card-hover)', color: 'var(--text-2)' }}>
                            {item.quantity}x
                          </span>
                        )}

                        <span className="font-bold flex-shrink-0 w-14 text-right" style={{ color: isSelected ? 'var(--brand)' : 'var(--text)' }}>
                          ₺{canPay ? (qty > 0 ? contributes : lineTotal) : lineTotal}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {orders.length === 0 && (
                <div className="h-40 flex flex-col items-center justify-center text-center">
                  <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>Masada siparis bulunmuyor</p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Masayı kapatmak için aşağıdaki butonu kullanabilirsiniz</p>
                </div>
              )}

              {/* Previous Payments */}
              {payments.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-xs font-bold" style={{ color: 'var(--text-2)' }}>Alınan Ödemeler ({payments.length})</h3>
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Masa açıkken geri alınabilir</span>
                  </div>
                  <div className="space-y-1.5">
                    {payments.map((p: any) => (
                      <div
                        key={p.id}
                        className="rounded-2xl p-2.5 flex items-center justify-between text-xs"
                        style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold" style={{ color: 'var(--success)' }}>
                            {PAYMENT_TYPES.find((t) => t.id === p.payment_type)?.label || p.payment_type}
                          </span>
                          {p.created_at && (
                            <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                              {new Date(p.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold" style={{ color: 'var(--success)' }}>₺{Number(p.amount).toFixed(2)}</span>
                          {canPay && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`₺${Number(p.amount).toFixed(2)} tutarındaki bu ödemeyi geri almak istediğinize emin misiniz?`)) {
                                  deletePaymentMutation.mutate(p.id);
                                }
                              }}
                              disabled={deletePaymentMutation.isPending}
                              className="border px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors active:scale-95 disabled:opacity-50"
                              style={{ background: 'var(--card)', color: 'var(--danger)', borderColor: 'rgba(248,113,113,0.30)' }}
                              title="Ödemeyi Geri Al"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Geri Al</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Active Applied Discount Banner — only show remove button to canPay users */}
            {sessionDiscount > 0 && (
              <div className="mt-2 p-2.5 rounded-2xl flex items-center justify-between text-xs" style={{ background: 'rgba(255,102,0,0.10)', border: '1px solid rgba(255,102,0,0.30)' }}>
                <div className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--brand)' }}>
                  <Tag className="w-4 h-4" />
                  <span>
                    Uygulanan İndirim: -₺{sessionDiscount.toFixed(2)}
                    {sessionDiscountReason && ` · ${sessionDiscountReason}`}
                  </span>
                </div>
                {canPay && (
                  <button
                    onClick={() => applyDiscountMutation.mutate({ discount_amount: 0, discount_reason: '' })}
                    className="hover:opacity-70 p-1 font-bold text-[11px]"
                    style={{ color: 'var(--danger)' }}
                  >
                    Kaldır
                  </button>
                )}
              </div>
            )}

            {/* Totals Summary */}
            <div className="mt-2 pt-2.5 space-y-1 text-xs" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex justify-between font-semibold" style={{ color: 'var(--text-muted)' }}>
                <span>Toplam Masa Tutarı:</span>
                <span className="font-bold" style={{ color: 'var(--text)' }}>₺{totalAmount.toFixed(2)}</span>
              </div>
              {sessionDiscount > 0 && (
                <div className="flex justify-between font-bold" style={{ color: 'var(--brand)' }}>
                  <span>İndirim / İkram:</span>
                  <span>-₺{sessionDiscount.toFixed(2)}</span>
                </div>
              )}
              {paidAmount > 0 && (
                <div className="flex justify-between font-semibold" style={{ color: 'var(--success)' }}>
                  <span>Daha Önce Ödenen:</span>
                  <span>₺{paidAmount.toFixed(2)}</span>
                </div>
              )}
              {totalPayUnits > 0 && (
                <div className="flex justify-between font-bold" style={{ color: 'var(--sky)' }}>
                  <span>Şimdi Ödenecek ({totalPayUnits} adet):</span>
                  <span>₺{itemsPayable.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black pt-1" style={{ borderTop: '1px solid var(--border)', color: 'var(--text)' }}>
                <span>Kalan Ödenecek:</span>
                <span style={{ color: remaining === 0 ? 'var(--success)' : 'var(--brand)' }}>
                  ₺{remaining.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Payment Method & Numpad / Item Summary */}
          <div className="col-span-12 md:col-span-5 flex flex-col justify-between min-h-0 overflow-y-auto custom-scrollbar rounded-3xl p-3 sm:p-3.5" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
            {!canPay ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.12)' }}>
                  <CreditCard className="w-6 h-6" style={{ color: 'var(--danger)' }} />
                </div>
                <div>
                  <p className="text-sm font-black" style={{ color: 'var(--text)' }}>Ödeme Yetkiniz Yok</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Ödeme ve hesap kapatma işlemleri için yetkili personeli çağırın</p>
                </div>
              </div>
            ) : (
            <>
              <div className="space-y-2">
                {/* Payment Types */}
                <div className="grid grid-cols-3 gap-1.5">
                  {PAYMENT_TYPES.map(({ id, label, icon: Icon, color }) => (
                    <button
                      key={id}
                      onClick={() => setPaymentType(id)}
                      className={clsx('py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 font-bold text-[11px] transition-all active:scale-95 border')}
                      style={paymentType === id
                        ? { background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--brand)', boxShadow: '0 0 0 1px var(--brand)' }
                        : { background: 'var(--card)', color: 'var(--text-2)', borderColor: 'var(--border)' }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                {/* Amount display */}
                <div className="rounded-xl p-2 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border-sub)' }}>
                  <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                    {totalPayUnits > 0 ? `Seçilen Kalemler (${totalPayUnits} adet)` : 'Ödenecek Tutar'}
                  </p>
                  <p className="text-xl sm:text-2xl font-black" style={{ color: 'var(--text)' }}>
                    ₺ {payableAmount.toFixed(2)}
                  </p>
                </div>

                {/* Calculator mode: Quick Amounts + Numpad */}
                {payMode === 'calc' && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setPayQty({});
                          setNumpadInput(remaining.toFixed(2));
                          setAmount(remaining.toFixed(2));
                        }}
                        className="flex-1 py-1 rounded-lg text-white font-bold text-xs"
                        style={{ background: 'var(--brand)' }}
                      >
                        Kalanın Tamamı
                      </button>
                      {QUICK_AMOUNTS.map((n) => (
                        <button
                          key={n}
                          onClick={() => {
                            setNumpadInput(String(n));
                            setAmount(String(n));
                          }}
                          className="px-2.5 py-1 rounded-lg font-bold text-xs transition-colors"
                          style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
                        >
                          ₺{n}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((key) => (
                        <button
                          key={key}
                          onClick={() => handleNumpad(key)}
                          className="h-8 sm:h-9 rounded-lg active:scale-95 font-bold text-xs sm:text-sm flex items-center justify-center transition-colors"
                          style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
                        >
                          {key === 'del' ? '⌫' : key}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items mode: selected units summary */}
                {payMode === 'items' && (
                  <div className="rounded-xl p-2.5" style={{ background: 'var(--card)', border: '1px solid var(--border-sub)' }}>
                    {totalPayUnits === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                        Soldaki listeden ödeyeceğiniz adedi + / - ile seçin
                      </p>
                    ) : (
                      <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar pr-0.5">
                        {allOrderItems.filter((it) => (payQty[it.id] || 0) > 0).map((it) => (
                          <div key={it.id} className="flex items-center justify-between text-xs py-0.5">
                            <span className="truncate" style={{ color: 'var(--text)' }}>{payQty[it.id]}x {it.product_name}</span>
                            <span className="font-bold flex-shrink-0 ml-2" style={{ color: 'var(--text)' }}>₺{(it.unit_price * (payQty[it.id] || 0)).toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Single Dynamic Action Button */}
              <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
                {remaining <= 0 || orders.length === 0 ? (
                  <button
                    onClick={() => setShowCloseConfirm(true)}
                    className="w-full text-white font-bold py-2.5 sm:py-3 rounded-xl text-xs shadow-md active:scale-98 transition-all flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--success)' }}
                  >
                    <Check className="w-4 h-4" />
                    <span>Hesabı ve Masayı Kapat</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePay}
                    disabled={payMutation.isPending || payableAmount <= 0}
                    className="w-full text-white font-bold py-2.5 sm:py-3 rounded-xl text-xs shadow-md active:scale-98 transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}
                  >
                    {payMutation.isPending ? 'İşleniyor...' : `Ödemeyi Kaydet (₺${payableAmount.toFixed(0)})`}
                  </button>
                )}
              </div>
            </>
            )}
          </div>
        </div>
      </div>

      {/* Discount Modal */}
      {showDiscountModal && canPay && (
        <DiscountModal
          totalAmount={totalAmount}
          initialDiscountAmount={sessionDiscount}
          initialReason={sessionDiscountReason}
          onApply={(amt, reason) => {
            applyDiscountMutation.mutate({ discount_amount: amt, discount_reason: reason });
            setShowDiscountModal(false);
            toast.success(`₺${amt.toFixed(2)} indirim uygulandı`);
          }}
          onClose={() => setShowDiscountModal(false)}
        />
      )}

      {/* Close Confirm Modal */}
      {showCloseConfirm && canPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-3xl p-6 w-full max-w-sm shadow-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text)' }}>Masayı Kapat</h3>
            <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
              <strong>{session?.table_name}</strong> masası kapatılacak ve masa durumu bos olarak güncellenecektir.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                style={{ background: 'var(--app)', color: 'var(--text-2)' }}
              >
                İptal
              </button>
              <button
                onClick={() => { closeMutation.mutate(); setShowCloseConfirm(false); }}
                className="flex-1 text-white py-2.5 rounded-xl text-xs font-bold"
                style={{ background: 'var(--success)' }}
              >
                Evet, Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

function DiscountModal({
  totalAmount,
  initialDiscountAmount,
  initialReason,
  onApply,
  onClose,
}: {
  totalAmount: number;
  initialDiscountAmount: number;
  initialReason: string;
  onApply: (amount: number, reason: string) => void;
  onClose: () => void;
}) {
  const [percentInput, setPercentInput] = useState(initialDiscountAmount > 0 && totalAmount > 0 ? ((initialDiscountAmount / totalAmount) * 100).toFixed(1) : '');
  const [amountInput, setAmountInput] = useState(initialDiscountAmount > 0 ? String(initialDiscountAmount) : '');
  const [reason, setReason] = useState(initialReason || DISCOUNT_REASONS[0]);

  const handlePercentChange = (valStr: string) => {
    setPercentInput(valStr);
    const p = parseFloat(valStr) || 0;
    if (totalAmount > 0) {
      const amt = (totalAmount * p) / 100;
      setAmountInput(amt > 0 ? amt.toFixed(2) : '');
    }
  };

  const handleAmountChange = (valStr: string) => {
    setAmountInput(valStr);
    const a = parseFloat(valStr) || 0;
    if (totalAmount > 0) {
      const p = (a / totalAmount) * 100;
      setPercentInput(p > 0 ? p.toFixed(1) : '');
    }
  };

  const handleApply = () => {
    const amt = parseFloat(amountInput) || 0;
    if (amt < 0) return toast.error('Geçerli bir indirim girin');
    if (amt > totalAmount && totalAmount > 0) return toast.error('İndirim toplam tutardan büyük olamaz');
    onApply(amt, reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Percent className="w-5 h-5" style={{ color: 'var(--brand)' }} />
            <h2 className="text-base font-black" style={{ color: 'var(--text)' }}>İndirim / İkram Uygula</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10" style={{ color: 'var(--text-2)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-2)' }}>Hızlı Yüzdelik Seçimi</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[5, 10, 15, 20, 25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handlePercentChange(String(pct))}
                  className={clsx('py-2 rounded-xl text-xs font-black transition-all active:scale-95 border')}
                  style={percentInput === String(pct)
                    ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                    : { background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--border)' }}
                >
                  %{pct}{pct === 100 && ' (İkram)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-2)' }}>% İndirim Oranı</label>
              <div className="relative">
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={percentInput}
                  onChange={(e) => handlePercentChange(e.target.value)}
                  placeholder="%"
                  className="w-full rounded-2xl pl-3 pr-7 py-2.5 text-sm font-black focus:outline-none focus:border-orange-500"
                  style={sharedInputStyle}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-2)' }}>₺ İndirim Tutarı</label>
              <div className="relative">
                <input
                  type="number" step="0.01"
                  value={amountInput}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="₺ 0.00"
                  className="w-full rounded-2xl pl-3 pr-7 py-2.5 text-sm font-black focus:outline-none focus:border-orange-500"
                  style={sharedInputStyle}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs" style={{ color: 'var(--text-muted)' }}>₺</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-2)' }}>İndirim Sebebi</label>
            <div className="flex flex-wrap gap-1.5">
              {DISCOUNT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={clsx('px-3 py-1.5 rounded-xl text-xs font-bold transition-all')}
                  style={reason === r
                    ? { background: 'var(--brand)', color: '#fff' }
                    : { background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 font-bold py-2.5 rounded-2xl text-xs"
              style={{ background: 'var(--app)', color: 'var(--text-2)' }}
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 text-white font-bold py-2.5 rounded-2xl text-xs"
              style={{ background: 'linear-gradient(90deg, var(--brand), #ff9500)' }}
            >
              İndirimi Uygula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
