import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Row, Col, Card, Typography, Select, Empty, Skeleton, Tag, Button, Space, Spin, Tabs, message } from 'antd';
import { FilePdfOutlined, DownloadOutlined, EyeOutlined, PlayCircleOutlined, FileTextOutlined } from '@ant-design/icons';
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
  const url = resource.file ? `${UPLOADS_BASE}/resources/${resource.file}` : null;
  return (
    <Card
      size="small"
      style={{ borderRadius: 12, border: '1px solid #ede9fe', height: '100%', boxShadow: '0 2px 12px rgba(124,58,237,0.07)' }}
      styles={{ body: { padding: 14 } }}
    >
      {resource.fileType === 'image' ? (
        <img src={url} alt={resource.title} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />
      ) : resource.fileType === 'pdf' ? (
        <div style={{ width: '100%', height: 140, borderRadius: 8, marginBottom: 10, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
          <FilePdfOutlined />
        </div>
      ) : resource.videoLink ? (
        <a href={resource.videoLink} target="_blank" rel="noreferrer">
          <div style={{ width: '100%', height: 140, borderRadius: 8, marginBottom: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
            <PlayCircleOutlined />
          </div>
        </a>
      ) : null}
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>{resource.title}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <Tag color={TYPE_COLORS[resource.type]}>{TYPE_OPTIONS.find((t) => t.value === resource.type)?.label || resource.type}</Tag>
        {resource.bank?.name && <span style={{ fontSize: 12, color: '#64748b' }}>{resource.bank.name}</span>}
      </div>
      {resource.description && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{resource.description}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {url && <Button size="small" icon={<EyeOutlined />} href={url} target="_blank" rel="noreferrer" style={{ flex: 1 }}>View</Button>}
        {url && <Button size="small" icon={<DownloadOutlined />} href={url} download target="_blank" rel="noreferrer" style={{ flex: 1 }}>Download</Button>}
        {resource.videoLink && <Button size="small" icon={<PlayCircleOutlined />} href={resource.videoLink} target="_blank" rel="noreferrer" style={{ flex: 1 }}>Watch Video</Button>}
      </div>
    </Card>
  );
}

function TrainingDeckTab() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/promotions/resources')
      .then((res) => setResources(res.data))
      .catch(() => message.error('Failed to load training deck'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  if (!resources.length) {
    return <Empty description="No training material yet — check back soon" />;
  }

  return (
    <>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
        Training videos and guidelines on using the portal and earning more incentive.
      </Typography.Text>
      <Row gutter={[16, 16]} align="stretch">
        {resources.map((resource) => (
          <Col xs={24} md={12} lg={8} key={resource._id}>
            <Card
              style={{ borderRadius: 14, border: '1px solid #e2e8f0', height: '100%' }}
              styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%' } }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{resource.title}</div>
                {resource.description && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>{resource.description}</div>
                )}
              </div>
              <Space wrap style={{ marginTop: 12 }}>
                {resource.videoLink && (
                  <Button size="small" type="primary" icon={<PlayCircleOutlined />} href={resource.videoLink} target="_blank" rel="noopener noreferrer">
                    Watch Video
                  </Button>
                )}
                {resource.docsLink && (
                  <Button size="small" icon={<FileTextOutlined />} href={resource.docsLink} target="_blank" rel="noopener noreferrer">
                    View Docs
                  </Button>
                )}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}

function LibraryTab() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bankFilter, setBankFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/resources')
      .then((res) => setResources(res.data))
      .catch(() => message.error('Failed to load resources'))
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

function Resources() {
  const { user } = useSelector((s) => s.auth);

  const header = (
    <div style={{ marginBottom: 12 }}>
      <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>Resources</Typography.Title>
      <Typography.Text type="secondary">Flyers, policy documents, and training material from your banks.</Typography.Text>
    </div>
  );

  // Training Deck (formerly Promotion > Partner Guide) is agent-only.
  if (user?.role !== 'agent') {
    return <>{header}<LibraryTab /></>;
  }

  return (
    <>
      {header}
      <Tabs
        items={[
          { key: 'library', label: 'Library', children: <LibraryTab /> },
          { key: 'trainingDeck', label: 'Training Deck', children: <TrainingDeckTab /> },
        ]}
      />
    </>
  );
}

export default Resources;
