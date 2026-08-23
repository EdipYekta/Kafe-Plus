'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';
import {
  CreditCard, Banknote, ShoppingBag, Check, X,
  Percent, Printer, AlertTriangle, ArrowLeft, Tag, Gift, Trash2, RotateCcw
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

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

export default function CashierSessionPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const sessionId = params.id as string;

  const [paymentType, setPaymentType] = useState('cash');
  const [amount, setAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [numpadInput, setNumpadInput] = useState('');

  // 1. Fetch Session Info with accurate backend subqueries
  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.get(`/sessions/${sessionId}`).then((r) => r.data),
    refetchInterval: 5000,
  });

  // 2. Fetch Orders for this table session
  const { data: orders = [] } = useQuery({
    queryKey: ['session-orders', sessionId],
    queryFn: () => api.get('/orders', { params: { session_id: sessionId } }).then((r) => r.data),
    refetchInterval: 5000,
  });

  // 3. Fetch Payments already made for this session
  const { data: payments = [] } = useQuery({
    queryKey: ['session-payments', sessionId],
    queryFn: () => api.get(`/payments/session/${sessionId}`).then((r) => r.data),
    refetchInterval: 5000,
  });

  const totalAmount = Number(session?.total_amount || 0);
  const paidAmount = Number(session?.paid_amount || payments.reduce((s: number, p: any) => s + Number(p.amount), 0));
  const previousDiscounts = Number(session?.total_discount || payments.reduce((s: number, p: any) => s + Number(p.discount_amount || 0), 0));
  
  // Calculate remaining balance
  const remaining = Math.max(0, totalAmount - paidAmount - previousDiscounts - discountAmount);

  const payMutation = useMutation({
    mutationFn: (data: any) => api.post('/payments', { ...data, session_id: sessionId }),
    onSuccess: () => {
      toast.success('Ödeme başarıyla kaydedildi');
      setAmount('');
      setNumpadInput('');
      qc.invalidateQueries({ queryKey: ['session-payments', sessionId] });
      qc.invalidateQueries({ queryKey: ['session', sessionId] });
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
      toast.success('Masa hesabı kapatıldı ve masa boşaltıldı');
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['payment-history'] });
      router.push('/waiter');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Masa kapatılamadı'),
  });

  const cancelSessionMutation = useMutation({
    mutationFn: () => api.post(`/sessions/${sessionId}/cancel`),
    onSuccess: () => {
      toast.success('Masa iptal edildi ve boşaltıldı');
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
    const inputVal = parseFloat(numpadInput || amount);
    const payAmount = isNaN(inputVal) ? remaining : inputVal;
    
    if (payAmount <= 0 && discountAmount <= 0) return toast.error('Geçerli bir tutar girin');
    
    payMutation.mutate({
      amount: payAmount > 0 ? payAmount : 0,
      payment_type: paymentType,
      discount_amount: discountAmount,
      discount_reason: discountReason || (discountPercent > 0 ? `%${discountPercent} İndirim` : undefined),
    });

    // Reset current discount after applying to this payment chunk
    setDiscountAmount(0);
    setDiscountPercent(0);
    setDiscountReason('');
  };

  const tableName = session?.table_name || 'Masa';

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#dde6ed] text-slate-800 flex flex-col font-sans select-none p-2 sm:p-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-[#8faebe] text-white font-black text-xl px-6 py-2 rounded-2xl shadow-sm tracking-wide">
            {tableName} · Kasa & Hesap
          </div>
          {session?.area_name && (
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white text-slate-800 border border-slate-200 shadow-xs">
              {session.area_name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Cancel / Free up empty table */}
          {orders.length === 0 && (
            <button
              onClick={() => cancelSessionMutation.mutate()}
              disabled={cancelSessionMutation.isPending}
              className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2.5 sm:px-3.5 py-2 rounded-2xl text-xs flex items-center gap-1 transition-all shadow-xs border border-red-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Masayı Boşalt</span>
            </button>
          )}

          {/* X – always goes directly to Masa Haritası (/waiter) */}
          <Link
            href="/waiter"
            className="bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 w-10 h-10 sm:w-11 sm:h-11 rounded-2xl shadow-sm flex items-center justify-center transition-all active:scale-95 border border-slate-300/60"
            title="Masalara Dön"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </Link>
        </div>
      </div>

      {/* Main 2-Column POS Layout */}
      <div className="flex-1 grid grid-cols-12 gap-2 sm:gap-3 min-h-0">
        {/* Left: Orders & Payments Summary */}
        <div className="col-span-12 md:col-span-7 flex flex-col min-h-0 bg-[#c4d4dc] rounded-3xl p-3 sm:p-4 border border-slate-300/60 shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800">Masa Sipariş Detayı</h2>
            {/* Open Discount Modal Button */}
            <button
              onClick={() => setShowDiscountModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-orange-50 text-orange-600 border border-orange-300 text-xs font-bold shadow-xs transition-all active:scale-95"
            >
              <Percent className="w-3.5 h-3.5 text-orange-500" />
              <span>{discountAmount > 0 ? `İndirim Düzenle (₺${discountAmount.toFixed(0)})` : 'İndirim / İkram Uygula'}</span>
            </button>
          </div>

          {/* Orders List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {orders.map((order: any) => (
              <div key={order.id} className="bg-white rounded-2xl p-3 shadow-xs border border-slate-200">
                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500">Sipariş #{order.id}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-slate-800">
                    {order.waiter_name}
                  </span>
                </div>
                {order.items?.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1 text-xs">
                    <span className="font-semibold text-slate-800">
                      {item.quantity}× {item.product_name}
                      {item.note && <span className="text-orange-600 text-[10px] ml-1">({item.note})</span>}
                    </span>
                    <span className="font-bold text-slate-800">
                      ₺{(item.quantity * item.unit_price).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            {orders.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-500 text-center">
                <p className="text-xs font-bold text-slate-800">Masada sipariş bulunmuyor</p>
                <p className="text-[11px] text-slate-500 mt-1">Masayı kapatmak için aşağıdaki butonu kullanabilirsiniz</p>
              </div>
            )}

            {/* Previous Payments */}
            {payments.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-bold text-slate-600">Alınan Ödemeler ({payments.length})</h3>
                  <span className="text-[10px] text-slate-400 font-semibold">Masa açıkken geri alınabilir</span>
                </div>
                <div className="space-y-1.5">
                  {payments.map((p: any) => (
                    <div
                      key={p.id}
                      className="bg-emerald-50 rounded-2xl p-2.5 border border-emerald-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-800">
                          ✓ {PAYMENT_TYPES.find((t) => t.id === p.payment_type)?.label || p.payment_type}
                          {p.discount_amount > 0 && ` (İndirim: ₺${p.discount_amount})`}
                        </span>
                        {p.created_at && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(p.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-700">₺{Number(p.amount).toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`₺${Number(p.amount).toFixed(2)} tutarındaki bu ödemeyi geri almak istediğinize emin misiniz?`)) {
                              deletePaymentMutation.mutate(p.id);
                            }
                          }}
                          disabled={deletePaymentMutation.isPending}
                          className="bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-red-200 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors active:scale-95 disabled:opacity-50"
                          title="Ödemeyi Geri Al"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Geri Al</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active Applied Discount Banner */}
          {discountAmount > 0 && (
            <div className="mt-2 p-2.5 bg-orange-100  rounded-2xl border border-orange-300  flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-orange-900  font-bold">
                <Tag className="w-4 h-4 text-orange-600" />
                <span>
                  Uygulanan İndirim: -₺{discountAmount.toFixed(2)} {discountPercent > 0 && `(%${discountPercent})`}{' '}
                  {discountReason && `· ${discountReason}`}
                </span>
              </div>
              <button
                onClick={() => {
                  setDiscountAmount(0);
                  setDiscountPercent(0);
                  setDiscountReason('');
                }}
                className="text-orange-700  hover:text-red-600 p-1 font-bold text-[11px]"
              >
                Kaldır ✕
              </button>
            </div>
          )}

          {/* Totals Summary */}
          <div className="mt-2 pt-2.5 border-t border-slate-200 space-y-1 text-xs">
            <div className="flex justify-between font-semibold text-slate-500">
              <span>Toplam Masa Tutarı:</span>
              <span className="font-bold text-slate-800">₺{totalAmount.toFixed(2)}</span>
            </div>
            {(previousDiscounts > 0 || discountAmount > 0) && (
              <div className="flex justify-between font-bold text-orange-600">
                <span>Toplam İndirim / İkram:</span>
                <span>-₺{(previousDiscounts + discountAmount).toFixed(2)}</span>
              </div>
            )}
            {paidAmount > 0 && (
              <div className="flex justify-between font-semibold text-emerald-600 ">
                <span>Daha Önce Ödenen:</span>
                <span>₺{paidAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-800 pt-1 border-t border-slate-200">
              <span>Kalan Ödenecek Tutar:</span>
              <span className={remaining === 0 ? 'text-emerald-600 ' : 'text-orange-600'}>
                ₺{remaining.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Payment Method & Numpad */}
        <div className="col-span-12 md:col-span-5 flex flex-col justify-between min-h-0 bg-white/80 rounded-3xl p-4 border border-slate-200 shadow-xs">
          <div>
            {/* Payment Types (Nakit, Kredi Kartı, Yemek Kartı) */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PAYMENT_TYPES.map(({ id, label, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => setPaymentType(id)}
                  className={clsx(
                    'py-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 font-bold text-xs transition-all active:scale-95 shadow-xs border',
                    paymentType === id
                      ? 'bg-white text-slate-800 border-2 border-orange-500 shadow-md ring-1 ring-orange-500/20'
                      : 'bg-white/60 text-slate-500 border-transparent hover:bg-white hover:text-main'
                  )}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Amount display */}
            <div className="bg-white rounded-2xl p-2.5 text-center shadow-xs border border-slate-200 mb-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Ödenecek Tutar</p>
              <p className="text-2xl font-black text-slate-800 mt-0.5">
                ₺ {numpadInput || remaining.toFixed(2)}
              </p>
            </div>

            {/* Quick Amounts */}
            <div className="flex gap-1.5 mb-2.5">
              <button
                onClick={() => {
                  setNumpadInput(remaining.toFixed(2));
                  setAmount(remaining.toFixed(2));
                }}
                className="flex-1 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
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
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-white text-slate-800 font-bold text-xs shadow-xs border border-slate-200"
                >
                  ₺{n}
                </button>
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((key) => (
                <button
                  key={key}
                  onClick={() => handleNumpad(key)}
                  className="h-10 rounded-xl bg-white hover:bg-white active:scale-95 font-bold text-sm text-slate-800 shadow-xs border border-slate-200 flex items-center justify-center"
                >
                  {key === 'del' ? '⌫' : key}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <button
              onClick={handlePay}
              disabled={payMutation.isPending || (remaining <= 0 && discountAmount <= 0)}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3 rounded-2xl text-xs shadow-md active:scale-98 transition-all disabled:opacity-50"
            >
              {payMutation.isPending ? 'İşleniyor...' : 'Ödemeyi Kaydet'}
            </button>

            {(remaining <= 0 || orders.length === 0) && (
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-xs shadow-md active:scale-98 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Hesabı ve Masayı Kapat</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Discount / İndirim & İkram Modal ─── */}
      {showDiscountModal && (
        <DiscountModal
          totalAmount={totalAmount}
          initialDiscountAmount={discountAmount}
          initialDiscountPercent={discountPercent}
          initialReason={discountReason}
          onApply={(amt, pct, reason) => {
            setDiscountAmount(amt);
            setDiscountPercent(pct);
            setDiscountReason(reason);
            setShowDiscountModal(false);
            toast.success(`₺${amt.toFixed(2)} (${pct > 0 ? `%${pct}` : ''}) indirim uygulandı`);
          }}
          onClose={() => setShowDiscountModal(false)}
        />
      )}

      {/* Close Confirm Modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-2">Masayı Kapat</h3>
            <p className="text-xs text-slate-500 mb-5">
              <strong>{session?.table_name}</strong> masası kapatılacak ve masa durumu boş olarak güncellenecektir.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 bg-white/80 hover:bg-white/80 text-slate-800 py-2.5 rounded-xl text-xs font-semibold"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  closeMutation.mutate();
                  setShowCloseConfirm(false);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold"
              >
                Evet, Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DiscountModal({
  totalAmount,
  initialDiscountAmount,
  initialDiscountPercent,
  initialReason,
  onApply,
  onClose,
}: {
  totalAmount: number;
  initialDiscountAmount: number;
  initialDiscountPercent: number;
  initialReason: string;
  onApply: (amount: number, percent: number, reason: string) => void;
  onClose: () => void;
}) {
  const [percentInput, setPercentInput] = useState(initialDiscountPercent > 0 ? String(initialDiscountPercent) : '');
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
    const pct = parseFloat(percentInput) || 0;
    if (amt < 0) return toast.error('Geçerli bir indirim girin');
    if (amt > totalAmount && totalAmount > 0) return toast.error('İndirim toplam tutardan büyük olamaz');
    onApply(amt, pct, reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-slide-up">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-black text-slate-800">İndirim / İkram Uygula</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-panel text-slate-500 hover:text-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">Hızlı Yüzdelik Seçimi</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[5, 10, 15, 20, 25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handlePercentChange(String(pct))}
                  className={clsx(
                    'py-2 rounded-xl text-xs font-black transition-all active:scale-95 border',
                    percentInput === String(pct)
                      ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                      : 'bg-white/80 text-slate-800 hover:bg-panel border-slate-200'
                  )}
                >
                  %{pct} {pct === 100 && '(İkram)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">% İndirim Oranı</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={percentInput}
                  onChange={(e) => handlePercentChange(e.target.value)}
                  placeholder="%"
                  className="w-full bg-white/80 border border-slate-200 rounded-2xl pl-3 pr-7 py-2.5 text-slate-800 text-sm font-black focus:outline-none focus:border-orange-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">₺ İndirim Tutarı</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={amountInput}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="₺ 0.00"
                  className="w-full bg-white/80 border border-slate-200 rounded-2xl pl-3 pr-7 py-2.5 text-slate-800 text-sm font-black focus:outline-none focus:border-orange-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₺</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">İndirim Sebebi</label>
            <div className="flex flex-wrap gap-1.5">
              {DISCOUNT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={clsx(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                    reason === r
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-white/80 text-slate-500 hover:text-main hover:bg-panel'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/80 text-slate-500 hover:text-main font-bold py-2.5 rounded-2xl text-xs"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-2.5 rounded-2xl text-xs shadow-xs"
            >
              İndirimi Uygula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
