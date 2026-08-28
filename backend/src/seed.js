require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  console.log('Seeding database from scratch...');

  try {
    // 1. Roles
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
    console.log('✔ Roles created');

    // 2. Main Demo Cafe (Tek kafe, ID: 1)
    const { rows: [cafe] } = await db.query(`
      INSERT INTO cafes (name, phone, address)
      VALUES ('Kafe+ Demo', '0212 123 45 67', 'Bağcılar, İstanbul')
      RETURNING *
    `);
    const cafeId = cafe.id;
    console.log(`✔ Cafe created with ID: ${cafeId}`);

    // 3. Users
    const ownerHash = await bcrypt.hash('admin123', 10);
    const staffHash = await bcrypt.hash('123456', 10);

    const users = [
      { full_name: 'Super Yönetici', username: 'superadmin', hash: ownerHash, role: 'SuperAdmin', color: '#dc2626', pin: '0000' },
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
      `, [cafeId, role.id, u.full_name, u.username, u.hash, u.color, u.pin]);
    }
    console.log('✔ Users created');

    // 4. Areas & Tables
    const areaNames = ['İç Mekan', 'Bahçe', 'Teras', 'Balkon'];
    const areaIds = [];
    for (let i = 0; i < areaNames.length; i++) {
      const { rows: [area] } = await db.query(`
        INSERT INTO areas (cafe_id, name, sort_order) VALUES ($1, $2, $3)
        RETURNING id
      `, [cafeId, areaNames[i], i]);
      areaIds.push(area.id);
    }

    for (let aIdx = 0; aIdx < areaIds.length; aIdx++) {
      const prefix = ['A', 'B', 'T', 'K'][aIdx];
      const count = [12, 21, 8, 6][aIdx];
      for (let i = 1; i <= count; i++) {
        const col = (i - 1) % 7;
        const row = Math.floor((i - 1) / 7);
        await db.query(`
          INSERT INTO tables (cafe_id, area_id, name, capacity, pos_x, pos_y, shape)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [cafeId, areaIds[aIdx], `${prefix}${i}`, [2, 4, 4, 6][Math.floor(Math.random() * 4)],
          col * 13 + 5, row * 20 + 10, i % 5 === 0 ? 'round' : 'square']);
      }
    }
    console.log('✔ Areas and Tables created');

    // 5. Categories & Products
    const itemsPath = path.resolve(__dirname, '../../items.json');
    let importData = [];
    if (fs.existsSync(itemsPath)) {
      importData = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
    }

    const catIds = {};
    for (let i = 0; i < importData.length; i++) {
      const group = importData[i];
      const catName = (group.category || '').trim();
      if (!catName) continue;
      const { rows: [cat] } = await db.query(`
        INSERT INTO categories (cafe_id, name, icon, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [cafeId, catName, '☕', i]);
      catIds[catName] = cat.id;
    }

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
        `, [cafeId, catId, name, (item.description || '').trim() || null, parseFloat(item.price) || 0, Math.floor(Math.random() * 10) + 2]);
        prodCount++;
      }
    }
    console.log(`✔ Categories and ${prodCount} Products created`);

    // 6. Cash Register
    await db.query(`
      INSERT INTO cash_registers (cafe_id, name, day_end_time)
      VALUES ($1, 'Ana Kasa', '03:00')
    `, [cafeId]);
    console.log('✔ Cash register created');

    console.log('\n🚀 ALL SEED DONE CLEANLY!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();