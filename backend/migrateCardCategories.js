require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const col = db.collection('cardproducts');

  const cards = await col.find({}).toArray();
  let migrated = 0;
  for (const card of cards) {
    const cats = card.cashbackCategories || [];
    if (!cats.length) continue;
    // Check if already in new format
    if (cats[0] && typeof cats[0] === 'object' && cats[0].category) continue;
    // Convert ObjectId array to [{category, rate}] format
    const newCats = cats.map(id => ({ category: id, rate: null }));
    await col.updateOne({ _id: card._id }, { $set: { cashbackCategories: newCats } });
    migrated++;
  }
  console.log(`Migrated ${migrated} cards`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
