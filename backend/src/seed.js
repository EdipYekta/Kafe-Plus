require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  console.log('Seeding database...');

  try {
    // Roles already created by schema.sql. Ensure SuperAdmin exists.
    await db.query(`
      INSERT INTO roles (name, description) VALUES
        ('SuperAdmin', 'Sistem / uygulama yöneticisi (tüm kafeler)')
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('Roles ready');

    // Create demo cafe
    const { rows: [cafe] } = await db.query(`
      INSERT INTO cafes (name, phone, address, kitchen_enabled)
      VALUES ('Kafe+ Demo', '0212 123 45 67', 'Bağcılar, İstanbul', true)
      ON CONFLICT DO NOTHING
      RETURNING *
    `);

    // Ensure all roles exist
    await db.query(`
      INSERT INTO roles (name, description) VALUES
        ('SuperAdmin', 'Sistem / uygulama yöneticisi (tüm kafeler)'),
        ('Owner', 'Kafe Sahibi'),
        ('Manager', 'Kafe Yöneticisi'),
        ('Cashier', 'Kasiyer'),
        ('Waiter', 'Garson'),
        ('Kitchen', 'Mutfak')
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('Roles ready');
    const cafeId = cafe?.id || 1;
    console.log('Cafe created:', cafeId);

    // Create users — "admin" keeps username but is the cafe Owner
    const ownerHash = await bcrypt.hash('admin123', 10);
    const staffHash = await bcrypt.hash('123456', 10);

    const users = [
      { full_name: 'Demo Sahibi', username: 'admin', hash: ownerHash, role: 'Owner', color: '#ef4444', pin: '1111' },
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
    console.log('Users created');

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
    console.log('Areas created:', areaIds);

    // Create tables
    for (let aIdx = 0; aIdx < areaIds.length; aIdx++) {
      const prefix = ['A', 'B', 'T', 'K'][aIdx];
      const count = [12, 21, 8, 6][aIdx];
      for (let i = 1; i <= count; i++) {
        const col = (i - 1) % 7;
        const row = Math.floor((i - 1) / 7);
        await db.query(`
          INSERT INTO tables (cafe_id, area_id, name, capacity, pos_x, pos_y, shape)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [cafeId, areaIds[aIdx], `${prefix}${i}`, [2, 4, 4, 6][Math.floor(Math.random() * 4)],
          col * 13 + 5, row * 20 + 10, i % 5 === 0 ? 'round' : 'square']);
      }
    }
    console.log('Tables created');

    // Load categories + products from items.json (same structure as the import endpoint)
    const itemsPath = path.resolve(__dirname, '../../items.json');
    let importData = [];
    if (fs.existsSync(itemsPath)) {
      importData = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
    } else {
      // Fallback small demo set
      importData = [
        {
          category: 'Espresso Kahveler', items: [
            { name: 'Espresso', description: '30 ml tek shot yoğun kahve.', price: 110 },
            { name: 'Latte', description: 'Espresso, sıcak süt ve süt köpüğü.', price: 150 },
          ]
        },
        {
          category: 'Soğuk İçecekler', items: [
            { name: 'Limonata', description: '', price: 110 },
            { name: 'Su', description: '', price: 40 },
          ]
        },
      ];
    }

    const catIds = {};
    for (let i = 0; i < importData.length; i++) {
      const group = importData[i];
      const catName = (group.category || '').trim();
      if (!catName) continue;
      const { rows: [cat] } = await db.query(`
        INSERT INTO categories (cafe_id, name, icon, sort_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING RETURNING id
      `, [cafeId, catName, '☕', i]);
      if (cat) catIds[catName] = cat.id;
    }
    const { rows: existingCats } = await db.query('SELECT id, name FROM categories WHERE cafe_id=$1', [cafeId]);
    for (const ec of existingCats) catIds[ec.name] = ec.id;

    let prodCount = 0;
    for (const group of importData) {
      const catId = catIds[(group.category || '').trim()];
      if (!catId) continue;
      const items = Array.isArray(group.items) ? group.items : [];
      for (const item of items) {
        const name = (item.name || '').trim();
        if (!name) continue;
        await db.query(`
          INSERT INTO products (cafe_id, category_id, name, description, price, preparation_time)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING
        `, [cafeId, catId, name, (item.description || '').trim() || null, parseFloat(item.price) || 0, Math.floor(Math.random() * 10) + 2]);
        prodCount++;
      }
    }
    console.log(`Products created: ${prodCount}`);

    // Mark a few popular items as quick access
    const quickNames = ['Latte', 'Espresso', 'Türk Kahvesi', 'Çay', 'Su', 'Coca-Cola'];
    for (const qn of quickNames) {
      await db.query(`UPDATE products SET is_quick_access=true WHERE cafe_id=$1 AND name=$2`, [cafeId, qn]);
    }

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
    console.log('Expense structures created');

    await db.query(`
      INSERT INTO cash_registers (cafe_id, name, day_end_time)
      VALUES ($1, 'Ana Kasa', '03:00')
      ON CONFLICT DO NOTHING
    `, [cafeId]);
    console.log('Cash register created');

    console.log('\nSeed completed successfully!');
    console.log('\nDemo Credentials:');
    console.log('  Owner:    admin / admin123 (PIN: 1111)');
    console.log('  Manager:  manager / 123456 (PIN: 2222)');
    console.log('  Cashier:  kasiyer / 123456 (PIN: 3333)');
    console.log('  Waiter:   garson1 / 123456 (PIN: 4444)');
    console.log('  Kitchen:  mutfak / 123456 (PIN: 6666)');
    console.log('\nSuperAdmin login: /admin/login with password: Yekta1346!');

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
