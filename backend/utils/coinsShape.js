const BUCKET = process.env.AWS_S3_BUCKET || 'mysilah';
const REGION = process.env.AWS_REGION || 'us-east-1';
const LOGO_BASE = `https://${BUCKET}.s3.${REGION}.amazonaws.com/voucher-logos/`;

const logoUrl = (filename) => (filename ? LOGO_BASE + filename : null);

// User.coinBalance has no schema default, so a user never credited has no field: read it as 0.
const balanceOf = (u) => (u && u.coinBalance) || 0;

// Name words; UAE PASS stores names comma-separated ("HAFIZ,MUHAMMAD,QAMAR,,,").
const nameParts = (name) => String(name || '').split(/[\s,]+/).filter(Boolean);
// An ALL-CAPS word reads as shouting in a list: "HAFIZ" -> "Hafiz".
const tidyWord = (w) => (w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase() ? w[0] + w.slice(1).toLowerCase() : w);

// "Maya Sharma Khan" -> "Maya K."; "HAFIZ,MUHAMMAD,QAMAR,," -> "Hafiz Q."; single word -> first name only.
const maskName = (name) => {
  const parts = nameParts(name);
  if (parts.length === 0) return '';
  if (parts.length === 1) return tidyWord(parts[0]);
  const last = Array.from(parts[parts.length - 1])[0].toUpperCase();
  return `${tidyWord(parts[0])} ${last}.`;
};

// The caller's own full name with UAE PASS commas turned into spaces.
const displayName = (name) => nameParts(name).join(' ');

const shapeVoucher = (v, stock) => ({
  _id: v._id,
  title: v.title,
  brand: v.brand,
  category: v.category,
  description: v.description,
  terms: v.terms,
  valueLabel: v.valueLabel,
  coinCost: v.coinCost,
  logoUrl: logoUrl(v.logo),
  theme: v.theme,
  validUntil: v.validUntil,
  stock: stock || 0,
});

const shapeRedemption = (r, voucher, stock) => ({
  _id: r._id,
  code: r.code,
  coinCost: r.coinCost,
  createdAt: r.createdAt,
  scratchedAt: r.scratchedAt,
  voucher: voucher ? shapeVoucher(voucher, stock) : null,
});

module.exports = { displayName, logoUrl, balanceOf, maskName, shapeVoucher, shapeRedemption };
