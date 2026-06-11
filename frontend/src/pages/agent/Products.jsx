import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Typography, Input, Select, Tag, message, Skeleton, Empty, Modal, Tabs } from 'antd';
import 'quill/dist/quill.core.css';
import { CreditCardOutlined, FundOutlined, RiseOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../../api/client';

const UPLOADS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '/uploads');
const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function StatCard({ icon, iconColor, label, value, borderColor }) {
  return (
    <div
      style={{
        borderRadius: 14, border: '1px solid #edf0f7', borderTop: `3px solid ${borderColor}`,
        background: `linear-gradient(170deg, ${borderColor}12 0%, #ffffff 45%, #f8faff 100%)`,
        boxShadow: '0 4px 16px rgba(15,23,42,0.08)', padding: '18px 20px', height: '100%',
        transition: 'box-shadow 0.2s, transform 0.2s', cursor: 'default',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 24px ${borderColor}28`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8' }}>{label}</div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${borderColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, fontSize: 16 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

function HtmlContent({ html }) {
  if (!html) return <Empty description="No information added yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  return (
    <div
      className="ql-editor"
      style={{ fontSize: 13, color: '#374151', padding: 0 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function ProductCard({ product, onClick }) {
  const firstBracket = (product.commissionBrackets || [])[0];
  const hasImage = product.productType === 'credit_card' && product.cardImage;

  return (
    <Card
      size="small"
      onClick={onClick}
      className="lead-card"
      style={{
        borderRadius: 12,
        border: '1px solid #e0e2f7',
        height: '100%',
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(99,102,241,0.07), 0 1px 3px rgba(99,102,241,0.04)',
        transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
      }}
      styles={{ body: { padding: '16px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', lineHeight: 1.3 }}>
          {product.name}
        </div>
        {product.productType === 'loan' && product.bank?.logo && (
          <img
            src={`${UPLOADS_BASE}/bank-logos/${product.bank.logo}`}
            alt={product.bank?.name || ''}
            style={{ height: 32, width: 'auto', maxWidth: 72, objectFit: 'contain', flexShrink: 0, marginTop: 2 }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
      </div>

      {product.bank?.name && (
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{product.bank.name}</div>
      )}


      {firstBracket && (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Min Salary</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{aed(firstBracket.minimumSalary)}</div>
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 18, fontWeight: 300 }}>→</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Payout</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>
                {product.productType === 'loan' ? `${Number(firstBracket.payable || 0)}%` : aed(firstBracket.payable)}
              </div>
            </div>
          </div>
          {product.productType === 'credit_card' && firstBracket.feeType && (
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Tag color={firstBracket.feeType === 'free' ? 'green' : 'blue'} style={{ fontSize: 10, margin: 0 }}>
                {firstBracket.feeType === 'free' ? 'Free' : 'Paid'}
              </Tag>
              {hasImage && (
                <img
                  src={`${UPLOADS_BASE}/card-images/${product.cardImage}`}
                  alt=""
                  style={{ width: 80, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
            </div>
          )}
          {(!firstBracket.feeType || product.productType !== 'credit_card') && hasImage && (
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <img
                src={`${UPLOADS_BASE}/card-images/${product.cardImage}`}
                alt=""
                style={{ width: 80, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}
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
  const [bankFilter, setBankFilter] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/card-products'), api.get('/loan-products')])
      .then(([cardsRes, loansRes]) => {
        setCards(cardsRes.data.filter((c) => c.isActive).map((c) => ({ ...c, productType: 'credit_card' })));
        setLoans(loansRes.data.filter((l) => l.isActive).map((l) => ({ ...l, productType: 'loan' })));
      })
      .catch(() => message.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, []);

  const allProducts = useMemo(() => [...cards, ...loans], [cards, loans]);

  const stats = useMemo(() => {
    const cardPayables = cards.flatMap((p) => (p.commissionBrackets || []).map((b) => b.payable));
    const topCardPayout = cardPayables.length ? Math.max(...cardPayables) : 0;
    return {
      total: allProducts.length,
      cardCount: cards.length,
      loanCount: loans.length,
      topCardPayout,
    };
  }, [allProducts, cards, loans]);

  const bankOptions = useMemo(() => {
    const seen = new Set();
    return allProducts
      .filter((p) => p.bank?._id && !seen.has(p.bank._id) && seen.add(p.bank._id))
      .map((p) => ({ value: p.bank._id, label: p.bank.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allProducts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (typeFilter === 'credit_card' && p.productType !== 'credit_card') return false;
      if (typeFilter === 'loan' && p.productType !== 'loan') return false;
      if (bankFilter && p.bank?._id !== bankFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allProducts, search, typeFilter, bankFilter]);

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>Products</Typography.Title>
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
          <StatCard icon={<RiseOutlined />} iconColor="#16a34a" label="Top Card Payout" value={aed(stats.topCardPayout)} borderColor="#22c55e" bg="#f0fdf4" />
        </Col>
      </Row>

      <div className="leads-filter-bar" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <Input
          allowClear
          placeholder="Search products..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260, borderRadius: 6 }}
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
        <Select
          allowClear
          placeholder="All Banks"
          value={bankFilter}
          onChange={setBankFilter}
          options={bankOptions}
          style={{ width: 200, borderRadius: 6 }}
        />
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
              <ProductCard product={p} onClick={() => setSelectedProduct(p)} />
            </Col>
          ))}
        </Row>
      )}

      <Modal
        open={!!selectedProduct}
        onCancel={() => setSelectedProduct(null)}
        footer={null}
        width={600}
        destroyOnClose
        title={null}
      >
        {selectedProduct && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              {selectedProduct.productType === 'credit_card' && selectedProduct.cardImage && (
                <img
                  src={`${UPLOADS_BASE}/card-images/${selectedProduct.cardImage}`}
                  alt=""
                  style={{ width: 100, height: 65, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0 }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>{selectedProduct.name}</Typography.Title>
            </div>
            <Tabs
              items={[
                {
                  key: 'benefits',
                  label: 'Product Benefits',
                  children: <HtmlContent html={selectedProduct.benefits} />,
                },
                {
                  key: 'fees',
                  label: 'Fees & Eligibility',
                  children: <HtmlContent html={selectedProduct.feesEligibility} />,
                },
              ]}
            />
          </>
        )}
      </Modal>
    </>
  );
}

export default Products;
