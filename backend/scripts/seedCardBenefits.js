require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CardProduct = require('../models/CardProduct');

const b = (items) => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;

const CARDS = [
  // ─── DIB ──────────────────────────────────────────────────────────────────
  { name: 'DIB SHAMS Infinite Covered Card',
    benefits: b(['5% back on dining & travel (10 Wala\'a rewards per AED 1)','4 Wala\'a rewards/AED international; 3.5/AED domestic','Welcome bonus: up to 200,000 Wala\'a rewards (AED 1,000)','20% cashback on Amazon, Deliveroo, Noon, Talabat (first 3 months, max AED 25/merchant)','12 complimentary airport lounge visits/year (with guest)','4 complimentary golf rounds/month at 6 UAE courses','4 valet parking services/month; 4 airport transfers/year','Travel insurance up to USD 500,000; roadside assistance 3×/year']),
    feesEligibility: b(['Annual Fee: Free for life (waived with AED 60,000 annual spend)','Minimum Salary: AED 20,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats','Sharia-compliant covered card']) },

  { name: 'DIB SHAMS Signature Covered Card',
    benefits: b(['5% back on dining (10 Wala\'a/AED, cap 10,000/month)','5% back on travel (10 Wala\'a/AED, cap 15,000/month)','3 Wala\'a/AED international; 2.5/AED domestic','Welcome bonus: up to 100,000 Wala\'a rewards (AED 500)','20% cashback on delivery apps first 3 months (max AED 20/merchant)','8 airport lounge visits/year; 2 valet/month; 2 airport transfers/year','Travel insurance up to USD 500,000; roadside assistance 2×/year']),
    feesEligibility: b(['Annual Fee: Free for life (waived with AED 30,000 annual spend)','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats','Sharia-compliant covered card']) },

  { name: 'DIB SHAMS Platinum Covered Card',
    benefits: b(['5% back on dining (10 Wala\'a/AED, cap 5,000/month)','5% back on travel (10 Wala\'a/AED, cap 10,000/month)','2 Wala\'a/AED international; 1.5/AED domestic','Welcome bonus: up to 50,000 Wala\'a rewards (AED 250)','20% cashback on delivery apps first 3 months (max AED 15/merchant)','Travel insurance up to USD 100,000; roadside assistance; buyers protection 365 days']),
    feesEligibility: b(['Annual Fee: Free for life (waived with AED 15,000 annual spend)','Minimum Salary: AED 10,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats','Sharia-compliant covered card']) },

  { name: 'The Emirates Skywards DIB Infinite Covered Card',
    benefits: b(['2 Skywards Miles/USD on Emirates spends; 1.5 Miles/USD foreign; 1 Mile/USD local','Welcome: 25,000 Miles on activation + 25,000 on balance transfer + 25,000 on USD 20,000 spend','Unlimited airport lounge access (1,200+ lounges)','Complimentary Emirates Skywards Silver membership','4 valet/month; 4 airport transfers/year; travel insurance up to USD 500,000','0% Easy Payment Plan on Emirates tickets']),
    feesEligibility: b(['Annual Fee: AED 2,500','Minimum Salary: AED 20,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats','Sharia-compliant covered card']) },

  { name: 'The Emirates Skywards DIB Signature Covered Card',
    benefits: b(['1.5 Skywards Miles/USD Emirates; 1 Mile/USD foreign; 0.75 Mile/USD local','Joining bonus: 15,000 Miles + 15,000 on balance transfer (min AED 30,000)','8 airport lounge visits/year (1,200+ lounges)','2 airport transfers/year; travel insurance up to USD 500,000','0% Easy Payment Plan on Emirates tickets; 24/7 concierge']),
    feesEligibility: b(['Annual Fee: AED 1,500','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats','Sharia-compliant covered card']) },

  { name: 'The Emirates Skywards DIB Platinum Covered Card',
    benefits: b(['1 Skywards Mile/USD Emirates; 0.75 Mile/USD foreign; 0.5 Mile/USD local','Joining bonus: 5,000 Skywards Miles on activation','Travel insurance up to USD 100,000; roadside assistance 2×/year','0% Easy Payment Plan on Emirates tickets','Luxury Hotel Collection (900+ properties); purchase protection 365 days']),
    feesEligibility: b(['Annual Fee: AED 500','Minimum Salary: AED 10,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats','Sharia-compliant covered card']) },

  { name: 'Consumer Cashback Platinum Card',
    benefits: b(['Up to 4% cashback on supermarkets, fuel, auto servicing, telecom, utilities, school fees & Salik/NOL','Monthly cashback cap: AED 1,000 per billing cycle','Minimum monthly spend AED 4,000 required for cashback eligibility','Travel insurance up to USD 100,000','Complimentary roadside assistance 2×/year']),
    feesEligibility: b(['Annual Fee: AED 249 + VAT (first year free)','Minimum Salary: AED 15,000','Minimum Monthly Spend: AED 4,000 for cashback','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Consumer Cashback Reward Card',
    benefits: b(['Up to 3% cashback on supermarkets, fuel, auto servicing & bills','Monthly cashback cap: AED 1,000 per billing cycle','Minimum monthly spend AED 3,000 required for cashback','Travel insurance up to USD 100,000','Complimentary roadside assistance 2×/year']),
    feesEligibility: b(['Annual Fee: AED 200 + VAT (first year free)','Minimum Salary: AED 5,000','Minimum Monthly Spend: AED 3,000 for cashback','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Prime Infinite Card',
    benefits: b(['3.0 Wala\'a Rewards/AED locally; 3.5/AED foreign currency','12 airport lounge visits/year (1,200+ lounges)','2 complimentary valet/month (requires AED 8,000 min monthly spend)','Multi-trip travel insurance up to USD 500,000 (cardholder, spouse & 5 children)','Roadside assistance 5×/year; buyers protection 365 days','Access to 900+ luxury hotels via Visa Hotel Collection']),
    feesEligibility: b(['Annual Fee: AED 2,500','Minimum Salary: AED 20,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Prime Signature Card',
    benefits: b(['2.5 Wala\'a Rewards/AED locally; 3.0/AED foreign currency','8 airport lounge visits/year (1,200+ lounges)','2 complimentary valet/month (requires AED 5,000 min monthly spend)','Multi-trip travel insurance up to USD 500,000','Roadside assistance 3×/year; buyers protection 365 days']),
    feesEligibility: b(['Annual Fee: AED 1,500','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Prime Platinum Card',
    benefits: b(['2.0 Wala\'a Rewards/AED locally; 2.2/AED foreign currency','Travel insurance up to USD 100,000','Roadside assistance 2×/year; buyers protection 365 days','Extended warranty on electronics','Visa Luxury Hotels benefits (upgrades, late check-out, F&B vouchers)']),
    feesEligibility: b(['Annual Fee: AED 500','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Prime Gold Card',
    benefits: b(['0.6 Wala\'a Rewards/AED locally; 1.0/AED foreign currency','Travel insurance up to USD 75,000','Credit Shield Takaful: death/disability AED 200,000; job loss AED 30,000','Complimentary roadside assistance 2×/year']),
    feesEligibility: b(['Annual Fee: No annual fee','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Prime Classic Card',
    benefits: b(['0.5 Wala\'a Rewards/AED locally; 0.8/AED foreign currency','Travel insurance up to USD 50,000','Credit Shield Takaful: death/disability AED 200,000; job loss AED 30,000','Complimentary roadside assistance 2×/year']),
    feesEligibility: b(['Annual Fee: No annual fee','Minimum Salary: AED 3,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Al Islami Platinum Charge Card',
    benefits: b(['Sharia-compliant charge card (full balance due monthly)','Earn Wala\'a Rewards on all retail spends','4 complimentary airport lounge visits/year','Travel insurance up to USD 200,000','Purchase protection & extended warranty']),
    feesEligibility: b(['Annual Fee: AED 500','Minimum Salary: AED 10,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats','Full payment required every month']) },

  { name: 'Al Islami Gold Charge Card',
    benefits: b(['Sharia-compliant charge card (full balance due monthly)','Earn Wala\'a Rewards on all retail spends','Travel insurance up to USD 100,000','Purchase protection; roadside assistance']),
    feesEligibility: b(['Annual Fee: AED 300','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats','Full payment required every month']) },

  { name: 'Al Islami Classic Charge Card',
    benefits: b(['Sharia-compliant charge card (full balance due monthly)','Earn Wala\'a Rewards on all retail spends','Travel insurance up to USD 50,000','Purchase protection; supplementary cards']),
    feesEligibility: b(['Annual Fee: AED 150','Minimum Salary: AED 3,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats','Full payment required every month']) },

  // ─── ENBD ─────────────────────────────────────────────────────────────────
  { name: 'Skywards Infinite Credit Card',
    benefits: b(['Earn 1.75 Skywards Miles/AED international; 1.25 Miles/AED local','Unlimited airport lounge access (1,000+ lounges via LoungeKey)','Complimentary Emirates Skywards Gold membership','24/7 Visa Infinite Concierge; golf at premium UAE courses','Travel insurance up to USD 500,000; valet parking']),
    feesEligibility: b(['Annual Fee: AED 2,500','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Skywards Signature Credit Card',
    benefits: b(['Earn 1.5 Skywards Miles/AED international; 1.25 Miles/AED local','8 complimentary airport lounge visits/year','Complimentary Emirates Skywards Silver membership','Travel insurance up to USD 500,000; valet parking']),
    feesEligibility: b(['Annual Fee: AED 1,500','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Etihad Guest Visa Inspire',
    benefits: b(['Earn 1.25 Etihad Guest Miles/AED on Etihad spends; 0.75 Miles/AED elsewhere','4 complimentary airport lounge visits/year','Travel insurance up to USD 100,000','Purchase protection; supplementary cards']),
    feesEligibility: b(['Annual Fee: AED 500','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Etihad Guest Visa Elevate',
    benefits: b(['Earn 1.5 Etihad Miles/AED Etihad; 1 Mile/AED international; 0.75 Miles/AED local','8 complimentary airport lounge visits/year','Etihad Guest Silver tier status','Travel insurance up to USD 500,000; valet parking']),
    feesEligibility: b(['Annual Fee: AED 1,500','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'dnata Platinum Credit Card',
    benefits: b(['Earn dnata Travel Dollars on all spends (2 per AED 100 travel; 1 per AED 100 elsewhere)','Complimentary dnata travel services & exclusive travel deals','4 complimentary airport lounge visits/year','Travel insurance up to USD 500,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 1,000','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'dnata World Credit Card',
    benefits: b(['Earn premium dnata Travel Dollars on all spends','Complimentary dnata lounge access at Dubai Airport','Unlimited airport lounge access worldwide','Travel insurance up to USD 500,000','24/7 Visa Infinite Concierge; golf; valet parking']),
    feesEligibility: b(['Annual Fee: AED 1,750','Minimum Salary: AED 20,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Marriott Bonvoy® World Mastercard®',
    benefits: b(['Earn 6 Marriott Bonvoy points per AED 3 at Marriott hotels','Earn 2 points per AED 3 on all other spends','1 complimentary hotel night award annually (on card renewal)','Complimentary Marriott Bonvoy Silver Elite status','8 airport lounge visits/year; travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 1,500','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Marriott Bonvoy® World Elite Mastercard®',
    benefits: b(['Earn 10 Marriott Bonvoy points per AED 3 at Marriott hotels','Earn 3 points per AED 3 on all other spends','2 complimentary hotel night awards annually','Complimentary Marriott Bonvoy Gold Elite status','Unlimited airport lounge access; 24/7 concierge','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,500','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Voyager World Credit Card',
    benefits: b(['Earn Skywards Miles on all spends','8 complimentary airport lounge visits/year','Travel insurance up to USD 500,000','Premium hotel benefits; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 1,200','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Voyager World Elite Credit Card',
    benefits: b(['Earn enhanced Skywards Miles on all spends','Unlimited airport lounge access worldwide','24/7 concierge; golf; valet parking','Travel insurance up to USD 500,000; premium hotel benefits']),
    feesEligibility: b(['Annual Fee: AED 2,000','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'SHARE Visa Platinum Credit Card',
    benefits: b(['Earn 1 SHARE point/AED 1 on all spends','Redeem at 5,000+ UAE merchants (retail, dining, entertainment)','4 complimentary airport lounge visits/year','Travel insurance up to USD 200,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 700','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'SHARE Visa Signature Credit Card',
    benefits: b(['Earn 2 SHARE points/AED 1 on all spends','Redeem at 5,000+ UAE merchants','8 complimentary airport lounge visits/year','Travel insurance up to USD 500,000; valet parking; 24/7 concierge']),
    feesEligibility: b(['Annual Fee: AED 1,200','Minimum Salary: AED 12,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'SHARE Visa Infinite Credit Card',
    benefits: b(['Earn 3 SHARE points/AED 1 on all spends','Redeem at 5,000+ UAE merchants','Unlimited airport lounge access worldwide','24/7 Visa Infinite Concierge; golf; valet parking','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,500','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Darna Select Visa Credit Card',
    benefits: b(['Earn Darna points on all spends','Cashback on utility bills & school fees','UAE Focus program — discounts at 1,000+ local merchants','Travel insurance up to USD 100,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 500','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals only']) },

  { name: 'Darna Visa Signature Credit Card',
    benefits: b(['Earn enhanced Darna points; cashback on utility bills, school fees & UAE Focus merchants','8 complimentary airport lounge visits/year','Travel insurance up to USD 500,000; valet parking']),
    feesEligibility: b(['Annual Fee: AED 1,200','Minimum Salary: AED 12,000','Minimum Age: 21 years','Nationality: UAE Nationals only']) },

  { name: 'Darna Visa Infinite Credit Card',
    benefits: b(['Earn premium Darna points; cashback on utility bills, school fees & UAE Focus','Unlimited airport lounge access worldwide','24/7 concierge; golf; valet parking; travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,500','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals only']) },

  { name: 'U by Emaar Family Credit Card',
    benefits: b(['Earn U Points at all Emaar properties (hotels, malls, restaurants)','Up to 20% off at Emaar dining & entertainment outlets','Emaar hospitality discounts (Address Hotels, Vida Hotels)','Travel insurance up to USD 100,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 500','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'U By Emaar Signature Credit Card',
    benefits: b(['Earn 3 U Points/AED 1 at Emaar properties; 1 U Point/AED 1 elsewhere','8 complimentary airport lounge visits/year','24/7 concierge; Emaar property & dining discounts','Travel insurance up to USD 500,000; valet parking']),
    feesEligibility: b(['Annual Fee: AED 1,200','Minimum Salary: AED 12,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'U by Emaar Infinite Credit Card',
    benefits: b(['Earn 5 U Points/AED 1 at Emaar properties; 2 U Points/AED 1 elsewhere','Unlimited airport lounge access worldwide','24/7 concierge; golf; valet parking','Emaar property, dining & entertainment discounts','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,000','Minimum Salary: AED 20,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'U by Emaar Visa Infinite Emirati Credit Card',
    benefits: b(['Exclusive for UAE Nationals — enhanced U Points at Emaar properties','Unlimited airport lounge access worldwide','24/7 concierge; golf; valet parking; priority services','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: Waived','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals only']) },

  { name: 'LuLu 247 Titanium Credit Card',
    benefits: b(['Earn 1 LuLu point/AED 1 at LuLu Hypermarket; 0.5 points/AED 1 elsewhere','Redeem points for LuLu cashback vouchers','Travel insurance up to USD 100,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 200 (first year free)','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'LuLu 247 Platinum Credit Card',
    benefits: b(['Earn 1.5 LuLu points/AED 1 at LuLu; 1 point/AED 1 elsewhere','4 complimentary airport lounge visits/year','LuLu cashback vouchers; golf; valet parking','Travel insurance up to USD 200,000']),
    feesEligibility: b(['Annual Fee: AED 600','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'ENBD Mastercard Titanium Credit Card',
    benefits: b(['Earn reward points on all spends','Travel insurance up to USD 100,000','Purchase protection; supplementary cards; balance transfer; 0% instalment plans']),
    feesEligibility: b(['Annual Fee: AED 200','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'ENBD Mastercard Platinum Credit Card',
    benefits: b(['Earn reward points on all spends','4 complimentary airport lounge visits/year','Travel insurance up to USD 200,000; golf; balance transfer; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 600','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'ENBD Visa Platinum Credit Card',
    benefits: b(['Earn reward points on all spends','4 complimentary airport lounge visits/year','Travel insurance up to USD 200,000; golf; balance transfer','Purchase protection; supplementary cards; 0% instalment plans']),
    feesEligibility: b(['Annual Fee: AED 600','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'ENBD Visa Infinite Credit Card',
    benefits: b(['Earn premium reward points on all spends','Unlimited airport lounge access worldwide','24/7 Visa Infinite Concierge; golf; valet parking','Travel insurance up to USD 500,000; luxury hotel benefits']),
    feesEligibility: b(['Annual Fee: AED 2,000','Minimum Salary: AED 20,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Go4it Gold Credit Card',
    benefits: b(['Up to 10% cashback on dining & entertainment','2% cashback on travel; 1% on all other spends (monthly cap applies)','Travel insurance up to USD 100,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 300','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Go4it Platinum Credit Card',
    benefits: b(['Up to 10% cashback on dining, entertainment & travel','2% cashback on all other spends (monthly cap applies)','8 complimentary airport lounge visits/year','Travel insurance up to USD 500,000; valet parking']),
    feesEligibility: b(['Annual Fee: AED 600','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Duo Credit Card',
    benefits: b(['Dual-currency card — spend in AED plus a second currency (USD or EUR)','No foreign exchange fees on designated secondary currency','Earn reward points on all spends in both currencies','Travel insurance; purchase protection; balance transfer']),
    feesEligibility: b(['Annual Fee: AED 600','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Visa Flexi Credit Card',
    benefits: b(['Low interest rate (1% per month)','0% instalment plans at select UAE merchants','Flexible minimum payment options','Purchase protection; supplementary cards']),
    feesEligibility: b(['Annual Fee: AED 400 (first year free)','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Priority Banking Visa Infinite Credit Card',
    benefits: b(['Dedicated Priority Banking relationship manager','Unlimited airport lounge access worldwide','Global 24/7 Visa Infinite Concierge; premium reward points','Premium hotel & travel benefits; golf; travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,500 (waived for Priority Banking clients)','Minimum Salary: AED 35,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Webshopper Credit Card',
    benefits: b(['Up to 5% cashback on online shopping','1% cashback on all other spends','3D Secure protection for all online transactions','EMI payment plans for online purchases; virtual card option']),
    feesEligibility: b(['Annual Fee: AED 200','Minimum Salary: AED 3,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Manchester United Credit Card',
    benefits: b(['Manchester United co-branded card — exclusive fan experiences','Earn reward points on all spends','Access to Manchester United match ticket ballot','Merchandise discounts; travel insurance; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 400','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Diners Club Credit Card',
    benefits: b(['Access to 700+ Diners Club airport lounges globally','Earn Diners Club rewards on all spends','Premium travel insurance up to USD 500,000','24/7 Diners Club Concierge; global dining privileges']),
    feesEligibility: b(['Annual Fee: AED 2,000','Minimum Salary: AED 20,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── EIB ──────────────────────────────────────────────────────────────────
  { name: 'EIB Etihad Guest Platinum Credit Card',
    benefits: b(['Earn 2 Etihad Guest Miles/AED 1 on Etihad; 1 Mile/AED 1 elsewhere','4 complimentary airport lounge visits/year','Travel insurance up to USD 200,000; Sharia-compliant; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 700','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Amazon Platinum Credit Card',
    benefits: b(['5% cashback on Amazon.ae; 1% cashback on all other spends','Complimentary Amazon Prime membership (first year)','Travel insurance up to USD 100,000; purchase protection; 3D Secure']),
    feesEligibility: b(['Annual Fee: AED 400','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Amazon World Credit Card',
    benefits: b(['Up to 5% cashback on Amazon.ae; 2% on other online; 1% on all spends','Complimentary Amazon Prime membership','8 complimentary airport lounge visits/year','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 1,200','Minimum Salary: AED 12,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Emarati Credit Card',
    benefits: b(['Exclusive for UAE Nationals — enhanced reward points','Preferential interest rates & credit limits','Priority services at EIB branches','Annual fee waived; travel insurance up to USD 200,000']),
    feesEligibility: b(['Annual Fee: Waived','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals only']) },

  { name: 'Etihad Guest Ameera Credit Card',
    benefits: b(['Women\'s lifestyle card — earn Etihad Guest Miles on all spends','Spa & wellness discounts at select UAE partners','Fashion & beauty merchant offers','4 complimentary airport lounge visits/year','Travel insurance up to USD 200,000']),
    feesEligibility: b(['Annual Fee: AED 700','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats (female cardholders)']) },

  { name: 'Etihad Guest Premium Credit Card',
    benefits: b(['Earn 3 Etihad Miles/AED 1 Etihad; 1.5 Miles/AED 1 international; 1 Mile/AED 1 local','8 complimentary airport lounge visits/year','Etihad Guest Silver tier status','Travel insurance up to USD 500,000; valet parking']),
    feesEligibility: b(['Annual Fee: AED 1,500','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Etihad Guest Saqer Credit Card',
    benefits: b(['Earn 5 Etihad Miles/AED 1 Etihad; 2 Miles/AED 1 international; 1.5 Miles/AED 1 local','Unlimited airport lounge access worldwide','Complimentary Etihad Guest Platinum tier status','24/7 concierge; golf; valet parking; butler service','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 5,000','Minimum Salary: AED 50,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Flex Elite Credit Card',
    benefits: b(['Flexible payment structure — choose repayment amount each month','Earn reward points on all spends; convert any purchase to 0% instalment','8 complimentary airport lounge visits/year','Travel insurance up to USD 500,000; 24/7 concierge']),
    feesEligibility: b(['Annual Fee: AED 1,200','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Flex Credit Card',
    benefits: b(['Flexible repayment — choose how much to pay each month','Earn reward points; convert purchases to 0% instalment plan','Travel insurance up to USD 100,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 400','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'EIB Cashback Credit Card',
    benefits: b(['Up to 5% cashback on dining, groceries & telecom','1% cashback on all other spends; monthly cap: AED 500','Travel insurance up to USD 100,000; purchase protection; Sharia-compliant']),
    feesEligibility: b(['Annual Fee: AED 400','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Switch Cashback Credit Card',
    benefits: b(['Choose your cashback category monthly (dining/groceries/fuel/online)','Up to 10% cashback on chosen category; 1% on all other spends','Switch category once per billing cycle','Travel insurance up to USD 100,000']),
    feesEligibility: b(['Annual Fee: AED 500','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Cashback Plus Credit Card',
    benefits: b(['Up to 8% cashback on groceries, dining & utility bills','2% cashback on all other spends (monthly cap applies)','Travel insurance up to USD 200,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 600','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'RTA Credit Card',
    benefits: b(['Earn RTA Nol points on all card spends','10% discount on RTA services (taxi, bus, metro)','Top up Nol card using reward points','Travel insurance up to USD 100,000; purchase protection; 3D Secure']),
    feesEligibility: b(['Annual Fee: AED 300','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'EIB Skywards Signature Credit Card',
    benefits: b(['Earn 1.5 Skywards Miles/AED international; 1.25 Miles/AED local','8 complimentary airport lounge visits/year','Complimentary Emirates Skywards Silver membership','Travel insurance up to USD 500,000; Sharia-compliant']),
    feesEligibility: b(['Annual Fee: AED 1,500','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'EIB Skywards Infinite Credit Card',
    benefits: b(['Earn 1.75 Skywards Miles/AED international; 1.25 Miles/AED local','Unlimited airport lounge access worldwide','Complimentary Emirates Skywards Gold membership','24/7 concierge; golf; travel insurance up to USD 500,000; Sharia-compliant']),
    feesEligibility: b(['Annual Fee: AED 2,500','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'EIB Skywards Black Credit Card',
    benefits: b(['Top-tier Skywards — earn 3 Miles/AED 1 Emirates; 2 Miles/AED 1 international; 1.5 Miles/AED 1 local','Unlimited airport lounge access; Emirates Platinum status','24/7 butler service; concierge; golf; valet','Travel insurance up to USD 500,000; Sharia-compliant']),
    feesEligibility: b(['Annual Fee: AED 5,000','Minimum Salary: AED 50,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── FAB ──────────────────────────────────────────────────────────────────
  { name: 'FAB Cashback Credit Card',
    benefits: b(['Up to 5% cashback on groceries, dining & online shopping','1.5% cashback on all other spends; monthly cap: AED 400','Travel insurance up to USD 200,000; purchase protection; 0% instalment plans']),
    feesEligibility: b(['Annual Fee: AED 300 (first year free)','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Islamic Cashback Credit Card',
    benefits: b(['Sharia-compliant — up to 5% cashback on groceries, dining & online','1.5% cashback on all other spends; monthly cap: AED 400','Travel insurance up to USD 200,000; purchase protection; 0% instalment plans']),
    feesEligibility: b(['Annual Fee: AED 300 (first year free)','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Blue FAB Islamic Credit Card',
    benefits: b(['Sharia-compliant entry-level card','Earn rewards on all spends','Travel insurance up to USD 50,000; purchase protection; no minimum spend']),
    feesEligibility: b(['Annual Fee: AED 150','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Emirati Islamic Credit Card',
    benefits: b(['Exclusive for UAE Nationals — Sharia-compliant','Enhanced reward points; preferential rates & credit limits','Annual fee waived; travel insurance up to USD 200,000']),
    feesEligibility: b(['Annual Fee: Waived','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals only']) },

  { name: 'FAB Etihad Guest Platinum Islamic Credit Card',
    benefits: b(['Sharia-compliant — earn 2 Etihad Miles/AED 1 Etihad; 1 Mile/AED 1 elsewhere','4 complimentary airport lounge visits/year','Travel insurance up to USD 200,000']),
    feesEligibility: b(['Annual Fee: AED 700','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Etihad Guest Signature Islamic Credit Card',
    benefits: b(['Sharia-compliant — earn 2 Miles/AED Etihad; 1.25 Miles/AED international; 0.75 Miles/AED local','8 airport lounge visits/year; Etihad Guest Silver status','Travel insurance up to USD 500,000; valet parking']),
    feesEligibility: b(['Annual Fee: AED 1,500','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Etihad Guest Infinite Islamic Credit Card',
    benefits: b(['Sharia-compliant — earn 2.5 Miles/AED Etihad; 1.5 Miles/AED international; 1 Mile/AED local','Unlimited airport lounge access; Etihad Guest Gold status','24/7 concierge; travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,500','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Etihad Guest Platinum Credit Card',
    benefits: b(['Earn 2 Etihad Miles/AED 1 Etihad; 1 Mile/AED 1 elsewhere','4 complimentary airport lounge visits/year','Travel insurance up to USD 200,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 700','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Etihad Guest Signature Credit Card',
    benefits: b(['Earn 2 Miles/AED Etihad; 1.25 Miles/AED international; 0.75 Miles/AED local','8 airport lounge visits/year; Etihad Guest Silver status','Travel insurance up to USD 500,000; valet parking']),
    feesEligibility: b(['Annual Fee: AED 1,500','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Etihad Guest Infinite Credit Card',
    benefits: b(['Earn 2.5 Miles/AED Etihad; 1.5 Miles/AED international; 1 Mile/AED local','Unlimited airport lounge access; Etihad Guest Gold status','24/7 concierge; travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,500','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB GEMS World Credit Card',
    benefits: b(['Earn GEMS points redeemable for GEMS school fees','Up to 5% back on GEMS school fee payments','Earn 1 reward point/AED 1 on all other spends','4 airport lounge visits/year; travel insurance up to USD 200,000']),
    feesEligibility: b(['Annual Fee: AED 500','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB ADNOC Cashback Credit Card',
    benefits: b(['Up to 5% cashback on ADNOC fuel & retail spends','1% cashback on all other spends','ADNOC Rewards program integration','Travel insurance up to USD 100,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 300','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB MANCHESTER CITY Credit Card',
    benefits: b(['Manchester City co-branded — earn rewards on all spends','Access to Man City match ticket opportunities','Merchandise discounts; travel insurance; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 400','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Z Card',
    benefits: b(['Instant cashback — up to 3% on dining & entertainment; 1% on all other spends','No minimum spend; digital-first card management','Travel insurance up to USD 100,000; 0% instalment plans']),
    feesEligibility: b(['Annual Fee: AED 300','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB SHARE Platinum Credit Card',
    benefits: b(['Earn 1 SHARE point/AED 1 on all spends','Redeem at 5,000+ UAE merchants','4 airport lounge visits/year; travel insurance up to USD 200,000']),
    feesEligibility: b(['Annual Fee: AED 700','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB SHARE Signature Credit Card',
    benefits: b(['Earn 2 SHARE points/AED 1 on all spends','Redeem at 5,000+ UAE merchants','8 airport lounge visits/year; 24/7 concierge','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 1,200','Minimum Salary: AED 12,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB SHARE Infinite Credit Card',
    benefits: b(['Earn 3 SHARE points/AED 1 on all spends','Redeem at 5,000+ UAE merchants','Unlimited airport lounge access; 24/7 concierge; golf; valet','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,500','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Travel Credit Card',
    benefits: b(['Earn 3x miles on flights, hotels & travel bookings; 1x on all other spends','6 complimentary airport lounge visits/year; no forex fees','Hotel upgrades & benefits; travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 800','Minimum Salary: AED 10,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Blue Platinum Visa Card (Al Futtaim)',
    benefits: b(['Al Futtaim retail discounts (ACE, IKEA, Marks & Spencer, Borders & more)','Earn Blue Rewards points on all spends','4 airport lounge visits/year; travel insurance up to USD 200,000']),
    feesEligibility: b(['Annual Fee: AED 600','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Blue Signature Visa Card (Al Futtaim)',
    benefits: b(['Enhanced Al Futtaim discounts across all Al Futtaim brands','Earn 2x Blue Rewards points; 8 airport lounge visits/year','24/7 concierge; travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 1,200','Minimum Salary: AED 12,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Blue Infinite Visa Card (Al Futtaim)',
    benefits: b(['Premium Al Futtaim discounts & priority access','Earn 3x Blue Rewards points; unlimited airport lounge access','24/7 concierge; golf; travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,500','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Rewards Active Credit Card',
    benefits: b(['Earn 1 rewards point/AED 1 on all spends','Redeem for flights, hotels & cashback','Travel insurance up to USD 100,000; purchase protection; 0% instalment plans']),
    feesEligibility: b(['Annual Fee: AED 400','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB Rewards Indulge Card',
    benefits: b(['Earn 2 rewards points/AED 1 on all spends','Redeem for flights, hotels, dining & cashback','6 airport lounge visits/year; 24/7 concierge; golf; hotel upgrades','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 800','Minimum Salary: AED 12,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'du Credit Card',
    benefits: b(['Earn du points on all du telecom bill payments (5x multiplier)','Earn 1 du point/AED 1 on all other spends','Redeem for du credit, devices & accessories','Travel insurance up to USD 100,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 300','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'FAB World Elite Mastercard',
    benefits: b(['Mastercard World Elite benefits on all spends','Unlimited airport lounge access worldwide','24/7 lifestyle manager & concierge; premium hotel collection; golf','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,500','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── RAKBANK ──────────────────────────────────────────────────────────────
  { name: 'Air Arabia Credit Card',
    benefits: b(['Earn Air Reward Miles (2 miles/AED on Air Arabia; 1 mile/AED elsewhere)','Complimentary airport lounge access at select GCC airports','Annual free Air Arabia ticket (on minimum spend threshold)','Travel insurance up to USD 100,000; no salary transfer required']),
    feesEligibility: b(['Annual Fee: AED 300 (first year free)','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'RAKBANK Red Mastercard Credit Card',
    benefits: b(['Up to 2% cashback on dining, fuel & online shopping','0.5% cashback on all other spends; no salary transfer required','Travel insurance up to USD 100,000; purchase protection; 0% instalment plans']),
    feesEligibility: b(['Annual Fee: AED 300','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'RAKBANK Titanium Mastercard Credit Card',
    benefits: b(['Earn rewards on all spends; no salary transfer required','Travel insurance up to USD 100,000','Purchase protection; supplementary cards; balance transfer']),
    feesEligibility: b(['Annual Fee: AED 200','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'RAKBANK World Credit Card',
    benefits: b(['Earn WorldPoints on all spends; no salary transfer required','8 airport lounge visits/year (Mastercard Lounge)','24/7 Mastercard Concierge; golf; valet parking','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 800','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'RAKBANK Elevate World Elite Mastercard',
    benefits: b(['Up to 5% cashback on all spends (highest cashback tier)','Unlimited airport lounge access (Mastercard Lounge)','24/7 Mastercard World Elite Concierge; golf; valet parking','No salary transfer required; travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 1,500','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── MASHREQ ──────────────────────────────────────────────────────────────
  { name: 'Mashreq Cashback Credit Card',
    benefits: b(['Up to 5% cashback on dining & groceries','3% cashback on online shopping; 1% cashback on all other spends','No minimum spend; monthly cashback cap applies','Travel insurance up to USD 100,000']),
    feesEligibility: b(['Annual Fee: AED 300 (first year free)','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Mashreq noon Credit Card',
    benefits: b(['Earn 5x noon points on noon.com & noon Daily purchases','1% cashback on all other spends','Exclusive noon.com discounts & flash sale access','noon vouchers redeemable for products; travel insurance']),
    feesEligibility: b(['Annual Fee: AED 300','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Mashreq Platinum Plus',
    benefits: b(['Earn rewards points on all spends','4 complimentary airport lounge visits/year','Travel insurance up to USD 200,000; purchase protection; balance transfer; valet parking']),
    feesEligibility: b(['Annual Fee: AED 600','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Mashreq Flash Cash',
    benefits: b(['Easy cash access — up to 100% of credit limit','Low cash advance fee; flexible repayment options','0% instalment plan at select merchants; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 200','Minimum Salary: AED 3,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Mashreq Solitaire Credit Card',
    benefits: b(['Women\'s lifestyle card — earn Solitaire rewards on all spends','Spa & beauty discounts at premium UAE partners','Fashion & dining merchant privileges','4 airport lounge visits/year; travel insurance up to USD 200,000; valet parking']),
    feesEligibility: b(['Annual Fee: AED 700','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats (female cardholders)']) },

  // ─── CBD ──────────────────────────────────────────────────────────────────
  { name: 'CBD Super Saver Visa Credit Card',
    benefits: b(['Up to 10% cashback on grocery & dining','2% cashback on fuel; 1% cashback on all other spends; monthly cap: AED 200','Travel insurance up to USD 100,000']),
    feesEligibility: b(['Annual Fee: AED 300 (first year free)','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'CBD Smiles Visa Signature Credit Card',
    benefits: b(['Earn 2 Smiles points/AED 1 on all spends','Redeem at thousands of UAE & Egypt merchants','8 airport lounge visits/year; travel insurance up to USD 500,000; valet parking']),
    feesEligibility: b(['Annual Fee: AED 600','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'CBD Visa Infinite Credit Card',
    benefits: b(['Earn premium rewards on all spends','Unlimited airport lounge access worldwide','24/7 Visa Infinite Concierge; golf; valet parking; luxury hotel benefits','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,000','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'CBD One Credit Card',
    benefits: b(['All-in-one: cashback + rewards + lounge access','Up to 5% cashback on selected categories','4 airport lounge visits/year; travel insurance up to USD 200,000; 0% instalment plans']),
    feesEligibility: b(['Annual Fee: AED 400','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── SIB ──────────────────────────────────────────────────────────────────
  { name: 'SIB Smiles Titanium',
    benefits: b(['Earn 1 Smiles point/AED 1 on all spends (Sharia-compliant)','Redeem Smiles points at thousands of UAE & Egypt merchants','Travel insurance up to USD 100,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 300','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'SIB World Mastercard Covered Card (Smiles)',
    benefits: b(['Sharia-compliant World covered card','Earn 2 Smiles points/AED 1 on all spends','8 airport lounge visits/year; Smiles merchant discounts; golf; valet','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 600','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'SIB Cashback',
    benefits: b(['Up to 5% cashback on groceries, dining & fuel (Sharia-compliant)','1% cashback on all other spends','Travel insurance up to USD 100,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 200','Minimum Salary: AED 3,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── AJMAN BANK ───────────────────────────────────────────────────────────
  { name: 'Ajman Bank ULTRACASH Mastercard Touch Card',
    benefits: b(['Earn cash rewards on all retail spends','Touch (contactless) payment technology','Easy Cash facility; travel insurance up to USD 100,000','0% Easy Instalment Scheme at select merchants']),
    feesEligibility: b(['Annual Fee: AED 200','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Ajman Bank Bright Titanium Credit Card',
    benefits: b(['Earn Bright rewards on all spends','Easy Instalment Scheme at select UAE merchants','Travel insurance up to USD 100,000; purchase protection; 3D Secure']),
    feesEligibility: b(['Annual Fee: AED 200','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Ajman Bank Bright Platinum Credit Card',
    benefits: b(['Earn enhanced Bright rewards on all spends','4 airport lounge visits/year; golf; valet parking','Travel insurance up to USD 200,000; 0% Easy Instalment Scheme; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 500','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Ajman Bank World Credit Card',
    benefits: b(['Earn World rewards on all spends','8 airport lounge visits/year; 24/7 concierge; golf; valet parking','Luxury hotel benefits; travel insurance up to USD 500,000','0% Easy Instalment Scheme on Emirates tickets']),
    feesEligibility: b(['Annual Fee: AED 1,000','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── UAB ──────────────────────────────────────────────────────────────────
  { name: 'UAB Titanium Credit Card',
    benefits: b(['Earn rewards on all spends','Travel insurance up to USD 100,000','Purchase protection; supplementary cards; balance transfer; 0% instalment plans']),
    feesEligibility: b(['Annual Fee: AED 200','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'UAB Platinum Credit Card',
    benefits: b(['Earn rewards on all spends','8 airport lounge visits/year; golf; valet parking','Travel insurance up to USD 200,000; purchase protection; balance transfer']),
    feesEligibility: b(['Annual Fee: AED 500','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'UAB World Credit Card',
    benefits: b(['Earn premium rewards on all spends','Unlimited airport lounge access worldwide','24/7 concierge; golf; valet parking; luxury hotel benefits','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 1,000','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── AAFAQ ────────────────────────────────────────────────────────────────
  { name: 'Aafaq Titanium Credit Card',
    benefits: b(['Sharia-compliant entry-level card','Earn rewards on all retail spends','Travel insurance up to USD 100,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 200','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Aafaq Platinum Credit Card',
    benefits: b(['Sharia-compliant Platinum card','Earn rewards on all retail spends','4 airport lounge visits/year; travel insurance up to USD 200,000; valet parking']),
    feesEligibility: b(['Annual Fee: AED 400','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Afaq World Credit Card',
    benefits: b(['Sharia-compliant World card','Earn rewards on all retail spends','8 airport lounge visits/year; 24/7 concierge; golf; valet','Travel insurance up to USD 500,000; hotel benefits']),
    feesEligibility: b(['Annual Fee: AED 800','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── MAWARID ──────────────────────────────────────────────────────────────
  { name: 'Mawarid Titanium Card',
    benefits: b(['Sharia-compliant entry-level card','Earn rewards on all retail spends','Travel insurance up to USD 100,000; purchase protection; balance transfer']),
    feesEligibility: b(['Annual Fee: AED 200','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Mawarid Platinum Card',
    benefits: b(['Sharia-compliant Platinum card','Earn rewards on all retail spends','4 airport lounge visits/year; golf; travel insurance up to USD 200,000; valet']),
    feesEligibility: b(['Annual Fee: AED 500','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Mawarid World Card',
    benefits: b(['Sharia-compliant World card','Earn rewards on all retail spends','8 airport lounge visits/year; 24/7 concierge; golf; valet','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 1,000','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Mawarid World Elite Card',
    benefits: b(['Sharia-compliant World Elite — premium rewards on all spends','Unlimited airport lounge access worldwide','24/7 concierge; golf; valet; luxury hotel collection','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,000','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── CITI ─────────────────────────────────────────────────────────────────
  { name: 'Citi Simplicity',
    benefits: b(['No late payment fees; no over-limit fees; low interest rate','0% instalment plan at select UAE merchants','Purchase protection; supplementary cards; digital card via Citi Mobile App']),
    feesEligibility: b(['Annual Fee: No annual fee','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Citi Cash Back',
    benefits: b(['Up to 2% cashback on all spends','Up to 10% cashback at select Citi partner merchants','No minimum spend; cashback credited monthly','Travel insurance up to USD 100,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 300','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Citi Ready Credit',
    benefits: b(['Revolving credit line with flexible repayment','Easy cash access up to credit limit','0% instalment plan at select merchants; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 200','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Citi Premier',
    benefits: b(['Earn 2 ThankYou Points/USD on dining & travel; 1 point/USD elsewhere','4 complimentary airport lounge visits/year','Hotel benefits at select properties; travel insurance up to USD 200,000']),
    feesEligibility: b(['Annual Fee: AED 800','Minimum Salary: AED 12,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Citi Rewards',
    benefits: b(['Earn 1 ThankYou Point/AED 1 on all spends','Redeem for merchandise, flights, hotel stays & cashback','Travel insurance up to USD 100,000; purchase protection']),
    feesEligibility: b(['Annual Fee: AED 400','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Citi Ultima',
    benefits: b(['Ultra-premium — unlimited airport lounge access worldwide','24/7 Ultima butler & lifestyle concierge service','Premium hotel stays & curated travel experiences','Golf; travel insurance up to USD 500,000; dedicated Relationship Manager']),
    feesEligibility: b(['Annual Fee: AED 5,000 (waived with minimum spend)','Minimum Salary: AED 50,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats (by invitation)']) },

  { name: 'Citi Prestige',
    benefits: b(['Earn 5 ThankYou Points on dining, hotels & flights; 1 point elsewhere','Unlimited airport lounge access worldwide','4th night hotel free at 1,000+ hotels globally','24/7 concierge; golf; travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 2,000','Minimum Salary: AED 25,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── DUBAI FIRST ──────────────────────────────────────────────────────────
  { name: 'Dubai First Cashback Credit Card',
    benefits: b(['Up to 10% cashback on dining, grocery & online shopping','1% cashback on all other spends (monthly cap applies)','Travel insurance; purchase protection; 0% instalment plans']),
    feesEligibility: b(['Annual Fee: AED 300','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Dubai First Low-Rate Credit Card',
    benefits: b(['Lowest interest rate — 0.99% per month','No annual fee; flexible minimum payment options','Purchase protection; supplementary cards; 0% instalment plans']),
    feesEligibility: b(['Annual Fee: No annual fee','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'SlicePay',
    benefits: b(['Buy now, pay later — split into 0% interest instalments (3 or 6 months)','Instant digital card — no physical card required','No annual fee; instant approval; works at all Visa-accepting merchants']),
    feesEligibility: b(['Annual Fee: No annual fee','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── DEEM ─────────────────────────────────────────────────────────────────
  { name: 'Deem Titanium Cash Up Mastercard',
    benefits: b(['Up to 10% cashback on dining, fuel & entertainment (Sahl program)','1% cashback on all other spends; no salary transfer required','Travel insurance up to USD 100,000; easy online application']),
    feesEligibility: b(['Annual Fee: AED 299','Minimum Salary: AED 5,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Deem Platinum Cash Up Mastercard',
    benefits: b(['Up to 10% cashback on enhanced categories (Sahl program)','4 airport lounge visits/year; no salary transfer required','Travel insurance up to USD 200,000']),
    feesEligibility: b(['Annual Fee: AED 499','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Deem World Cash Up Mastercard',
    benefits: b(['Premium cashback on all spends (Sahl program)','Unlimited airport lounge access worldwide','24/7 Mastercard Concierge; golf; no salary transfer required','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 799','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── INVEST BANK ──────────────────────────────────────────────────────────
  { name: 'Invest Bank Platinum Credit Card',
    benefits: b(['Earn rewards on all retail spends','8 airport lounge visits/year; golf; valet parking','Travel insurance up to USD 200,000; purchase protection; balance transfer']),
    feesEligibility: b(['Annual Fee: AED 500','Minimum Salary: AED 8,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  { name: 'Invest Bank World Credit Card',
    benefits: b(['Earn premium rewards on all retail spends','Unlimited airport lounge access worldwide','24/7 concierge; golf; valet parking; luxury hotel collection','Travel insurance up to USD 500,000']),
    feesEligibility: b(['Annual Fee: AED 1,000','Minimum Salary: AED 15,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },

  // ─── WIO ──────────────────────────────────────────────────────────────────
  { name: 'Wio Credit Card',
    benefits: b(['1% cashback on all spends — no category restrictions','No foreign exchange transaction fees','Instant virtual card via Wio app; built-in budgeting & spending analytics','Purchase protection; 3D Secure']),
    feesEligibility: b(['Annual Fee: No annual fee','Minimum Salary: AED 3,000','Minimum Age: 21 years','Nationality: UAE Nationals & Expats']) },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  let updated = 0;
  let notFound = 0;

  for (const { name, benefits, feesEligibility } of CARDS) {
    const card = await CardProduct.findOne({ name });
    if (!card) {
      console.warn(`  NOT FOUND: ${name}`);
      notFound++;
      continue;
    }
    card.benefits = benefits;
    card.feesEligibility = feesEligibility;
    await card.save();
    updated++;
    console.log(`  Updated: ${name}`);
  }

  console.log(`\nDone. Updated: ${updated}, Not found: ${notFound}`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
