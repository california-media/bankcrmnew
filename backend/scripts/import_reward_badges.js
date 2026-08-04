/**
 * Import rewardBadges from inzigo-site/mysilah_cards_backend.xlsx → Reward_Badges sheet
 * Run: node scripts/import_reward_badges.js
 * Matches cards by name (case-insensitive). Overwrites existing rewardBadges.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const XLSX     = require('xlsx');
const path     = require('path');

const CardProduct = require('../models/CardProduct');

const XLSX_PATH = path.join(__dirname, '../../inzigo-site/mysilah_cards_backend.xlsx');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const wb = XLSX.readFile(XLSX_PATH);

  // Build card_id → card_name map from Cards sheet
  const cardRows  = XLSX.utils.sheet_to_json(wb.Sheets['Cards'],         { defval: null });
  const badgeRows = XLSX.utils.sheet_to_json(wb.Sheets['Reward_Badges'], { defval: null });

  const idToName = {};
  for (const row of cardRows) {
    if (row.card_id && row.card_name) idToName[row.card_id] = row.card_name;
  }

  // Group badges by card_id
  const byCard = {};
  for (const row of badgeRows) {
    const id = row.card_id;
    if (!id) continue;
    if (!byCard[id]) byCard[id] = [];
    byCard[id].push(row);
  }

  const cardIds = Object.keys(byCard);
  console.log(`Unique card_ids in badges: ${cardIds.length}`);

  let updated = 0, notFound = 0;
  for (const cardId of cardIds) {
    const cardName = idToName[cardId];
    if (!cardName) {
      console.warn(`  [SKIP] No card_name for card_id "${cardId}"`);
      notFound++;
      continue;
    }

    const card = await CardProduct.findOne({ name: { $regex: new RegExp(`^${escapeRegex(cardName)}$`, 'i') } });
    if (!card) {
      console.warn(`  [MISS] DB card not found: "${cardName}" (${cardId})`);
      notFound++;
      continue;
    }

    const badges = byCard[cardId]
      .sort((a, b) => (a.badge_order || 0) - (b.badge_order || 0))
      .map((row) => ({
        badgeOrder:   Number(row.badge_order)  || 1,
        icon:         String(row.icon          || ''),
        valueType:    row.value_type === 'percent' ? 'percent' : 'text',
        percentValue: row.percent_value != null ? Number(row.percent_value) : null,
        labelOrText:  String(row.label_or_text || ''),
      }));

    await CardProduct.updateOne({ _id: card._id }, { $set: { rewardBadges: badges } });
    console.log(`  [SET] ${cardName} → ${badges.map(b => `${b.icon} ${b.labelOrText}`).join(' | ')}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}  Not found: ${notFound}  Total cards in sheet: ${cardIds.length}`);
  await mongoose.disconnect();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

run().catch(err => { console.error(err); process.exit(1); });
