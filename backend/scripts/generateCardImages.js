/**
 * Generates SVG card images for each bank and updates CardProduct records.
 * Run: node backend/scripts/generateCardImages.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Bank = require('../models/Bank');
const CardProduct = require('../models/CardProduct');

const OUT_DIR = path.join(__dirname, '../uploads/card-images');

const BANK_COLORS = {
  ENBD:    ['#00843d', '#005f2c'],
  EIB:     ['#006b40', '#004428'],
  CBD:     ['#003580', '#001f4d'],
  FAB:     ['#8c1c13', '#5c1009'],
  RAK:     ['#1a5fa8', '#0d3d70'],
  DIB:     ['#007848', '#004a2c'],
  SIB:     ['#00704a', '#004430'],
  Deem:    ['#6d28d9', '#4c1d95'],
  Ajman:   ['#1d6a96', '#0d4060'],
  Mashreq: ['#c0392b', '#922b21'],
  Aafaq:   ['#1b3a6b', '#0d2244'],
  Invest:  ['#1d4ed8', '#1e3a8a'],
  UAB:     ['#1b3560', '#0d1e3a'],
  Mawarid: ['#155724', '#0a3316'],
  Arab:    ['#2c3e7a', '#1a2550'],
  Wio:     ['#7c3aed', '#5b21b6'],
};

const DEFAULT_COLORS = ['#374151', '#1f2937'];

function bankColors(code) {
  return BANK_COLORS[code] || DEFAULT_COLORS;
}

// EMV chip path (simplified gold chip)
function chip(x, y) {
  return `
    <rect x="${x}" y="${y}" width="42" height="32" rx="5" ry="5" fill="#d4a827" opacity="0.95"/>
    <line x1="${x + 14}" y1="${y}" x2="${x + 14}" y2="${y + 32}" stroke="#b8901e" stroke-width="1"/>
    <line x1="${x + 28}" y1="${y}" x2="${x + 28}" y2="${y + 32}" stroke="#b8901e" stroke-width="1"/>
    <line x1="${x}" y1="${y + 11}" x2="${x + 42}" y2="${y + 11}" stroke="#b8901e" stroke-width="1"/>
    <line x1="${x}" y1="${y + 21}" x2="${x + 42}" y2="${y + 21}" stroke="#b8901e" stroke-width="1"/>
    <rect x="${x + 14}" y="${y + 11}" width="14" height="10" fill="#c49b20" rx="1"/>
  `;
}

function generateSVG(bank) {
  const [c1, c2] = bankColors(bank.code);
  const w = 420, h = 265;
  const gId = `g${bank.code}`;

  // Abbreviate long names for display
  const displayName = bank.name.length > 22 ? bank.name.replace(/\bBank\b/, '').trim() : bank.name;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="${gId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <clipPath id="card-clip">
      <rect width="${w}" height="${h}" rx="18" ry="18"/>
    </clipPath>
  </defs>

  <!-- Card background -->
  <rect width="${w}" height="${h}" rx="18" ry="18" fill="url(#${gId})"/>

  <!-- Decorative circles -->
  <circle cx="${w - 60}" cy="${h - 40}" r="110" fill="rgba(255,255,255,0.06)"/>
  <circle cx="${w - 20}" cy="${h + 30}" r="130" fill="rgba(255,255,255,0.04)"/>
  <circle cx="30" cy="30" r="80" fill="rgba(255,255,255,0.04)"/>

  <!-- Top stripe -->
  <rect x="0" y="0" width="${w}" height="6" rx="0" fill="rgba(255,255,255,0.15)"/>

  <!-- Chip -->
  ${chip(32, 90)}

  <!-- Contactless icon -->
  <g transform="translate(95, 98)" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2">
    <path d="M0,8 Q5,0 0,-8"/>
    <path d="M5,12 Q14,0 5,-12"/>
    <path d="M10,16 Q22,0 10,-16"/>
  </g>

  <!-- Bank name -->
  <text x="32" y="54" font-family="Arial, sans-serif" font-size="20" font-weight="700"
    fill="rgba(255,255,255,0.95)" letter-spacing="0.5">${displayName}</text>

  <!-- Card number placeholder -->
  <text x="32" y="175" font-family="Courier New, monospace" font-size="17" letter-spacing="3"
    fill="rgba(255,255,255,0.55)">•••• •••• •••• ••••</text>

  <!-- Labels -->
  <text x="32" y="215" font-family="Arial, sans-serif" font-size="9" fill="rgba(255,255,255,0.5)"
    letter-spacing="1.5" text-transform="uppercase">CARD HOLDER</text>
  <text x="32" y="232" font-family="Arial, sans-serif" font-size="13" font-weight="600"
    fill="rgba(255,255,255,0.8)">•••••••••••••</text>

  <text x="295" y="215" font-family="Arial, sans-serif" font-size="9" fill="rgba(255,255,255,0.5)"
    letter-spacing="1.5">EXPIRES</text>
  <text x="295" y="232" font-family="Arial, sans-serif" font-size="13" font-weight="600"
    fill="rgba(255,255,255,0.8)">••/••</text>

  <!-- Card type logo area (Visa-style circles) -->
  <circle cx="${w - 55}" cy="42" r="22" fill="rgba(255,255,255,0.15)"/>
  <circle cx="${w - 35}" cy="42" r="22" fill="rgba(255,255,255,0.1)"/>

  <!-- Bank code bottom right -->
  <text x="${w - 30}" y="${h - 14}" font-family="Arial, sans-serif" font-size="11" font-weight="700"
    fill="rgba(255,255,255,0.4)" text-anchor="end" letter-spacing="2">${bank.code?.toUpperCase() || ''}</text>
</svg>`;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const banks = await Bank.find();
  if (!banks.length) { console.log('No banks found'); process.exit(0); }

  let updated = 0;

  for (const bank of banks) {
    const filename = `bank-${bank.code || bank._id}.svg`;
    const filepath = path.join(OUT_DIR, filename);

    const svg = generateSVG(bank);
    fs.writeFileSync(filepath, svg, 'utf8');
    console.log(`Generated ${filename}`);

    const result = await CardProduct.updateMany(
      { bank: bank._id, $or: [{ cardImage: { $exists: false } }, { cardImage: null }, { cardImage: '' }] },
      { cardImage: filename }
    );
    updated += result.modifiedCount;
    if (result.modifiedCount) console.log(`  → Updated ${result.modifiedCount} card product(s)`);
  }

  console.log(`\nDone. ${banks.length} images generated, ${updated} card products updated.`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
