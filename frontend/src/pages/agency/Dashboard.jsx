import { useSelector } from 'react-redux';

function AgencyDashboard() {
  const { user } = useSelector((s) => s.auth);
  const banks = user.banks || [];

  return (
    <>
      <div className="eyebrow">§ Standing Committee &middot; Welcome</div>
      <h1 style={styles.h1}>
        Good day, <em style={styles.italic}>{user.name || user.email}.</em>
      </h1>
      <p style={styles.lede}>
        This is your standing desk. Filings sent your way will appear here in coming editions &mdash;
        for now, here are the institutions you may service.
      </p>
      <hr className="rule-double" style={{ margin: '32px 0' }} />

      <div className="eyebrow" style={{ marginBottom: 12 }}>§ Banks under your remit</div>
      {banks.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--ink-muted)' }}>
          &mdash; no banks have been assigned to you yet &mdash;
        </p>
      ) : (
        <div style={styles.bankGrid}>
          {banks.map((b, i) => (
            <article key={b._id || b} style={styles.bankCard}>
              <span style={styles.bankNum}>{String(i + 1).padStart(2, '0')}</span>
              <span style={styles.bankName}>{b.name || String(b)}</span>
              {b.code && <span style={styles.bankCode}>{b.code}</span>}
            </article>
          ))}
        </div>
      )}

      <hr className="rule" style={{ margin: '40px 0 16px' }} />
      <p style={styles.note}>
        <i>Note from the Mediator:</i> approval of agent filings will be enabled in a forthcoming edition.
      </p>
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
    margin: '14px 0 16px',
  },
  italic: { fontStyle: 'italic', color: 'var(--accent)' },
  lede: { fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-soft)', maxWidth: 760, margin: 0, lineHeight: 1.5 },
  bankGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 0, border: '1px solid var(--ink)' },
  bankCard: {
    padding: '20px 22px',
    borderRight: '1px solid var(--rule)',
    borderBottom: '1px solid var(--rule)',
    background: 'var(--surface)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  bankNum: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--accent)',
    letterSpacing: '0.12em',
  },
  bankName: {
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    color: 'var(--ink)',
    letterSpacing: '-0.01em',
  },
  bankCode: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--ink-muted)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  note: { fontFamily: 'var(--font-display)', color: 'var(--ink-muted)', margin: 0 },
};

export default AgencyDashboard;
