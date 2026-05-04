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
  PercentageOutlined,
  TrophyOutlined,
  AuditOutlined,
  IdcardOutlined,
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
    { key: '/admin/commission-rules', icon: <PercentageOutlined />, label: <Link to="/admin/commission-rules">Commission Rules</Link> },
    { key: '/admin/volume-bonuses', icon: <TrophyOutlined />, label: <Link to="/admin/volume-bonuses">Volume Bonuses</Link> },
  ],
  agent: [
    { key: '/agent', icon: <DashboardOutlined />, label: <Link to="/agent">Dashboard</Link> },
    { key: '/agent/leads', icon: <UnorderedListOutlined />, label: <Link to="/agent/leads">My Leads</Link> },
    { key: '/agent/leads/new', icon: <FileAddOutlined />, label: <Link to="/agent/leads/new">Submit Lead</Link> },
    { key: '/agent/commissions', icon: <DollarOutlined />, label: <Link to="/agent/commissions">Commissions</Link> },
  ],
  agency: [
    { key: '/agency', icon: <DashboardOutlined />, label: <Link to="/agency">Dashboard</Link> },
    { key: '/agency/leads', icon: <AuditOutlined />, label: <Link to="/agency/leads">Lead Queue</Link> },
  ],
};

const titleByRole = { admin: 'Admin', agency: 'Agency', agent: 'Agent' };

function AppLayout() {
  const { user } = useSelector((s) => s.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { token } = theme.useToken();

  const items = menusByRole[user.role] || [];

  const onMenuAction = ({ key }) => {
    if (key === 'logout') {
      dispatch(logout());
      navigate('/login');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0" theme="dark" width={232}>
        <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#d4a847',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            BC
          </div>
          <div style={{ color: '#fff', lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Bank CRM</div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              {titleByRole[user.role]} Portal
            </div>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          style={{ borderInlineEnd: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            {titleByRole[user.role]} Panel
          </Typography.Title>
          <Dropdown
            menu={{
              items: [
                { key: 'profile', icon: <UserOutlined />, label: user.email, disabled: true },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: 'Logout' },
              ],
              onClick: onMenuAction,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1677ff' }}>
                {(user.name || user.email)[0].toUpperCase()}
              </Avatar>
              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{user.name || user.email}</div>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{titleByRole[user.role]}</div>
              </div>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default AppLayout;
