require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { WebSocketServer } = require('ws');
const http = require('http');
const { backfillAll } = require('./summary');

const app = express();
const server = http.createServer(app);

// WebSocket Server (KDS için realtime)
const wss = new WebSocketServer({ server });
const clients = new Map(); // cafe_id -> Set of clients

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const cafeId = url.searchParams.get('cafe_id');
  const role = url.searchParams.get('role');

  if (!clients.has(cafeId)) clients.set(cafeId, new Set());
  clients.get(cafeId).add({ ws, role });

  ws.on('close', () => {
    if (clients.has(cafeId)) {
      clients.get(cafeId).forEach(client => {
        if (client.ws === ws) clients.get(cafeId).delete(client);
      });
    }
  });
});

// Broadcast to specific cafe
const broadcast = (cafeId, event, data, targetRole = null) => {
  const cafeClients = clients.get(String(cafeId));
  if (!cafeClients) return;
  cafeClients.forEach(({ ws, role }) => {
    if (ws.readyState === 1) {
      if (!targetRole || role === targetRole) {
        ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
      }
    }
  });
};

app.set('broadcast', broadcast);

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cafes', require('./routes/cafes'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/areas', require('./routes/areas'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Kafe+ Backend running on port ${PORT}`));

// Backfill daily sales summaries from existing payments so metrics stay consistent.
backfillAll();
