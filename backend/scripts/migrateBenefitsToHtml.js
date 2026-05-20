require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CardProduct = require('../models/CardProduct');
const LoanProduct = require('../models/LoanProduct');

function toHtml(sections) {
  return sections.map((s) => {
    let html = '';
    if (s.sectionTitle) html += `<h2>${s.sectionTitle}</h2>`;
    if (s.items && s.items.length) {
      html += '<ul>' + s.items.map((item) => `<li>${item}</li>`).join('') + '</ul>';
    }
    return html;
  }).join('');
}

const CARD_TEMPLATES = {
  regular: {
    benefits: toHtml([
      { sectionTitle: 'Rewards', items: ['Earn reward points on every purchase.', 'Redeem points for cashback, vouchers, or merchandise.', 'Bonus points on supermarket and fuel spends.'] },
      { sectionTitle: 'Payment Flexibility', items: ['Easy payment plan (0% interest) at select merchants.', 'Balance transfer facility at competitive rates.', 'Auto-pay and minimum payment options available.'] },
      { sectionTitle: 'Security & Protection', items: ['Zero liability on unauthorised transactions.', 'Instant SMS and app alerts for every transaction.', 'Card lock/unlock via mobile banking app.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Annual Fee', items: ['Annual fee as per the selected bracket (Free or Paid).', 'Supplementary cards available at reduced or no cost.'] },
      { sectionTitle: 'Eligibility', items: ['Minimum age: 21 years.', 'UAE resident with valid Emirates ID or passport.', 'Minimum monthly salary as per the applicable bracket.', 'Required documents: Emirates ID, passport copy, salary certificate, 3-month bank statement.'] },
      { sectionTitle: 'Key Charges', items: ['Late payment fee: AED 241.50.', 'Over-limit fee: AED 294.25.', 'Cash advance fee: 3% of amount (minimum AED 103.50).', 'Foreign currency transaction fee: 2.99%.'] },
    ]),
  },
  premium: {
    benefits: toHtml([
      { sectionTitle: 'Premium Rewards', items: ['Accelerated rewards points on dining, travel, and luxury retail.', 'Annual bonus points on achieving spending milestones.', 'Points never expire as long as card is active.'] },
      { sectionTitle: 'Travel Privileges', items: ['Complimentary airport lounge access (Priority Pass or equivalent) — up to 6 visits/year.', 'Complimentary travel insurance covering trip cancellation, medical emergency, and lost baggage.', 'Meet & greet airport services at select airports.', 'Forex markup waiver on international transactions.'] },
      { sectionTitle: 'Lifestyle Benefits', items: ['Complimentary golf sessions at select UAE courses.', 'Concierge service 24/7 for dining, travel, and event bookings.', 'Exclusive hotel privileges including room upgrades and late checkout.', 'Access to Visa Infinite / Mastercard World Elite offers.'] },
      { sectionTitle: 'Protection', items: ['Purchase protection and extended warranty on eligible items.', 'Zero liability on unauthorised transactions.', 'Dedicated premium customer service line.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Annual Fee', items: ['Annual fee as per the selected bracket (Free or Paid).', 'Waiver conditions may apply based on annual spend threshold.', 'Supplementary cards available at reduced cost.'] },
      { sectionTitle: 'Eligibility', items: ['Minimum age: 21 years.', 'UAE resident with valid Emirates ID.', 'Minimum monthly salary as per the applicable bracket.', 'Required documents: Emirates ID, passport copy, salary certificate, 3-month bank statement.'] },
      { sectionTitle: 'Key Charges', items: ['Late payment fee: AED 241.50.', 'Over-limit fee: AED 294.25.', 'Cash advance fee: 3% of amount (minimum AED 103.50).', 'Foreign currency transaction fee: waived or reduced for premium tier.'] },
    ]),
  },
  rewards_lifestyle: {
    benefits: toHtml([
      { sectionTitle: 'Cashback & Rewards', items: ['Up to 5% cashback on dining and entertainment.', 'Up to 3% cashback on supermarket and online shopping.', '1% cashback on all other eligible spends.', 'Monthly cashback credited automatically to your account.'] },
      { sectionTitle: 'Lifestyle Offers', items: ['Buy-1-get-1 dining offers at 500+ restaurants across UAE.', 'Discounts at cinemas, theme parks, and entertainment venues.', 'Exclusive access to lifestyle events and brand partnerships.', 'Special discounts at partner gyms and wellness centres.'] },
      { sectionTitle: 'Shopping Benefits', items: ['Additional discounts at partner retail stores and online platforms.', 'Easy payment plan at 0% interest at select merchants.', 'Purchase protection on eligible transactions.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Annual Fee', items: ['Annual fee as per the selected bracket (Free or Paid).', 'Fee waiver possible upon meeting minimum annual spend.'] },
      { sectionTitle: 'Eligibility', items: ['Minimum age: 21 years.', 'UAE resident with valid Emirates ID or passport.', 'Minimum monthly salary as per the applicable bracket.', 'Required documents: Emirates ID, passport copy, salary certificate, 3-month bank statement.'] },
      { sectionTitle: 'Key Charges', items: ['Late payment fee: AED 241.50.', 'Cash advance fee: 3% of amount (minimum AED 103.50).', 'Foreign currency transaction fee: 2.99%.'] },
    ]),
  },
  travel: {
    benefits: toHtml([
      { sectionTitle: 'Airport & Travel', items: ['Unlimited complimentary airport lounge access worldwide (Priority Pass).', 'Complimentary meet & assist at major international airports.', 'Travel inconvenience cover: flight delay, cancellation, and missed connection.', 'Forex markup waiver — spend abroad at no extra charge.'] },
      { sectionTitle: 'Miles & Points', items: ['Earn air miles or travel points on every spend.', 'Accelerated miles on airline and hotel bookings.', 'Miles can be redeemed for flights, upgrades, and hotel stays.', 'Transfer points to leading airline frequent flyer programmes.'] },
      { sectionTitle: 'Travel Insurance', items: ['Comprehensive travel insurance: medical expenses up to USD 500,000.', 'Personal accident cover while travelling.', 'Baggage loss and delay coverage.', 'Emergency card replacement and cash advance abroad.'] },
      { sectionTitle: 'Hotel & Dining', items: ['Preferred hotel rates and complimentary room upgrades.', 'Complimentary breakfast at partner hotel properties.', 'Dining discounts at airport and hotel restaurants.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Annual Fee', items: ['Annual fee as per the selected bracket (Free or Paid).', 'First-year fee waiver may be available.'] },
      { sectionTitle: 'Eligibility', items: ['Minimum age: 21 years.', 'UAE resident with valid Emirates ID.', 'Minimum monthly salary as per the applicable bracket.', 'Required documents: Emirates ID, passport copy, salary certificate, 3-month bank statement.'] },
      { sectionTitle: 'Key Charges', items: ['Late payment fee: AED 241.50.', 'Cash advance fee: 3% of amount (minimum AED 103.50).', 'Foreign currency transaction fee: waived or 1% for this card.'] },
    ]),
  },
  ecommerce: {
    benefits: toHtml([
      { sectionTitle: 'Online Shopping Rewards', items: ['Up to 5% cashback on online purchases.', 'Bonus rewards at major e-commerce platforms (Amazon, Noon, etc.).', 'Additional discounts via card-linked offers at online retailers.'] },
      { sectionTitle: 'Security & Buyer Protection', items: ['3D Secure OTP authentication for every online transaction.', 'Virtual card number generation for safer online payments.', 'Purchase protection on eligible online transactions up to AED 10,000.', 'Dispute resolution support for unauthorised online charges.'] },
      { sectionTitle: 'Convenience', items: ['Easy payment plan at 0% interest at select online merchants.', 'Instant card controls — freeze/unfreeze via app.', 'Tokenisation support for Apple Pay, Google Pay, and Samsung Pay.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Annual Fee', items: ['Annual fee as per the selected bracket (Free or Paid).'] },
      { sectionTitle: 'Eligibility', items: ['Minimum age: 21 years.', 'UAE resident with valid Emirates ID or passport.', 'Minimum monthly salary as per the applicable bracket.', 'Required documents: Emirates ID, passport copy, salary certificate, 3-month bank statement.'] },
      { sectionTitle: 'Key Charges', items: ['Late payment fee: AED 241.50.', 'Cash advance fee: 3% of amount (minimum AED 103.50).', 'Foreign currency transaction fee: 2.99%.'] },
    ]),
  },
  legacy: {
    benefits: toHtml([
      { sectionTitle: 'Core Benefits', items: ['Earn reward points on eligible purchases.', 'Access to easy payment plans at partner merchants.', 'Supplementary cards for family members.'] },
      { sectionTitle: 'Security', items: ['Zero liability on unauthorised transactions.', 'SMS and email transaction alerts.', 'Chip & PIN and contactless payment enabled.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Annual Fee', items: ['Annual fee as per the selected bracket (Free or Paid).'] },
      { sectionTitle: 'Eligibility', items: ['Minimum age: 21 years.', 'UAE resident with valid Emirates ID or passport.', 'Minimum monthly salary as per the applicable bracket.', 'Required documents: Emirates ID, passport copy, salary certificate, 3-month bank statement.'] },
      { sectionTitle: 'Key Charges', items: ['Late payment fee: AED 241.50.', 'Cash advance fee: 3% of amount (minimum AED 103.50).', 'Foreign currency transaction fee: 2.99%.'] },
    ]),
  },
};

const LOAN_TEMPLATES = {
  personal: {
    benefits: toHtml([
      { sectionTitle: 'Key Features', items: ['Competitive interest rates starting from as low as 4.99% per annum (reducing).', 'Loan amounts up to 20x monthly salary.', 'Flexible repayment tenure up to 48 months.', 'Quick approval — decision within 24–48 hours.', 'Top-up facility available after 6 months of clean repayment.'] },
      { sectionTitle: 'Repayment Flexibility', items: ['Fixed monthly instalments for easy budgeting.', 'Option to defer first instalment by up to 90 days.', 'Partial or full early settlement permitted (charges may apply).', 'Direct salary deduction or standing instruction payment options.'] },
      { sectionTitle: 'Additional Benefits', items: ['Free life takaful / insurance cover (subject to terms).', 'No collateral or guarantor required for salaried employees.', 'Dedicated relationship manager for premium customers.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Eligibility Criteria', items: ['Minimum age: 21 years; maximum age at maturity: 65 years (residents), 60 years (non-residents).', 'UAE resident with valid Emirates ID and residence visa.', 'Minimum monthly salary as per the applicable bracket.', 'Salary transfer to the lending bank preferred (non-salary-transfer available at higher rate).', 'Minimum 6 months of employment with current employer.'] },
      { sectionTitle: 'Required Documents', items: ['Emirates ID (original + copy).', 'Passport with valid UAE residence visa.', 'Salary certificate on company letterhead.', '3 months bank statements (salary account).', 'Labour contract or offer letter (for new employees).'] },
      { sectionTitle: 'Fees & Charges', items: ['Processing fee: up to 1% of loan amount (minimum AED 500).', 'Early settlement fee: up to 1% of outstanding balance.', 'Late payment fee: AED 500 per month (or as per bank schedule of charges).', 'Life insurance / takaful premium included in instalment or charged separately.'] },
    ]),
  },
  mortgage: {
    benefits: toHtml([
      { sectionTitle: 'Financing Highlights', items: ['Finance up to 85% of property value for UAE Nationals (80% for expatriates).', 'Competitive fixed rates for initial 1, 3, or 5-year periods.', 'Switches to variable rate (EIBOR-linked) after fixed period.', 'Minimum property value: AED 500,000.', 'Finance available for ready and off-plan properties.'] },
      { sectionTitle: 'Repayment Flexibility', items: ['Repayment tenure up to 25 years.', 'Option to make overpayments during fixed-rate period (limited).', 'Free overpayment of up to 10% of outstanding balance per year.', 'Offset account facility available with select products.'] },
      { sectionTitle: 'Additional Benefits', items: ['Complimentary property valuation.', 'Pre-approval certificate valid for 60–90 days.', 'Life and property insurance bundled into monthly payment.', 'Free re-mortgage / balance transfer from another bank.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Eligibility Criteria', items: ['Minimum age: 21 years; maximum age at loan maturity: 65 years (salaried), 70 years (self-employed).', 'UAE resident or non-resident investor.', 'Minimum monthly income as per the applicable bracket.', 'Debt burden ratio (DBR) must not exceed 50% of monthly income.', 'Property must be in an approved freehold area.'] },
      { sectionTitle: 'Required Documents', items: ['Emirates ID and passport copies.', 'Salary certificate / proof of income (last 3 months payslips).', '6 months bank statements.', 'Property sale and purchase agreement (SPA) or NOC from developer.', 'Valuation report from bank-approved valuer.'] },
      { sectionTitle: 'Fees & Charges', items: ['Processing fee: up to 1% of finance amount (minimum AED 1,000).', 'Property valuation fee: AED 2,500 – AED 3,500.', 'Dubai Land Department (DLD) registration fee: 4% of property value.', 'Mortgage registration fee: 0.25% of finance amount + AED 290 admin fee.', 'Early settlement fee: 3% of outstanding balance (regulatory maximum).', 'Life and property insurance: included in monthly instalment.'] },
    ]),
  },
  investor: {
    benefits: toHtml([
      { sectionTitle: 'Investment Financing', items: ['Finance up to 75% of investment property value (LTV).', 'Suitable for buy-to-let residential and commercial properties.', 'Rental income considered as part of serviceability assessment.', 'Available to UAE residents and eligible non-residents.', 'Finance for multiple investment properties subject to DBR.'] },
      { sectionTitle: 'Repayment Options', items: ['Tenure up to 25 years.', 'Capital & interest (annuity) repayment structure.', 'Interest-only period available for first 1–3 years (select products).', 'Early repayment permitted subject to charges.'] },
      { sectionTitle: 'Additional Benefits', items: ['Competitive variable and fixed-rate options.', 'Dedicated investment property specialist team.', 'Streamlined process for portfolio landlords.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Eligibility Criteria', items: ['Minimum age: 21 years.', 'UAE resident or eligible non-resident investor.', 'Minimum net monthly income as per the applicable bracket.', 'DBR must not exceed 50% of monthly income including rental commitments.', 'Property must be in an approved freehold investment zone.'] },
      { sectionTitle: 'Required Documents', items: ['Emirates ID / passport copies.', '6 months personal and business bank statements.', 'Proof of existing property ownership (if applicable).', 'Tenancy agreements for existing investment properties.', 'Valuation report from bank-approved valuer.'] },
      { sectionTitle: 'Fees & Charges', items: ['Processing fee: up to 1.25% of finance amount.', 'Property valuation fee: AED 2,500 – AED 4,000.', 'DLD registration and mortgage registration fees apply.', 'Early settlement fee: 3% of outstanding balance (regulatory maximum).'] },
    ]),
  },
  business: {
    benefits: toHtml([
      { sectionTitle: 'Business Finance Highlights', items: ['Finance up to AED 5M depending on business turnover and bank policy.', 'Working capital loans, term loans, and overdraft facilities available.', 'Flexible repayment structures aligned to cash-flow cycles.', 'Minimal documentation for established businesses.', 'Fast-track processing for priority SME customers.'] },
      { sectionTitle: 'Use of Funds', items: ['Working capital and day-to-day operational expenses.', 'Purchase of equipment, machinery, or vehicles.', 'Business expansion, fit-out, and renovation.', 'Import / export trade finance facilities.', 'Invoice discounting and supply chain finance.'] },
      { sectionTitle: 'Additional Benefits', items: ['Dedicated business relationship manager.', 'Access to current accounts, trade finance, and FX services.', 'Insurance bundled on request.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Eligibility Criteria', items: ['Business registered and operational in the UAE for minimum 1–2 years.', 'Annual revenue meeting the bank minimum threshold.', 'Valid trade licence and MOA / AOA.', 'Clean credit history for all shareholders.', 'UAE resident shareholders / directors.'] },
      { sectionTitle: 'Required Documents', items: ['Valid trade licence (current year).', 'MOA / AOA / share certificate.', 'Emirates IDs and passports of all shareholders.', '12 months business bank statements.', 'Audited financials or management accounts for last 2 years.', 'VAT returns (if applicable).'] },
      { sectionTitle: 'Fees & Charges', items: ['Processing fee: 1%–2% of facility amount.', 'Annual facility review fee may apply.', 'Early settlement fee: 1%–3% of outstanding balance.', 'Late payment charges as per bank schedule.'] },
    ]),
  },
  auto_loan: {
    benefits: toHtml([
      { sectionTitle: 'Vehicle Finance Highlights', items: ['Finance up to 80% of vehicle value (new) or 70% (used).', 'Competitive flat rates starting from 1.79% per annum.', 'Tenure up to 60 months for new vehicles.', 'Available for new and pre-owned vehicles.', 'Dealer tie-ups for seamless approval at showroom.'] },
      { sectionTitle: 'Repayment Flexibility', items: ['Fixed monthly instalments for easy planning.', 'Balloon payment option to reduce monthly EMI.', 'Early settlement permitted (charges may apply).', 'Option to include comprehensive insurance in finance.'] },
      { sectionTitle: 'Additional Benefits', items: ['Quick approval — same day in many cases.', 'Dedicated auto loan processing desk.', 'Free vehicle valuation for used cars.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Eligibility Criteria', items: ['Minimum age: 21 years.', 'UAE resident with valid Emirates ID and driving licence.', 'Minimum monthly salary as per the applicable bracket.', 'Vehicle must be from an approved brand / dealer list.', 'Used vehicles must not be older than 5 years at time of application.'] },
      { sectionTitle: 'Required Documents', items: ['Emirates ID (original + copy) and passport.', 'Valid UAE driving licence.', 'Salary certificate or payslip.', '3 months bank statements.', 'Vehicle proforma invoice or quotation from dealer.', 'Comprehensive insurance policy (arranged before disbursement).'] },
      { sectionTitle: 'Fees & Charges', items: ['Processing fee: up to 1% of loan amount (minimum AED 500).', 'Early settlement fee: up to 1% of outstanding balance.', 'Late payment fee: AED 500 per month.', 'Comprehensive vehicle insurance compulsory (financed separately or as part of loan).'] },
    ]),
  },
  buyout: {
    benefits: toHtml([
      { sectionTitle: 'Buyout Highlights', items: ['Transfer your existing personal loan to benefit from a lower interest rate.', 'Consolidate multiple loans into one manageable monthly payment.', 'Top-up cash available alongside the buyout amount.', 'No early settlement hassle — bank handles transfer directly.'] },
      { sectionTitle: 'Repayment Flexibility', items: ['Flexible tenure up to 48 months.', 'Fixed monthly instalments.', 'Option to reduce monthly burden by extending tenure.'] },
      { sectionTitle: 'Additional Benefits', items: ['Fast processing — approval within 48 hours.', 'Minimal documentation required.', 'Free life takaful cover (subject to terms).'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Eligibility Criteria', items: ['Minimum age: 21 years.', 'UAE resident with valid Emirates ID.', 'Minimum monthly salary as per the applicable bracket.', 'Existing loan with a UAE-licensed bank or finance company.', 'Minimum 6 months of clean repayment history on existing loan.'] },
      { sectionTitle: 'Required Documents', items: ['Emirates ID and passport copy.', 'Salary certificate.', '3 months bank statements.', 'Existing loan liability letter from current bank.', 'Last 6 months loan account statement.'] },
      { sectionTitle: 'Fees & Charges', items: ['Processing fee: up to 1% of buyout amount.', 'Early settlement fee from existing bank may apply (bank will advise).', 'Late payment fee: AED 500 per month.'] },
    ]),
  },
  fresh: {
    benefits: toHtml([
      { sectionTitle: 'Fresh Loan Highlights', items: ['Designed for first-time borrowers with no UAE credit history.', 'Loan amounts up to 15x monthly salary.', 'Flexible tenure up to 36 months.', 'Competitive rates for new-to-bank customers.'] },
      { sectionTitle: 'Repayment Flexibility', items: ['Fixed monthly instalments.', 'Direct salary deduction available.', 'Option to repay early (charges may apply).'] },
      { sectionTitle: 'Additional Benefits', items: ['Quick approval for new residents.', 'Minimal documentation compared to standard personal loan.', 'Build your UAE credit history with timely payments.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Eligibility Criteria', items: ['Minimum age: 21 years.', 'UAE resident within first 12 months of employment.', 'Valid Emirates ID and residence visa.', 'Minimum monthly salary as per the applicable bracket.', 'Employed with an approved employer.'] },
      { sectionTitle: 'Required Documents', items: ['Emirates ID (original + copy).', 'Passport with valid UAE residence visa.', 'Salary certificate on company letterhead.', '1–3 months bank statements.', 'Employment contract or offer letter.'] },
      { sectionTitle: 'Fees & Charges', items: ['Processing fee: up to 1% of loan amount (minimum AED 500).', 'Early settlement fee: up to 1% of outstanding balance.', 'Late payment fee: AED 500 per month.'] },
    ]),
  },
  pdc: {
    benefits: toHtml([
      { sectionTitle: 'PDC Loan Highlights', items: ['Finance against post-dated cheques (PDCs).', 'Suitable for self-employed individuals and business owners.', 'No salary transfer required.', 'Loan amounts based on PDC value and creditworthiness.'] },
      { sectionTitle: 'Repayment Flexibility', items: ['Repayment via pre-arranged PDCs.', 'Flexible tenure based on cheque schedule.', 'Option to substitute cheques with prior bank approval.'] },
      { sectionTitle: 'Additional Benefits', items: ['Alternative to traditional salary-based lending.', 'Fast processing for established businesses.', 'Dedicated relationship manager.'] },
    ]),
    feesEligibility: toHtml([
      { sectionTitle: 'Eligibility Criteria', items: ['Minimum age: 21 years.', 'UAE resident with valid Emirates ID.', 'Self-employed, business owner, or salaried with PDC facility.', 'Active UAE business bank account.', 'PDCs must be from a UAE-licensed bank.'] },
      { sectionTitle: 'Required Documents', items: ['Emirates ID and passport copy.', 'Trade licence (for self-employed).', '6–12 months bank statements.', 'Post-dated cheques as per agreed schedule.', 'Audited financials or management accounts (if applicable).'] },
      { sectionTitle: 'Fees & Charges', items: ['Processing fee: 1%–2% of facility amount.', 'Cheque return fee: AED 1,000 per returned cheque.', 'Early settlement fee: up to 1% of outstanding balance.', 'Late payment fee as per bank schedule.'] },
    ]),
  },
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Cards
  const cards = await CardProduct.find();
  console.log(`\nCard products: ${cards.length}`);
  let cardUpdated = 0, cardSkipped = 0;
  for (const card of cards) {
    const tpl = CARD_TEMPLATES[card.cardType];
    if (!tpl) {
      console.log(`  SKIP (no template for type "${card.cardType}"): ${card.name}`);
      cardSkipped++;
      continue;
    }
    await CardProduct.updateOne({ _id: card._id }, { $set: { benefits: tpl.benefits, feesEligibility: tpl.feesEligibility } });
    console.log(`  Updated [${card.cardType}]: ${card.name}`);
    cardUpdated++;
  }
  console.log(`Cards — updated: ${cardUpdated}, skipped: ${cardSkipped}`);

  // Loans
  const loans = await LoanProduct.find();
  console.log(`\nLoan products: ${loans.length}`);
  let loanUpdated = 0, loanSkipped = 0;
  for (const loan of loans) {
    const tpl = LOAN_TEMPLATES[loan.loanCategory];
    if (!tpl) {
      console.log(`  SKIP (no template for category "${loan.loanCategory}"): ${loan.name}`);
      loanSkipped++;
      continue;
    }
    await LoanProduct.updateOne({ _id: loan._id }, { $set: { benefits: tpl.benefits, feesEligibility: tpl.feesEligibility } });
    console.log(`  Updated [${loan.loanCategory}]: ${loan.name}`);
    loanUpdated++;
  }
  console.log(`Loans — updated: ${loanUpdated}, skipped: ${loanSkipped}`);

  await mongoose.disconnect();
  console.log('\nDone.');
}

run().catch((err) => { console.error(err); process.exit(1); });
