require('dotenv').config();
const mongoose = require('mongoose');
const CardCategory = require('./models/CardCategory');
const CardProduct  = require('./models/CardProduct');

const STANDARD_CATS = [
  'Groceries',
  'Dining',
  'Fuel',
  'Online Shopping',
  'Travel & Miles',
  'Airport Lounge',
  'International Spend',
  'Entertainment',
  'Utilities & Telecom',
  'Education',
  'Salik & Parking',
];

// Which categories map to which card types
const TYPE_CATS = {
  regular:           ['Groceries', 'Dining', 'Fuel', 'Online Shopping', 'Utilities & Telecom'],
  premium:           ['Dining', 'Airport Lounge', 'Travel & Miles', 'International Spend', 'Groceries', 'Entertainment'],
  rewards_lifestyle: ['Groceries', 'Dining', 'Entertainment', 'Online Shopping', 'Utilities & Telecom'],
  travel:            ['Travel & Miles', 'Airport Lounge', 'International Spend', 'Dining'],
  ecommerce:         ['Online Shopping', 'Dining', 'Groceries', 'International Spend'],
  legacy:            ['Groceries', 'Dining', 'Fuel', 'Salik & Parking'],
};

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected');

    // Upsert all standard categories
    const catMap = {};
    for (const name of STANDARD_CATS) {
      let cat = await CardCategory.findOne({ name });
      if (!cat) {
        cat = await CardCategory.create({ name });
        console.log(`Created category: ${name}`);
      } else {
        console.log(`Exists: ${name}`);
      }
      catMap[name] = cat._id;
    }

    // Assign categories to every card product based on its type
    const cards = await CardProduct.find({}).lean();
    console.log(`\nAssigning categories to ${cards.length} card products...`);

    for (const card of cards) {
      const catNames = TYPE_CATS[card.cardType] || TYPE_CATS.regular;
      const catIds   = catNames.map(n => catMap[n]).filter(Boolean);
      await CardProduct.findByIdAndUpdate(card._id, { cashbackCategories: catIds });
      console.log(`  [${card.cardType}] ${card.name} → ${catNames.join(', ')}`);
    }

    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
