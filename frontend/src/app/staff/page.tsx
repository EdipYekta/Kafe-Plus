'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import { useAuthStore, UserPermissions } from '@/store/authStore';
import {
  Plus, X, Edit2, Trash2, Shield, KeyRound, Check,
  CreditCard, DollarSign, FileText, ChefHat, Package,
  Users as UsersIcon, Calendar, Lock, Unlock
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const ROLE_COLORS: Record<string, string> = {
  Owner: '#ef4444',
  Admin: '#ef4444',
  Manager: '#f97316',
  Cashier: '#3b82f6',
  Waiter: '#16a34a',
  Kitchen: '#8b5cf6',
};

const AVATAR_COLORS = ['#f97316', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];

const DEFAULT_PERMISSIONS: UserPermissions = {
  can_take_payment: false,
  can_view_revenue: false,
  can_view_history: 'today_only',
  can_view_products: false,
  can_view_kitchen: false,
  can_view_staff: false,
  can_manage_expenses: false,
  can_print_z_report: false,
  can_view_weekly_monthly: false,
  can_edit_table_items: false,
};

export default function StaffPage() {
  return (
    <MainLayout>
      <StaffContent />
    </MainLayout>
  );
}

export function StaffContent() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/users/roles').then((r) => r.data),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/users/${id}`, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Personel durumu güncellendi');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'İşlem başarısız'),
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Personel silindi');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Personel silinemedi'),
  });

  return (
    <>
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-orange-500" />
            <span>Personel &amp; Yetki Yönetimi</span>
          </h1>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {staff.filter((u: any) => u.is_active).length} aktif personel · Rol ve yetkileri özelleştirebilirsiniz
            </p>
          </div>
          <button
            onClick={() => {
              setEditUser(null);
              setShowModal(true);
            }}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Personel Ekle</span>
          </button>
        </div>

        {/* Staff Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-white/10" style={{ background: 'var(--card)' }}>
            <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-sm font-bold text-white">Henüz personel eklenmemiş</p>
            <p className="text-xs text-slate-500 mt-1">Kafenize garson, kasiyer veya mutfak personeli ekleyin</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {staff.map((u: any) => {
              const initials = u.full_name
                ?.split(' ')
                .map((n: string) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'P';
              const roleColor = ROLE_COLORS[u.role_name] || '#64748b';
              const isSelf = user?.id === u.id;
              const perms: UserPermissions = u.permissions || DEFAULT_PERMISSIONS;

              return (
                <div
                  key={u.id}
                  className={clsx(
                    'rounded-2xl p-4 border flex flex-col justify-between transition-all relative overflow-hidden',
                    u.is_active ? 'border-white/10' : 'border-white/5 opacity-60'
                  )}
                  style={{ background: 'var(--card)' }}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm"
                        style={{ background: u.avatar_color || '#f97316' }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white truncate">{u.full_name}</p>
                        <p className="text-xs font-semibold text-slate-400 truncate">@{u.username}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                            style={{ background: `${roleColor}25`, color: roleColor }}
                          >
                            {u.role_name}
                          </span>
                          {u.pin_code && (
                            <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                              PIN: {u.pin_code}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditUser(u);
                            setShowModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-orange-400 rounded-lg hover:bg-white/5 transition-colors"
                          title="Düzenle & Yetkiler"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => {
                              if (confirm(`${u.full_name} isimli personeli silmek istediğinize emin misiniz?`)) {
                                deleteUser.mutate(u.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Permissions Badges */}
                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Yetki Özeti</p>
                      <div className="flex flex-wrap gap-1">
                        {perms.can_edit_table_items && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-pink-500/15 text-pink-400 border border-pink-500/20">
                            Ürün Düzenler
                          </span>
                        )}
                        {perms.can_take_payment ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            Ödeme Alır
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400/70">
                            Ödeme Yok
                          </span>
                        )}
                        {perms.can_view_revenue && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                            Ciro
                          </span>
                        )}
                        {perms.can_print_z_report && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            Z Raporu
                          </span>
                        )}
                        {perms.can_view_weekly_monthly ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/20">
                            Tüm Geçmiş
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-500/15 text-slate-400">
                            Sadece Bugün
                          </span>
                        )}
                        {perms.can_view_kitchen && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-400">
                            Mutfak
                          </span>
                        )}
                        {perms.can_view_products && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-400">
                            Ürünler
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status toggle footer */}
                  <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[11px] font-bold" style={{ color: u.is_active ? '#10b981' : '#ef4444' }}>
                      {u.is_active ? '● Aktif' : '○ Pasif'}
                    </span>
                    {!isSelf && (
                      <button
                        onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                        className={clsx(
                          'text-xs font-bold px-2.5 py-1 rounded-lg transition-colors',
                          u.is_active
                            ? 'text-red-400 hover:bg-red-500/10'
                            : 'text-emerald-400 hover:bg-emerald-500/10'
                        )}
                      >
                        {u.is_active ? 'Pasife Al' : 'Aktifleştir'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Staff Modal */}
      {showModal && (
        <StaffModal
          user={editUser}
          roles={roles}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['staff'] });
          }}
        />
      )}
    </>
  );
}

