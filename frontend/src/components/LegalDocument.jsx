import { Typography } from 'antd';

const { Title, Paragraph, Text } = Typography;

function renderItem(item, i) {
  if (item.type === 'p') return <Paragraph key={i}>{item.text}</Paragraph>;
  if (item.type === 'caps') return <Paragraph key={i} style={{ fontSize: 13 }}>{item.text}</Paragraph>;
  if (item.type === 'sub') return <Title key={i} level={5} style={{ marginTop: 16 }}>{item.text}</Title>;
  if (item.type === 'ul') return (
    <ul key={i} style={{ paddingLeft: 20, marginBottom: 16 }}>
      {item.items.map((t, j) => <li key={j} style={{ marginBottom: 6 }}><Text>{t}</Text></li>)}
    </ul>
  );
  if (item.type === 'contact') return (
    <div key={i} style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
      <Text strong style={{ display: 'block' }}>{item.lines[0]}</Text>
      {item.lines.slice(1).map((l, j) => <Text key={j} style={{ display: 'block', fontSize: 14 }}>{l}</Text>)}
    </div>
  );
  if (item.type === 'table') return (
    <div key={i} style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        {item.head && (
          <thead>
            <tr>{item.head.map((h, j) => <th key={j} style={{ border: '1px solid #e2e8f0', background: '#f1f5f9', padding: '8px 12px', textAlign: 'left' }}>{h}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {item.rows.map((r, j) => (
            <tr key={j}>{r.map((c, k) => <td key={k} style={{ border: '1px solid #e2e8f0', padding: '8px 12px', verticalAlign: 'top', fontWeight: !item.head && k === 0 ? 600 : 400 }}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return null;
}

// Renders a legal document ({ title, updated, subtitle, intro, sections }) with a contents list.
export default function LegalDocument({ doc }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '40px 16px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid #e2e8f0' }}>
          <img src="/mysilah.svg" alt="MySilah" style={{ height: 48, width: 'auto', objectFit: 'contain', marginBottom: 24 }} />
          <Title level={1} style={{ margin: '0 0 8px', fontSize: 36, fontWeight: 800 }}>{doc.title}</Title>
          {doc.subtitle && <div style={{ fontSize: 15, color: '#475569', marginBottom: 6 }}>{doc.subtitle}</div>}
          <Text type="secondary">{doc.updated}</Text>

          <div style={{ marginTop: 28, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>On this page</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '6px 24px' }}>
              {doc.sections.map((s) => (
                <a key={s.id} href={`#section-${s.id}`} style={{ fontSize: 13, color: '#7C3AED', textDecoration: 'none' }}>
                  {s.num}. {s.title}
                </a>
              ))}
            </div>
          </div>
        </div>

        {doc.intro?.map((t, i) => <Paragraph key={i}>{t}</Paragraph>)}

        {doc.sections.map((s) => (
          <div key={s.id} id={`section-${s.id}`} style={{ marginBottom: 40, paddingBottom: 40, borderBottom: '1px solid #f1f5f9' }}>
            <Title level={3} style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{s.num}. {s.title}</Title>
            {s.content.map((item, i) => renderItem(item, i))}
          </div>
        ))}

        <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>
          Silah L.L.C-FZ  |  mysilah.ae
        </div>
      </div>
    </div>
  );
}
