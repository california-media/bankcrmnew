# Nationality Dropdown + Card Image Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-text nationality input with searchable dropdown, and display card images when agent selects a card product (thumbnail in submit form, zoomable preview in lead detail).

**Architecture:** Pure frontend changes — two files modified. Nationality list is a static array co-located in SubmitLead.jsx. Card image uses the same URL pattern already established in admin CardProducts.jsx (`${API_BASE}/uploads/card-images/${filename}`). No backend changes needed.

**Tech Stack:** React, Ant Design (Select, Image, Descriptions), Vite env vars

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/pages/agent/SubmitLead.jsx` | Add NATIONALITIES array, replace Input→Select for nationality, add `API_BASE` const, add card image thumbnail after card selection |
| `frontend/src/pages/leads/LeadDetail.jsx` | Add `Image` to antd imports, add card image preview in Product card section |

---

### Task 1: Add nationality dropdown in SubmitLead.jsx

**Files:**
- Modify: `frontend/src/pages/agent/SubmitLead.jsx`

- [ ] **Step 1: Add NATIONALITIES constant and API_BASE near top of file (after imports, before `function buildBracketOptions`)**

Replace the line:
```jsx
const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;
```

With:
```jsx
const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const NATIONALITIES = [
  'Afghan', 'Albanian', 'Algerian', 'American', 'Andorran', 'Angolan', 'Antiguan',
  'Argentine', 'Armenian', 'Australian', 'Austrian', 'Azerbaijani', 'Bahamian',
  'Bahraini', 'Bangladeshi', 'Barbadian', 'Belarusian', 'Belgian', 'Belizean',
  'Beninese', 'Bhutanese', 'Bolivian', 'Bosnian', 'Botswanan', 'Brazilian',
  'British', 'Bruneian', 'Bulgarian', 'Burkinabe', 'Burundian', 'Cambodian',
  'Cameroonian', 'Canadian', 'Cape Verdean', 'Central African', 'Chadian',
  'Chilean', 'Chinese', 'Colombian', 'Comorian', 'Congolese', 'Costa Rican',
  'Croatian', 'Cuban', 'Cypriot', 'Czech', 'Danish', 'Djiboutian', 'Dominican',
  'Dutch', 'East Timorese', 'Ecuadorian', 'Egyptian', 'Emirati', 'Equatorial Guinean',
  'Eritrean', 'Estonian', 'Eswatini', 'Ethiopian', 'Fijian', 'Finnish', 'French',
  'Gabonese', 'Gambian', 'Georgian', 'German', 'Ghanaian', 'Greek', 'Grenadian',
  'Guatemalan', 'Guinean', 'Guinea-Bissauan', 'Guyanese', 'Haitian', 'Honduran',
  'Hungarian', 'Icelandic', 'Indian', 'Indonesian', 'Iranian', 'Iraqi', 'Irish',
  'Israeli', 'Italian', 'Ivorian', 'Jamaican', 'Japanese', 'Jordanian',
  'Kazakhstani', 'Kenyan', 'Kiribati', 'Korean', 'Kuwaiti', 'Kyrgyzstani',
  'Laotian', 'Latvian', 'Lebanese', 'Lesotho', 'Liberian', 'Libyan',
  'Liechtenstein', 'Lithuanian', 'Luxembourgish', 'Macedonian', 'Malagasy',
  'Malawian', 'Malaysian', 'Maldivian', 'Malian', 'Maltese', 'Marshallese',
  'Mauritanian', 'Mauritian', 'Mexican', 'Micronesian', 'Moldovan', 'Monacan',
  'Mongolian', 'Montenegrin', 'Moroccan', 'Mozambican', 'Myanmar', 'Namibian',
  'Nauruan', 'Nepali', 'New Zealander', 'Nicaraguan', 'Nigerian', 'Nigerien',
  'Norwegian', 'Omani', 'Pakistani', 'Palauan', 'Palestinian', 'Panamanian',
  'Papua New Guinean', 'Paraguayan', 'Peruvian', 'Philippine', 'Polish',
  'Portuguese', 'Qatari', 'Romanian', 'Russian', 'Rwandan', 'Salvadoran',
  'Samoan', 'Saudi Arabian', 'Senegalese', 'Serbian', 'Seychellois',
  'Sierra Leonean', 'Singaporean', 'Slovak', 'Slovenian', 'Solomon Islander',
  'Somali', 'South African', 'South Sudanese', 'Spanish', 'Sri Lankan',
  'Sudanese', 'Surinamese', 'Swedish', 'Swiss', 'Syrian', 'Taiwanese',
  'Tajikistani', 'Tanzanian', 'Thai', 'Togolese', 'Tongan', 'Trinidadian',
  'Tunisian', 'Turkish', 'Turkmenistani', 'Tuvaluan', 'Ugandan', 'Ukrainian',
  'Uruguayan', 'Uzbekistani', 'Vanuatuan', 'Venezuelan', 'Vietnamese', 'Yemeni',
  'Zambian', 'Zimbabwean',
].map((n) => ({ value: n, label: n }));
```

- [ ] **Step 2: Replace nationality Input with Select (SubmitLead.jsx ~line 203-207)**

Replace:
```jsx
            <Col xs={24} md={12}>
              <Form.Item name="nationality" label="Nationality (optional)">
                <Input placeholder="e.g. Pakistani" />
              </Form.Item>
            </Col>
