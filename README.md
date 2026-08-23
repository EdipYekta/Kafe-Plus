# Kafe+ Kafe & Restoran Yönetim Sistemi

Modern, çoklu kafe destekli restoran yönetim sistemi.

## 🚀 Kurulum

### 1. Veritabanı Hazırlama

```bash
# PostgreSQL'de veritabanı oluşturun
createdb kafeplus

# Schema'yı uygulayın
psql kafeplus < backend/src/schema.sql
```

### 2. Backend Kurulum

```bash
cd backend
npm install
cp .env.example .env
# .env dosyasındaki DATABASE_URL'yi düzenleyin

# Demo verilerini yükleyin
npm run seed

# Sunucuyu başlatın
npm run dev   # http://localhost:5000
```

### 3. Frontend Kurulum

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

## 📋 Demo Hesaplar

| Rol | Kullanıcı | Şifre | PIN |
|-----|-----------|-------|-----|
| Admin | admin | admin123 | 1111 |
| Yönetici | manager | 123456 | 2222 |
| Kasiyer | kasiyer | 123456 | 3333 |
| Garson | garson1 | 123456 | 4444 |
| Mutfak | mutfak | 123456 | 6666 |

## 🏗 Proje Yapısı

```
Kafe+/
├── backend/          # Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── index.js       # Ana sunucu + WebSocket
│   │   ├── db.js          # DB bağlantısı
│   │   ├── seed.js        # Demo veriler
│   │   ├── schema.sql     # Veritabanı şeması
│   │   ├── middleware/
│   │   │   └── auth.js    # JWT middleware
│   │   └── routes/
│   │       ├── auth.js    # Giriş, PIN login
│   │       ├── tables.js  # Masa yönetimi + drag pozisyonları
│   │       ├── sessions.js # Oturum aç/kapat
│   │       ├── orders.js  # Sipariş + KDS
│   │       ├── payments.js # Ödeme
│   │       ├── products.js # Ürün
│   │       ├── categories.js # Kategori
│   │       ├── areas.js   # Oturma alanları
│   │       ├── expenses.js # Masraf
│   │       ├── reports.js # Raporlar
│   │       ├── users.js   # Personel
│   │       └── cafes.js   # Kafe bilgileri
│   └── package.json
│
└── frontend/         # Next.js 14 + Tailwind CSS
    └── src/
        ├── app/
        │   ├── login/         # Giriş ekranı
        │   ├── dashboard/     # Admin dashboard
        │   ├── waiter/        # Masa ve sipariş
        │   │   └── session/[id]/ # Sipariş alma
        │   ├── kitchen/       # KDS - Mutfak ekranı
        │   ├── cashier/       # Kasa
        │   │   └── session/[id]/ # Ödeme
        │   ├── products/      # Ürün yönetimi
        │   ├── reports/       # Raporlar & grafikler
        │   ├── expenses/      # Masraf yönetimi
        │   ├── staff/         # Personel yönetimi
        │   └── settings/      # Sistem ayarları
        ├── components/
        │   ├── layout/MainLayout.tsx  # Sidebar + Navbar
        │   └── providers/
        └── store/authStore.ts # Zustand auth state
```

## ✨ Özellikler

- 🏢 **Multi-Tenant**: Çoklu kafe izolasyonu
- 👥 **RBAC**: Admin/Manager/Cashier/Waiter/Kitchen rolleri  
- 🗺 **Masa Haritası**: Sürükle-bırak masa konumlandırma
- ⚡ **Realtime KDS**: WebSocket tabanlı mutfak ekranı
- 💳 **Parçalı Ödeme**: Nakit/Kart/Yemek kartı kombinasyonu
- 📊 **Raporlar**: Günlük/haftalık/aylık ciro analizi
- 💰 **Masraf Takibi**: Periyodik ve tek seferlik giderler
- 📱 **Responsive**: Mobil/tablet uyumlu arayüz
