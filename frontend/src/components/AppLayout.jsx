import { Layout, Menu, Avatar, Dropdown } from 'antd';
import {
  DashboardOutlined,
  BankOutlined,
  TeamOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';

const { Header, Sider, Content } = Layout;

const menusByRole = {
  admin: [
    { key: '/admin', icon: <DashboardOutlined />, label: <Link to="/admin">Editorial Desk</Link> },
    { key: '/admin/banks', icon: <BankOutlined />, label: <Link to="/admin/banks">Banks</Link> },
    { key: '/admin/agencies', icon: <TeamOutlined />, label: <Link to="/admin/agencies">Agencies</Link> },
  ],
  agent: [
    { key: '/agent', icon: <DashboardOutlined />, label: <Link to="/agent">Field Desk</Link> },
    { key: '/agent/leads/new', icon: <FileAddOutlined />, label: <Link to="/agent/leads/new">File a Lead</Link> },
    { key: '/agent/leads', icon: <UnorderedListOutlined />, label: <Link to="/agent/leads">My Filings</Link> },
  ],
  agency: [
    { key: '/agency', icon: <DashboardOutlined />, label: <Link to="/agency">Standing Desk</Link> },
  ],
};

const roleLabels = { admin: 'The Mediator', agency: 'The Agency', agent: 'The Field' };

function AppLayout() {
  const { user } = useSelector((s) => s.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const items = menusByRole[user.role] || [];

  const onMenuAction = ({ key }) => {
    if (key === 'logout') {
      dispatch(logout());
      navigate('/login');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        width={240}
        style={{
          background: 'var(--ink)',
          borderRight: '1px solid var(--ink)',
          backgroundImage: 'radial-gradient(rgba(251, 247, 238, 0.025) 1px, transparent 1px)',
          backgroundSize: '4px 4px',
        }}
      >
        <div style={brand.box}>
          <div className="eyebrow" style={{ color: 'rgba(251, 247, 238, 0.45)' }}>
            § Vol. I
          </div>
          <div style={brand.word}>
            The Bank<br />
            <em style={brand.italic}>Ledger</em>.
          </div>
          <div style={brand.role}>{roleLabels[user.role]}</div>
        </div>
        <hr style={brand.rule} />
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          style={{ background: 'transparent', borderInlineEnd: 0, fontFamily: 'var(--font-body)', fontSize: 14 }}
        />
      </Sider>
      <Layout>
        <Header style={header.bar}>
          <div style={header.dateline}>
            <span className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <span style={header.dot}>&middot;</span>
            <span className="eyebrow">{user.role.toUpperCase()} EDITION</span>
          </div>
          <Dropdown
            menu={{
              items: [
                { key: 'profile', icon: <UserOutlined />, label: user.email, disabled: true },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: 'Log out' },
              ],
              onClick: onMenuAction,
            }}
          >
            <div style={header.avatarWrap}>
              <span style={header.avatarName}>{user.name || user.email}</span>
              <Avatar style={header.avatar}>
                {(user.name || user.email)[0].toUpperCase()}
              </Avatar>
            </div>
          </Dropdown>
        </Header>
        <Content style={content.box}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

const brand = {
  box: { padding: '28px 24px 8px' },
  word: {
    fontFamily: 'var(--font-display)',
    fontSize: 28,
    lineHeight: 1,
    letterSpacing: '-0.03em',
    color: 'var(--paper)',
    marginTop: 14,
  },
  italic: {
    fontStyle: 'italic',
    color: '#e7c9bd',
    fontVariationSettings: '"opsz" 144, "SOFT" 100',
  },
  role: {
    marginTop: 14,
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#e7c9bd',
  },
  rule: {
    border: 0,
    borderTop: '1px solid rgba(251, 247, 238, 0.7)',
    borderBottom: '1px solid rgba(251, 247, 238, 0.7)',
    height: 4,
    margin: '20px 0',
  },
};

const header = {
  bar: {
    background: 'var(--paper)',
    padding: '0 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--ink)',
    height: 64,
  },
  dateline: { display: 'flex', alignItems: 'center', gap: 12 },
  dot: { color: 'var(--ink-muted)' },
  avatarWrap: { display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' },
  avatarName: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontSize: 16,
    color: 'var(--ink)',
  },
  avatar: {
    background: 'var(--ink)',
    color: 'var(--paper)',
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    border: '1px solid var(--ink)',
  },
};

const content = {
  box: {
    margin: 32,
    padding: '40px 44px',
    background: 'var(--surface)',
    border: '1px solid var(--rule)',
    boxShadow: 'var(--shadow-paper)',
  },
};

export default AppLayout;
