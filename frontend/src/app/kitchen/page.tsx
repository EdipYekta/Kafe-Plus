'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ChefHat, Clock, CheckCircle2, Flame, X, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import MainLayout from '@/components/layout/MainLayout';

export default function KitchenKDSPage() {
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
          toast('Yeni siparis geldi', { icon: '👤' });
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
    <MainLayout>
      {/* Filter Pills */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <div className="flex items-center gap-1 p-1 rounded-xl border border-white/10" style={{ background: 'var(--card)' }}>
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
                'px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95',
                filter === f.key
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Order Tickets Grid */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 rounded-3xl bg-white/5 animate-pulse" />
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
                    'rounded-3xl p-4 border flex flex-col justify-between h-72 transition-all',
                    isPending ? 'border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20' :
                    isPreparing ? 'border-sky-500/50 bg-sky-500/5 ring-1 ring-sky-500/20' :
                    'border-emerald-500/50 bg-emerald-500/5'
                  )}
                  style={{ background: 'var(--card)' }}
                >
                  {/* Ticket Header */}
                  <div>
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                      <div>
                        <span className="text-lg font-black text-white">{order.table_name}</span>
                        <span className="text-[10px] text-slate-400 block font-bold">#{order.id} · {order.area_name}</span>
                      </div>
                      <div className="text-right">
                        <span className={clsx(
                          'text-xs font-mono font-bold px-2 py-0.5 rounded-lg inline-block',
                          minutes > 15 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          minutes > 8 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-white/10 text-slate-300'
                        )}>
                          {minutes} dk
                        </span>
                        <span className="text-[10px] text-slate-400 block font-medium mt-0.5">{order.waiter_name}</span>
                      </div>
                    </div>

                    {/* Order Items List */}
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                      {order.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start justify-between text-xs py-0.5">
                          <div className="min-w-0 flex-1">
                            <span className="font-black text-orange-400 mr-1.5">{item.quantity}×</span>
                            <span className="font-bold text-white">{item.product_name}</span>
                            {item.note && (
                              <p className="text-[10px] text-amber-400 italic font-semibold">Not: {item.note}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.kitchen_note && (
                      <div className="mt-2 p-1.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[10px] text-amber-300 font-semibold">
                        Not: {order.kitchen_note}
                      </div>
                    )}
                  </div>

                  {/* Status Action Button */}
                  <div className="pt-2 border-t border-white/10">
                    {isPending && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: 'preparing' })}
                        className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <Flame className="w-4 h-4" />
                        <span>Hazırlamaya Başla</span>
                      </button>
                    )}
                    {isPreparing && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: 'ready' })}
                        className="w-full bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Hazır Olarak İşaretle</span>
                      </button>
                    )}
                    {isReady && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: 'delivered' })}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
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
              <div className="col-span-4 rounded-3xl p-12 text-center border border-white/10 text-slate-400 mt-6" style={{ background: 'var(--card)' }}>
                <ChefHat className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="font-bold text-sm text-white">Bekleyen mutfak siparişi yok</p>
                <p className="text-xs text-slate-500 mt-0.5">Garsonlar sipariş aldıkça burada görüntülenecektir</p>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
