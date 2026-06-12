require('dotenv').config();
const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const jwt       = require('jsonwebtoken');
const cors      = require('cors');
const path      = require('path');
const connectDB = require('./config/db');
const { setIO } = require('./utils/io');

const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[fatal] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const app        = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET', 'POST'] },
});

setIO(io);

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require('./models/User');
    const user = await User.findById(decoded.id).select('_id isActive').lean();
    if (!user || !user.isActive) return next(new Error('Unauthorized'));
    socket.userId = String(decoded.id);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  socket.join(String(socket.userId));
  socket.on('disconnect', () => {});
});

connectDB();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.json({ message: 'Bank CRM API' }));

app.use('/api/public',            require('./routes/public.routes'));
app.use('/api/auth',              require('./routes/auth.routes'));
app.use('/api/banks',             require('./routes/bank.routes'));
app.use('/api/agencies',          require('./routes/agency.routes'));
app.use('/api/leads',             require('./routes/lead.routes'));
app.use('/api/commission-rules',  require('./routes/commissionRule.routes'));
app.use('/api/volume-bonuses',    require('./routes/volumeBonus.routes'));
app.use('/api/admin',             require('./routes/admin.routes'));
app.use('/api/card-products',     require('./routes/cardProduct.routes'));
app.use('/api/loan-products',     require('./routes/loanProduct.routes'));
app.use('/api/employees',         require('./routes/employee.routes'));
app.use('/api/employee-statuses', require('./routes/employeeStatus.routes'));
app.use('/api/agency-payouts',    require('./routes/agencyPayout.routes'));
app.use('/api/notifications',     require('./routes/notification.routes'));
app.use('/api/inquiries',         require('./routes/inquiry.routes'));
app.use('/api/webhooks',          require('./routes/webhook.routes'));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
