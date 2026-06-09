import { Layout, Menu, Avatar, Dropdown, Typography, Badge, Popover, Button, Space, theme, ConfigProvider } from 'antd';
import {
  DashboardOutlined, BankOutlined, TeamOutlined, FileAddOutlined,
  UnorderedListOutlined, LogoutOutlined, UserOutlined, DollarOutlined,
  AuditOutlined, IdcardOutlined, CreditCardOutlined, FundOutlined,
  DownOutlined, InboxOutlined, AppstoreOutlined,
  BellOutlined, PlusCircleOutlined, CheckCircleOutlined,
  UserAddOutlined, SyncOutlined, MessageOutlined, ProjectOutlined, WalletOutlined,
  SettingOutlined, MailOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { NotificationsProvider, useNotificationsContext } from '../contexts/NotificationsContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Header, Sider, Content } = Layout;

const TYPE_ICONS = {
  lead_created:            <PlusCircleOutlined />,
  status_changed:          <CheckCircleOutlined />,
  lead_assigned:           <UserAddOutlined />,
  employee_status_updated: <SyncOutlined />,
  note_added:              <MessageOutlined />,
  commission_payable:      <DollarOutlined />,
};

const TYPE_COLORS = {
  lead_created:            '#4f46e5',
  status_changed:          '#16a34a',
  lead_assigned:           '#2563eb',
  employee_status_updated: '#0891b2',
  note_added:              '#d97706',
  commission_payable:      '#16a34a',
};

const menusByRole = {
  admin: [
    { key: '/admin',                   icon: <DashboardOutlined />,    label: <Link to="/admin">Overview</Link> },
    { key: '/admin/leads',             icon: <AuditOutlined />,        label: <Link to="/admin/leads">All Leads</Link> },
    { key: '/admin/agents',            icon: <IdcardOutlined />,       label: <Link to="/admin/agents">Agents</Link> },
    { key: '/admin/agencies',          icon: <TeamOutlined />,         label: <Link to="/admin/agencies">Agencies</Link> },
    { key: '/admin/banks',             icon: <BankOutlined />,         label: <Link to="/admin/banks">Banks</Link> },
    { key: '/admin/card-products',     icon: <CreditCardOutlined />,   label: <Link to="/admin/card-products">Card Products</Link> },
    { key: '/admin/loan-products',     icon: <FundOutlined />,         label: <Link to="/admin/loan-products">Loan Products</Link> },
    { key: '/admin/payouts',           icon: <DollarOutlined />,       label: <Link to="/admin/payouts">Payouts</Link> },
    { key: '/admin/receive',           icon: <InboxOutlined />,        label: <Link to="/admin/receive">Receive</Link> },
    { key: '/admin/employee-statuses', icon: <UnorderedListOutlined />,label: <Link to="/admin/employee-statuses">Lead Status</Link> },
    { key: '/admin/pipeline',          icon: <ProjectOutlined />,      label: <Link to="/admin/pipeline">Pipeline</Link> },
    { key: '/admin/consent-logs',      icon: <MessageOutlined />,      label: <Link to="/admin/consent-logs">Consent Logs</Link> },
    { key: '/admin/bucket-requests',   icon: <WalletOutlined />,       label: <Link to="/admin/bucket-requests">Bucket Requests</Link> },
    { key: '/admin/inquiries',         icon: <MailOutlined />,         label: <Link to="/admin/inquiries">Inquiries</Link> },
    { key: '/admin/notifications',     icon: <BellOutlined />,         label: <Link to="/admin/notifications">Notifications</Link> },
  ],
  agent: [
    { key: '/agent',                  icon: <DashboardOutlined />,    label: <Link to="/agent">Dashboard</Link> },
    { key: '/agent/leads',            icon: <UnorderedListOutlined />,label: <Link to="/agent/leads">My Leads</Link> },
    { key: '/agent/leads/new',        icon: <FileAddOutlined />,      label: <Link to="/agent/leads/new">New Lead</Link> },
    { key: '/agent/commissions',      icon: <DollarOutlined />,       label: <Link to="/agent/commissions">Payouts</Link> },
    { key: '/agent/products',         icon: <AppstoreOutlined />,     label: <Link to="/agent/products">Products</Link> },

    { key: '/agent/notifications',    icon: <BellOutlined />,         label: <Link to="/agent/notifications">Notifications</Link> },
    { key: '/agent/settings',         icon: <SettingOutlined />,      label: <Link to="/agent/settings">Settings</Link> },
  ],
  agency: [
    { key: '/agency',                 icon: <DashboardOutlined />,    label: <Link to="/agency">Dashboard</Link> },
    { key: '/agency/leads',           icon: <AuditOutlined />,        label: <Link to="/agency/leads">Lead Queue</Link> },
    { key: '/agency/pipeline',        icon: <ProjectOutlined />,      label: <Link to="/agency/pipeline">Pipeline</Link> },
    { key: '/agency/employees',       icon: <TeamOutlined />,         label: <Link to="/agency/employees">Employees</Link> },
    { key: '/agency/payouts',         icon: <DollarOutlined />,       label: <Link to="/agency/payouts">Payouts</Link> },
    { key: '/agency/consent-logs',     icon: <MessageOutlined />,      label: <Link to="/agency/consent-logs">Consent Logs</Link> },
    { key: '/agency/notifications',   icon: <BellOutlined />,         label: <Link to="/agency/notifications">Notifications</Link> },
  ],
  employee: [
    { key: '/employee',               icon: <DashboardOutlined />,    label: <Link to="/employee">Dashboard</Link> },
    { key: '/employee/leads',         icon: <UnorderedListOutlined />,label: <Link to="/employee/leads">My Leads</Link> },
    { key: '/employee/pipeline',      icon: <ProjectOutlined />,      label: <Link to="/employee/pipeline">Pipeline</Link> },
    { key: '/employee/consent-logs',  icon: <MessageOutlined />,      label: <Link to="/employee/consent-logs">Consent Logs</Link> },
    { key: '/employee/notifications', icon: <BellOutlined />,         label: <Link to="/employee/notifications">Notifications</Link> },
  ],
};

const titleByRole = { admin: 'Admin', agency: 'Agency', agent: 'Agent', employee: 'Employee' };

const ROLE_COLORS = { admin: '#7c3aed', agency: '#1e40af', agent: '#0f766e', employee: '#b45309' };

function NotifDropdown({ notifications, role, markRead, markAllRead, navigate }) {
  const recent = notifications.slice(0, 5);
  return (
    <div style={{ width: 320 }}>
      {!recent.length && (
        <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No notifications yet
        </div>
      )}
      {recent.map((n) => (
        <div
          key={n._id}
          onClick={() => {
            if (n.lead) navigate(`/${role}/leads/${n.lead}`);
            if (!n.isRead) markRead([String(n._id)]);
          }}
          style={{
            padding: '10px 14px',
            cursor: n.lead ? 'pointer' : 'default',
            background: n.isRead ? 'transparent' : '#eff6ff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}
        >
          <div style={{ color: TYPE_COLORS[n.type] || '#4f46e5', fontSize: 15, marginTop: 2, flexShrink: 0 }}>
            {TYPE_ICONS[n.type] || <BellOutlined />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: n.isRead ? 400 : 600, fontSize: 13, color: '#0f172a' }}>
              {({ 'New Lead Submitted': 'New Lead', 'Lead Approved': 'Application Approved', 'Lead Disbursed': 'Application Disbursed', 'Lead Rejected': 'Application Rejected' }[n.title] || n.title)}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{dayjs(n.createdAt).fromNow()}</div>
          </div>
          {!n.isRead && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', marginTop: 5, flexShrink: 0 }} />}
        </div>
      ))}
      <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
        <Button size="small" type="link" style={{ padding: 0, fontSize: 12 }} onClick={markAllRead}>
          Mark all read
        </Button>
        <Link to={`/${role}/notifications`} style={{ fontSize: 12, color: '#4f46e5' }}>View all →</Link>
      </div>
    </div>
  );
}

function AppLayoutInner() {
  const { user } = useSelector((s) => s.auth);
  const location  = useLocation();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const { token } = theme.useToken();
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationsContext();

  const items    = menusByRole[user.role] || [];
  const roleColor = ROLE_COLORS[user.role] || '#1e40af';

  const onMenuAction = ({ key }) => {
    if (key === 'logout')  { dispatch(logout()); navigate('/login'); }
    if (key === 'profile') navigate(`/${user.role}/profile`);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0" theme="light" width={240}
        style={{ background: '#ffffff', borderRight: '1px solid #e2e8f0' }}
      >
        <div style={{ padding: '16px 16px 12px' }}>
          <div>
            <img src="/logo.png" alt="Bank CRM" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 3, fontWeight: 500 }}>
              {titleByRole[user.role]} Portal
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: '#e2e8f0', margin: '0 12px 8px' }} />

        <div style={{ padding: '6px 12px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Avatar size={28} style={{ background: roleColor, fontWeight: 600, fontSize: 11, flexShrink: 0 }}>
              {(user.name || user.email)[0].toUpperCase()}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#0f172a', fontSize: 12, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name || user.email}
              </div>
              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 400 }}>{titleByRole[user.role]}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 8px' }}>
          <div style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.4, color: '#94a3b8', padding: '0 8px', marginBottom: 4 }}>
            Navigation
          </div>
          <ConfigProvider theme={{
            token: { fontSize: 13.5 },
            components: { Menu: {
              itemColor: '#6b7280',
              itemHoverColor: '#1e293b',
              itemHoverBg: '#f1f5f9',
              itemSelectedColor: '#4f46e5',
              itemSelectedBg: '#ede9fe',
              itemBorderRadius: 8,
              itemHeight: 38,
              itemMarginInline: 0,
              itemPaddingInline: 10,
            }},
          }}>
            <Menu
              theme="light" mode="inline"
              selectedKeys={[location.pathname]}
              items={items}
              style={{ borderInlineEnd: 0, background: 'transparent', fontWeight: 400 }}
            />
          </ConfigProvider>
        </div>
      </Sider>

      <Layout>
        <Header style={{
          padding: '0 28px', height: 'auto', lineHeight: 'normal',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(15,23,42,0.05)',
          position: 'sticky', top: 0, zIndex: 100, background: '#ffffff',
          minHeight: 56,
        }}>
          <div>
            <Typography.Text style={{ fontSize: 14, fontWeight: 500, color: '#374151', whiteSpace: 'nowrap', display: 'block' }}>
              {titleByRole[user.role]} Panel
            </Typography.Text>
            <div style={{ fontSize: 11, color: '#b0b8c8', marginTop: 1, fontWeight: 400 }}>
              {dayjs().format('dddd, MMMM D, YYYY')}
            </div>
          </div>

          <Space size={16} align="center">
            <Popover
              placement="bottomRight"
              trigger="click"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 200 }}>
                  <span style={{ fontWeight: 700 }}>Notifications</span>
                </div>
              }
              content={
                <NotifDropdown
                  notifications={notifications}
                  role={user.role}
                  markRead={markRead}
                  markAllRead={markAllRead}
                  navigate={navigate}
                />
              }
            >
              <Badge count={unreadCount} overflowCount={99} size="small">
                <div
                  style={{ cursor: 'pointer', padding: '4px 6px', borderRadius: 8 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <BellOutlined style={{ fontSize: 18, color: '#475569' }} />
                </div>
              </Badge>
            </Popover>

            <Dropdown menu={{ items: [
              { key: 'profile', icon: <UserOutlined />, label: 'My Profile' },
              { type: 'divider' },
              { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
            ], onClick: onMenuAction }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', borderRadius: 8 }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Avatar style={{ backgroundColor: roleColor, fontWeight: 700 }}>
                  {(user.name || user.email)[0].toUpperCase()}
                </Avatar>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: '#0f172a' }}>{user.name || user.email}</div>
                  <div style={{ fontSize: 11, fontWeight: 400, color: token.colorTextSecondary }}>{titleByRole[user.role]}</div>
                </div>
                <DownOutlined style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2 }} />
              </div>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: '0', padding: '20px 24px 28px', background: 'transparent', minHeight: 280 }}>
          <div style={{ maxWidth: 1160, margin: '0 auto' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

function AppLayout() {
  return (
    <NotificationsProvider>
      <AppLayoutInner />
    </NotificationsProvider>
  );
}

export default AppLayout;
