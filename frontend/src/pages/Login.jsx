import { useEffect } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/slices/authSlice';

function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, status, error } = useSelector((s) => s.auth);

  useEffect(() => {
    if (user) navigate(`/${user.role}`, { replace: true });
  }, [user, navigate]);

  useEffect(() => () => dispatch(clearError()), [dispatch]);

  const onFinish = (values) => dispatch(login(values));

  return (
    <div style={styles.shell}>
      <aside style={styles.left}>
        <div style={styles.leftInner}>
          <div className="eyebrow" style={{ color: 'rgba(251, 247, 238, 0.55)', marginBottom: 28 }}>
            Vol. I &middot; No. 001 &middot; Est. MMXXVI
          </div>
          <h1 style={styles.masthead}>
            The <em style={styles.italic}>Bank</em>
            <br />
            Ledger.
          </h1>
          <hr style={styles.leftRule} />
          <p style={styles.tagline}>
            A disciplined account of leads, agencies and the banks that move them &mdash;
            <span style={{ fontStyle: 'italic' }}> kept honestly, in a single book.</span>
          </p>

          <div style={styles.colophon}>
            <div className="eyebrow" style={{ color: 'rgba(251, 247, 238, 0.45)', marginBottom: 8 }}>
              Today's Departments
            </div>
            <ol style={styles.dept}>
              <li><span style={styles.deptNum}>I.</span> Agents &mdash; <i>field correspondents</i></li>
              <li><span style={styles.deptNum}>II.</span> Agencies &mdash; <i>standing committees</i></li>
              <li><span style={styles.deptNum}>III.</span> The Mediator &mdash; <i>editor-in-chief</i></li>
            </ol>
          </div>
        </div>
        <div style={styles.leftFoot}>
          <span className="eyebrow" style={{ color: 'rgba(251, 247, 238, 0.4)' }}>§ Daily, since 2026</span>
        </div>
      </aside>

      <main style={styles.right}>
        <div style={styles.formBox}>
          <div className="eyebrow">§ Sign in</div>
          <h2 style={styles.h2}>
            Welcome <em style={styles.italicSm}>back.</em>
          </h2>
          <p style={styles.lede}>
            One ledger for admins, agencies and agents. Enter your credentials to continue your work.
          </p>
          <hr className="rule" style={{ margin: '24px 0' }} />

          {error && <Alert type="error" message={error} style={{ marginBottom: 16, borderRadius: 2 }} />}

          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              name="email"
              label={<span className="eyebrow">Email Address</span>}
              rules={[{ required: true, type: 'email' }]}
            >
              <Input placeholder="you@firm.example" />
            </Form.Item>
            <Form.Item
              name="password"
              label={<span className="eyebrow">Password</span>}
              rules={[{ required: true }]}
            >
              <Input.Password placeholder="••••••••" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={status === 'loading'} block style={styles.cta}>
              Enter the Ledger &rarr;
            </Button>
          </Form>

          <hr className="rule" />
          <p style={styles.subnav}>
            New field agent? <Link to="/register" style={styles.link}>Register a column &rarr;</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

const styles = {
  shell: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 4fr)',
    background: 'var(--paper)',
  },
  left: {
    position: 'relative',
    background: 'var(--ink)',
    color: 'var(--paper)',
    padding: '48px 56px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundImage:
      'radial-gradient(rgba(251, 247, 238, 0.03) 1px, transparent 1px)',
    backgroundSize: '4px 4px',
  },
  leftInner: { maxWidth: 560 },
  masthead: {
    fontFamily: 'var(--font-display)',
    fontVariationSettings: '"opsz" 144, "SOFT" 30',
    fontSize: 'clamp(64px, 9vw, 128px)',
    lineHeight: 0.92,
    letterSpacing: '-0.04em',
    fontWeight: 400,
    color: 'var(--paper)',
    margin: 0,
  },
  italic: {
    fontStyle: 'italic',
    fontVariationSettings: '"opsz" 144, "SOFT" 100',
    color: '#e7c9bd',
  },
  italicSm: {
    fontStyle: 'italic',
    color: 'var(--accent)',
    fontVariationSettings: '"opsz" 144',
  },
  leftRule: {
    border: 0,
    borderTop: '1px solid rgba(251, 247, 238, 0.7)',
    borderBottom: '1px solid rgba(251, 247, 238, 0.7)',
    height: 5,
    margin: '40px 0 28px',
  },
  tagline: {
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    lineHeight: 1.4,
    letterSpacing: '-0.005em',
    color: 'rgba(251, 247, 238, 0.92)',
    margin: 0,
    maxWidth: 460,
  },
  colophon: { marginTop: 56 },
  dept: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    color: 'rgba(251, 247, 238, 0.85)',
    lineHeight: 1.9,
  },
  deptNum: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    letterSpacing: '0.08em',
    color: '#e7c9bd',
    marginRight: 12,
    display: 'inline-block',
    width: 24,
  },
  leftFoot: { marginTop: 24 },
  right: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 32px',
  },
  formBox: { width: '100%', maxWidth: 440 },
  h2: {
    fontFamily: 'var(--font-display)',
    fontSize: 56,
    lineHeight: 1,
    letterSpacing: '-0.03em',
    margin: '12px 0 16px',
    fontWeight: 400,
    color: 'var(--ink)',
  },
  lede: {
    fontFamily: 'var(--font-display)',
    fontSize: 17,
    lineHeight: 1.5,
    color: 'var(--ink-soft)',
    margin: 0,
  },
  cta: {
    height: 48,
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    background: 'var(--ink)',
    borderColor: 'var(--ink)',
  },
  subnav: {
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    color: 'var(--ink-soft)',
    margin: 0,
    fontStyle: 'italic',
  },
  link: { color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 3 },
};

export default Login;
