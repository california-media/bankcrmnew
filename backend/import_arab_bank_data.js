const mongoose = require('mongoose');
require('dotenv').config();

const Bank        = require('./models/Bank');
const CardProduct = require('./models/CardProduct');

// Parsed from Excel
const CARDS = [
  {
    name: 'Arab Bank Visa Classic Credit Card',
    cardType: 'regular',
    minSalary: 5000,
    annualFee: 0,
    feeType: 'free',
    feesEligibility: 'No Annual Fee — free for life, no salary conditions or thresholds.',
    benefits: 'Free for life with no annual fee, no salary conditions and no thresholds. Arab Bank\'s entry-level Visa credit card.',
    keyFeatures: '1. More secure online shopping with Arab Bank Verified by Visa/Mastercard Secure Code Service\n2. Manage your card account for free via Internet Banking and Phone Banking\n3. Free SMS alerts on all purchases and cash withdrawals\n\nRewards Program:\n1. Automatic enrollment in the Arabi Rewards program, earn 1 point for every AED 2 spent\n2. Easy Payment Plans starting from as low as 1% monthly, at a wide range of merchants\n3. Shopping discounts at selected outlets across the UAE\n\nAdditional Benefits:\n1. Personalized credit limit to suit your financial needs\n2. Easy Payment Plans starting from as low as 1% monthly, at a wide range of merchants\n3. Grace period of interest-free credit on retail purchases',
    redirectUrl: 'https://www.arabbank.ae/docs/default-source/default-document-library/credit-card-en.pdf?sfvrsn=e68cbc9f_0',
  },
  {
    name: 'Arab Bank Platinum Mastercard',
    cardType: 'premium',
    minSalary: 10000,
    annualFee: 500,
    feeType: 'paid',
    feesEligibility: 'Annual Fee: AED 500',
    benefits: 'Complimentary access to 1,200+ airport lounges worldwide via the DragonPass Lounge program.',
    keyFeatures: '1. Exclusive Platinum card design, equipped with Smart Chip technology for enhanced anti-fraud protection\n2. Extra online security via Arab Bank Verified by Visa/Mastercard Secure Code Service\n3. Personalized credit limit to meet your evolving financial requirements\n\nRewards Program:\n1. Automatic enrollment in the Arabi Points rewards program on every spend\n2. Complimentary access to 1,200+ airport lounges worldwide via DragonPass\n3. Personalized credit limit to meet your evolving financial requirements\n\nAdditional Benefits:\n1. Settle payments conveniently via Internet Banking, Phone Banking, Arabi Mobile and ATMs\n2. Free supplementary cards for family members\n3. Optional Credit Shield insurance covering your outstanding balance',
    redirectUrl: 'https://www.arabbank.ae/docs/default-source/default-document-library/credit-card-en.pdf?sfvrsn=e68cbc9f_0',
  },
  {
    name: 'Arab Bank Visa Signature Credit Card',
    cardType: 'rewards_lifestyle',
    minSalary: 15000,
    annualFee: 1000,
    feeType: 'paid',
    feesEligibility: 'Annual Fee: AED 1,000 (waived for Elite program customers)',
    benefits: 'Arab Bank\'s flagship lifestyle card, offered exclusively to the bank\'s most valued clients, waived annual fee for Elite program customers.',
    keyFeatures: '1. Free Careem Plus annual subscription (promo code ARABIPLUS)\n2. Buy-1-Get-1 movie tickets at VOX, Reel, Roxy and Novo Cinemas\n3. 20% off Talabat food orders, up to 2 transactions a month (max AED 20)\n\nRewards Program:\n1. Access to 1,300+ airport lounges in 500+ cities worldwide via the Visa Airport Companion app\n2. Multi-trip travel insurance covering you and your family\n3. 24-hour concierge service for restaurant bookings, travel arrangements and shopping recommendations\n\nAdditional Benefits:\n1. Meet-and-assist services at 450+ destinations worldwide\n2. 11% off international transfers via GetTransfer.com\n3. Automatic enrollment in the Arabi Points rewards program on all spend',
    redirectUrl: 'https://www.arabbank.ae/docs/default-source/default-document-library/credit-card-en.pdf?sfvrsn=e68cbc9f_0',
  },
  {
    name: 'Arab Bank World Elite Mastercard',
    cardType: 'premium',
    minSalary: 30000,
    annualFee: 1900,
    feeType: 'paid',
    feesEligibility: 'Annual Fee: AED 1,900',
    benefits: 'Arab Bank\'s top-tier Mastercard — your own personalized key to a world of absolute luxury and convenience.',
    keyFeatures: '1. World Elite Mastercard global privileges and curated luxury experiences\n2. Extra online security via Arab Bank Verified by Mastercard Secure Code Service\n3. Flexible repayment instructions: 5%, 25%, 50% or 100%\n\nRewards Program:\n1. Automatic enrollment in the Arabi Points rewards program on every spend\n2. Complimentary access to airport lounges worldwide via the DragonPass program\n3. Personalized credit limit designed around your financial profile\n\nAdditional Benefits:\n1. Dedicated support through Arab Bank\'s Elite Contact Center\n2. Free supplementary cards for family members\n3. Optional Credit Shield insurance covering your outstanding balance',
    redirectUrl: 'https://www.arabbank.ae/docs/default-source/default-document-library/credit-card-en.pdf?sfvrsn=e68cbc9f_0',
  },
  {
    name: 'Arab Bank Visa Platinum Credit Card',
    cardType: 'premium',
    minSalary: 8000,
    annualFee: 500,
    feeType: 'paid',
    feesEligibility: 'Annual Fee: AED 500',
    benefits: 'Complimentary access to the exclusive Platinum benefits under the Visa Premium Privileges Program.',
    keyFeatures: '1. Exclusive offers at 900+ luxury hotels worldwide\n2. Global concierge service for travel, dining and shopping needs\n3. Grace period of interest-free credit on retail purchases up to 52 days\n\nRewards Program:\n1. Automatic enrollment in the Arabi Points rewards program\n2. Guaranteed exclusive deals at selected hotels and rent-a-car agencies via Visa Premium Privileges\n3. Access to 1,000+ premium airport lounges worldwide\n\nAdditional Benefits:\n1. Optional purchase protection program on eligible purchases\n2. High cash advance limit for cash-flow flexibility\n3. Free supplementary credit cards for family members',
    redirectUrl: 'https://www.arabbank.ae/docs/default-source/default-document-library/credit-card-en.pdf?sfvrsn=e68cbc9f_0',
  },
  {
    name: 'Arab Bank Visa Travel Mate Credit Card',
    cardType: 'travel',
    minSalary: 20000,
    annualFee: 600,
    feeType: 'paid',
    feesEligibility: 'Annual Fee: AED 600',
    benefits: 'Your passport to a world of travel benefits and privileges under the Visa Premium Privileges Program.',
    keyFeatures: '1. Extra online security via Arab Bank Verified by Visa/Mastercard Secure Code Service\n2. Automatic enrollment in the Arabi Points rewards program\n3. Personalized credit limit to meet your evolving travel and lifestyle needs\n\nRewards Program:\n1. Exclusive deals at selected Fairmont, Raffles and Marriott hotels\n2. Up to 15% off at Hertz, with the possibility of a complimentary vehicle upgrade\n3. Free Purchase Protection Cover — insures eligible purchases against theft or accidental damage for 365 days\n\nAdditional Benefits:\n1. Free supplementary cards for family members\n2. Settle payments conveniently via Internet Banking, Phone Banking, Arabi Mobile and ATMs\n3. Optional Credit Shield insurance covering your outstanding balance',
    redirectUrl: 'https://www.arabbank.ae/docs/default-source/default-document-library/credit-card-en.pdf?sfvrsn=e68cbc9f_0',
  },
];

async function main() {
  console.log('Connecting…');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  const bank = await Bank.findOne({ name: /^arab bank$/i }).lean();
  if (!bank) { console.error('Arab Bank not found in DB'); process.exit(1); }

  for (const c of CARDS) {
    const update = {
      bank: bank._id,
      cardType: c.cardType,
      benefits: c.benefits,
      feesEligibility: c.feesEligibility,
      keyFeatures: c.keyFeatures,
      redirectUrl: c.redirectUrl,
      redirectActive: false,
      isActive: true,
      commissionBrackets: [{
        minimumSalary: c.minSalary,
        receivable: 0,
        payable: 0,
        feeType: c.feeType,
      }],
    };

    const result = await CardProduct.findOneAndUpdate(
      { name: new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { $set: update },
      { new: true }
    );

    if (result) {
      console.log(`✓ Updated: "${result.name}"`);
    } else {
      console.log(`✗ Not found: "${c.name}"`);
    }
  }

  console.log('\n🎉 Done.');
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