```

With:
```jsx
            <Col xs={24} md={12}>
              <Form.Item name="nationality" label="Nationality (optional)">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select nationality"
                  options={NATIONALITIES}
                  filterOption={(input, opt) =>
                    opt.label.toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
```

- [ ] **Step 3: Verify `Input` is still used elsewhere in file — if not, it can be removed from imports. Check:**

Run: search file for `<Input` — it is used for customerName, phone, email, companyName, jobTitle so keep the import.

- [ ] **Step 4: Start dev server and verify nationality field shows searchable dropdown**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm/frontend"
npm run dev
```

Navigate to agent submit lead page. Nationality field should show dropdown with search.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/agent/SubmitLead.jsx
git commit -m "feat: replace nationality text input with searchable dropdown"
```

---

### Task 2: Show card image thumbnail in SubmitLead.jsx after card selection

**Files:**
- Modify: `frontend/src/pages/agent/SubmitLead.jsx`

- [ ] **Step 1: Update card selection Descriptions block (~line 266-273) to include card image**

Replace:
```jsx
              {selectedCard && (
                <Descriptions size="small" bordered style={{ marginBottom: 12 }}>
                  <Descriptions.Item label="Bank">{selectedCard.bank?.name}</Descriptions.Item>
                  <Descriptions.Item label="Card Type">
                    {({ regular: 'Regular', premium: 'Premium', rewards_lifestyle: 'Rewards & Lifestyle', travel: 'Travel', ecommerce: 'E-Commerce', legacy: 'Legacy' })[selectedCard.cardType] || selectedCard.cardType}
                  </Descriptions.Item>
                </Descriptions>
              )}
```

With:
```jsx
              {selectedCard && (
                <>
                  {selectedCard.cardImage && (
                    <div style={{ marginBottom: 12 }}>
                      <img
                        src={`${API_BASE}/uploads/card-images/${selectedCard.cardImage}`}
                        alt={selectedCard.name}
                        style={{
                          width: 200,
                          height: 126,
                          objectFit: 'cover',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          display: 'block',
                        }}
                      />
                    </div>
                  )}
                  <Descriptions size="small" bordered style={{ marginBottom: 12 }}>
                    <Descriptions.Item label="Bank">{selectedCard.bank?.name}</Descriptions.Item>
                    <Descriptions.Item label="Card Type">
                      {({ regular: 'Regular', premium: 'Premium', rewards_lifestyle: 'Rewards & Lifestyle', travel: 'Travel', ecommerce: 'E-Commerce', legacy: 'Legacy' })[selectedCard.cardType] || selectedCard.cardType}
                    </Descriptions.Item>
                  </Descriptions>
                </>
              )}
```

- [ ] **Step 2: Verify in browser — select a card product that has an image uploaded. Image should appear above the descriptions.**

If no card has an image, skip visual verification and trust the conditional render.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/agent/SubmitLead.jsx
git commit -m "feat: show card image thumbnail when agent selects a card product"
```

---

### Task 3: Show card image in LeadDetail.jsx product section

**Files:**
- Modify: `frontend/src/pages/leads/LeadDetail.jsx`

- [ ] **Step 1: Add `Image` to antd imports (LeadDetail.jsx line 4-7)**

Replace:
```jsx
import {
  Card, Col, Row, Typography, Tag, Space, Button, Descriptions, Skeleton,
  Timeline, Divider, message, Modal, Form, InputNumber, Input, Select,
} from 'antd';
```

With:
```jsx
import {
  Card, Col, Row, Typography, Tag, Space, Button, Descriptions, Skeleton,
  Timeline, Divider, message, Modal, Form, InputNumber, Input, Select, Image,
} from 'antd';
```

- [ ] **Step 2: Add card image to Product card section (~line 252-264)**

Replace:
```jsx
              {!isLoan && lead.cardProduct && (
                <>
                  <Descriptions.Item label="Card">{lead.cardProduct.name}</Descriptions.Item>
                  <Descriptions.Item label="Card Type">
                    {(() => {
                      const labels = { regular: 'Regular', premium: 'Premium', rewards_lifestyle: 'Rewards & Lifestyle', travel: 'Travel', ecommerce: 'E-Commerce', legacy: 'Legacy' };
                      const colors = { regular: 'blue', premium: 'gold', rewards_lifestyle: 'green', travel: 'cyan', ecommerce: 'purple', legacy: 'volcano' };
                      const t = lead.cardProduct.cardType;
                      return <Tag color={colors[t] || 'default'}>{labels[t] || t}</Tag>;
                    })()}
                  </Descriptions.Item>
                </>
              )}
```

With:
```jsx
              {!isLoan && lead.cardProduct && (
                <>
                  <Descriptions.Item label="Card">{lead.cardProduct.name}</Descriptions.Item>
                  <Descriptions.Item label="Card Type">
                    {(() => {
                      const labels = { regular: 'Regular', premium: 'Premium', rewards_lifestyle: 'Rewards & Lifestyle', travel: 'Travel', ecommerce: 'E-Commerce', legacy: 'Legacy' };
                      const colors = { regular: 'blue', premium: 'gold', rewards_lifestyle: 'green', travel: 'cyan', ecommerce: 'purple', legacy: 'volcano' };
                      const t = lead.cardProduct.cardType;
                      return <Tag color={colors[t] || 'default'}>{labels[t] || t}</Tag>;
                    })()}
                  </Descriptions.Item>
                  {lead.cardProduct.cardImage && (
                    <Descriptions.Item label="Card Image" span={2}>
                      <Image
                        src={`${API_BASE}/uploads/card-images/${lead.cardProduct.cardImage}`}
                        alt={lead.cardProduct.name}
                        style={{
                          width: 200,
                          height: 126,
                          objectFit: 'cover',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                        }}
                        preview={{ mask: 'View' }}
                      />
                    </Descriptions.Item>
                  )}
                </>
              )}
```

Note: `API_BASE` is already defined at line 32 of LeadDetail.jsx:
```js
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
```
No need to add it again.

- [ ] **Step 3: Verify in browser — open a lead with a credit card product that has a card image. Should see image in Product section with click-to-zoom preview.**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/leads/LeadDetail.jsx
git commit -m "feat: show zoomable card image in lead detail product section"
```

---

## Self-Review

**Spec coverage:**
- [x] Nationality dropdown with all nationalities — Task 1
- [x] Card image in submit form when card selected — Task 2  
- [x] Card image in lead detail when agent views card — Task 3

**Placeholder scan:** None found.

**Type consistency:**
- `selectedCard.cardImage` — matches CardProduct model field `cardImage: { type: String }`
- `lead.cardProduct.cardImage` — same field, populated via `getOne()` controller which does `populate('cardProduct')`
- `API_BASE` — defined in Task 1 step 1 for SubmitLead; already exists in LeadDetail at line 32
- `NATIONALITIES` array `.map()` produces `{ value, label }` matching Ant Design Select `options` shape
