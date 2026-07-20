# Agent Products Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Products catalog page to the agent portal showing all active credit card and loan products with commission brackets and estimated payouts.

**Architecture:** Single new file `Products.jsx` fetches both `/card-products` and `/loan-products` in parallel, merges them client-side, and renders stat cards + a responsive product grid with search/type filters. Nav item and route wired in two existing files.

**Tech Stack:** React, Ant Design (Card, Row, Col, Tag, Input, Select, Skeleton, Empty, Typography, message), React Router, existing `api` client.

---

### Task 1: Create Products.jsx

**Files:**
- Create: `frontend/src/pages/agent/Products.jsx`

- [ ] **Step 1: Create the file with full implementation**

```jsx
import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Typography, Input, Select, Tag, message, Skeleton, Empty } from 'antd';
import { CreditCardOutlined, FundOutlined, RiseOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../../api/client';

const BANK_COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0f766e', '#be185d'];

function bankColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return BANK_COLORS[Math.abs(hash) % BANK_COLORS.length];
}

function bankInitials(name) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const UPLOADS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '/uploads');
const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function StatCard({ icon, iconColor, label, value, borderColor, bg }) {
  return (
    <Card
      size="small"
      style={{ borderRadius: 12, borderLeft: `4px solid ${borderColor}`, background: bg, border: `1px solid ${borderColor}22`, height: '100%' }}
      styles={{ body: { padding: '18px 20px' } }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: iconColor, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>{label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: iconColor, lineHeight: 1.2 }}>{value}</div>
    </Card>
  );
}

function ProductCard({ product }) {
  const bankName = product.bank?.name || 'Unknown Bank';
  const color = bankColor(bankName);
  const initials = bankInitials(bankName);
  const brackets = product.commissionBrackets || [];

  return (
    <Card
      size="small"
      style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: '100%' }}
      styles={{ body: { padding: '16px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: color,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', lineHeight: 1.3, marginBottom: 2 }}>{product.name}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{bankName}</div>
        </div>
        <Tag color={product.productType === 'credit_card' ? 'blue' : 'purple'} style={{ flexShrink: 0 }}>
          {product.productType === 'credit_card' ? 'Credit Card' : 'Personal Loan'}
        </Tag>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
        <Typography.Text style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Authorized</Typography.Text>
      </div>

      {brackets.length > 0 && (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', marginBottom: product.cardImage ? 10 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Commission Brackets</div>
          {brackets.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: i < brackets.length - 1 ? 4 : 0 }}>
              <Typography.Text style={{ fontSize: 12, flex: 1 }}>
                ≥ {aed(b.minimumSalary)} → <strong style={{ color: '#16a34a' }}>{aed(b.payable)}</strong>
              </Typography.Text>
              {b.feeType && (
                <Tag color={b.feeType === 'free' ? 'green' : 'blue'} style={{ fontSize: 10, margin: 0 }}>
                  {b.feeType === 'free' ? 'Free' : 'Paid'}
                </Tag>
              )}
            </div>
          ))}
        </div>
      )}

      {product.cardImage && (
        <div style={{ marginTop: 10 }}>
          <img
            src={`${UPLOADS_BASE}/card-images/${product.cardImage}`}
            alt=""
            style={{ width: 80, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
          />
        </div>
      )}
    </Card>
  );
}

function Products() {
  const [cards, setCards] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/card-products'), api.get('/loan-products')])
      .then(([cardsRes, loansRes]) => {
        setCards(cardsRes.data.map((c) => ({ ...c, productType: 'credit_card' })));
        setLoans(loansRes.data.map((l) => ({ ...l, productType: 'loan' })));
      })
      .catch(() => message.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, []);

  const allProducts = useMemo(() => [...cards, ...loans], [cards, loans]);

  const stats = useMemo(() => {
    const allPayables = allProducts.flatMap((p) => (p.commissionBrackets || []).map((b) => b.payable));
    return {
      total: allProducts.length,
      cardCount: cards.length,
      loanCount: loans.length,
      topPayout: allPayables.length ? Math.max(...allPayables) : 0,
    };
  }, [allProducts, cards, loans]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (typeFilter === 'credit_card' && p.productType !== 'credit_card') return false;
      if (typeFilter === 'loan' && p.productType !== 'loan') return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allProducts, search, typeFilter]);

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Products</Typography.Title>
        <Typography.Text type="secondary">Browse all authorized card and loan products with estimated payouts.</Typography.Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard icon={<FundOutlined />} iconColor="#4f46e5" label="Live Products" value={stats.total} borderColor="#6366f1" bg="#eef2ff" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard icon={<CreditCardOutlined />} iconColor="#0891b2" label="Card Products" value={stats.cardCount} borderColor="#06b6d4" bg="#ecfeff" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard icon={<FundOutlined />} iconColor="#7c3aed" label="Loan Products" value={stats.loanCount} borderColor="#7c3aed" bg="#f5f3ff" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard icon={<RiseOutlined />} iconColor="#16a34a" label="Top Payout" value={aed(stats.topPayout)} borderColor="#22c55e" bg="#f0fdf4" />
        </Col>
      </Row>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <Input
          allowClear
          placeholder="Search products..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          style={{ width: 160 }}
          options={[
            { value: 'all', label: 'All Types' },
            { value: 'credit_card', label: 'Credit Cards' },
            { value: 'loan', label: 'Loans' },
          ]}
        />
        <Typography.Text type="secondary">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</Typography.Text>
      </div>

      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Col key={i} xs={24} sm={12} lg={8}>
              <Card style={{ borderRadius: 12 }}><Skeleton active /></Card>
            </Col>
          ))}
        </Row>
      ) : filtered.length === 0 ? (
        <Empty description="No products found" />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((p) => (
            <Col key={p._id} xs={24} sm={12} lg={8}>
              <ProductCard product={p} />
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}

export default Products;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/agent/Products.jsx
git commit -m "feat: add agent Products catalog page"
```

---

### Task 2: Wire route and nav item

**Files:**
- Modify: `frontend/src/App.jsx` (lines 18, 103)
- Modify: `frontend/src/components/AppLayout.jsx` (lines 38–42)

- [ ] **Step 1: Add import to App.jsx**

After line 18 (`import Commissions from './pages/agent/Commissions';`), add:

```jsx
import AgentProducts from './pages/agent/Products';
```

- [ ] **Step 2: Add route to App.jsx**

Inside the `/agent` route block (after `<Route path="commissions" element={<Commissions />} />`), add:

```jsx
<Route path="products" element={<AgentProducts />} />
```

- [ ] **Step 3: Add nav item to AppLayout.jsx**

In the `agent` array in `menusByRole`, add after the `commissions` entry:

```jsx
{ key: '/agent/products', icon: <AppstoreOutlined />, label: <Link to="/agent/products">Products</Link> },
```

- [ ] **Step 4: Add AppstoreOutlined to the import in AppLayout.jsx**

Update the `@ant-design/icons` import line to include `AppstoreOutlined`:

```jsx
import {
  DashboardOutlined,
  BankOutlined,
  TeamOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
  LogoutOutlined,
  UserOutlined,
  DollarOutlined,
  AuditOutlined,
  IdcardOutlined,
  CreditCardOutlined,
  FundOutlined,
  DownOutlined,
  InboxOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/AppLayout.jsx
git commit -m "feat: wire agent Products route and nav item"
```
