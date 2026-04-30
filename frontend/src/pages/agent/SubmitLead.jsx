import { useEffect, useState } from 'react';
import { Form, Input, Select, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

function SubmitLead() {
  const [banks, setBanks] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  useEffect(() => {
    api.get('/banks').then((res) => setBanks(res.data));
  }, []);

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/leads', values);
      message.success('Lead filed');
      navigate('/agent/leads');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to file');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="eyebrow">§ File a New Lead</div>
      <h1 style={styles.h1}>
        A fresh <em style={styles.italic}>filing.</em>
      </h1>
      <p style={styles.lede}>
        Record a customer's interest in plain terms. The lead is dated and entered as <i>submitted</i>.
      </p>
      <hr className="rule-double" style={{ margin: '32px 0' }} />

      <div style={styles.split}>
        <aside style={styles.aside}>
          <div className="eyebrow">House Style</div>
          <ol style={styles.guide}>
            <li><span style={styles.guideNum}>i.</span> Use the customer's full given name.</li>
            <li><span style={styles.guideNum}>ii.</span> Phone numbers in international format where possible.</li>
            <li><span style={styles.guideNum}>iii.</span> Note any context the agency may need in the margin (Notes).</li>
            <li><span style={styles.guideNum}>iv.</span> Choose the bank carefully — it cannot be silently changed once filed.</li>
          </ol>
        </aside>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} style={styles.form}>
          <Form.Item name="customerName" label={<span className="eyebrow">Customer Name</span>} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label={<span className="eyebrow">Phone Number</span>} rules={[{ required: true }]}>
            <Input style={{ fontFamily: 'var(--font-mono)' }} />
          </Form.Item>
          <Form.Item name="productType" label={<span className="eyebrow">Product</span>} rules={[{ required: true }]}>
            <Select
              placeholder="Credit card or loan"
              options={[
                { value: 'credit_card', label: 'Credit Card' },
                { value: 'loan', label: 'Loan' },
              ]}
            />
          </Form.Item>
          <Form.Item name="bank" label={<span className="eyebrow">Bank</span>} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select an institution"
              options={banks.map((b) => ({ value: b._id, label: b.name }))}
            />
          </Form.Item>
          <Form.Item name="notes" label={<span className="eyebrow">Notes (optional)</span>}>
            <Input.TextArea rows={4} placeholder="Anything the agency should know about the customer." />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block style={styles.cta}>
            File This Lead &rarr;
          </Button>
        </Form>
      </div>
    </>
  );
}

const styles = {
  h1: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(48px, 6vw, 80px)',
    lineHeight: 0.95,
    letterSpacing: '-0.03em',
    fontWeight: 400,
    margin: '14px 0 14px',
  },
  italic: { fontStyle: 'italic', color: 'var(--accent)' },
  lede: { fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-soft)', margin: 0, maxWidth: 700 },
  split: { display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 56 },
  aside: {
    borderTop: '4px solid var(--ink)',
    paddingTop: 18,
  },
  guide: {
    listStyle: 'none',
    padding: 0,
    margin: '14px 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    lineHeight: 1.6,
    color: 'var(--ink-soft)',
  },
  guideNum: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--accent)',
    marginRight: 8,
    letterSpacing: '0.08em',
  },
  form: { borderTop: '4px solid var(--ink)', paddingTop: 18 },
  cta: {
    height: 48,
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    background: 'var(--ink)',
    borderColor: 'var(--ink)',
    marginTop: 8,
  },
};

export default SubmitLead;
