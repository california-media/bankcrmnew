import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd';
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
    { key: '/admin', icon: <DashboardOutlined />, label: <Link to="/admin">Dashboard</Link> },
    { key: '/admin/banks', icon: <BankOutlined />, label: <Link to="/admin/banks">Banks</Link> },
    { key: '/admin/agencies', icon: <TeamOutlined />, label: <Link to="/admin/agencies">Agencies</Link> },
  ],
  agent: [
    { key: '/agent', icon: <DashboardOutlined />, label: <Link to="/agent">Dashboard</Link> },
    { key: '/agent/leads/new', icon: <FileAddOutlined />, label: <Link to="/agent/leads/new">Submit Lead</Link> },
    { key: '/agent/leads', icon: <UnorderedListOutlined />, label: <Link to="/agent/leads">My Leads</Link> },
  ],
  agency: [
    { key: '/agency', icon: <DashboardOutlined />, label: <Link to="/agency">Dashboard</Link> },
  ],
};

const titleByRole = { admin: 'Admin', agency: 'Agency', agent: 'Agent' };

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
      <Sider breakpoint="lg" collapsedWidth="0" theme="dark">
        <div style={{ color: '#fff', textAlign: 'center', padding: '20px 0', fontWeight: 600, fontSize: 18 }}>
          Bank CRM
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={items} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            <Avatar style={{ backgroundColor: '#1677ff', cursor: 'pointer' }}>
              {(user.name || user.email)[0].toUpperCase()}
            </Avatar>
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
