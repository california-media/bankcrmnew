require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CardProduct = require('../models/CardProduct');

// Category IDs from DB
const CAT = {
  dining:       '6a574ebc9e55a7d83381b758',
  groceries:    '6a574eb39e55a7d83381b757',
  international:'6a574edf9e55a7d83381b75c',
  online:       '6a574eda9e55a7d83381b75b',
  salik:        '6a578c7e62747ddf3e62ec4f',
  travel:       '6a574ee49e55a7d83381b75d',
  utilities:    '6a574ed49e55a7d83381b75a',
  fuel:         '6a564ba0c0d30c387ef4fa0e',
};

function assignCategories(name, cardType) {
  const n = name.toLowerCase();

  // Travel / Miles / Skywards / Etihad / Airlines
  if (/skywards|etihad|dnata|voyager|air arabi|travel|miles|airline/i.test(n) || cardType === 'travel') {
    return [
      { category: CAT.travel,        rate: 3 },
      { category: CAT.international, rate: 2 },
      { category: CAT.dining,        rate: 1 },
    ];
  }

  // Cashback cards (general)
  if (/cashback|cash back|cash\+|cashback\+/i.test(n)) {
    return [
      { category: CAT.groceries,    rate: 5 },
      { category: CAT.dining,       rate: 3 },
      { category: CAT.international,rate: 2 },
    ];
  }

  // LuLu / Supermarket / Grocery
  if (/lulu|groceries|supermarket|hypermarket|super saver/i.test(n)) {
    return [
      { category: CAT.groceries,    rate: 5 },
      { category: CAT.online,       rate: 3 },
      { category: CAT.dining,       rate: 2 },
    ];
  }

  // Amazon / Online / Ecommerce / Noon / Webshopper
  if (/amazon|noon|webshopper|online|ecommerce|e-commerce/i.test(n) || cardType === 'ecommerce') {
    return [
      { category: CAT.online,        rate: 5 },
      { category: CAT.groceries,     rate: 2 },
      { category: CAT.international, rate: 2 },
    ];
  }

  // Dining / Food / Talabat / Smiles
  if (/talabat|dining|food|smiles/i.test(n)) {
    return [
      { category: CAT.dining,       rate: 5 },
      { category: CAT.groceries,    rate: 3 },
      { category: CAT.online,       rate: 2 },
    ];
  }

  // Fuel / RTA / Salik / Darb
  if (/fuel|salik|rta|darb|petrol/i.test(n)) {
    return [
      { category: CAT.fuel,         rate: 5 },
      { category: CAT.salik,        rate: 5 },
      { category: CAT.international,rate: 2 },
    ];
  }

  // Utilities / Telecom
  if (/utility|utilities|telecom|du |etisalat/i.test(n)) {
    return [
      { category: CAT.utilities,    rate: 5 },
      { category: CAT.groceries,    rate: 2 },
      { category: CAT.dining,       rate: 2 },
    ];
  }

  // Rewards / Points / Lifestyle
  if (/rewards|reward|points|lifestyle|shukran|touchpoints|share visa|u by emaar|marriott|booking/i.test(n) || cardType === 'rewards_lifestyle') {
    return [
      { category: CAT.dining,       rate: 3 },
      { category: CAT.groceries,    rate: 3 },
      { category: CAT.international,rate: 2 },
    ];
  }

  // Premium / Infinite / World Elite / Prestige / Solitaire / Prime
  if (/infinite|world elite|prestige|solitaire|prime infinite|ultra|elevate/i.test(n) || cardType === 'premium') {
    return [
      { category: CAT.dining,       rate: 5 },
      { category: CAT.travel,       rate: 3 },
      { category: CAT.international,rate: 3 },
      { category: CAT.groceries,    rate: 2 },
    ];
  }

  // Default — general card
  return [
    { category: CAT.groceries,    rate: 2 },
    { category: CAT.dining,       rate: 2 },
    { category: CAT.international,rate: 1 },
  ];
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const cards = await CardProduct.find({}).lean();
  console.log(`Total cards: ${cards.length}`);

  let updated = 0;
  for (const card of cards) {
    // Skip if already has categories set
    if (card.cashbackCategories && card.cashbackCategories.length > 0) {
      console.log(`SKIP (has cats): ${card.name}`);
      continue;
    }

    const cats = assignCategories(card.name, card.cardType);
    await CardProduct.updateOne(
      { _id: card._id },
      { $set: { cashbackCategories: cats } }
    );
    console.log(`SET: ${card.name} (${card.cardType}) → ${cats.map(c=>Object.keys(CAT).find(k=>CAT[k]===c.category.toString())+'@'+c.rate+'%').join(', ')}`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} cards.`);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
