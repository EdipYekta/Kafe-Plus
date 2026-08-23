-- ==========================================
-- KAFE+ YÖNETİM SİSTEMİ - VERİTABANI ŞEMASI
-- ==========================================

-- Kafeler
CREATE TABLE cafes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  logo_url TEXT,
  timezone VARCHAR(50) DEFAULT 'Europe/Istanbul',
  currency VARCHAR(10) DEFAULT 'TRY',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Roller
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE, -- 'Admin', 'Manager', 'Cashier', 'Waiter', 'Kitchen'
  description TEXT,
  permissions JSONB DEFAULT '{}'
);

INSERT INTO roles (name, description, permissions) VALUES
  ('Admin', 'Sistem yöneticisi', '{"all": true}'),
  ('Manager', 'Kafe yöneticisi', '{"tables": true, "orders": true, "reports": true, "products": true, "expenses": true, "users": true}'),
  ('Cashier', 'Kasa görevlisi', '{"tables": true, "orders": true, "payments": true, "reports": true}'),
  ('Waiter', 'Garson', '{"tables": true, "orders": true}'),
  ('Kitchen', 'Mutfak personeli', '{"kitchen": true}');

-- Kullanıcılar
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  cafe_id INT REFERENCES cafes(id) ON DELETE CASCADE,
  role_id INT REFERENCES roles(id),
  full_name VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_color VARCHAR(7) DEFAULT '#6366f1',
  pin_code VARCHAR(6), -- Hızlı giriş için PIN
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- ÜRÜN & KATEGORİ YAPISI
-- ==========================================

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  cafe_id INT REFERENCES cafes(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(7) DEFAULT '#6366f1',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  cafe_id INT REFERENCES cafes(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) DEFAULT 0,
  image_url TEXT,
  stock_quantity INT DEFAULT 0,
  track_stock BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  preparation_time INT DEFAULT 0, -- Dakika cinsinden
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- MASA & OTURUM YAPISI
-- ==========================================

CREATE TABLE areas (
  id SERIAL PRIMARY KEY,
  cafe_id INT REFERENCES cafes(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- 'İç Mekan', 'Bahçe', 'Teras', 'Balkon'
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tables (
  id SERIAL PRIMARY KEY,
  cafe_id INT REFERENCES cafes(id) ON DELETE CASCADE,
  area_id INT REFERENCES areas(id) ON DELETE SET NULL,
  name VARCHAR(50) NOT NULL, -- 'Masa 1', 'A1', 'VIP-1'
  capacity INT DEFAULT 4,
  type VARCHAR(50) DEFAULT 'Standard', -- 'VIP', 'Standard', 'Bar', 'Terrace'
  status VARCHAR(20) DEFAULT 'empty', -- 'empty', 'occupied', 'reserved', 'cleaning'
  pos_x DECIMAL(6,2) DEFAULT 0,   -- Sürükle-bırak X koordinatı (%)
  pos_y DECIMAL(6,2) DEFAULT 0,   -- Sürükle-bırak Y koordinatı (%)
  width DECIMAL(6,2) DEFAULT 80,  -- Masa genişliği (px)
  height DECIMAL(6,2) DEFAULT 80, -- Masa yüksekliği (px)
  shape VARCHAR(20) DEFAULT 'square', -- 'square', 'round', 'rectangle'
  current_session_id INT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  table_id INT REFERENCES tables(id),
  cafe_id INT REFERENCES cafes(id),
  user_id INT REFERENCES users(id), -- Oturumu açan
  guest_count INT DEFAULT 1,
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT true,
  notes TEXT
);

-- tables.current_session_id FK'sini sonradan ekle
ALTER TABLE tables ADD CONSTRAINT fk_current_session
  FOREIGN KEY (current_session_id) REFERENCES sessions(id) ON DELETE SET NULL;

-- ==========================================
-- SİPARİŞ & SİPARİŞ DETAY YAPISI
-- ==========================================

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sessions(id),
  cafe_id INT REFERENCES cafes(id),
  user_id INT REFERENCES users(id), -- Siparişi alan garson
  status VARCHAR(20) DEFAULT 'pending',
  -- 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  kitchen_note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  note TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  -- 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  cancel_reason TEXT,
  cancelled_by INT REFERENCES users(id),
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- ÖDEME & KASA YAPISI
-- ==========================================

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sessions(id),
  cafe_id INT REFERENCES cafes(id),
  user_id INT REFERENCES users(id), -- Ödemeyi alan
  amount DECIMAL(10,2) NOT NULL,
  payment_type VARCHAR(30) NOT NULL, -- 'cash', 'credit_card', 'meal_card', 'mixed'
  discount_amount DECIMAL(10,2) DEFAULT 0,
  discount_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cash_registers (
  id SERIAL PRIMARY KEY,
  cafe_id INT REFERENCES cafes(id) ON DELETE CASCADE,
  name VARCHAR(100) DEFAULT 'Ana Kasa',
  day_end_time TIME DEFAULT '03:00', -- Gün sonu saati
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cash_register_reports (
  id SERIAL PRIMARY KEY,
  cafe_id INT REFERENCES cafes(id),
  register_id INT REFERENCES cash_registers(id),
  report_date DATE NOT NULL,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_cost DECIMAL(12,2) DEFAULT 0,
  total_expense DECIMAL(12,2) DEFAULT 0,
  net_profit DECIMAL(12,2) DEFAULT 0,
  cash_amount DECIMAL(12,2) DEFAULT 0,
  card_amount DECIMAL(12,2) DEFAULT 0,
  meal_card_amount DECIMAL(12,2) DEFAULT 0,
  discount_total DECIMAL(12,2) DEFAULT 0,
  order_count INT DEFAULT 0,
  customer_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- MASRAF / GİDER YAPISI
-- ==========================================

CREATE TABLE expense_structures (
  id SERIAL PRIMARY KEY,
  cafe_id INT REFERENCES cafes(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- 'Kira', 'Fatura', 'Personel', 'Tedarik', 'Diğer'
  recurrence_type VARCHAR(20) NOT NULL, -- 'monthly', 'weekly', 'yearly', 'one_time'
  amount DECIMAL(10,2) NOT NULL,
  due_day INT, -- Ayın/haftanın kaçıncı günü
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  cafe_id INT REFERENCES cafes(id) ON DELETE CASCADE,
  expense_structure_id INT REFERENCES expense_structures(id) ON DELETE SET NULL,
  user_id INT REFERENCES users(id), -- Kaydeden kullanıcı
  title VARCHAR(255) NOT NULL,
  expense_type VARCHAR(100), -- 'Kira', 'Fatura', 'Tedarik', 'Personel', 'Diğer'
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  receipt_url TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- BİLDİRİM YAPISI
-- ==========================================

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  cafe_id INT REFERENCES cafes(id),
  user_id INT REFERENCES users(id) NULL, -- NULL ise tüm kullanıcılara
  role_name VARCHAR(50) NULL, -- Belirli role
  type VARCHAR(50), -- 'order_ready', 'new_order', 'payment', 'system'
  title VARCHAR(255),
  message TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- İNDEKSLER
-- ==========================================

CREATE INDEX idx_users_cafe ON users(cafe_id);
CREATE INDEX idx_tables_cafe ON tables(cafe_id);
CREATE INDEX idx_tables_area ON tables(area_id);
CREATE INDEX idx_sessions_table ON sessions(table_id);
CREATE INDEX idx_sessions_active ON sessions(is_active);
CREATE INDEX idx_orders_session ON orders(session_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_payments_session ON payments(session_id);
CREATE INDEX idx_products_cafe ON products(cafe_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_expenses_cafe ON expenses(cafe_id);
