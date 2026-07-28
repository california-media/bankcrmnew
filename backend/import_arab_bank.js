const mongoose = require('mongoose');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs   = require('fs');
const path = require('path');

require('dotenv').config();

const MONGO_URI  = process.env.MONGO_URI;
const S3_BUCKET  = process.env.AWS_S3_BUCKET || 'mysilah';
const AWS_REGION = process.env.AWS_REGION    || 'us-east-1';
const AWS_KEY    = process.env.ACCESS_KEY;
const AWS_SECRET = process.env.SECRET_ACCESS;
const IMG_DIR    = '/Users/californiamediadubai/Downloads/Arab Bank';

const s3 = new S3Client({ region: AWS_REGION, credentials: { accessKeyId: AWS_KEY, secretAccessKey: AWS_SECRET } });

const Bank        = mongoose.model('Bank',        new mongoose.Schema({ name:String, isActive:Boolean }, { strict:false }));
const CardProduct = mongoose.model('CardProduct', new mongoose.Schema({ name:String, bank:mongoose.Schema.Types.ObjectId, cardImage:String }, { strict:false }));

// Image file → card name mapping
const CARDS = [
  { file: 'ARAB-BANK-WORLD-ELITE-MASTERCARD®.png',      name: 'Arab Bank World Elite Mastercard' },
  { file: 'ARABBANK-VISA-Signature-Credit-Card.png',     name: 'Arab Bank Visa Signature Credit Card' },
  { file: 'ARABBANK-VISA-TRAVEL-MATE-CREDIT-CARD.png',   name: 'Arab Bank Visa Travel Mate Credit Card' },
  { file: 'ARABBANK-Visa-Platinum-Credit-Card.png',      name: 'Arab Bank Visa Platinum Credit Card' },
  { file: 'ArabBank-Platinum-MasterCard®.png',           name: 'Arab Bank Platinum Mastercard' },
  { file: 'ArabBank-VISA-CLASSIC-CREDIT-CARD.png',       name: 'Arab Bank Visa Classic Credit Card' },
];

async function main() {
  console.log('Connecting…');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  // 1. Ensure Arab Bank exists
  let bank = await Bank.findOne({ name: /^arab bank$/i }).lean();
  if (!bank) {
    bank = await Bank.create({ name: 'Arab Bank', isActive: true });
    console.log('✓ Created bank: Arab Bank', bank._id);
  } else {
    console.log('✓ Bank already exists:', bank._id);
  }

  // 2. Create cards + upload images
  for (const { file, name } of CARDS) {
    const imgPath = path.join(IMG_DIR, file);
    if (!fs.existsSync(imgPath)) {
      console.log(`  ✗ File not found: ${file}`);
      continue;
    }

    // Upsert card
    let card = await CardProduct.findOne({ name: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$','i') }).lean();
    if (!card) {
      card = await CardProduct.create({ name, bank: bank._id, cardImage: file });
      console.log(`  ✓ Created card: "${name}"`);
    } else {
      console.log(`  • Card already exists: "${name}"`);
    }

    // Upload image to S3
    const buf  = fs.readFileSync(imgPath);
    const s3Key = 'card-images/' + file;
    await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: s3Key, Body: buf, ContentType: 'image/png' }));

    // Link image to card
    await CardProduct.findByIdAndUpdate(card._id || card.id, { $set: { cardImage: file } });
    console.log(`  ✓ Uploaded & linked: ${file}`);
  }

  console.log('\n🎉 Done.');
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
