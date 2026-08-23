'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ChefHat, Clock, CheckCircle2, Flame, ArrowRight, X, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

export default function KitchenKDSPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: () => api.get('/orders/kitchen').then(r => r.data),
    refetchInterval: 8000,
  });

  // WebSocket for instant notification
  useEffect(() => {
    if (!user) return;
    try {
      const ws = new WebSocket(`ws://localhost:5000?cafe_id=${user.cafe_id}&role=${user.role}`);
      ws.onmessage = (e) => {
        const { event } = JSON.parse(e.data || '{}');
        if (event === 'new_order') {
          qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
          toast('🔔 Yeni sipariş geldi!', { icon: '👨‍🍳' });
        }
      };
      return () => ws.close();
    } catch {}
  }, [user, qc]);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      if (vars.status === 'ready') toast.success('Sipariş hazır! Garsona bildirildi.');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Durum güncellenemedi'),
  });

  const filteredOrders = filter
    ? orders.filter((o: any) => o.status === filter)
    : orders;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#dde6ed] text-slate-800 flex flex-col font-sans select-none p-3 sm:p-5">
      
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-[#8faebe] text-white font-black text-xl px-5 py-2 rounded-2xl shadow-sm tracking-wide flex items-center gap-2">
            <ChefHat className="w-5 h-5" />
            <span>Mutfak Ekranı (KDS)</span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-white/70 p-1 rounded-2xl border border-slate-300">
            {[
              { key: null, label: 'Tümü' },
              { key: 'pending', label: 'Bekleyen' },
              { key: 'preparing', label: 'Hazırlanıyor' },
              { key: 'ready', label: 'Hazır' },
            ].map((f) => (
              <button
                key={String(f.key)}
                onClick={() => setFilter(f.key)}
                className={clsx(
                  'px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95',
                  filter === f.key
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Close Button back to Waiter / POS */}
        <button
          onClick={() => router.push('/waiter')}
          className="bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 w-11 h-11 rounded-2xl shadow-sm flex items-center justify-center transition-all active:scale-95 border border-slate-300/60"
          title="Çıkış"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Order Tickets Grid */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 rounded-3xl bg-white/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 content-start">
            {filteredOrders.map((order: any) => {
              const minutes = Math.round(Number(order.minutes_elapsed || 0));
              const isPending = order.status === 'pending';
              const isPreparing = order.status === 'preparing';
              const isReady = order.status === 'ready';

              return (
                <div
                  key={order.id}
                  className={clsx(
                    'bg-white rounded-3xl p-4 shadow-xs border flex flex-col justify-between h-72 transition-all',
                    isPending ? 'border-amber-300 ring-2 ring-amber-300/20' :
                    isPreparing ? 'border-sky-300 ring-2 ring-sky-300/20' :
                    'border-emerald-300'
                  )}
                >
                  {/* Ticket Header */}
                  <div>
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-lg font-black text-slate-900">{order.table_name}</span>
                        <span className="text-[10px] text-slate-400 block font-bold">#{order.id} · {order.area_name}</span>
                      </div>
                      <div className="text-right">
                        <span className={clsx(
                          'text-xs font-mono font-bold px-2 py-0.5 rounded-lg inline-block',
                          minutes > 15 ? 'bg-red-100 text-red-700' :
                          minutes > 8 ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        )}>
                          ⏱ {minutes} dk
                        </span>
                        <span className="text-[10px] text-slate-400 block font-medium mt-0.5">{order.waiter_name}</span>
                      </div>
                    </div>

                    {/* Order Items List */}
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                      {order.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start justify-between text-xs py-0.5">
                          <div className="min-w-0 flex-1">
                            <span className="font-black text-slate-900 mr-1.5">{item.quantity}×</span>
                            <span className="font-bold text-slate-800">{item.product_name}</span>
                            {item.note && (
                              <p className="text-[10px] text-amber-700 italic font-semibold">Not: {item.note}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.kitchen_note && (
                      <div className="mt-2 p-1.5 bg-amber-50 rounded-xl border border-amber-200 text-[10px] text-amber-800 font-semibold">
                        📌 {order.kitchen_note}
                      </div>
                    )}
                  </div>

                  {/* Status Action Button */}
                  <div className="pt-2 border-t border-slate-100">
                    {isPending && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: 'preparing' })}
                        className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold py-2.5 rounded-2xl text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <Flame className="w-4 h-4" />
                        <span>Hazırlamaya Başla</span>
                      </button>
                    )}
                    {isPreparing && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: 'ready' })}
                        className="w-full bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold py-2.5 rounded-2xl text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Hazır Olarak İşaretle</span>
                      </button>
                    )}
                    {isReady && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: 'delivered' })}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2.5 rounded-2xl text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Teslim Edildi (Kapat)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredOrders.length === 0 && (
              <div className="col-span-4 bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400 mt-6">
                <ChefHat className="w-12 h-12 mx-auto mb-2 opacity-40 text-slate-600" />
                <p className="font-bold text-sm text-slate-800">Bekleyen mutfak siparişi yok</p>
                <p className="text-xs text-slate-400 mt-0.5">Garsonlar sipariş aldıkça burada görüntülenecektir</p>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
