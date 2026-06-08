require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const CardProduct = require('../models/CardProduct');

const IMAGES_DIR = path.join(__dirname, '../uploads/card-images');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const files = fs.readdirSync(IMAGES_DIR);
  let matched = 0, skipped = 0, notFound = 0;

  for (const filename of files) {
    const ext = path.extname(filename);
    const cardName = path.basename(filename, ext).trim();

    const card = await CardProduct.findOne({ name: cardName });
    if (!card) {
      console.log(`NOT FOUND: ${cardName}`);
      notFound++;
      continue;
    }

    if (card.cardImage === filename) {
      skipped++;
      continue;
    }

    card.cardImage = filename;
    await card.save();
    console.log(`Assigned: ${cardName} → ${filename}`);
    matched++;
  }

  console.log(`\nDone. Assigned: ${matched}, Already set: ${skipped}, Not found: ${notFound}`);
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
