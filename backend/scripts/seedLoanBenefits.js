require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const LoanProduct = require('../models/LoanProduct');

const BENEFITS_BY_CATEGORY = {
  personal: {
    benefits: [
      {
        sectionTitle: 'Key Features',
        items: [
          'Competitive interest rates starting from as low as 4.99% per annum (reducing).',
          'Loan amounts up to 20x monthly salary.',
          'Flexible repayment tenure up to 48 months.',
          'Quick approval — decision within 24–48 hours.',
          'Top-up facility available after 6 months of clean repayment.',
        ],
      },
      {
        sectionTitle: 'Repayment Flexibility',
        items: [
          'Fixed monthly instalments for easy budgeting.',
          'Option to defer first instalment by up to 90 days.',
          'Partial or full early settlement permitted (charges may apply).',
          'Direct salary deduction or standing instruction payment options.',
        ],
      },
      {
        sectionTitle: 'Additional Benefits',
        items: [
          'Free life takaful / insurance cover (subject to terms).',
          'No collateral or guarantor required for salaried employees.',
          'Dedicated relationship manager for premium customers.',
        ],
      },
    ],
    feesEligibility: [
      {
        sectionTitle: 'Eligibility Criteria',
        items: [
          'Minimum age: 21 years; maximum age at maturity: 65 years (residents), 60 years (non-residents).',
          'UAE resident with valid Emirates ID and residence visa.',
          'Minimum monthly salary as per the applicable bracket.',
          'Salary transfer to the lending bank preferred (non-salary-transfer available at higher rate).',
          'Minimum 6 months of employment with current employer.',
        ],
      },
      {
        sectionTitle: 'Required Documents',
        items: [
          'Emirates ID (original + copy).',
          'Passport with valid UAE residence visa.',
          'Salary certificate on company letterhead.',
          '3 months bank statements (salary account).',
          'Labour contract or offer letter (for new employees).',
        ],
      },
      {
        sectionTitle: 'Fees & Charges',
        items: [
          'Processing fee: up to 1% of loan amount (minimum AED 500).',
          'Early settlement fee: up to 1% of outstanding balance.',
          'Late payment fee: AED 500 per month (or as per bank schedule of charges).',
          'Life insurance / takaful premium included in instalment or charged separately.',
        ],
      },
    ],
  },

  mortgage: {
    benefits: [
      {
        sectionTitle: 'Financing Highlights',
        items: [
          'Finance up to 85% of property value for UAE Nationals (80% for expatriates).',
          'Competitive fixed rates for initial 1, 3, or 5-year periods.',
          'Switches to variable rate (EIBOR-linked) after fixed period.',
          'Minimum property value: AED 500,000.',
          'Finance available for ready and off-plan properties.',
        ],
      },
      {
        sectionTitle: 'Repayment Flexibility',
        items: [
          'Repayment tenure up to 25 years.',
          'Option to make overpayments during fixed-rate period (limited).',
          'Free overpayment of up to 10% of outstanding balance per year.',
          'Offset account facility available with select products.',
        ],
      },
      {
        sectionTitle: 'Additional Benefits',
        items: [
          'Complimentary property valuation.',
          'Pre-approval certificate valid for 60–90 days.',
          'Life and property insurance bundled into monthly payment.',
          'Free re-mortgage / balance transfer from another bank.',
        ],
      },
    ],
    feesEligibility: [
      {
        sectionTitle: 'Eligibility Criteria',
        items: [
          'Minimum age: 21 years; maximum age at loan maturity: 65 years (salaried), 70 years (self-employed).',
          'UAE resident or non-resident investor.',
          'Minimum monthly income as per the applicable bracket.',
          'Debt burden ratio (DBR) must not exceed 50% of monthly income.',
          'Property must be in an approved freehold area.',
        ],
      },
      {
        sectionTitle: 'Required Documents',
        items: [
          'Emirates ID and passport copies.',
          'Salary certificate / proof of income (last 3 months payslips).',
          '6 months bank statements.',
          'Property sale and purchase agreement (SPA) or NOC from developer.',
          'Valuation report from bank-approved valuer.',
        ],
      },
      {
        sectionTitle: 'Fees & Charges',
        items: [
          'Processing fee: up to 1% of finance amount (minimum AED 1,000).',
          'Property valuation fee: AED 2,500 – AED 3,500.',
          'Dubai Land Department (DLD) registration fee: 4% of property value.',
          'Mortgage registration fee: 0.25% of finance amount + AED 290 admin fee.',
          'Early settlement fee: 3% of outstanding balance (regulatory maximum).',
          'Life and property insurance: included in monthly instalment.',
        ],
      },
    ],
  },

  investor: {
    benefits: [
      {
        sectionTitle: 'Investment Financing',
        items: [
          'Finance up to 75% of investment property value (LTV).',
          'Suitable for buy-to-let residential and commercial properties.',
          'Rental income considered as part of serviceability assessment.',
          'Available to UAE residents and eligible non-residents.',
          'Finance for multiple investment properties subject to DBR.',
        ],
      },
      {
        sectionTitle: 'Repayment Options',
        items: [
          'Tenure up to 25 years.',
          'Capital & interest (annuity) repayment structure.',
          'Interest-only period available for first 1–3 years (select products).',
          'Early repayment permitted subject to charges.',
        ],
      },
      {
        sectionTitle: 'Additional Benefits',
        items: [
          'Competitive variable and fixed-rate options.',
          'Dedicated investment property specialist team.',
          'Streamlined process for portfolio landlords.',
        ],
      },
    ],
    feesEligibility: [
      {
        sectionTitle: 'Eligibility Criteria',
        items: [
          'Minimum age: 21 years.',
          'UAE resident or eligible non-resident investor.',
          'Minimum net monthly income as per the applicable bracket.',
          'DBR must not exceed 50% of monthly income including rental commitments.',
          'Property must be in an approved freehold investment zone.',
        ],
      },
      {
        sectionTitle: 'Required Documents',
        items: [
          'Emirates ID / passport copies.',
          '6 months personal and business bank statements.',
          'Proof of existing property ownership (if applicable).',
          'Tenancy agreements for existing investment properties.',
          'Valuation report from bank-approved valuer.',
        ],
      },
      {
        sectionTitle: 'Fees & Charges',
        items: [
          'Processing fee: up to 1.25% of finance amount.',
          'Property valuation fee: AED 2,500 – AED 4,000.',
          'DLD registration and mortgage registration fees apply.',
          'Early settlement fee: 3% of outstanding balance (regulatory maximum).',
        ],
      },
    ],
  },

  business: {
    benefits: [
      {
        sectionTitle: 'Business Finance Highlights',
        items: [
          'Finance up to AED 5M depending on business turnover and bank policy.',
          'Working capital loans, term loans, and overdraft facilities available.',
          'Flexible repayment structures aligned to cash-flow cycles.',
          'Minimal documentation for established businesses.',
          'Fast-track processing for priority SME customers.',
        ],
      },
      {
        sectionTitle: 'Use of Funds',
        items: [
          'Working capital and day-to-day operational expenses.',
          'Purchase of equipment, machinery, or vehicles.',
          'Business expansion, fit-out, and renovation.',
          'Import / export trade finance facilities.',
          'Invoice discounting and supply chain finance.',
        ],
      },
      {
        sectionTitle: 'Additional Benefits',
        items: [
          'Dedicated business relationship manager.',
          'Access to current accounts, trade finance, and FX services.',
          'Insurance bundled on request.',
        ],
      },
    ],
    feesEligibility: [
      {
        sectionTitle: 'Eligibility Criteria',
        items: [
          'Business registered and operational in the UAE for minimum 1–2 years.',
          'Annual revenue meeting the bank minimum threshold.',
          'Valid trade licence and MOA / AOA.',
          'Clean credit history for all shareholders.',
          'UAE resident shareholders / directors.',
        ],
      },
      {
        sectionTitle: 'Required Documents',
        items: [
          'Valid trade licence (current year).',
          'MOA / AOA / share certificate.',
          'Emirates IDs and passports of all shareholders.',
          '12 months business bank statements.',
          'Audited financials or management accounts for last 2 years.',
          'VAT returns (if applicable).',
        ],
      },
      {
        sectionTitle: 'Fees & Charges',
        items: [
          'Processing fee: 1%–2% of facility amount.',
          'Annual facility review fee may apply.',
          'Early settlement fee: 1%–3% of outstanding balance.',
          'Late payment charges as per bank schedule.',
        ],
      },
    ],
  },

  auto_loan: {
    benefits: [
      {
        sectionTitle: 'Vehicle Finance Highlights',
        items: [
          'Finance up to 80% of vehicle value (new) or 70% (used).',
          'Competitive flat rates starting from 1.79% per annum.',
          'Tenure up to 60 months for new vehicles.',
          'Available for new and pre-owned vehicles.',
          'Dealer tie-ups for seamless approval at showroom.',
        ],
      },
      {
        sectionTitle: 'Repayment Flexibility',
        items: [
          'Fixed monthly instalments for easy planning.',
          'Balloon payment option to reduce monthly EMI.',
          'Early settlement permitted (charges may apply).',
          'Option to include comprehensive insurance in finance.',
        ],
      },
      {
        sectionTitle: 'Additional Benefits',
        items: [
          'Quick approval — same day in many cases.',
          'Dedicated auto loan processing desk.',
          'Free vehicle valuation for used cars.',
        ],
      },
    ],
    feesEligibility: [
      {
        sectionTitle: 'Eligibility Criteria',
        items: [
          'Minimum age: 21 years.',
          'UAE resident with valid Emirates ID and driving licence.',
          'Minimum monthly salary as per the applicable bracket.',
          'Vehicle must be from an approved brand / dealer list.',
          'Used vehicles must not be older than 5 years at time of application.',
        ],
      },
      {
        sectionTitle: 'Required Documents',
        items: [
          'Emirates ID (original + copy) and passport.',
          'Valid UAE driving licence.',
          'Salary certificate or payslip.',
          '3 months bank statements.',
          'Vehicle proforma invoice or quotation from dealer.',
          'Comprehensive insurance policy (arranged before disbursement).',
        ],
      },
      {
        sectionTitle: 'Fees & Charges',
        items: [
          'Processing fee: up to 1% of loan amount (minimum AED 500).',
          'Early settlement fee: up to 1% of outstanding balance.',
          'Late payment fee: AED 500 per month.',
          'Comprehensive vehicle insurance compulsory (financed separately or as part of loan).',
        ],
      },
    ],
  },
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const loans = await LoanProduct.find();
  console.log(`Found ${loans.length} loan product(s)`);

  let updated = 0;
  let skipped = 0;

  for (const loan of loans) {
    const alreadyHasContent = (loan.benefits && loan.benefits.length > 0) ||
                              (loan.feesEligibility && loan.feesEligibility.length > 0);
    if (alreadyHasContent) {
      console.log(`  SKIP (already has content): ${loan.name}`);
      skipped++;
      continue;
    }

    const template = BENEFITS_BY_CATEGORY[loan.loanCategory];
    if (!template) {
      console.log(`  SKIP (no template for category "${loan.loanCategory}"): ${loan.name}`);
      skipped++;
      continue;
    }

    loan.benefits = template.benefits;
    loan.feesEligibility = template.feesEligibility;
    await loan.save();
    console.log(`  Updated [${loan.loanCategory}]: ${loan.name}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