function StaffModal({
  user,
  roles,
  onClose,
  onSuccess,
}: {
  user: any;
  roles: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<string>(user?.role_id ? String(user.role_id) : String(roles[0]?.id || ''));
  const [pinCode, setPinCode] = useState(user?.pin_code || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || AVATAR_COLORS[0]);

  // Initial permissions from user or default
  const [permissions, setPermissions] = useState<UserPermissions>(() => {
    if (user?.permissions && Object.keys(user.permissions).length > 0) {
      return { ...DEFAULT_PERMISSIONS, ...user.permissions };
    }
    return DEFAULT_PERMISSIONS;
  });

  const handleRoleChange = (newRoleId: string) => {
    setRoleId(newRoleId);
    const selectedRole = roles.find(r => String(r.id) === newRoleId);
    if (!selectedRole) return;

    // Preset permissions according to role if creating new user
    if (!user) {
      if (selectedRole.name === 'Manager') {
        setPermissions({
          can_take_payment: true,
          can_view_revenue: true,
          can_view_history: 'all',
          can_view_products: true,
          can_view_kitchen: true,
          can_view_staff: true,
          can_manage_expenses: true,
          can_print_z_report: true,
          can_view_weekly_monthly: true,
          can_edit_table_items: true,
        });
      } else if (selectedRole.name === 'Cashier') {
        setPermissions({
          can_take_payment: true,
          can_view_revenue: true,
          can_view_history: 'all',
          can_view_products: false,
          can_view_kitchen: false,
          can_view_staff: false,
          can_manage_expenses: false,
          can_print_z_report: true,
          can_view_weekly_monthly: false,
          can_edit_table_items: false,
        });
      } else if (selectedRole.name === 'Waiter') {
        setPermissions({
          can_take_payment: false,
          can_view_revenue: false,
          can_view_history: 'today_only',
          can_view_products: false,
          can_view_kitchen: false,
          can_view_staff: false,
          can_manage_expenses: false,
          can_print_z_report: false,
          can_view_weekly_monthly: false,
          can_edit_table_items: false,
        });
      } else if (selectedRole.name === 'Kitchen') {
        setPermissions({
          can_take_payment: false,
          can_view_revenue: false,
          can_view_history: 'today_only',
          can_view_products: false,
          can_view_kitchen: true,
          can_view_staff: false,
          can_manage_expenses: false,
          can_print_z_report: false,
          can_view_weekly_monthly: false,
          can_edit_table_items: false,
        });
      }
    }
  };

  const togglePerm = (key: keyof UserPermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      user ? api.patch(`/users/${user.id}`, data) : api.post('/users', data),
    onSuccess: () => {
      toast.success(user ? 'Personel ve yetkileri güncellendi' : 'Yeni personel eklendi');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kayıt başarısız'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim()) return toast.error('İsim ve kullanıcı adı zorunludur');
    if (!user && !password) return toast.error('Şifre zorunludur');

    saveMutation.mutate({
      full_name: fullName.trim(),
      username: username.trim(),
      password: password || undefined,
      role_id: parseInt(roleId) || roles[0]?.id,
      pin_code: pinCode.trim() || undefined,
      avatar_color: avatarColor,
      permissions,
    });
  };

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-semibold placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 w-full max-w-lg shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-sm sm:text-base font-black text-white">
              {user ? 'Personel & Yetki Düzenle' : 'Yeni Personel Ekle'}
            </h2>
            <p className="text-[11px] text-slate-400">Kullanıcı bilgileri ve özel erişim yetkileri</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 py-3 space-y-3">
            {/* Temel Bilgiler */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Ad Soyad *</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Örn: Ayşe Yılmaz"
                className={inputClass}
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Kullanıcı Adı *</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ayse"
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  {user ? 'Yeni Şifre' : 'Giriş Şifresi *'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={user ? 'Boş = değişmez' : '••••••••'}
                  className={inputClass}
                  required={!user}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Varsayılan Rol *</label>
                <select
                  value={roleId}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className={inputClass + ' cursor-pointer'}
                  required
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Hızlı PIN (4-6 Hane)</label>
                <input
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Örn: 1234"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Avatar Rengi</label>
              <div className="flex gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    className={clsx(
                      'w-6 h-6 rounded-lg transition-all',
                      avatarColor === c ? 'ring-2 ring-offset-2 ring-orange-500 scale-110 ring-offset-slate-900' : 'opacity-70 hover:opacity-100'
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            {/* Yetki Seçimleri */}
            <div className="pt-2.5 border-t border-white/10">
              <p className="text-[11px] font-black text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Özel Erişim &amp; İzin Yetkileri</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Masadaki Ürünleri Düzenleme Yetkisi */}
                <label className={clsx('flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all', permissions.can_edit_table_items ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5')}>
                  <input
                    type="checkbox"
                    checked={permissions.can_edit_table_items}
                    onChange={() => togglePerm('can_edit_table_items')}
                    className="mt-0.5 rounded text-orange-500 focus:ring-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Masadaki Ürünleri Düzenle</p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Sipariş adetini arttır/azalt/sil</p>
                  </div>
                </label>

                {/* Ödeme Alma Yetkisi */}
                <label className={clsx('flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all', permissions.can_take_payment ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5')}>
                  <input
                    type="checkbox"
                    checked={permissions.can_take_payment}
                    onChange={() => togglePerm('can_take_payment')}
                    className="mt-0.5 rounded text-orange-500 focus:ring-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Ödeme Alabilir</p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Masadan nakit/kart tahsilat</p>
                  </div>
                </label>

                {/* Ciro Görme */}
                <label className={clsx('flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all', permissions.can_view_revenue ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5')}>
                  <input
                    type="checkbox"
                    checked={permissions.can_view_revenue}
                    onChange={() => togglePerm('can_view_revenue')}
                    className="mt-0.5 rounded text-orange-500 focus:ring-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Ciro &amp; Kasa Ekranı</p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Kasa toplamlarını görme</p>
                  </div>
                </label>

                {/* Gün Sonu & Z Raporu */}
                <label className={clsx('flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all', permissions.can_print_z_report ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5')}>
                  <input
                    type="checkbox"
                    checked={permissions.can_print_z_report}
                    onChange={() => togglePerm('can_print_z_report')}
                    className="mt-0.5 rounded text-orange-500 focus:ring-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Z Raporu Alabilir</p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Gün sonu raporu alma</p>
                  </div>
                </label>

                {/* Haftalık / Aylık Geçmiş Görme */}
                <label className={clsx('flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all', permissions.can_view_weekly_monthly ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5')}>
                  <input
                    type="checkbox"
                    checked={permissions.can_view_weekly_monthly}
                    onChange={() => togglePerm('can_view_weekly_monthly')}
                    className="mt-0.5 rounded text-orange-500 focus:ring-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Geçmiş Ciro Analizi</p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Haftalık/aylık geçmişi görme</p>
                  </div>
                </label>

                {/* Mutfak Ekranı */}
                <label className={clsx('flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all', permissions.can_view_kitchen ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5')}>
                  <input
                    type="checkbox"
                    checked={permissions.can_view_kitchen}
                    onChange={() => togglePerm('can_view_kitchen')}
                    className="mt-0.5 rounded text-orange-500 focus:ring-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Mutfak Ekranı (KDS)</p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Sipariş hazırlık ekranı</p>
                  </div>
                </label>

                {/* Ürün & Menü */}
                <label className={clsx('flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all', permissions.can_view_products ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5')}>
                  <input
                    type="checkbox"
                    checked={permissions.can_view_products}
                    onChange={() => togglePerm('can_view_products')}
                    className="mt-0.5 rounded text-orange-500 focus:ring-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Ürünler &amp; Menü</p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Fiyat ve ürün düzenleme</p>
                  </div>
                </label>

                {/* Personel Ekranı */}
                <label className={clsx('flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all', permissions.can_view_staff ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5')}>
                  <input
                    type="checkbox"
                    checked={permissions.can_view_staff}
                    onChange={() => togglePerm('can_view_staff')}
                    className="mt-0.5 rounded text-orange-500 focus:ring-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Personel Yönetimi</p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Üye ekleme ve düzenleme</p>
                  </div>
                </label>

                {/* Giderler */}
                <label className={clsx('flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all', permissions.can_manage_expenses ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5')}>
                  <input
                    type="checkbox"
                    checked={permissions.can_manage_expenses}
                    onChange={() => togglePerm('can_manage_expenses')}
                    className="mt-0.5 rounded text-orange-500 focus:ring-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Masraf &amp; Gider</p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Gider kaydı ekleme/silme</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2.5 border-t border-white/10 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {saveMutation.isPending ? 'Kaydediliyor...' : user ? 'Değişiklikleri Kaydet' : 'Personel Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
