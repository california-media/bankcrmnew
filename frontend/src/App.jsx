import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';
import Login from './pages/Login';
import Register from './pages/Register';
import SetPassword from './pages/SetPassword';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './pages/admin/Dashboard';
import Agencies from './pages/admin/Agencies';
import AdminLeads from './pages/admin/Leads';
import AdminAgents from './pages/admin/Agents';
import VolumeBonuses from './pages/admin/VolumeBonuses';
import CardProducts from './pages/admin/CardProducts';
import LoanProducts from './pages/admin/LoanProducts';
import AdminBanks from './pages/admin/Banks';
import AgentDashboard from './pages/agent/Dashboard';
import SubmitLead from './pages/agent/SubmitLead';
import MyLeads from './pages/agent/MyLeads';
import Commissions from './pages/agent/Commissions';
import AgencyDashboard from './pages/agency/Dashboard';
import AgencyLeads from './pages/agency/Leads';
import AgencyEmployees from './pages/agency/Employees';
import AgencyReceipts from './pages/agency/Receipts';
import Payouts from './pages/admin/Payouts';
import EmployeeStatuses from './pages/admin/EmployeeStatuses';
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeLeads from './pages/employee/AssignedLeads';
import LeadDetail from './pages/leads/LeadDetail';
import Profile from './pages/Profile';

const theme = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#1e40af',
    colorInfo: '#3b82f6',
    borderRadius: 10,
    colorBgLayout: '#eef2f7',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    Layout: { siderBg: '#0f172a', headerBg: '#ffffff', bodyBg: '#eef2f7' },
    Card: { borderRadiusLG: 12 },
    Menu: {
      darkItemBg: '#0f172a',
      darkSubMenuItemBg: '#0f172a',
      darkItemSelectedBg: '#d4a847',
      darkItemSelectedColor: '#0f172a',
      darkItemHoverBg: '#1e293b',
      darkItemColor: '#94a3b8',
    },
    Statistic: { titleFontSize: 12 },
    Table: { rowSelectedBg: '#eff6ff', rowSelectedHoverBg: '#dbeafe', borderRadius: 12 },
    Button: { fontWeight: 500 },
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
          <Route path="agencies" element={<Agencies />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="agents" element={<AdminAgents />} />
          <Route path="volume-bonuses" element={<VolumeBonuses />} />
          <Route path="card-products" element={<CardProducts />} />
          <Route path="loan-products" element={<LoanProducts />} />
          <Route path="banks" element={<AdminBanks />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="employee-statuses" element={<EmployeeStatuses />} />
          <Route path="profile" element={<Profile />} />
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
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="commissions" element={<Commissions />} />
          <Route path="profile" element={<Profile />} />
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
          <Route path="leads" element={<AgencyLeads />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="employees" element={<AgencyEmployees />} />
          <Route path="receipts" element={<AgencyReceipts />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route
          path="/employee"
          element={
            <ProtectedRoute roles={['employee']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<EmployeeDashboard />} />
          <Route path="leads" element={<EmployeeLeads />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
