const LegalPage = require('../models/LegalPage');

const DEFAULTS = [
  {
    slug: 'terms',
    title: 'Terms of Service',
    lastUpdated: new Date('2026-06-01'),
    content: `
<section id="acceptance">
  <h2>1. Acceptance of Terms</h2>
  <p>By accessing or using the MySilah platform ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Platform.</p>
  <p>These Terms constitute a legally binding agreement between you and Silah L.L.C-FZ, a company registered at Meydan FreeZone, Dubai, UAE ("MySilah", "we", "us", or "our").</p>
  <div class="highlight-box"><p>⚠️ Please read these Terms carefully before using the Platform. Your continued use of the Platform constitutes acceptance of any updates to these Terms.</p></div>
</section>

<section id="services">
  <h2>2. Description of Services</h2>
  <p>MySilah operates a premium banking referral infrastructure platform that connects:</p>
  <ul>
    <li>Freelance banking agents seeking to refer financial products</li>
    <li>Partner agencies managing teams of referral agents</li>
    <li>Banks and financial institutions (FIs) seeking qualified leads</li>
  </ul>
  <p>The Platform facilitates the submission, tracking, and management of financial product referrals across the UAE. MySilah does not itself offer, sell, or underwrite any financial products and is not a licensed financial institution.</p>
</section>

<section id="eligibility">
  <h2>3. Eligibility</h2>
  <p>To use the Platform, you must:</p>
  <ul>
    <li>Be at least 21 years of age</li>
    <li>Be a resident or registered business entity in the UAE</li>
    <li>Hold any applicable licences or permits required by UAE law for your role</li>
    <li>Not be barred from receiving services under applicable law</li>
  </ul>
  <p>Referral partners operating through the Platform may be required to hold a valid UAE freelance permit or equivalent authorisation. MySilah reserves the right to verify eligibility at any time.</p>
</section>

<section id="accounts">
  <h2>4. Accounts &amp; Registration</h2>
  <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to:</p>
  <ul>
    <li>Provide accurate and complete registration information</li>
    <li>Update your information promptly if it changes</li>
    <li>Notify us immediately of any unauthorised use of your account</li>
    <li>Not share your credentials with any third party</li>
  </ul>
  <p>MySilah reserves the right to suspend or terminate accounts that violate these Terms or engage in fraudulent activity.</p>
</section>

<section id="referrals">
  <h2>5. Referral Rules</h2>
  <p>MySilah Referral Partners are independent third parties who introduce potential customers to products and services listed on the MySilah platform. Referral Partners are not employees, agents, or representatives of any bank, financial institution, insurance provider, or telecom operator featured on the platform. Referral Partners are not authorised to provide financial advice, make representations regarding product eligibility, or guarantee any application outcome.</p>
  <p>All referrals submitted through the Platform must comply with the following rules:</p>
  <ul>
    <li>Referrals must relate to genuine prospective customers who have provided informed consent</li>
    <li>Agents must not make misleading representations about any financial product</li>
    <li>Referrals must not duplicate leads already submitted by another agent</li>
    <li>Agents must comply with all applicable UAE Central Bank guidelines and anti-money-laundering regulations</li>
  </ul>
  <h3>Data Accuracy</h3>
  <p>Agents are responsible for the accuracy of customer data submitted. Submission of false or incomplete data may result in withholding of incentives and account suspension.</p>
</section>

<section id="fees">
  <h2>6. Fees &amp; Payments</h2>
  <p>Incentive structures, payout schedules, and fee arrangements are governed by the specific agreement entered into between the agent or agency and MySilah. General terms include:</p>
  <ul>
    <li>Incentives are paid upon confirmation of a successful referral by the relevant bank or FI</li>
    <li>Payment timelines vary by product and institution, typically 1–7 days after disbursement</li>
    <li>MySilah may deduct applicable taxes or regulatory charges as required by UAE law</li>
    <li>Disputed incentives must be raised within 30 days of the relevant payout cycle</li>
  </ul>
  <h3>6a. Card Fee — Free*(T&amp;C)</h3>
  <p>Where a card product is marked "Free*(T&amp;C)", the annual fee is waived for the first year only. From the second year onwards, charges will be applied in accordance with the issuing bank's policy. The client must be informed of this before submission.</p>
</section>

<section id="conduct">
  <h2>7. Acceptable Use &amp; Conduct</h2>
  <p>You agree not to use the Platform to:</p>
  <ul>
    <li>Violate any applicable UAE law or regulation</li>
    <li>Engage in fraudulent, deceptive, or misleading conduct</li>
    <li>Harass, abuse, or harm any other user or customer</li>
    <li>Upload malicious code or attempt to compromise platform security</li>
    <li>Scrape, copy, or redistribute Platform data without written consent</li>
  </ul>
</section>

<section id="ip">
  <h2>8. Intellectual Property</h2>
  <p>All content, trademarks, logos, and software on the Platform are the property of MySilah or its licensors. You are granted a limited, non-exclusive, non-transferable licence to access and use the Platform for its intended purpose.</p>
  <p>You may not reproduce, distribute, or create derivative works from any Platform content without prior written permission.</p>
</section>

<section id="liability">
  <h2>9. Limitation of Liability</h2>
  <p>To the fullest extent permitted by UAE law, MySilah shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform, including loss of profits, data, or business opportunities.</p>
  <p>Our total liability to you for any claim arising under these Terms shall not exceed the total fees paid by you to MySilah in the three (3) months preceding the claim.</p>
</section>

<section id="termination">
  <h2>10. Termination</h2>
  <p>Either party may terminate access to the Platform with 30 days' written notice. MySilah may terminate or suspend access immediately if you breach these Terms, engage in fraudulent activity, or if required by applicable law.</p>
  <p>Upon termination, your right to use the Platform ceases immediately. Accrued incentives for confirmed referrals prior to termination will be paid per the standard schedule.</p>
</section>

<section id="governing">
  <h2>11. Governing Law</h2>
  <p>These Terms are governed by the laws of Dubai, UAE. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the Dubai Courts, UAE.</p>
</section>

<section id="contact">
  <h2>12. Contact Us</h2>
  <p>For questions regarding these Terms, please contact:</p>
  <div class="highlight-box">
    <p><strong>Silah L.L.C-FZ</strong><br>Meydan FreeZone, Dubai, United Arab Emirates<br>Email: support@mysilah.ae</p>
  </div>
</section>
`.trim(),
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    lastUpdated: new Date('2026-06-01'),
    content: `
<section id="overview">
  <h2>1. Overview</h2>
  <p>Silah L.L.C-FZ ("MySilah", "we", "us") is committed to protecting your personal data. This Privacy Policy explains how we collect, use, share, and safeguard information when you use the MySilah Platform.</p>
  <p>This policy applies to all users of the Platform including referral partners, partner agencies, bank representatives, and prospective customers whose data is submitted as part of a referral.</p>
  <div class="highlight-box"><p>🔒 MySilah does not sell personal data to third parties. Your data is used solely for the operation and improvement of the Platform and the referral services it enables.</p></div>
</section>

<section id="collect">
  <h2>2. Data We Collect</h2>
  <table class="data-table">
    <tr><th>Category</th><th>Examples</th><th>Source</th></tr>
    <tr><td>Identity</td><td>Full name, Emirates ID, passport number</td><td>Registration / agent submission</td></tr>
    <tr><td>Contact</td><td>Email, phone, address</td><td>Registration / referral form</td></tr>
    <tr><td>Financial</td><td>Bank account details, salary information</td><td>Referral submissions</td></tr>
    <tr><td>Professional</td><td>Employer, job title, licence numbers</td><td>Agent profile / KYC</td></tr>
    <tr><td>Usage</td><td>Login activity, pages visited, referral history</td><td>Platform analytics</td></tr>
    <tr><td>Device</td><td>IP address, browser type, device ID</td><td>Automatic collection</td></tr>
  </table>
</section>

<section id="use">
  <h2>3. How We Use Your Data</h2>
  <p>We use collected data to:</p>
  <ul>
    <li>Operate and deliver the Platform's referral services</li>
    <li>Verify agent and agency eligibility and compliance</li>
    <li>Process and track referral submissions with banks and FIs</li>
    <li>Calculate and process incentive payments</li>
    <li>Communicate updates, policy changes, and account notifications</li>
    <li>Comply with UAE legal and regulatory obligations</li>
    <li>Detect and prevent fraud and unauthorised access</li>
    <li>Improve Platform features and user experience</li>
  </ul>
</section>

<section id="sharing">
  <h2>4. Data Sharing</h2>
  <p>We share personal data only in the following circumstances:</p>
  <h3>With Banks &amp; Financial Institutions</h3>
  <p>Customer referral data is shared with the relevant bank or FI to process the application. Only the data necessary for the application is shared.</p>
  <h3>With Service Providers</h3>
  <p>We engage trusted third-party providers for hosting, analytics, and payment processing, all bound by data processing agreements.</p>
  <h3>Legal Requirements</h3>
  <p>We may disclose data where required by UAE law, regulatory authorities (including the UAE Central Bank), or court order.</p>
</section>

<section id="retention">
  <h2>5. Data Retention</h2>
  <p>We retain personal data for as long as necessary to fulfil the purposes outlined in this policy, and in any case for a minimum of 5 years as required by UAE anti-money-laundering regulations. After this period, data is securely deleted or anonymised.</p>
</section>

<section id="rights">
  <h2>6. Your Rights</h2>
  <p>Under applicable UAE data protection law, you have the right to:</p>
  <ul>
    <li>Access the personal data we hold about you</li>
    <li>Request correction of inaccurate data</li>
    <li>Request deletion of data (subject to legal retention requirements)</li>
    <li>Object to certain processing activities</li>
    <li>Withdraw consent where processing is consent-based</li>
  </ul>
  <p>To exercise any of these rights, contact us at support@mysilah.ae. We will respond within 30 days.</p>
</section>

<section id="security">
  <h2>7. Security</h2>
  <p>We implement industry-standard security measures including TLS encryption, access controls, and regular security audits. However, no system is completely secure and we cannot guarantee absolute security of data transmitted over the internet.</p>
</section>

<section id="children">
  <h2>8. Children</h2>
  <p>The Platform is not directed at individuals under the age of 21. We do not knowingly collect personal data from minors. If you believe a minor has submitted data through the Platform, please contact us immediately.</p>
</section>

<section id="updates">
  <h2>9. Policy Updates</h2>
  <p>We may update this Privacy Policy from time to time. Material changes will be notified via email or a prominent notice on the Platform at least 14 days before taking effect. Continued use of the Platform after the effective date constitutes acceptance of the updated policy.</p>
</section>

<section id="contact">
  <h2>10. Contact</h2>
  <div class="highlight-box">
    <p><strong>Data Protection Officer</strong><br>Silah L.L.C-FZ<br>Meydan FreeZone, Dubai, United Arab Emirates<br>Email: support@mysilah.ae</p>
  </div>
</section>
`.trim(),
  },
  {
    slug: 'cookie-policy',
    title: 'Cookies Policy',
    lastUpdated: new Date('2026-06-01'),
    content: `
<section id="what">
  <h2>1. What Are Cookies?</h2>
  <p>Cookies are small text files placed on your device when you visit a website. They allow the site to recognise your device, remember your preferences, and provide a more personalised experience.</p>
  <p>We also use similar technologies such as web beacons, pixel tags, and local storage. References to "cookies" in this policy include these similar technologies.</p>
  <div class="highlight-box"><p>🍪 The MySilah Platform only sets cookies if you accept them via the cookie banner shown on your first visit. You can change your choice at any time using the "Cookie settings" button, or via your browser settings.</p></div>
</section>

<section id="types">
  <h2>2. Types of Cookies We Use</h2>
  <div class="cookie-toggle">
    <div class="cookie-item">
      <div class="cookie-item-info">
        <h4>Strictly Necessary <span class="badge badge-required">Not Used</span></h4>
        <p>The MySilah Platform does not currently set any strictly-necessary cookies. Signing in does not rely on a cookie — your session is kept using your browser's local storage instead, which is not a cookie and is not shared with any third party.</p>
      </div>
    </div>
    <div class="cookie-item">
      <div class="cookie-item-info">
        <h4>Performance &amp; Analytics <span class="badge badge-optional">Optional</span></h4>
        <p>The only cookies we use are set by Google Analytics, and only after you accept them via the cookie banner shown when you first visit the site. They help us understand which pages are visited and how we can improve the Platform. You can accept or reject them at any time using the "Cookie settings" button.</p>
      </div>
    </div>
    <div class="cookie-item">
      <div class="cookie-item-info">
        <h4>Functional &amp; Marketing <span class="badge badge-optional">Not Used</span></h4>
        <p>We do not currently use functional or marketing/advertising cookies of any kind.</p>
      </div>
    </div>
  </div>
</section>

<section id="list">
  <h2>3. Cookie List</h2>
  <table class="cookie-table">
    <tr><th>Name</th><th>Type</th><th>Duration</th><th>Purpose</th></tr>
    <tr><td>_ga</td><td>Analytics (Google)</td><td>2 years</td><td>Google Analytics — distinguishes users, set only if you accept cookies</td></tr>
    <tr><td>_gid</td><td>Analytics (Google)</td><td>24 hours</td><td>Google Analytics — distinguishes users, set only if you accept cookies</td></tr>
  </table>
  <p>These are the only cookies the MySilah Platform sets. No other first-party or third-party cookie is used.</p>
</section>

<section id="third-party">
  <h2>4. Third-Party Cookies</h2>
  <p>We use one trusted third-party service that may place cookies on your device, and only with your consent:</p>
  <ul>
    <li><strong>Google Analytics</strong> — web analytics (opt-out available via Google's opt-out tool, or by rejecting cookies via our on-site banner)</li>
  </ul>
  <p>Google has its own privacy and cookie policy. We encourage you to review it.</p>
</section>

<section id="control">
  <h2>5. Your Choices</h2>
  <p>The primary way to control cookies on the MySilah Platform is the cookie banner shown on your first visit, or the "🍪 Cookie settings" button available at any time afterward — use it to accept or reject Google Analytics cookies. You can also control cookies through your browser settings, which let you:</p>
  <ul>
    <li>View and delete existing cookies</li>
    <li>Block all or certain cookies</li>
    <li>Set preferences for specific websites</li>
  </ul>
  <p>Since the Platform does not rely on cookies for login or core functionality, rejecting or blocking cookies will not prevent you from signing in or using the Platform.</p>
  <h3>Opt-Out Links</h3>
  <ul>
    <li>Google Analytics: tools.google.com/dlpage/gaoptout</li>
  </ul>
</section>

<section id="updates">
  <h2>6. Updates to This Policy</h2>
  <p>We may update this Cookies Policy as our use of cookies changes. Material updates will be communicated via a notice on the Platform. The "last updated" date at the top of this page reflects the most recent revision.</p>
</section>

<section id="contact">
  <h2>7. Contact</h2>
  <div class="highlight-box">
    <p><strong>Silah L.L.C-FZ</strong><br>Meydan FreeZone, Dubai, United Arab Emirates<br>Email: support@mysilah.ae</p>
  </div>
</section>
`.trim(),
  },
  {
    slug: 'data-policy',
    title: 'Data Policy',
    lastUpdated: new Date('2026-06-01'),
    content: `
<section id="principles">
  <h2>1. Our Data Principles</h2>
  <p>MySilah is committed to responsible data stewardship. We process personal data in accordance with applicable UAE data protection law, including Federal Decree-Law No. 45 of 2021 on Personal Data Protection.</p>
  <div class="principle-grid">
    <div class="principle-card">
      <div class="icon">🎯</div>
      <h4>Purpose Limitation</h4>
      <p>Data is collected for specific, explicit purposes and not processed beyond those purposes.</p>
    </div>
    <div class="principle-card">
      <div class="icon">⚖️</div>
      <h4>Data Minimisation</h4>
      <p>We collect only data that is adequate, relevant, and limited to what is necessary.</p>
    </div>
    <div class="principle-card">
      <div class="icon">✅</div>
      <h4>Accuracy</h4>
      <p>We take reasonable steps to ensure data is accurate and kept up to date.</p>
    </div>
    <div class="principle-card">
      <div class="icon">🔒</div>
      <h4>Security</h4>
      <p>Appropriate technical and organisational measures protect data at all times.</p>
    </div>
    <div class="principle-card">
      <div class="icon">🗓️</div>
      <h4>Storage Limitation</h4>
      <p>Data is retained only for as long as necessary and then securely deleted.</p>
    </div>
    <div class="principle-card">
      <div class="icon">📋</div>
      <h4>Accountability</h4>
      <p>We maintain records of processing activities and are responsible for demonstrating compliance.</p>
    </div>
  </div>
</section>

<section id="controller">
  <h2>2. Data Controller</h2>
  <p>Silah L.L.C-FZ is the data controller for personal data processed through the Platform. We determine the purposes and means of processing and are responsible for compliance with applicable data protection law.</p>
  <p>Where partner agencies use the Platform to manage their agents, they may act as independent data controllers in respect of their agents' personal data. Each party is responsible for its own compliance obligations.</p>
</section>

<section id="lawful">
  <h2>3. Lawful Basis for Processing</h2>
  <p>We rely on the following lawful bases for processing personal data:</p>
  <ul>
    <li><strong>Contract performance</strong> — processing necessary to deliver the Platform services and manage referral agreements</li>
    <li><strong>Legal obligation</strong> — processing required by UAE law, including AML/KYC obligations and regulatory reporting</li>
    <li><strong>Legitimate interests</strong> — fraud prevention, platform security, and analytics to improve services</li>
    <li><strong>Consent</strong> — for optional communications, marketing, and non-essential cookies</li>
  </ul>
  <p>Where we rely on consent, you have the right to withdraw consent at any time without affecting the lawfulness of prior processing.</p>
</section>

<section id="referral-data">
  <h2>4. Referral Data Handling</h2>
  <p>The Platform involves submission of customer personal data by agents as part of financial product referrals. The following standards apply:</p>
  <h3>Consent Requirements</h3>
  <p>Agents must obtain explicit informed consent from customers before submitting their data to the Platform. Consent records must be retained and may be audited by MySilah or the relevant bank.</p>
  <h3>Data Accuracy</h3>
  <p>Agents are responsible for the accuracy of data submitted. MySilah will pass referral data to banks and FIs as submitted. Correction of inaccurate referral data must be requested promptly.</p>
  <h3>Customer Rights</h3>
  <p>Customers whose data has been submitted may exercise rights directly with MySilah by contacting support@mysilah.ae. We will liaise with the relevant agent and bank to fulfil such requests.</p>
</section>

<section id="transfers">
  <h2>5. International Data Transfers</h2>
  <p>MySilah operates primarily within the UAE. Where data is processed or stored outside the UAE, we ensure appropriate safeguards are in place including:</p>
  <ul>
    <li>Standard contractual clauses approved by the UAE Data Office</li>
    <li>Transfers only to jurisdictions with adequate data protection standards</li>
    <li>Data processing agreements with all international sub-processors</li>
  </ul>
</section>

<section id="processors">
  <h2>6. Sub-Processors</h2>
  <p>We engage trusted sub-processors to support Platform operations. All sub-processors are bound by data processing agreements and may only process data as instructed by MySilah.</p>
  <p>A current list of sub-processors is available on request. We will provide 30 days' notice of any material changes to our sub-processor arrangements.</p>
</section>

<section id="breach">
  <h2>7. Data Breach Procedures</h2>
  <p>In the event of a personal data breach, MySilah will:</p>
  <ul>
    <li>Assess the breach within 24 hours of detection</li>
    <li>Notify the UAE Data Office within 72 hours where required by law</li>
    <li>Notify affected individuals without undue delay where the breach poses a high risk</li>
    <li>Document the breach, its effects, and remedial measures taken</li>
  </ul>
  <p>To report a suspected data breach, contact support@mysilah.ae immediately.</p>
</section>

<section id="dpia">
  <h2>8. Data Protection Impact Assessments</h2>
  <p>We conduct Data Protection Impact Assessments (DPIAs) for new or changed processing activities that are likely to result in high risk to individuals, including large-scale processing of sensitive financial data. DPIAs are reviewed annually and updated as needed.</p>
</section>

<section id="compliance">
  <h2>9. Regulatory Compliance</h2>
  <p>MySilah's data practices are designed to comply with:</p>
  <ul>
    <li>UAE Federal Decree-Law No. 45 of 2021 on Personal Data Protection</li>
    <li>UAE Central Bank Consumer Protection Regulations</li>
    <li>UAE AML/CFT Federal Decree-Law No. 20 of 2018</li>
  </ul>
  <p>We conduct annual compliance reviews and maintain a register of processing activities as required by applicable law.</p>
</section>

<section id="contact">
  <h2>10. Contact</h2>
  <p>For data policy enquiries, to exercise your rights, or to report a concern:</p>
  <div class="highlight-box">
    <p><strong>Data Protection Officer</strong><br>Silah L.L.C-FZ<br>Meydan FreeZone, Dubai, United Arab Emirates<br>Email: support@mysilah.ae<br>Security incidents: support@mysilah.ae</p>
  </div>
</section>
`.trim(),
  },
];

exports.ensureDefaults = async () => {
  for (const page of DEFAULTS) {
    await LegalPage.updateOne({ slug: page.slug }, { $setOnInsert: page }, { upsert: true });
  }
};

exports.list = async (req, res) => {
  try {
    const pages = await LegalPage.find().sort('slug').lean();
    res.json(pages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const page = await LegalPage.findOne({ slug: req.params.slug }).lean();
    if (!page) return res.status(404).json({ message: 'Page not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { title, content, lastUpdated } = req.body;
    const update = {};
    if (title       !== undefined) update.title       = title;
    if (content     !== undefined) update.content     = content;
    if (lastUpdated !== undefined) update.lastUpdated = new Date(lastUpdated);
    const page = await LegalPage.findOneAndUpdate(
      { slug: req.params.slug },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!page) return res.status(404).json({ message: 'Page not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
