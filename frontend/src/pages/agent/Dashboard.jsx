import { useEffect, useState } from 'react';
import { Spin, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import api from '../../api/client';

const cards = [
  { key: 'total', label: 'Total Filings', kicker: 'I' },
  { key: 'active', label: 'In Motion', kicker: 'II' },
  { key: 'approved', label: 'Approved', kicker: 'III', accent: true },
  { key: 'rejected', label: 'Rejected', kicker: 'IV' },
  { key: 'pending', label: 'Pending Review', kicker: 'V' },
  { key: 'earnings', label: 'Earnings', kicker: 'VI', currency: true },
];

function AgentDashboard() {
  const { user } = useSelector((s) => s.auth);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/leads/stats').then((res) => setStats(res.data));
  }, []);

  return (
    <>
      <header style={styles.header}>
        <div className="eyebrow">§ Field Desk &middot; Today's Bulletin</div>
        <h1 style={styles.h1}>
          Good day, <em style={styles.italic}>{(user.name || user.email).split(' ')[0]}.</em>
        </h1>
        <p style={styles.lede}>
          Your filings to date, kept honestly. Each lead is a column &mdash; every status, a quiet correction in the margin.
        </p>
        <hr className="rule-double" style={{ margin: '32px 0' }} />
      </header>

      <section style={styles.referralStrip}>
        <div>
          <div className="eyebrow">Your Referral Cipher</div>
          <Typography.Text
            copyable={{ icon: <CopyOutlined />, text: user.referralCode, tooltips: ['Copy', 'Copied'] }}
            style={styles.cipher}
          >
            {user.referralCode}
          </Typography.Text>
        </div>
        <p style={styles.referralCopy}>
          <i>Pass it on.</i> Each agent you refer becomes a column of their own &mdash; the ledger grows by introduction.
        </p>
      </section>

      <hr className="rule" style={{ margin: '40px 0 28px' }} />

      <div className="eyebrow" style={{ marginBottom: 18 }}>§ Standings</div>

      {!stats ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
      ) : (
        <div style={styles.grid}>
          {cards.map((c) => (
            <article key={c.key} style={{ ...styles.stat, ...(c.accent ? styles.statAccent : null) }}>
              <div style={styles.statKicker}>
                <span style={styles.statRoman}>{c.kicker}</span>
                <span className="eyebrow" style={{ color: c.accent ? '#e7c9bd' : 'var(--ink-muted)' }}>{c.label}</span>
              </div>
              <div style={{ ...styles.statNumber, color: c.accent ? 'var(--paper)' : 'var(--ink)' }} className="tabular">
                {c.currency ? '$' : ''}{Number(stats[c.key] || 0).toLocaleString()}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

const styles = {
  header: { marginBottom: 8 },
  h1: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(56px, 7vw, 96px)',
    lineHeight: 0.95,
    letterSpacing: '-0.035em',
    fontWeight: 400,
    margin: '14px 0 18px',
    color: 'var(--ink)',
  },
  italic: { fontStyle: 'italic', color: 'var(--accent)', fontVariationSettings: '"opsz" 144, "SOFT" 100' },
  lede: {
    fontFamily: 'var(--font-display)',
    fontSize: 19,
    lineHeight: 1.5,
    color: 'var(--ink-soft)',
    margin: 0,
    maxWidth: 720,
  },
  referralStrip: {
    display: 'grid',
    gridTemplateColumns: 'minmax(200px, auto) 1fr',
    gap: 32,
    alignItems: 'center',
    padding: '20px 24px',
    background: 'var(--paper)',
    border: '1px solid var(--rule)',
  },
  cipher: {
    display: 'inline-block',
    marginTop: 8,
    fontFamily: 'var(--font-mono)',
    fontSize: 22,
    letterSpacing: '0.18em',
    color: 'var(--accent)',
  },
  referralCopy: {
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    lineHeight: 1.5,
    color: 'var(--ink-soft)',
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 0,
    border: '1px solid var(--ink)',
  },
  stat: {
    padding: '24px 22px 28px',
    borderRight: '1px solid var(--rule)',
    borderBottom: '1px solid var(--rule)',
    background: 'var(--surface)',
    minHeight: 160,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  statAccent: {
    background: 'var(--ink)',
    color: 'var(--paper)',
    borderRight: '1px solid var(--ink)',
    borderBottom: '1px solid var(--ink)',
  },
  statKicker: { display: 'flex', alignItems: 'baseline', gap: 12 },
  statRoman: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 16,
    color: 'var(--accent)',
    fontVariationSettings: '"opsz" 144',
  },
  statNumber: {
    fontFamily: 'var(--font-display)',
    fontSize: 64,
    lineHeight: 1,
    letterSpacing: '-0.03em',
    fontWeight: 400,
    fontVariationSettings: '"opsz" 144',
  },
};

export default AgentDashboard;
