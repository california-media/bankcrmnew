import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

function AdminDashboard() {
  const { user } = useSelector((s) => s.auth);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      <div className="eyebrow">§ Editorial Desk &middot; {today}</div>
      <h1 style={styles.h1}>
        From the <em style={styles.italic}>Mediator's</em> chair.
      </h1>
      <p style={styles.lede}>
        You set the institutions of record and admit agencies to the masthead.
        Lead and agency oversight will follow in subsequent editions.
      </p>
      <hr className="rule-double" style={{ margin: '32px 0' }} />

      <div style={styles.grid}>
        <Link to="/admin/banks" style={styles.tileLink}>
          <article style={styles.tile}>
            <div style={styles.tileKicker}>
              <span style={styles.roman}>I.</span>
              <span className="eyebrow">Institutions of Record</span>
            </div>
            <h2 style={styles.tileH}>Manage <em style={styles.italicSm}>Banks</em></h2>
            <p style={styles.tileLede}>
              Maintain the canonical list of banks. Each agency selects from this register; each lead is filed against one of these names.
            </p>
            <div style={styles.tileCta}>Open the bank register &rarr;</div>
          </article>
        </Link>

        <Link to="/admin/agencies" style={styles.tileLink}>
          <article style={{ ...styles.tile, ...styles.tileDark }}>
            <div style={styles.tileKicker}>
              <span style={{ ...styles.roman, color: '#e7c9bd' }}>II.</span>
              <span className="eyebrow" style={{ color: 'rgba(251, 247, 238, 0.55)' }}>Standing Committees</span>
            </div>
            <h2 style={{ ...styles.tileH, color: 'var(--paper)' }}>
              Admit <em style={styles.italicSmDark}>Agencies</em>
            </h2>
            <p style={{ ...styles.tileLede, color: 'rgba(251, 247, 238, 0.78)' }}>
              Invite an agency by email; assign the banks they may service.
              They activate themselves &mdash; you keep the keys.
            </p>
            <div style={{ ...styles.tileCta, color: '#e7c9bd' }}>Open the agency desk &rarr;</div>
          </article>
        </Link>
      </div>

      <hr className="rule" style={{ margin: '40px 0 20px' }} />
      <p style={styles.signoff}>
        &mdash; <em style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>{user.email}</em>, signing in as Mediator.
      </p>
    </>
  );
}

const styles = {
  h1: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(56px, 7vw, 96px)',
    lineHeight: 0.95,
    letterSpacing: '-0.035em',
    fontWeight: 400,
    margin: '14px 0 16px',
  },
  italic: { fontStyle: 'italic', color: 'var(--accent)', fontVariationSettings: '"opsz" 144, "SOFT" 100' },
  italicSm: { fontStyle: 'italic', color: 'var(--accent)' },
  italicSmDark: { fontStyle: 'italic', color: '#e7c9bd' },
  lede: { fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-soft)', maxWidth: 720, margin: 0, lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  tileLink: { textDecoration: 'none' },
  tile: {
    padding: '32px 32px 28px',
    border: '1px solid var(--ink)',
    background: 'var(--surface)',
    minHeight: 280,
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  },
  tileDark: { background: 'var(--ink)', color: 'var(--paper)' },
  tileKicker: { display: 'flex', alignItems: 'center', gap: 10 },
  roman: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 18,
    color: 'var(--accent)',
  },
  tileH: {
    fontFamily: 'var(--font-display)',
    fontSize: 44,
    lineHeight: 1,
    letterSpacing: '-0.02em',
    fontWeight: 400,
    margin: '20px 0 12px',
    color: 'var(--ink)',
  },
  tileLede: {
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    lineHeight: 1.5,
    color: 'var(--ink-soft)',
    margin: 0,
    flex: 1,
  },
  tileCta: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    marginTop: 24,
  },
  signoff: { fontFamily: 'var(--font-display)', color: 'var(--ink-muted)', margin: 0 },
};

export default AdminDashboard;
