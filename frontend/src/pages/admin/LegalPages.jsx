import { useEffect, useState } from 'react';
import { Tabs, Button, Input, DatePicker, Typography, Space, Modal, message, Spin, Tag } from 'antd';
import { SaveOutlined, EyeOutlined, GlobalOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/client';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PAGES = [
  { slug: 'terms',          label: 'Terms & Conditions',  url: '/terms.html' },
  { slug: 'privacy-policy', label: 'Privacy Policy',      url: '/privacy-policy.html' },
  { slug: 'cookie-policy',  label: 'Cookies',             url: '/cookie-policy.html' },
  { slug: 'data-policy',    label: 'Data Policy',         url: '/data-policy.html' },
];

const PREVIEW_STYLES = `
  .legal-content section { margin-bottom: 36px; }
  .legal-content h2 { font-size: 20px; font-weight: 700; color: #0B0F1E; margin-bottom: 14px; padding-top: 6px; letter-spacing: -0.02em; }
  .legal-content h3 { font-size: 15px; font-weight: 600; color: #1A2036; margin: 18px 0 8px; }
  .legal-content p { font-size: 14px; line-height: 1.75; color: #3a3f55; margin-bottom: 12px; }
  .legal-content ul { padding-left: 20px; margin-bottom: 12px; }
  .legal-content ul li { font-size: 14px; line-height: 1.75; color: #3a3f55; margin-bottom: 4px; }
  .legal-content .highlight-box { background: #FAFAFB; border: 1px solid #E8E8EE; border-radius: 10px; padding: 16px 20px; margin: 16px 0; }
  .legal-content .highlight-box p { margin: 0; font-size: 13px; color: #6B7186; }
  .data-table, .cookie-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  .data-table th, .cookie-table th { background: #FAFAFB; padding: 8px 12px; text-align: left; font-weight: 600; color: #0B0F1E; border: 1px solid #E8E8EE; }
  .data-table td, .cookie-table td { padding: 8px 12px; border: 1px solid #E8E8EE; color: #3a3f55; line-height: 1.5; }
  .cookie-toggle { display: flex; flex-direction: column; gap: 10px; margin: 16px 0; }
  .cookie-item { border: 1px solid #E8E8EE; border-radius: 10px; padding: 14px 16px; }
  .cookie-item-info h4 { font-size: 14px; font-weight: 600; color: #0B0F1E; margin-bottom: 4px; }
  .cookie-item-info p { font-size: 12px; color: #6B7186; margin: 0; }
  .badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 999px; margin-left: 6px; }
  .badge-required { background: #e8f5e9; color: #2e7d32; }
  .badge-optional { background: #f3f0ff; color: #6d28d9; }
  .principle-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 16px 0; }
  .principle-card { border: 1px solid #E8E8EE; border-radius: 10px; padding: 16px; background: #FAFAFB; }
  .principle-card .icon { font-size: 20px; margin-bottom: 8px; }
  .principle-card h4 { font-size: 13px; font-weight: 600; color: #0B0F1E; margin-bottom: 4px; }
  .principle-card p { font-size: 12px; color: #6B7186; margin: 0; line-height: 1.5; }
`;

function PageEditor({ page, onChange, onSave, saving }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!page) return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, marginBottom: 16, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>PAGE TITLE</div>
          <Input
            value={page.title}
            onChange={(e) => onChange({ ...page, title: e.target.value })}
            style={{ fontWeight: 600 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>LAST UPDATED</div>
          <DatePicker
            style={{ width: '100%' }}
            value={page.lastUpdated ? dayjs(page.lastUpdated) : null}
            onChange={(d) => onChange({ ...page, lastUpdated: d ? d.toISOString() : null })}
          />
        </div>
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>Preview</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>Save</Button>
        </Space>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>HTML CONTENT</div>
      <TextArea
        value={page.content}
        onChange={(e) => onChange({ ...page, content: e.target.value })}
        autoSize={{ minRows: 28, maxRows: 60 }}
        style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
        placeholder="HTML content for the legal page..."
      />
      <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
        Enter raw HTML. Use &lt;section&gt;, &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;table&gt; tags. CSS classes: highlight-box, data-table, cookie-table, cookie-toggle, principle-grid, principle-card.
      </Text>

      <Modal
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={860}
        title={
          <span>
            Preview — {page.title}
            {page.lastUpdated && (
              <Tag color="blue" style={{ marginLeft: 12, fontWeight: 400, fontSize: 11 }}>
                Last updated: {dayjs(page.lastUpdated).format('D MMM YYYY')}
              </Tag>
            )}
          </span>
        }
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', padding: '20px 28px' } }}
        destroyOnClose
      >
        <style>{PREVIEW_STYLES}</style>
        <div
          className="legal-content"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </Modal>
    </div>
  );
}

export default function LegalPages() {
  const [pages, setPages]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/legal');
      const map = {};
      data.forEach((p) => { map[p.slug] = p; });
      setPages(map);
    } catch {
      message.error('Failed to load legal pages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (slug) => {
    const page = pages[slug];
    if (!page) return;
    setSaving((s) => ({ ...s, [slug]: true }));
    try {
      const { data } = await api.put(`/legal/${slug}`, {
        title:       page.title,
        content:     page.content,
        lastUpdated: page.lastUpdated,
      });
      setPages((p) => ({ ...p, [slug]: data }));
      message.success('Page saved');
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving((s) => ({ ...s, [slug]: false }));
    }
  };

  const tabItems = PAGES.map(({ slug, label, url }) => ({
    key:   slug,
    label: label,
    children: (
      <PageEditor
        page={pages[slug]}
        onChange={(updated) => setPages((p) => ({ ...p, [slug]: updated }))}
        onSave={() => handleSave(slug)}
        saving={!!saving[slug]}
      />
    ),
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Legal Pages</Title>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Manage Terms, Privacy Policy, Cookies &amp; Data Policy content
          </div>
        </div>
        <Space>
          {PAGES.map(({ label, url }) => (
            <Button
              key={url}
              size="small"
              icon={<GlobalOutlined />}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {label}
            </Button>
          ))}
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <Tabs items={tabItems} type="card" />
      )}
    </div>
  );
}
