'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Coffee, ShieldCheck, LogOut, Plus, Edit2, Trash2, X,
  Users, Store, Eye, EyeOff, Phone, MapPin, Globe, ChefHat,
  CheckCircle2, XCircle, Search, RefreshCw, Building2, UserPlus,
  ToggleLeft, ToggleRight, Key, ChevronDown, ChevronUp, Package, Upload,
} from 'lucide-react';
import clsx from 'clsx';

const ADMIN_PASSWORD = 'Yekta1346!'; // unused — backend validates; kept only as fallback reference

const ROLE_COLORS: Record<string, string> = {
  Owner: '#ef4444', Admin: '#ef4444', Manager: '#f97316', Cashier: '#3b82f6',
  Waiter: '#16a34a', Kitchen: '#8b5cf6',
};
const AVATAR_COLORS = ['#6366f1','#f97316','#16a34a','#3b82f6','#8b5cf6','#ec4899','#f59e0b','#14b8a6'];

type Tab = 'cafes' | 'users';

export default function AdminPanel() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('cafes');
  const [token, setToken] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCafeId, setSelectedCafeId] = useState<number | null>(null);
  const [showCafeModal, setShowCafeModal] = useState(false);
  const [editCafe, setEditCafe] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCafe, setImportCafe] = useState<any>(null);
  const qc = useQueryClient();

  // Auth check
  useEffect(() => {
    const t = sessionStorage.getItem('admin-token');
    if (!t) { router.push('/admin/login'); return; }
    setToken(t);
  }, [router]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // Cafes
  const { data: cafes = [], isLoading: cafesLoading, refetch: refetchCafes } = useQuery({
    queryKey: ['admin-cafes'],
    queryFn: () => api.get('/cafes/all', { headers: authHeaders }).then(r => r.data),
    enabled: !!token,
  });

  // Users for selected cafe
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users', selectedCafeId],
    queryFn: () => api.get('/users', { headers: authHeaders, params: { cafe_id: selectedCafeId } }).then(r => r.data),
    enabled: !!token && !!selectedCafeId,
  });

  // Roles
  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/users/roles', { headers: authHeaders }).then(r => r.data),
    enabled: !!token,
  });

  const deleteCafe = useMutation({
    mutationFn: (id: number) => api.delete(`/cafes/${id}`, { headers: authHeaders }),
    onSuccess: () => { toast.success('Kafe silindi'); qc.invalidateQueries({ queryKey: ['admin-cafes'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kafe silinemedi'),
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`, { headers: authHeaders }),
    onSuccess: () => { toast.success('Kullanıcı silindi'); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Silinemedi'),
  });

  const toggleUserActive = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/users/${id}`, { is_active }, { headers: authHeaders }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Hata'),
  });

  const handleLogout = () => {
    sessionStorage.removeItem('admin-token');
    router.push('/admin/login');
  };

  const filteredCafes = cafes.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.address || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = users.filter((u: any) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  if (!token) return (
    <div className="min-h-screen bg-[#090a0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 font-sans">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-[#0d0e17]/95 border-b border-white/8 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-black text-white">Kafe<span className="text-orange-500">+</span> Admin</span>
              <span className="hidden sm:inline text-xs text-slate-500 ml-2 font-medium">Sistem Yönetici Paneli</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { refetchCafes(); refetchUsers(); }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Yenile"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-400 transition-colors px-3 py-2 rounded-xl hover:bg-red-500/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Toplam Kafe', value: cafes.length, icon: Store, color: 'text-orange-400', bg: 'bg-orange-500/10' },
            { label: 'Aktif Kafe', value: cafes.filter((c: any) => c.is_active !== false).length, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Toplam Kullanıcı', value: cafes.reduce((s: number, c: any) => s + Number(c.user_count || 0), 0), icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Toplam Masa', value: cafes.reduce((s: number, c: any) => s + Number(c.table_count || 0), 0), icon: Coffee, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-[#12131c] border border-white/8 rounded-2xl p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-xl font-black text-white">{value}</p>
                <p className="text-[11px] text-slate-400 font-medium">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 bg-[#12131c] border border-white/8 rounded-2xl p-1">
          <button
            onClick={() => setActiveTab('cafes')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all',
              activeTab === 'cafes'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            )}
          >
            <Store className="w-3.5 h-3.5" />
            Kafe Yönetimi ({cafes.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all',
              activeTab === 'users'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Kullanıcı Yönetimi
          </button>
        </div>

        {/* Search + Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={activeTab === 'cafes' ? 'Kafe ara...' : 'Kullanıcı ara...'}
              className="w-full bg-[#12131c] border border-white/8 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-all"
            />
          </div>
          {activeTab === 'cafes' && (
            <button
              onClick={() => { setEditCafe(null); setShowCafeModal(true); }}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Yeni Kafe Ekle
            </button>
          )}
          {activeTab === 'users' && (
            <div className="flex gap-2">
              <select
                value={selectedCafeId || ''}
                onChange={e => setSelectedCafeId(e.target.value ? Number(e.target.value) : null)}
                className="flex-1 sm:flex-none bg-[#12131c] border border-white/8 rounded-2xl px-3 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-orange-500 min-w-[160px]"
              >
                <option value="">— Kafe Seçin —</option>
                {cafes.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={() => { setEditUser(null); setShowUserModal(true); }}
                disabled={!selectedCafeId}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                Kullanıcı Ekle
              </button>
            </div>
          )}
        </div>

        {/* ─── Cafes Tab ─── */}
        {activeTab === 'cafes' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {cafesLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 bg-[#12131c] rounded-3xl animate-pulse border border-white/5" />
              ))
            ) : filteredCafes.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400">
                <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">Kafe bulunamadı</p>
                <p className="text-sm mt-1">Yeni kafe ekleyerek başlayın</p>
              </div>
            ) : filteredCafes.map((cafe: any) => (
              <CafeCard
                key={cafe.id}
                cafe={cafe}
                onEdit={() => { setEditCafe(cafe); setShowCafeModal(true); }}
                onDelete={() => {
                  if (confirm(`"${cafe.name}" kafesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) {
                    deleteCafe.mutate(cafe.id);
                  }
                }}
                onManageUsers={() => { setSelectedCafeId(cafe.id); setActiveTab('users'); setSearch(''); }}
                onImport={() => { setImportCafe(cafe); setShowImportModal(true); }}
              />
            ))}
          </div>
        )}

        {/* ─── Users Tab ─── */}
        {activeTab === 'users' && (
          <div>
            {!selectedCafeId ? (
              <div className="py-20 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">Bir kafe seçin</p>
                <p className="text-sm mt-1">Kullanıcıları görmek için yukarıdan kafe seçin</p>
              </div>
            ) : usersLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-32 bg-[#12131c] rounded-3xl animate-pulse border border-white/5" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-bold text-white">
                    {cafes.find((c: any) => c.id === selectedCafeId)?.name}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">· {filteredUsers.length} kullanıcı</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredUsers.map((u: any) => (
                    <UserCard
                      key={u.id}
                      user={u}
                      onEdit={() => { setEditUser(u); setShowUserModal(true); }}
                      onDelete={() => {
                        if (confirm(`"${u.full_name}" kullanıcısını silmek istediğinize emin misiniz?`)) {
                          deleteUser.mutate(u.id);
                        }
                      }}
                      onToggle={() => toggleUserActive.mutate({ id: u.id, is_active: !u.is_active })}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Cafe Modal */}
      {showCafeModal && (
        <CafeModal
          cafe={editCafe}
          authHeaders={authHeaders}
          onClose={() => setShowCafeModal(false)}
          onSuccess={() => { setShowCafeModal(false); qc.invalidateQueries({ queryKey: ['admin-cafes'] }); }}
        />
      )}

      {/* User Modal */}
      {showUserModal && (
        <UserModal
          user={editUser}
          cafeId={selectedCafeId!}
          cafes={cafes}
          roles={roles}
          authHeaders={authHeaders}
          onClose={() => setShowUserModal(false)}
          onSuccess={() => { setShowUserModal(false); qc.invalidateQueries({ queryKey: ['admin-users', selectedCafeId] }); }}
        />
      )}

      {/* JSON Import Modal (SuperAdmin only) */}
      {showImportModal && (
        <ImportProductsModal
          cafe={importCafe}
          authHeaders={authHeaders}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); }}
        />
      )}
    </div>
  );
}

// ─── Cafe Card ───
function CafeCard({ cafe, onEdit, onDelete, onManageUsers, onImport }: any) {
  const isActive = cafe.is_active !== false;
  return (
    <div className={clsx(
      'bg-[#12131c] border rounded-3xl p-5 flex flex-col gap-3 transition-all hover:border-white/15',
      isActive ? 'border-white/8' : 'border-white/5 opacity-60'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500/20 to-amber-500/20 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
            <Coffee className="w-5 h-5 text-orange-400" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-sm text-white truncate">{cafe.name}</p>
            <p className="text-[11px] text-slate-400 font-medium">ID: {cafe.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-xl text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-all" title="Düzenle">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Sil">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {cafe.phone && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{cafe.phone}</span>
          </div>
        )}
        {cafe.address && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{cafe.address}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        <span className={clsx(
          'text-[10px] font-bold px-2 py-0.5 rounded-full',
          isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
        )}>
          {isActive ? '● Aktif' : '○ Pasif'}
        </span>
        <span className="text-[10px] text-slate-500 font-medium">{cafe.user_count} kullanıcı · {cafe.table_count} masa</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onImport}
            className="text-[10px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1"
            title="Ürünleri JSON ile içe aktar"
          >
            <Package className="w-3 h-3" />
            İçe Aktar
          </button>
          <button
            onClick={onManageUsers}
            className="text-[10px] font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1"
          >
            <Users className="w-3 h-3" />
            Kullanıcılar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User Card ───
function UserCard({ user, onEdit, onDelete, onToggle }: any) {
  const initials = user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const roleColor = ROLE_COLORS[user.role_name] || '#64748b';

  return (
    <div className={clsx(
      'bg-[#12131c] border rounded-3xl p-4 flex flex-col gap-3 transition-all',
      user.is_active ? 'border-white/8' : 'border-white/5 opacity-60'
    )}>
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-xs font-black flex-shrink-0"
          style={{ background: user.avatar_color || '#6366f1' }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white truncate">{user.full_name}</p>
          <p className="text-[10px] text-slate-400 font-medium">@{user.username}</p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-xl text-slate-400 hover:text-orange-400 transition-colors">
            <Edit2 className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-xl text-slate-400 hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${roleColor}20`, color: roleColor }}
        >
          {user.role_name}
        </span>
        {user.pin_code && (
          <span className="text-[10px] text-slate-500 font-mono font-bold">PIN: {user.pin_code}</span>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className={clsx(
          'text-[10px] font-bold',
          user.is_active ? 'text-emerald-400' : 'text-slate-500'
        )}>
          {user.is_active ? '● Aktif' : '○ Pasif'}
        </span>
        <button
          onClick={onToggle}
          className={clsx(
            'text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors',
            user.is_active
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-emerald-400 hover:bg-emerald-500/10'
          )}
        >
          {user.is_active ? 'Durdur' : 'Aktif Et'}
        </button>
      </div>
    </div>
  );
}

// ─── Cafe Modal ───
function CafeModal({ cafe, authHeaders, onClose, onSuccess }: any) {
  const [name, setName] = useState(cafe?.name || '');
  const [phone, setPhone] = useState(cafe?.phone || '');
  const [address, setAddress] = useState(cafe?.address || '');
  const [timezone, setTimezone] = useState(cafe?.timezone || 'Europe/Istanbul');
  const [currency, setCurrency] = useState(cafe?.currency || 'TRY');
  const [kitchenEnabled, setKitchenEnabled] = useState(cafe?.kitchen_enabled || false);

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      cafe
        ? api.patch(`/cafes/${cafe.id}`, data, { headers: authHeaders })
        : api.post('/cafes', data, { headers: authHeaders }),
    onSuccess: () => {
      toast.success(cafe ? 'Kafe güncellendi' : 'Yeni kafe eklendi');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Kayıt başarısız'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Kafe adı zorunludur');
    saveMutation.mutate({ name: name.trim(), phone: phone.trim() || null, address: address.trim() || null, timezone, currency, kitchen_enabled: kitchenEnabled });
  };

  const inputClass = 'w-full bg-[#181a24] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all font-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#12131c] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/8">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <Store className="w-4 h-4 text-orange-500" />
            {cafe ? 'Kafe Düzenle' : 'Yeni Kafe Ekle'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Kafe Adı *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Örn: Sunrise Kafe" className={inputClass} autoFocus required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Telefon</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0212 123 45 67" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Para Birimi</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputClass + ' cursor-pointer'}>
                <option value="TRY">TRY (₺)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Adres</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Şehir, İlçe, Sokak..." className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Saat Dilimi</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputClass + ' cursor-pointer'}>
              <option value="Europe/Istanbul">Europe/Istanbul (TR)</option>
              <option value="Europe/London">Europe/London (UK)</option>
              <option value="America/New_York">America/New_York (US)</option>
            </select>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/3 border border-white/8 rounded-2xl">
            <div className="flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-xs font-bold text-white">Mutfak Ekranı (KDS)</p>
                <p className="text-[10px] text-slate-400">Aktif edilirse mutfak ekranı görünür</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setKitchenEnabled(!kitchenEnabled)}
              className={clsx('w-10 h-6 rounded-full transition-all relative', kitchenEnabled ? 'bg-orange-500' : 'bg-white/10')}
            >
              <span className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all', kitchenEnabled ? 'left-[18px]' : 'left-0.5')} />
            </button>
          </div>

          <div className="flex gap-2 pt-2 border-t border-white/8">
            <button type="button" onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-3 rounded-2xl text-xs transition-colors">
              İptal
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3 rounded-2xl text-xs shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all"
            >
              {saveMutation.isPending ? 'Kaydediliyor...' : cafe ? 'Güncelle' : 'Kafe Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── User Modal ───
function UserModal({ user, cafeId, cafes, roles, authHeaders, onClose, onSuccess }: any) {
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [roleId, setRoleId] = useState<string>(user?.role_id ? String(user.role_id) : String(roles[0]?.id || ''));
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || AVATAR_COLORS[0]);
  const [pinCode, setPinCode] = useState(user?.pin_code || '');
  const [selectedCafe, setSelectedCafe] = useState(user?.cafe_id || cafeId);

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      user ? api.patch(`/users/${user.id}`, data, { headers: authHeaders })
           : api.post('/users', data, { headers: authHeaders }),
    onSuccess: () => {
      toast.success(user ? 'Kullanıcı güncellendi' : 'Kullanıcı eklendi');
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
      role_id: parseInt(roleId),
      avatar_color: avatarColor,
      pin_code: pinCode.trim() || undefined,
      cafe_id: selectedCafe,
    });
  };

  const inputClass = 'w-full bg-[#181a24] border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all font-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#12131c] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/8">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-orange-500" />
            {user ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Cafe selection for SuperAdmin */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Kafe *</label>
            <select value={selectedCafe || ''} onChange={e => setSelectedCafe(Number(e.target.value))} className={inputClass + ' cursor-pointer'} required>
              <option value="">— Kafe Seçin —</option>
              {cafes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Ad Soyad *</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ayşe Yılmaz" className={inputClass} autoFocus required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Kullanıcı Adı *</label>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ayse" className={inputClass} disabled={!!user} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                {user ? 'Yeni Şifre' : 'Şifre *'}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••"
                  className={inputClass + ' pr-10'}
                  required={!user}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Rol *</label>
              <select value={roleId} onChange={e => setRoleId(e.target.value)} className={inputClass + ' cursor-pointer'} required>
                {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">PIN Kodu</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={pinCode}
                  onChange={e => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="4-6 haneli"
                  className={inputClass + ' pl-9 font-mono'}
                  maxLength={6}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">Avatar Rengi</label>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c} type="button" onClick={() => setAvatarColor(c)}
                  className={clsx('w-7 h-7 rounded-xl transition-all', avatarColor === c ? 'ring-2 ring-offset-2 ring-orange-500 ring-offset-[#12131c] scale-110' : 'opacity-60 hover:opacity-100')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-white/8">
            <button type="button" onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-3 rounded-2xl text-xs">İptal</button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3 rounded-2xl text-xs shadow-md shadow-orange-500/20 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Kaydediliyor...' : user ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Import Products (JSON) Modal — SuperAdmin only ───
const SAMPLE_JSON = `[
  {
    "category": "Soğuk Kahveler",
    "items": [
      { "name": "Ice Latte", "description": "", "price": 150 },
      { "name": "Ice Mocha", "description": "", "price": 165 }
    ]
  }
]`;

function ImportProductsModal({ cafe, authHeaders, onClose, onSuccess }: any) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');

  const importMutation = useMutation({
    mutationFn: (data: any) => api.post('/products/import-json', data, { headers: authHeaders }),
    onSuccess: (res) => {
      toast.success(`İçe aktarım başarılı: ${res.data.categories_created} kategori, ${res.data.products_created} ürün eklendi`);
      onSuccess();
    },
    onError: (e: any) => {
      const msg = e.response?.data?.error || 'İçe aktarım başarısız';
      setError(msg);
      toast.error(msg);
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonText(String(ev.target?.result || ''));
    reader.readAsText(file);
  };

  const handleImport = () => {
    setError('');
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setError('Geçersiz JSON formatı. Lütfen kontrol edin.');
      return;
    }
    if (!Array.isArray(parsed)) {
      setError('JSON bir dizi (array) olmalıdır: [ { category, items: [...] } ]');
      return;
    }
    importMutation.mutate({ cafe_id: cafe.id, data: parsed });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#12131c] border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/8">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-sky-400" />
            Ürün İçe Aktar — {cafe.name}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            JSON yapısı: <code className="text-sky-300">[&#123; "category": "...", "items": [&#123; "name", "description", "price" &#125;] &#125;]</code>.
            Aynı isimli kategori ve ürünler atlanır (tekrar eklemez).
          </p>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-200 px-4 py-2.5 rounded-2xl text-xs font-bold cursor-pointer border border-white/10 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Dosya Seç (.json)</span>
              <input type="file" accept="application/json,.json" onChange={handleFile} className="hidden" />
            </label>
            <button
              type="button"
              onClick={() => setJsonText(SAMPLE_JSON)}
              className="text-xs font-bold text-slate-400 hover:text-white px-3 py-2.5 rounded-2xl hover:bg-white/5 transition-colors"
            >
              Örnek Yapı
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">JSON İçeriği</label>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={SAMPLE_JSON}
              rows={10}
              className="w-full bg-[#0d0e17] border border-white/10 rounded-2xl px-4 py-3 text-xs font-mono text-emerald-300 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
            />
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-white/8">
            <button type="button" onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-3 rounded-2xl text-xs">
              İptal
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importMutation.isPending || !jsonText.trim()}
              className="flex-1 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold py-3 rounded-2xl text-xs shadow-md disabled:opacity-50 transition-all"
            >
              {importMutation.isPending ? 'İçe Aktarılıyor...' : 'İçe Aktar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
