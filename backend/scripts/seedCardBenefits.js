require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CardProduct = require('../models/CardProduct');

// Benefits and fees templates by card type.
// Script skips cards that already have benefits/feesEligibility populated.

const BENEFITS_BY_TYPE = {
  regular: {
    benefits: [
      {
        sectionTitle: 'Rewards',
        items: [
          'Earn reward points on every purchase.',
          'Redeem points for cashback, vouchers, or merchandise.',
          'Bonus points on supermarket and fuel spends.',
        ],
      },
      {
        sectionTitle: 'Payment Flexibility',
        items: [
          'Easy payment plan (0% interest) at select merchants.',
          'Balance transfer facility at competitive rates.',
          'Auto-pay and minimum payment options available.',
        ],
      },
      {
        sectionTitle: 'Security & Protection',
        items: [
          'Zero liability on unauthorised transactions.',
          'Instant SMS and app alerts for every transaction.',
          'Card lock/unlock via mobile banking app.',
        ],
      },
    ],
    feesEligibility: [
      {
        sectionTitle: 'Annual Fee',
        items: [
          'Annual fee as per the selected bracket (Free or Paid).',
          'Supplementary cards available at reduced or no cost.',
        ],
      },
      {
        sectionTitle: 'Eligibility',
        items: [
          'Minimum age: 21 years.',
          'UAE resident with valid Emirates ID or passport.',
          'Minimum monthly salary as per the applicable bracket.',
          'Required documents: Emirates ID, passport copy, salary certificate, 3-month bank statement.',
        ],
      },
      {
        sectionTitle: 'Key Charges',
        items: [
          'Late payment fee: AED 241.50.',
          'Over-limit fee: AED 294.25.',
          'Cash advance fee: 3% of amount (minimum AED 103.50).',
          'Foreign currency transaction fee: 2.99%.',
        ],
      },
    ],
  },

  premium: {
    benefits: [
      {
        sectionTitle: 'Premium Rewards',
        items: [
          'Accelerated rewards points on dining, travel, and luxury retail.',
          'Annual bonus points on achieving spending milestones.',
          'Points never expire as long as card is active.',
        ],
      },
      {
        sectionTitle: 'Travel Privileges',
        items: [
          'Complimentary airport lounge access (Priority Pass or equivalent) — up to 6 visits/year.',
          'Complimentary travel insurance covering trip cancellation, medical emergency, and lost baggage.',
          'Meet & greet airport services at select airports.',
          'Forex markup waiver on international transactions.',
        ],
      },
      {
        sectionTitle: 'Lifestyle Benefits',
        items: [
          'Complimentary golf sessions at select UAE courses.',
          'Concierge service 24/7 for dining, travel, and event bookings.',
          'Exclusive hotel privileges including room upgrades and late checkout.',
          'Access to Visa Infinite / Mastercard World Elite offers.',
        ],
      },
      {
        sectionTitle: 'Protection',
        items: [
          'Purchase protection and extended warranty on eligible items.',
          'Zero liability on unauthorised transactions.',
          'Dedicated premium customer service line.',
        ],
      },
    ],
    feesEligibility: [
      {
        sectionTitle: 'Annual Fee',
        items: [
          'Annual fee as per the selected bracket (Free or Paid).',
          'Waiver conditions may apply based on annual spend threshold.',
          'Supplementary cards available at reduced cost.',
        ],
      },
      {
        sectionTitle: 'Eligibility',
        items: [
          'Minimum age: 21 years.',
          'UAE resident with valid Emirates ID.',
          'Minimum monthly salary as per the applicable bracket.',
          'Required documents: Emirates ID, passport copy, salary certificate, 3-month bank statement.',
        ],
      },
      {
        sectionTitle: 'Key Charges',
        items: [
          'Late payment fee: AED 241.50.',
          'Over-limit fee: AED 294.25.',
          'Cash advance fee: 3% of amount (minimum AED 103.50).',
          'Foreign currency transaction fee: waived or reduced for premium tier.',
        ],
      },
    ],
  },

  rewards_lifestyle: {
    benefits: [
      {
        sectionTitle: 'Cashback & Rewards',
        items: [
          'Up to 5% cashback on dining and entertainment.',
          'Up to 3% cashback on supermarket and online shopping.',
          '1% cashback on all other eligible spends.',
          'Monthly cashback credited automatically to your account.',
        ],
      },
      {
        sectionTitle: 'Lifestyle Offers',
        items: [
          'Buy-1-get-1 dining offers at 500+ restaurants across UAE.',
          'Discounts at cinemas, theme parks, and entertainment venues.',
          'Exclusive access to lifestyle events and brand partnerships.',
          'Special discounts at partner gyms and wellness centres.',
        ],
      },
      {
        sectionTitle: 'Shopping Benefits',
        items: [
          'Additional discounts at partner retail stores and online platforms.',
          'Easy payment plan at 0% interest at select merchants.',
          'Purchase protection on eligible transactions.',
        ],
      },
    ],
    feesEligibility: [
      {
        sectionTitle: 'Annual Fee',
        items: [
          'Annual fee as per the selected bracket (Free or Paid).',
          'Fee waiver possible upon meeting minimum annual spend.',
        ],
      },
      {
        sectionTitle: 'Eligibility',
        items: [
          'Minimum age: 21 years.',
          'UAE resident with valid Emirates ID or passport.',
          'Minimum monthly salary as per the applicable bracket.',
          'Required documents: Emirates ID, passport copy, salary certificate, 3-month bank statement.',
        ],
      },
      {
        sectionTitle: 'Key Charges',
        items: [
          'Late payment fee: AED 241.50.',
          'Cash advance fee: 3% of amount (minimum AED 103.50).',
          'Foreign currency transaction fee: 2.99%.',
        ],
      },
    ],
  },

  travel: {
    benefits: [
      {
        sectionTitle: 'Airport & Travel',
        items: [
          'Unlimited complimentary airport lounge access worldwide (Priority Pass).',
          'Complimentary meet & assist at major international airports.',
          'Travel inconvenience cover: flight delay, cancellation, and missed connection.',
          'Forex markup waiver — spend abroad at no extra charge.',
        ],
      },
      {
        sectionTitle: 'Miles & Points',
        items: [
          'Earn air miles or travel points on every spend.',
          'Accelerated miles on airline and hotel bookings.',
          'Miles can be redeemed for flights, upgrades, and hotel stays.',
          'Transfer points to leading airline frequent flyer programmes.',
        ],
      },
      {
        sectionTitle: 'Travel Insurance',
        items: [
          'Comprehensive travel insurance: medical expenses up to USD 500,000.',
          'Personal accident cover while travelling.',
          'Baggage loss and delay coverage.',
          'Emergency card replacement and cash advance abroad.',
        ],
      },
      {
        sectionTitle: 'Hotel & Dining',
        items: [
          'Preferred hotel rates and complimentary room upgrades.',
          'Complimentary breakfast at partner hotel properties.',
          'Dining discounts at airport and hotel restaurants.',
        ],
      },
    ],
    feesEligibility: [
      {
        sectionTitle: 'Annual Fee',
        items: [
          'Annual fee as per the selected bracket (Free or Paid).',
          'First-year fee waiver may be available.',
        ],
      },
      {
        sectionTitle: 'Eligibility',
        items: [
          'Minimum age: 21 years.',
          'UAE resident with valid Emirates ID.',
          'Minimum monthly salary as per the applicable bracket.',
          'Required documents: Emirates ID, passport copy, salary certificate, 3-month bank statement.',
        ],
      },
      {
        sectionTitle: 'Key Charges',
        items: [
          'Late payment fee: AED 241.50.',
          'Cash advance fee: 3% of amount (minimum AED 103.50).',
          'Foreign currency transaction fee: waived or 1% for this card.',
        ],
      },
    ],
  },

  ecommerce: {
    benefits: [
      {
        sectionTitle: 'Online Shopping Rewards',
        items: [
          'Up to 5% cashback on online purchases.',
          'Bonus rewards at major e-commerce platforms (Amazon, Noon, etc.).',
          'Additional discounts via card-linked offers at online retailers.',
        ],
      },
      {
        sectionTitle: 'Security & Buyer Protection',
        items: [
          '3D Secure OTP authentication for every online transaction.',
          'Virtual card number generation for safer online payments.',
          'Purchase protection on eligible online transactions up to AED 10,000.',
          'Dispute resolution support for unauthorised online charges.',
        ],
      },
      {
        sectionTitle: 'Convenience',
        items: [
          'Easy payment plan at 0% interest at select online merchants.',
          'Instant card controls — freeze/unfreeze via app.',
          'Tokenisation support for Apple Pay, Google Pay, and Samsung Pay.',
        ],
      },
    ],
    feesEligibility: [
      {
        sectionTitle: 'Annual Fee',
        items: [
          'Annual fee as per the selected bracket (Free or Paid).',
        ],
      },
      {
        sectionTitle: 'Eligibility',
        items: [
          'Minimum age: 21 years.',
          'UAE resident with valid Emirates ID or passport.',
          'Minimum monthly salary as per the applicable bracket.',
          'Required documents: Emirates ID, passport copy, salary certificate, 3-month bank statement.',
        ],
      },
      {
        sectionTitle: 'Key Charges',
        items: [
          'Late payment fee: AED 241.50.',
          'Cash advance fee: 3% of amount (minimum AED 103.50).',
          'Foreign currency transaction fee: 2.99%.',
        ],
      },
    ],
  },

  legacy: {
    benefits: [
      {
        sectionTitle: 'Core Benefits',
        items: [
          'Earn reward points on eligible purchases.',
          'Access to easy payment plans at partner merchants.',
          'Supplementary cards for family members.',
        ],
      },
      {
        sectionTitle: 'Security',
        items: [
          'Zero liability on unauthorised transactions.',
          'SMS and email transaction alerts.',
          'Chip & PIN and contactless payment enabled.',
        ],
      },
    ],
    feesEligibility: [
      {
        sectionTitle: 'Annual Fee',
        items: [
          'Annual fee as per the selected bracket (Free or Paid).',
        ],
      },
      {
        sectionTitle: 'Eligibility',
        items: [
          'Minimum age: 21 years.',
          'UAE resident with valid Emirates ID or passport.',
          'Minimum monthly salary as per the applicable bracket.',
          'Required documents: Emirates ID, passport copy, salary certificate, 3-month bank statement.',
        ],
      },
      {
        sectionTitle: 'Key Charges',
        items: [
          'Late payment fee: AED 241.50.',
          'Cash advance fee: 3% of amount (minimum AED 103.50).',
          'Foreign currency transaction fee: 2.99%.',
        ],
      },
    ],
  },
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const cards = await CardProduct.find();
  console.log(`Found ${cards.length} card product(s)`);

  let updated = 0;
  let skipped = 0;

  for (const card of cards) {
    const alreadyHasContent = (card.benefits && card.benefits.length > 0) ||
                              (card.feesEligibility && card.feesEligibility.length > 0);
    if (alreadyHasContent) {
      console.log(`  SKIP (already has content): ${card.name}`);
      skipped++;
      continue;
    }

    const template = BENEFITS_BY_TYPE[card.cardType];
    if (!template) {
      console.log(`  SKIP (no template for type "${card.cardType}"): ${card.name}`);
      skipped++;
      continue;
    }

    card.benefits = template.benefits;
    card.feesEligibility = template.feesEligibility;
    await card.save();
    console.log(`  Updated [${card.cardType}]: ${card.name}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
