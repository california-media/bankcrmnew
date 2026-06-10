import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterAgency from './pages/RegisterAgency';
import ReferralForm from './pages/ReferralForm';
import SetPassword from './pages/SetPassword';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './pages/admin/Dashboard';
import Agencies from './pages/admin/Agencies';
import AdminLeads from './pages/admin/Leads';
import AdminAgents from './pages/admin/Agents';
import AgentDetail from './pages/admin/AgentDetail';
import CardProducts from './pages/admin/CardProducts';
import LoanProducts from './pages/admin/LoanProducts';
import AdminBanks from './pages/admin/Banks';
import AgentDashboard from './pages/agent/Dashboard';
import SubmitLead from './pages/agent/SubmitLead';
import MyLeads from './pages/agent/MyLeads';
import Commissions from './pages/agent/Commissions';
import AgentProducts from './pages/agent/Products';
import AgencyDashboard from './pages/agency/Dashboard';
import AgencyLeads from './pages/agency/Leads';
import AgencyEmployees from './pages/agency/Employees';
import AgencyPayouts from './pages/agency/Payouts';
import ConsentLogs from './pages/agency/ConsentLogs';
import Pipeline from './pages/agency/Pipeline';
import Payouts from './pages/admin/Payouts';
import Receive from './pages/admin/Receive';
import EmployeeStatuses from './pages/admin/EmployeeStatuses';
import BucketRequests from './pages/admin/BucketRequests';
import Inquiries from './pages/admin/Inquiries';
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeLeads from './pages/employee/AssignedLeads';
import LeadDetail from './pages/leads/LeadDetail';
import Profile from './pages/Profile';
import TermsAndConditions from './pages/TermsAndConditions';
import Notifications from './pages/Notifications';
import UaePassCallback from './pages/UaePassCallback';

const theme = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#4f46e5',
    colorInfo: '#6366f1',
    borderRadius: 10,
    colorBgLayout: '#fdfeff',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    Layout: { siderBg: '#0d1117', headerBg: '#ffffff', bodyBg: '#fdfeff' },
    Card: { borderRadiusLG: 12 },
    Menu: {
      darkItemBg: '#0d1117',
      darkSubMenuItemBg: '#0d1117',
      darkItemSelectedBg: 'rgba(99,102,241,0.18)',
      darkItemSelectedColor: '#a5b4fc',
      darkItemHoverBg: 'rgba(255,255,255,0.05)',
      darkItemColor: '#64748b',
      darkItemHoverColor: '#e2e8f0',
      itemSelectedColor: '#a5b4fc',
    },
    Statistic: { titleFontSize: 12 },
    Table: { rowSelectedBg: '#eff6ff', rowSelectedHoverBg: '#dbeafe', borderRadius: 12, headerBg: '#fdfeff' },
    Button: { fontWeight: 500 },
  },
};

function App() {
  return (
    <ConfigProvider theme={theme}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/agency" element={<RegisterAgency />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/auth/uaepass/callback" element={<UaePassCallback />} />
        <Route path="/ref/:code" element={<ReferralForm />} />

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
          <Route path="agents/:id" element={<AgentDetail />} />
          <Route path="card-products" element={<CardProducts />} />
          <Route path="loan-products" element={<LoanProducts />} />
          <Route path="banks" element={<AdminBanks />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="receive" element={<Receive />} />
          <Route path="employee-statuses" element={<EmployeeStatuses />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="consent-logs" element={<ConsentLogs />} />
          <Route path="bucket-requests" element={<BucketRequests />} />
          <Route path="inquiries" element={<Inquiries />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
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
          <Route path="products" element={<AgentProducts />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Profile />} />
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
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="payouts" element={<AgencyPayouts />} />
          <Route path="consent-logs" element={<ConsentLogs />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
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
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="consent-logs" element={<ConsentLogs />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
