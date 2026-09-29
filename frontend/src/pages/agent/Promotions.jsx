import { useEffect, useState } from 'react';
import { Card, Progress, Tag, Typography, Row, Col, Empty, Spin, DatePicker } from 'antd';
import { GiftOutlined, TrophyOutlined, CheckCircleFilled, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/client';

const STATUS_LABEL = { earned: 'Earned', sent: 'Sent', redeemed: 'Redeemed' };
const STATUS_COLOR = { earned: 'gold', sent: 'blue', redeemed: 'green' };
const PRODUCT_TYPE_LABELS = { credit_card: 'Cards', loan: 'Loans', account: 'Accounts' };

function windowLabel(tier) {
  if (tier.windowType === 'months' && tier.windowMonths) {
    return `last ${tier.windowMonths} month${tier.windowMonths > 1 ? 's' : ''}`;
  }
  return 'lifetime';
}

function productTypesLabel(tier) {
  const types = tier.productTypes?.length ? tier.productTypes : ['credit_card'];
  return types.map((t) => PRODUCT_TYPE_LABELS[t] || t).join(' + ');
}

function MyProgressTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [breakdownMonth, setBreakdownMonth] = useState(dayjs());

  const load = (month) => {
    setLoading(true);
    api.get('/promotions/my-progress', { params: { month } })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(breakdownMonth.format('YYYY-MM')); }, [breakdownMonth]);

  if (loading && !data) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  const breakdownLabel = data?.month
    ? new Date(`${data.month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '';

  return (
    <>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
        Each reward counts its own set of products (cards, loans, accounts) over its own window — shown on the card below.
      </Typography.Text>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card style={{ borderRadius: 14, height: '100%', background: 'linear-gradient(135deg, #7C3AED12, #ffffff)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Lifetime Total (all products)</Typography.Text>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#0f172a' }}>{data?.lifetimeCount ?? 0} disbursed</div>
              </div>
              <GiftOutlined style={{ fontSize: 40, color: '#7C3AED' }} />
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card style={{ borderRadius: 14, height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{breakdownLabel}</Typography.Text>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#0f172a' }}>{data?.monthlyCount ?? 0} disbursed this month</div>
              </div>
              <DatePicker
                picker="month"
                value={breakdownMonth}
                onChange={(v) => v && setBreakdownMonth(v)}
                allowClear={false}
                suffixIcon={<CalendarOutlined />}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {!data?.tiers?.length ? (
        <Empty description="No promotions set up yet — check back soon" />
      ) : (
        <Row gutter={[16, 16]}>
          {data.tiers.map((tier) => {
            const pct = Math.min(100, Math.round((tier.count / tier.threshold) * 100));
            return (
              <Col xs={24} md={12} lg={8} key={tier._id}>
                <Card
                  style={{
                    borderRadius: 14,
                    border: tier.achieved ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                    background: tier.achieved ? 'linear-gradient(160deg, #fef3c7 0%, #ffffff 55%)' : '#fff',
                    height: '100%',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <TrophyOutlined style={{ fontSize: 22, color: tier.achieved ? '#f59e0b' : '#94a3b8' }} />
                    {tier.achieved && (
                      <Tag color={STATUS_COLOR[tier.status] || 'gold'} icon={<CheckCircleFilled />}>
                        {STATUS_LABEL[tier.status] || 'Earned'}
                      </Tag>
                    )}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{tier.rewardTitle}</div>
                  {tier.rewardDescription && (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, marginBottom: 10 }}>{tier.rewardDescription}</div>
                  )}
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                    {tier.count} / {tier.threshold} {productTypesLabel(tier)} ({windowLabel(tier)})
                  </div>
                  <Progress
                    percent={pct}
                    showInfo={false}
                    strokeColor={tier.achieved ? '#f59e0b' : '#7C3AED'}
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </>
  );
}

function AgentPromotions() {
  return (
    <>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Promotion</h2>
      <MyProgressTab />
    </>
  );
}

export default AgentPromotions;
