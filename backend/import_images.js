const mongoose = require('mongoose');
const XLSX     = require('xlsx');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs   = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

require('dotenv').config();
const MONGO_URI  = process.env.MONGO_URI;
const DATA_DIR   = process.env.DATA_DIR || '/Users/californiamediadubai/Documents/data';
const S3_BUCKET  = process.env.AWS_S3_BUCKET  || 'mysilah';
const S3_PREFIX  = 'card-images/';
const AWS_REGION = process.env.AWS_REGION     || 'us-east-1';
const AWS_KEY    = process.env.ACCESS_KEY;
const AWS_SECRET = process.env.SECRET_ACCESS;

const s3 = new S3Client({ region: AWS_REGION, credentials: { accessKeyId: AWS_KEY, secretAccessKey: AWS_SECRET } });

// ── Models ───────────────────────────────────────────────────────────
const Bank        = mongoose.models.Bank        || mongoose.model('Bank',        new mongoose.Schema({ name: String }, { strict:false }));
const CardProduct = mongoose.models.CardProduct || mongoose.model('CardProduct', new mongoose.Schema({ name:String, bank: mongoose.Schema.Types.ObjectId, cardImage:String }, { strict:false }));

// ── Zip → bank name ──────────────────────────────────────────────────
const ZIP_BANK = {
  'AAFAQ.zip':        'Aafaq Islamic Finance',
  'ADCB.zip':         'ADCB',
  'ADIB.zip':         'ADIB',
  'AJMAN.zip':        'Ajman Bank',
  'AL HILAL.zip':     'Al Hilal Bank',
  'CBD.zip':          'Commercial Bank of Dubai',
  'CITI.zip':         'Citibank UAE',
  'DEEM.zip':         'Deem Finance',
  'DIB.zip':          'Dubai Islamic Bank',
  'DUBAI FIRST.zip':  'Dubai First',
  'EIB.zip':          'Emirates Islamic Bank',
  'ENBD.zip':         'Emirates NBD',
  'FAB.zip':          'First Abu Dhabi Bank',
  'HSBC.zip':         'HSBC',
  'Invest Bank.zip':  'Invest Bank',
  'LIV ENBD.zip':     'Liv. by Emirates NBD',
  'MASHREQ.zip':      'Mashreq',           // also covers Mashreq Al Islami
  'MAWARID.zip':      'Mawarid Finance',
  'RAK.zip':          'RAKBANK',
  'SCB.zip':          'Standard Chartered Bank',
  'SIB.zip':          'Sharjah Islamic Bank',
  'UAB.zip':          'United Arab Bank',
  'Wio.zip':          'Wio Bank',
};

// MIME by extension
const MIME = { '.avif':'image/avif', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp' };

// ── Normalise a string for matching ──────────────────────────────────
function norm(s) {
  return String(s||'').toLowerCase()
    .replace(/[-_]/g,' ')
    .replace(/[^a-z0-9 ]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

// Overlap score: how many words from imgName appear in cardName
function score(imgWords, cardNorm) {
  return imgWords.filter(w => w.length > 2 && cardNorm.includes(w)).length;
}

async function uploadToS3(localPath, s3Key, mime) {
  const body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: s3Key, Body: body, ContentType: mime }));
}

async function main() {
  console.log('Connecting…');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const zips = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.zip'));
  let matched = 0, unmatched = 0, uploaded = 0;

  for (const zipFile of zips) {
    const bankName = ZIP_BANK[zipFile];
    if (!bankName) { console.log(`? No mapping: ${zipFile}`); continue; }

    const bank = await Bank.findOne({ name: new RegExp('^' + bankName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$','i') }).lean();
    if (!bank) { console.log(`? Bank not in DB: ${bankName}`); continue; }

    // Get all cards for this bank (and for MASHREQ also get Al Islami)
    const bankIds = [bank._id];
    if (bankName === 'Mashreq') {
      const mai = await Bank.findOne({ name: /mashreq al islami/i }).lean();
      if (mai) bankIds.push(mai._id);
    }
    const cards = await CardProduct.find({ bank: { $in: bankIds } }).lean();

    const zip = new AdmZip(path.join(DATA_DIR, zipFile));
    const entries = zip.getEntries().filter(e => !e.isDirectory && !e.entryName.includes('__MACOSX') && !e.entryName.includes('.DS_Store'));

    console.log(`\n📦 ${zipFile} → ${bankName} (${entries.length} images, ${cards.length} cards)`);

    for (const entry of entries) {
      const basename = path.basename(entry.entryName);
      const ext = path.extname(basename).toLowerCase();
      if (!MIME[ext]) continue;

      const imgNorm  = norm(path.basename(basename, ext));
      const imgWords = imgNorm.split(' ');

      // Find best matching card
      let best = null, bestScore = 0;
      for (const card of cards) {
        const cardNorm = norm(card.name);
        const s = score(imgWords, cardNorm);
        if (s > bestScore) { bestScore = s; best = card; }
      }

      if (!best || bestScore < 2) {
        console.log(`  ✗ No match (score ${bestScore}): ${basename}`);
        unmatched++;
        continue;
      }

      const s3Key  = S3_PREFIX + basename;
      const mime   = MIME[ext];

      // Extract to temp buffer and upload
      const buf = entry.getData();
      await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: s3Key, Body: buf, ContentType: mime }));
      uploaded++;

      // Update card
      await CardProduct.findByIdAndUpdate(best._id, { $set: { cardImage: basename } });
      matched++;
      console.log(`  ✓ ${basename} → "${best.name}" (score ${bestScore})`);
    }
  }

  console.log(`\n🎉 Done. Matched+uploaded: ${matched}, Unmatched: ${unmatched}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
