import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Typography, Select, Empty, Skeleton, Tag, Button } from 'antd';
import { FilePdfOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../../api/client';

const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_BASE || (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '/uploads');

const TYPE_OPTIONS = [
  { value: 'flyer', label: 'Flyer' },
  { value: 'policy', label: 'Policy Document' },
  { value: 'training', label: 'Training Deck' },
  { value: 'other', label: 'Other' },
];
const TYPE_COLORS = { flyer: 'blue', policy: 'gold', training: 'purple', other: 'default' };

function ResourceCard({ resource }) {
  const url = `${UPLOADS_BASE}/resources/${resource.file}`;
  return (
    <Card
      size="small"
      style={{ borderRadius: 12, border: '1px solid #ede9fe', height: '100%', boxShadow: '0 2px 12px rgba(124,58,237,0.07)' }}
      styles={{ body: { padding: 14 } }}
    >
      {resource.fileType === 'image' ? (
        <img src={url} alt={resource.title} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />
      ) : (
        <div style={{ width: '100%', height: 140, borderRadius: 8, marginBottom: 10, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
          <FilePdfOutlined />
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>{resource.title}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <Tag color={TYPE_COLORS[resource.type]}>{TYPE_OPTIONS.find((t) => t.value === resource.type)?.label || resource.type}</Tag>
        {resource.bank?.name && <span style={{ fontSize: 12, color: '#64748b' }}>{resource.bank.name}</span>}
      </div>
      {resource.description && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{resource.description}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="small" icon={<EyeOutlined />} href={url} target="_blank" rel="noreferrer" style={{ flex: 1 }}>View</Button>
        <Button size="small" icon={<DownloadOutlined />} href={url} download style={{ flex: 1 }}>Download</Button>
      </div>
    </Card>
  );
}

function Resources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bankFilter, setBankFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/resources')
      .then((res) => setResources(res.data))
      .finally(() => setLoading(false));
  }, []);

  const bankOptions = useMemo(() => {
    const seen = new Set();
    return resources
      .filter((r) => r.bank?._id && !seen.has(r.bank._id) && seen.add(r.bank._id))
      .map((r) => ({ value: r.bank._id, label: r.bank.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [resources]);

  const filtered = useMemo(() => resources.filter((r) => {
    if (bankFilter && r.bank?._id !== bankFilter) return false;
    if (typeFilter && r.type !== typeFilter) return false;
    return true;
  }), [resources, bankFilter, typeFilter]);

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>Resources</Typography.Title>
        <Typography.Text type="secondary">Flyers, policy documents, and training material from your banks.</Typography.Text>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Select allowClear placeholder="All Banks" value={bankFilter} onChange={setBankFilter} options={bankOptions} style={{ width: 200 }} />
        <Select allowClear placeholder="All Types" value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} style={{ width: 200 }} />
      </div>

      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map((i) => (
            <Col key={i} xs={24} sm={12} lg={8}>
              <Card style={{ borderRadius: 12 }}><Skeleton active /></Card>
            </Col>
          ))}
        </Row>
      ) : filtered.length === 0 ? (
        <Empty description="No resources found" />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((r) => (
            <Col key={r._id} xs={24} sm={12} lg={8}>
              <ResourceCard resource={r} />
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}

export default Resources;
