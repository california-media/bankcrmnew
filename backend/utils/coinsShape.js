const BUCKET = process.env.AWS_S3_BUCKET || 'mysilah';
const REGION = process.env.AWS_REGION || 'us-east-1';
const LOGO_BASE = `https://${BUCKET}.s3.${REGION}.amazonaws.com/voucher-logos/`;

const logoUrl = (filename) => (filename ? LOGO_BASE + filename : null);

// "Maya Sharma Khan" -> "Maya K."; single word -> first name only.
const maskName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const last = Array.from(parts[parts.length - 1])[0].toUpperCase();
  return `${parts[0]} ${last}.`;
};

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

module.exports = { logoUrl, maskName, shapeVoucher, shapeRedemption };
