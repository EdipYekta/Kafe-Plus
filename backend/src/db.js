const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => console.error('Unexpected DB error', err));

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
};
