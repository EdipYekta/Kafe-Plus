'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import MainLayout from '@/components/layout/MainLayout';
import { useAuthStore } from '@/store/authStore';
import { Plus, X, Edit2, Trash2, User, KeyRound, Check, Shield } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const ROLE_COLORS: Record<string, string> = {
  Admin: '#ef4444',
  Manager: '#f97316',
  Cashier: '#3b82f6',
  Waiter: '#16a34a',
  Kitchen: '#8b5cf6',
};

const AVATAR_COLORS = ['#6366f1', '#f97316', '#16a34a', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6'];

export default function StaffPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  const { data: staff = [] } = useQuery({
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
    onError: (e: any) => toast.error(e.response?.data?.error || 'Yetkiniz yok'),
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
    <MainLayout>
      <div className="space-y-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-panel p-4 rounded-3xl border border-theme shadow-theme">
          <div>
            <h1 className="text-xl font-black text-main tracking-tight">Personel & Garson Yönetimi</h1>
            <p className="text-muted text-xs font-semibold mt-0.5">
              {staff.filter((u: any) => u.is_active).length} aktif personel çalışıyor
            </p>
          </div>
          <button
            onClick={() => {
              setEditUser(null);
              setShowModal(true);
            }}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-xs active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Personel Ekle</span>
          </button>
        </div>

        {/* Staff Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {staff.map((u: any) => {
            const initials = u.full_name
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            const roleColor = ROLE_COLORS[u.role_name] || '#64748b';
            const isSelf = user?.id === u.id;

            return (
              <div
                key={u.id}
                className={clsx(
                  'bg-card rounded-3xl p-4 border shadow-theme flex flex-col justify-between h-44 transition-all',
                  u.is_active ? 'border-theme' : 'border-theme opacity-60'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-xs"
                    style={{ background: u.avatar_color || '#6366f1' }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-main truncate">{u.full_name}</p>
                    <p className="text-[11px] text-muted font-semibold truncate">@{u.username}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => {
                        setEditUser(u);
                        setShowModal(true);
                      }}
                      className="p-1.5 text-muted hover:text-orange-500 rounded-lg transition-colors"
                      title="Düzenle"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {!isSelf && (
                      <button
                        onClick={() => {
                          if (confirm(`${u.full_name} isimli personeli silmek istediğinize emin misiniz?`)) {
                            deleteUser.mutate(u.id);
                          }
                        }}
                        className="p-1.5 text-muted hover:text-red-600 rounded-lg transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: `${roleColor}18`, color: roleColor }}
                    >
                      {u.role_name}
                    </span>
                    {u.phone && <span className="text-muted text-[10px]">{u.phone}</span>}
                  </div>

                  <div className="pt-2 border-t border-theme-subtle flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted">
                      {u.is_active ? '● Aktif' : '○ Pasif'}
                    </span>
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                      className={clsx(
                        'text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors',
                        u.is_active
                          ? 'text-red-600 hover:bg-red-50 '
                          : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                      )}
                    >
                      {u.is_active ? 'Durdur' : 'Aktif Et'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
    </MainLayout>
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
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || AVATAR_COLORS[0]);

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      user ? api.patch(`/users/${user.id}`, data) : api.post('/users', data),
    onSuccess: () => {
      toast.success(user ? 'Personel güncellendi' : 'Yeni personel eklendi');
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
      phone: phone.trim() || undefined,
      avatar_color: avatarColor,
    });
  };

  const inputClass =
    'w-full bg-panel-subtle border border-theme rounded-2xl px-4 py-2.5 text-main text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-orange-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-card rounded-3xl p-6 w-full max-w-md shadow-2xl border border-theme animate-slide-up">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-theme-subtle">
          <h2 className="text-base font-black text-main">
            {user ? 'Personel Bilgilerini Düzenle' : 'Yeni Personel / Garson Ekle'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-panel text-muted hover:text-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-main mb-1">Ad Soyad *</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Örn: Ayşe Yılmaz"
              className={inputClass}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-main mb-1">Kullanıcı Adı *</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ayse"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-main mb-1">
                {user ? 'Yeni Şifre (Boş bırakılabilir)' : 'Giriş Şifresi *'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
                className={inputClass}
                required={!user}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-main mb-1">Rol / Yetki *</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className={inputClass + ' cursor-pointer'}
                required
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-main mb-1">Telefon</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0532 000 0000"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-main mb-1.5">Avatar Rengi</label>
            <div className="flex gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  className={clsx(
                    'w-7 h-7 rounded-xl transition-all',
                    avatarColor === c ? 'ring-2 ring-offset-2 ring-orange-500 scale-110' : 'opacity-70'
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-theme-subtle">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-panel hover:bg-panel-subtle text-muted hover:text-main font-bold py-2.5 rounded-2xl text-xs"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-2.5 rounded-2xl text-xs shadow-xs disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Kaydediliyor...' : user ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
