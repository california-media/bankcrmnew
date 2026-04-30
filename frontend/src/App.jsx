import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Login from './pages/Login';
import Register from './pages/Register';
import SetPassword from './pages/SetPassword';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './pages/admin/Dashboard';
import Banks from './pages/admin/Banks';
import Agencies from './pages/admin/Agencies';
import AgentDashboard from './pages/agent/Dashboard';
import SubmitLead from './pages/agent/SubmitLead';
import MyLeads from './pages/agent/MyLeads';
import AgencyDashboard from './pages/agency/Dashboard';

const theme = {
  token: {
    colorPrimary: '#8b1f1f',
    colorInfo: '#8b1f1f',
    colorSuccess: '#15803d',
    colorWarning: '#a16207',
    colorError: '#7f1d1d',
    colorTextBase: '#1a1410',
    colorBgBase: '#fbf7ee',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBorder: '#d8cfb8',
    colorBorderSecondary: '#ece5d2',
    borderRadius: 2,
    borderRadiusLG: 4,
    borderRadiusSM: 2,
    fontFamily:
      "'Geist', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    wireframe: false,
    controlHeight: 40,
  },
  components: {
    Button: {
      controlHeight: 40,
      fontWeight: 500,
      primaryShadow: 'none',
      defaultShadow: 'none',
    },
    Input: { controlHeight: 40, paddingInline: 12 },
    Select: { controlHeight: 40 },
    Layout: { siderBg: '#1a1410', headerBg: '#fbf7ee', bodyBg: 'transparent', triggerBg: '#1a1410' },
    Menu: {
      darkItemBg: '#1a1410',
      darkSubMenuItemBg: '#1a1410',
      darkItemSelectedBg: '#8b1f1f',
      darkItemHoverBg: '#2a201a',
      darkItemColor: '#bfb8a8',
      darkItemSelectedColor: '#fbf7ee',
      itemBorderRadius: 0,
    },
    Card: { borderRadiusLG: 4, paddingLG: 28 },
    Modal: { borderRadiusLG: 4 },
    Tag: { defaultBg: '#fbf7ee', defaultColor: '#1a1410' },
  },
};

function App() {
  return (
    <ConfigProvider theme={theme}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/set-password" element={<SetPassword />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="banks" element={<Banks />} />
          <Route path="agencies" element={<Agencies />} />
        </Route>

        <Route
          path="/agent"
          element={
            <ProtectedRoute roles={['agent']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AgentDashboard />} />
          <Route path="leads" element={<MyLeads />} />
          <Route path="leads/new" element={<SubmitLead />} />
        </Route>

        <Route
          path="/agency"
          element={
            <ProtectedRoute roles={['agency']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AgencyDashboard />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
