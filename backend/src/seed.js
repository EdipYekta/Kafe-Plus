require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Create roles
    await db.query(`
      INSERT INTO roles (name, description) VALUES
        ('Admin', 'Sistem yöneticisi'),
        ('Manager', 'Kafe yöneticisi'),
        ('Cashier', 'Kasa görevlisi'),
        ('Waiter', 'Garson'),
        ('Kitchen', 'Mutfak personeli')
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ Roles created');

    // Create cafe
    const { rows: [cafe] } = await db.query(`
      INSERT INTO cafes (name, phone, address)
      VALUES ('Kafe+ Demo', '0212 123 45 67', 'Bağcılar, İstanbul')
      ON CONFLICT DO NOTHING
      RETURNING *
    `);
    const cafeId = cafe?.id || 1;
    console.log('✅ Cafe created:', cafeId);

    // Create users
    const adminHash = await bcrypt.hash('admin123', 10);
    const staffHash = await bcrypt.hash('123456', 10);

    const users = [
      { full_name: 'Admin Kullanıcı', username: 'admin', hash: adminHash, role: 'Admin', color: '#ef4444', pin: '1111' },
      { full_name: 'Ahmet Yönetici', username: 'manager', hash: staffHash, role: 'Manager', color: '#f97316', pin: '2222' },
      { full_name: 'Mehmet Kasiyer', username: 'kasiyer', hash: staffHash, role: 'Cashier', color: '#3b82f6', pin: '3333' },
      { full_name: 'Ayşe Garson', username: 'garson1', hash: staffHash, role: 'Waiter', color: '#22c55e', pin: '4444' },
      { full_name: 'Fatma Garson', username: 'garson2', hash: staffHash, role: 'Waiter', color: '#8b5cf6', pin: '5555' },
      { full_name: 'Ali Mutfak', username: 'mutfak', hash: staffHash, role: 'Kitchen', color: '#14b8a6', pin: '6666' },
    ];

    for (const u of users) {
      const { rows: [role] } = await db.query('SELECT id FROM roles WHERE name=$1', [u.role]);
      await db.query(`
        INSERT INTO users (cafe_id, role_id, full_name, username, password_hash, avatar_color, pin_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (username) DO NOTHING
      `, [cafeId, role.id, u.full_name, u.username, u.hash, u.color, u.pin]);
    }
    console.log('✅ Users created');

    // Create areas
    const areaNames = ['İç Mekan', 'Bahçe', 'Teras', 'Balkon'];
    const areaIds = [];
    for (let i = 0; i < areaNames.length; i++) {
      const { rows: [area] } = await db.query(`
        INSERT INTO areas (cafe_id, name, sort_order) VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING RETURNING id
      `, [cafeId, areaNames[i], i]);
      if (area) areaIds.push(area.id);
    }
    if (areaIds.length === 0) {
      const { rows } = await db.query('SELECT id FROM areas WHERE cafe_id=$1 ORDER BY sort_order', [cafeId]);
      areaIds.push(...rows.map(r => r.id));
    }
    console.log('✅ Areas created:', areaIds);

    // Create tables
    const tables = [];
    for (let aIdx = 0; aIdx < areaIds.length; aIdx++) {
      const prefix = ['A', 'B', 'T', 'K'][aIdx];
      const count = [12, 21, 8, 6][aIdx];
      for (let i = 1; i <= count; i++) {
        const col = (i - 1) % 7;
        const row = Math.floor((i - 1) / 7);
        tables.push({
          area_id: areaIds[aIdx],
          name: `${prefix}${i}`,
          capacity: [2, 4, 4, 6][Math.floor(Math.random() * 4)],
          pos_x: col * 13 + 5,
          pos_y: row * 20 + 10,
          shape: i % 5 === 0 ? 'round' : 'square',
        });
      }
    }

    for (const t of tables) {
      await db.query(`
        INSERT INTO tables (cafe_id, area_id, name, capacity, pos_x, pos_y, shape)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [cafeId, t.area_id, t.name, t.capacity, t.pos_x, t.pos_y, t.shape]);
    }
    console.log('✅ Tables created');

    // Create categories
    const cats = [
      { name: 'Demleme Kahveler', icon: '☕', color: '#f97316' },
      { name: 'Espresso Kahveler', icon: '☕', color: '#92400e' },
      { name: 'Soğuk İçecekler', icon: '🧃', color: '#3b82f6' },
      { name: 'Sıcak İçecekler', icon: '🫖', color: '#f59e0b' },
      { name: 'Atıştırmalıklar', icon: '🥪', color: '#22c55e' },
      { name: 'Tatlılar', icon: '🍰', color: '#ec4899' },
      { name: 'Kahvaltılar', icon: '🍳', color: '#8b5cf6' },
    ];

    const catIds = {};
    for (let i = 0; i < cats.length; i++) {
      const { rows: [cat] } = await db.query(`
        INSERT INTO categories (cafe_id, name, icon, color, sort_order)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING RETURNING id
      `, [cafeId, cats[i].name, cats[i].icon, cats[i].color, i]);
      if (cat) catIds[cats[i].name] = cat.id;
    }

    // If conflict, fetch IDs
    const { rows: existingCats } = await db.query('SELECT id, name FROM categories WHERE cafe_id=$1', [cafeId]);
    for (const ec of existingCats) catIds[ec.name] = ec.id;

    console.log('✅ Categories created');

    // Create products
    const products = [
      // Demleme Kahveler
      { cat: 'Demleme Kahveler', name: 'Filtre Kahve', price: 65, cost: 12 },
      { cat: 'Demleme Kahveler', name: 'Pour Over', price: 90, cost: 18 },
      { cat: 'Demleme Kahveler', name: 'French Press', price: 80, cost: 15 },
      { cat: 'Demleme Kahveler', name: 'Chemex', price: 95, cost: 20 },
      // Espresso
      { cat: 'Espresso Kahveler', name: 'Espresso', price: 55, cost: 10 },
      { cat: 'Espresso Kahveler', name: 'Americano', price: 65, cost: 11 },
      { cat: 'Espresso Kahveler', name: 'Cappuccino', price: 90, cost: 18 },
      { cat: 'Espresso Kahveler', name: 'Latte', price: 95, cost: 20 },
      { cat: 'Espresso Kahveler', name: 'Flat White', price: 90, cost: 17 },
      { cat: 'Espresso Kahveler', name: 'Türk Kahvesi', price: 50, cost: 8 },
      // Soğuk
      { cat: 'Soğuk İçecekler', name: 'Limonata', price: 75, cost: 15 },
      { cat: 'Soğuk İçecekler', name: 'Ice Latte', price: 100, cost: 22 },
      { cat: 'Soğuk İçecekler', name: 'Soda', price: 40, cost: 8 },
      { cat: 'Soğuk İçecekler', name: 'Su', price: 20, cost: 4 },
      { cat: 'Soğuk İçecekler', name: 'Ice Tea', price: 65, cost: 12 },
      // Sıcak
      { cat: 'Sıcak İçecekler', name: 'Çay', price: 35, cost: 5 },
      { cat: 'Sıcak İçecekler', name: 'Bitki Çayı', price: 50, cost: 8 },
      { cat: 'Sıcak İçecekler', name: 'Sıcak Çikolata', price: 80, cost: 18 },
      { cat: 'Sıcak İçecekler', name: 'Salep', price: 75, cost: 14 },
      // Atıştırmalık
      { cat: 'Atıştırmalıklar', name: 'Tost', price: 85, cost: 25 },
      { cat: 'Atıştırmalıklar', name: 'Patatesli Gözleme', price: 95, cost: 28 },
      { cat: 'Atıştırmalıklar', name: 'Kruvasan', price: 70, cost: 20 },
      { cat: 'Atıştırmalıklar', name: 'Kek', price: 60, cost: 15 },
      // Tatlılar
      { cat: 'Tatlılar', name: 'Cheesecake', price: 120, cost: 35 },
      { cat: 'Tatlılar', name: 'Brownie', price: 100, cost: 28 },
      { cat: 'Tatlılar', name: 'Tiramisu', price: 130, cost: 40 },
      // Kahvaltı
      { cat: 'Kahvaltılar', name: 'Serpme Kahvaltı', price: 250, cost: 80 },
      { cat: 'Kahvaltılar', name: 'Menemen', price: 120, cost: 35 },
      { cat: 'Kahvaltılar', name: 'Sahanda Yumurta', price: 90, cost: 25 },
    ];

    for (const p of products) {
      const catId = catIds[p.cat];
      if (!catId) continue;
      await db.query(`
        INSERT INTO products (cafe_id, category_id, name, price, cost, preparation_time)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [cafeId, catId, p.name, p.price, p.cost, Math.floor(Math.random() * 10) + 2]);
    }
    console.log('✅ Products created');

    // Expense structures
    const structures = [
      { title: 'Dükkan Kirası', category: 'Kira', recurrence_type: 'monthly', amount: 25000, due_day: 1 },
      { title: 'İnternet Faturası', category: 'Fatura', recurrence_type: 'monthly', amount: 500, due_day: 15 },
      { title: 'Elektrik Faturası', category: 'Fatura', recurrence_type: 'monthly', amount: 3000, due_day: 20 },
      { title: 'Doğalgaz Faturası', category: 'Fatura', recurrence_type: 'monthly', amount: 1500, due_day: 25 },
    ];

    for (const s of structures) {
      await db.query(`
        INSERT INTO expense_structures (cafe_id, title, category, recurrence_type, amount, due_day)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [cafeId, s.title, s.category, s.recurrence_type, s.amount, s.due_day]);
    }
    console.log('✅ Expense structures created');

    // Create a cash register
    await db.query(`
      INSERT INTO cash_registers (cafe_id, name, day_end_time)
      VALUES ($1, 'Ana Kasa', '03:00')
      ON CONFLICT DO NOTHING
    `, [cafeId]);
    console.log('✅ Cash register created');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('  Admin:   admin / admin123 (PIN: 1111)');
    console.log('  Manager: manager / 123456 (PIN: 2222)');
    console.log('  Cashier: kasiyer / 123456 (PIN: 3333)');
    console.log('  Waiter:  garson1 / 123456 (PIN: 4444)');
    console.log('  Kitchen: mutfak / 123456 (PIN: 6666)');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
