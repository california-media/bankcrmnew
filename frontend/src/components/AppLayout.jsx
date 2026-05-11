import { Layout, Menu, Avatar, Dropdown, Typography, theme } from 'antd';
import {
  DashboardOutlined,
  BankOutlined,
  TeamOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
  LogoutOutlined,
  UserOutlined,
  DollarOutlined,
  TrophyOutlined,
  AuditOutlined,
  IdcardOutlined,
  CreditCardOutlined,
  FundOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';

const { Header, Sider, Content } = Layout;

const menusByRole = {
  admin: [
    { key: '/admin', icon: <DashboardOutlined />, label: <Link to="/admin">Overview</Link> },
    { key: '/admin/leads', icon: <AuditOutlined />, label: <Link to="/admin/leads">All Leads</Link> },
    { key: '/admin/agents', icon: <IdcardOutlined />, label: <Link to="/admin/agents">Agents</Link> },
    { key: '/admin/agencies', icon: <TeamOutlined />, label: <Link to="/admin/agencies">Agencies</Link> },
    { key: '/admin/banks', icon: <BankOutlined />, label: <Link to="/admin/banks">Banks</Link> },
    { key: '/admin/card-products', icon: <CreditCardOutlined />, label: <Link to="/admin/card-products">Card Products</Link> },
    { key: '/admin/loan-products', icon: <FundOutlined />, label: <Link to="/admin/loan-products">Loan Products</Link> },
    { key: '/admin/volume-bonuses', icon: <TrophyOutlined />, label: <Link to="/admin/volume-bonuses">Volume Bonuses</Link> },
    { key: '/admin/payouts', icon: <DollarOutlined />, label: <Link to="/admin/payouts">Payouts</Link> },
    { key: '/admin/employee-statuses', icon: <UnorderedListOutlined />, label: <Link to="/admin/employee-statuses">Lead Status</Link> },
  ],
  agent: [
    { key: '/agent', icon: <DashboardOutlined />, label: <Link to="/agent">Dashboard</Link> },
    { key: '/agent/leads', icon: <UnorderedListOutlined />, label: <Link to="/agent/leads">My Leads</Link> },
    { key: '/agent/leads/new', icon: <FileAddOutlined />, label: <Link to="/agent/leads/new">New Lead</Link> },
    { key: '/agent/commissions', icon: <DollarOutlined />, label: <Link to="/agent/commissions">Commissions</Link> },
  ],
  agency: [
    { key: '/agency', icon: <DashboardOutlined />, label: <Link to="/agency">Dashboard</Link> },
    { key: '/agency/leads', icon: <AuditOutlined />, label: <Link to="/agency/leads">Lead Queue</Link> },
    { key: '/agency/employees', icon: <TeamOutlined />, label: <Link to="/agency/employees">Employees</Link> },
    { key: '/agency/receipts', icon: <FileAddOutlined />, label: <Link to="/agency/receipts">Receipts</Link> },
  ],
  employee: [
    { key: '/employee', icon: <DashboardOutlined />, label: <Link to="/employee">Dashboard</Link> },
    { key: '/employee/leads', icon: <UnorderedListOutlined />, label: <Link to="/employee/leads">My Leads</Link> },
  ],
};

const titleByRole = { admin: 'Admin', agency: 'Agency', agent: 'Agent', employee: 'Employee' };

const ROLE_COLORS = {
  admin: '#7c3aed',
  agency: '#1e40af',
  agent: '#0f766e',
  employee: '#b45309',
};

function AppLayout() {
  const { user } = useSelector((s) => s.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { token } = theme.useToken();

  const items = menusByRole[user.role] || [];
  const roleColor = ROLE_COLORS[user.role] || '#1e40af';

  const onMenuAction = ({ key }) => {
    if (key === 'logout') {
      dispatch(logout());
      navigate('/login');
    }
    if (key === 'profile') {
      navigate(`/${user.role}/profile`);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0" theme="dark" width={240}
        style={{ background: '#0d1117' }}
      >
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13, letterSpacing: 0.5,
              boxShadow: '0 4px 12px rgba(99,102,241,0.45)',
            }}>
              BC
            </div>
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14, lineHeight: 1.2, letterSpacing: 0.1 }}>Bank CRM</div>
              <div style={{ fontSize: 9.5, color: '#475569', textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 2 }}>
                {titleByRole[user.role]} Portal
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 16px 8px' }} />

        {/* User badge */}
        <div style={{ padding: '10px 16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
            <Avatar size={30} style={{ background: roleColor, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
              {(user.name || user.email)[0].toUpperCase()}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name || user.email}
              </div>
              <div style={{ color: '#475569', fontSize: 10 }}>{titleByRole[user.role]}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 8px' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#334155', padding: '0 8px', marginBottom: 6 }}>
            Navigation
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={items}
            style={{
              borderInlineEnd: 0,
              background: 'transparent',
              '--ant-menu-item-border-radius': '8px',
            }}
          />
        </div>
      </Sider>

      <Layout>
        <Header style={{
          padding: '0 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 8px rgba(15,23,42,0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#ffffff',
        }}>
          <div>
            <Typography.Text style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              {titleByRole[user.role]} Panel
            </Typography.Text>
          </div>
          <Dropdown
            menu={{
              items: [
                { key: 'profile', icon: <UserOutlined />, label: 'My Profile' },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
              ],
              onClick: onMenuAction,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Avatar style={{ backgroundColor: roleColor, fontWeight: 700 }}>
                {(user.name || user.email)[0].toUpperCase()}
              </Avatar>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{user.name || user.email}</div>
                <div style={{ fontSize: 11, color: token.colorTextSecondary }}>{titleByRole[user.role]}</div>
              </div>
              <DownOutlined style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2 }} />
            </div>
          </Dropdown>
        </Header>

        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(15,23,42,0.06)', minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default AppLayout;
