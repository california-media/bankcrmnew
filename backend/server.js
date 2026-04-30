require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[fatal] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

connectDB();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/', (req, res) => res.json({ message: 'Bank CRM API' }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/banks', require('./routes/bank.routes'));
app.use('/api/agencies', require('./routes/agency.routes'));
app.use('/api/leads', require('./routes/lead.routes'));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
