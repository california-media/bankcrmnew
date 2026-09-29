import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterAgency from './pages/RegisterAgency';
import ReferralForm from './pages/ReferralForm';
import TrackStatus from './pages/TrackStatus';
import SetPassword from './pages/SetPassword';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import InvoiceView from './pages/InvoiceView';
import AdminDashboard from './pages/admin/Dashboard';
import Agencies from './pages/admin/Agencies';
import AdminLeads from './pages/admin/Leads';
import AdminAgents from './pages/admin/Agents';
import AgentDetail from './pages/admin/AgentDetail';
import CardProducts from './pages/admin/CardProducts';
import FeaturedProducts from './pages/admin/FeaturedProducts';
import AdminResources from './pages/admin/Resources';
import LoanProducts from './pages/admin/LoanProducts';
import AccountProducts from './pages/admin/AccountProducts';
import AdminBanks from './pages/admin/Banks';
import AgentDashboard from './pages/agent/Dashboard';
import SubmitLead from './pages/agent/SubmitLead';
import MyLeads from './pages/agent/MyLeads';
import Commissions from './pages/agent/Commissions';
import AgentProducts from './pages/agent/Products';
import AgentSettings from './pages/agent/Settings';
import AgentPromotions from './pages/agent/Promotions';
import AgentResources from './pages/agent/Resources';
import AgencyDashboard from './pages/agency/Dashboard';
import AgencyLeads from './pages/agency/Leads';
import AgencyEmployees from './pages/agency/Employees';
import Agents from './pages/agency/Agents';
import AgencyRolesPermissions from './pages/agency/RolesPermissions';
import AgencyPayouts from './pages/agency/Payouts';
import AgencyInvoices from './pages/agency/Invoices';
import AgencyAgentPayouts from './pages/agency/AgentPayouts';
import ConsentLogs from './pages/agency/ConsentLogs';
import Pipeline from './pages/agency/Pipeline';
import Payouts from './pages/admin/Payouts';
import Receive from './pages/admin/Receive';
import AgencyLedger from './pages/admin/AgencyLedger';
import CreditNotes from './pages/admin/CreditNotes';
import Invoices from './pages/admin/Invoices';
import Promotions from './pages/admin/Promotions';
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
import AdminNotices from './pages/admin/Notices';
import AdminBlog from './pages/admin/Blog';
import LegalPages from './pages/admin/LegalPages';
import AdminReports from './pages/admin/Reports';
import ManageAdmins from './pages/admin/ManageAdmins';
import AgencyReports from './pages/agency/Reports';
import AgentReports from './pages/agent/Reports';
import VerifyEmail from './pages/VerifyEmail';

const theme = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#7C3AED',
    colorInfo: '#0EA5E9',
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
      darkItemSelectedBg: 'rgba(124,58,237,0.18)',
      darkItemSelectedColor: '#c4b5fd',
      darkItemHoverBg: 'rgba(255,255,255,0.05)',
      darkItemColor: '#64748b',
      darkItemHoverColor: '#e2e8f0',
      itemSelectedColor: '#c4b5fd',
    },
    Statistic: { titleFontSize: 12 },
    Table: { rowSelectedBg: '#f5f3ff', rowSelectedHoverBg: '#ede9fe', borderRadius: 12, headerBg: '#fdfeff' },
    Button: { fontWeight: 500 },
  },
};

function App() {
  return (
    // virtual={false}: disables antd's virtual-scroll dropdown list app-wide.
    // On mobile, rc-virtual-list's touch scroll containment is flaky — a
    // scroll gesture inside a long Select dropdown (Nationality, City, Bank,
    // ...) sometimes leaks through and scrolls the page behind it instead.
    // Plain (non-virtual) rendering uses a normal scrollable div, which
    // touch browsers contain correctly. All these dropdown lists are a few
    // hundred options at most, so there's no real perf cost either.
    <ConfigProvider theme={theme} virtual={false}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/agency" element={<RegisterAgency />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/auth/uaepass/callback" element={<UaePassCallback />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/ref/:code" element={<ReferralForm />} />
        <Route path="/track-status" element={<TrackStatus />} />
        {/* Standalone, no sidebar — this is what "View" opens in a new tab.
            Server-side getOne/pdf still scope by agency, so this URL is only
            ever useful to someone already authorized for that invoice. */}
        <Route
          path="/invoices/:id/view"
          element={
            <ProtectedRoute roles={['admin', 'agency', 'employee']}>
              <InvoiceView />
            </ProtectedRoute>
          }
        />

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
          <Route path="featured-products" element={<FeaturedProducts />} />
          <Route path="resources" element={<AdminResources />} />
          <Route path="loan-products" element={<LoanProducts />} />
          <Route path="account-products" element={<AccountProducts />} />
          <Route path="banks" element={<AdminBanks />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="receive" element={<Receive />} />
          <Route path="agency-ledger" element={<AgencyLedger />} />
          <Route path="credit-notes" element={<CreditNotes />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="promotions" element={<Promotions />} />
          <Route path="employee-statuses" element={<EmployeeStatuses />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="consent-logs" element={<ConsentLogs />} />
          <Route path="bucket-requests" element={<BucketRequests />} />
          <Route path="inquiries" element={<Inquiries />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="notices" element={<AdminNotices />} />
          <Route path="blog" element={<AdminBlog />} />
          <Route path="legal-pages" element={<LegalPages />} />
          <Route path="reports" element={<AdminReports initialTab="performance" />} />
          <Route path="margin-report" element={<AdminReports initialTab="margin" />} />
          <Route path="manage-admins" element={<ManageAdmins />} />
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
          <Route path="reports" element={<AgentReports />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Profile />} />
          <Route path="promotions" element={<AgentPromotions />} />
          <Route path="resources" element={<AgentResources />} />
        </Route>

        <Route
          path="/agency"
          element={
            /* 'employee' is also allowed here for Agency Coordinator/Account
               Access — a plain CPV/Sales employee reaching this by URL still
               gets refused per-endpoint by the backend (see
               allowEmployeeTypes in auth.middleware.js), so this widening
               only opens the door, not the data. */
            <ProtectedRoute roles={['agency', 'employee']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AgencyDashboard />} />
          <Route path="leads" element={<AgencyLeads />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="employees" element={<AgencyEmployees />} />
          <Route path="agents" element={<Agents />} />
          <Route path="leads/new" element={<SubmitLead />} />
          <Route path="roles-permissions" element={<AgencyRolesPermissions />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="payouts" element={<AgencyPayouts />} />
          <Route path="invoices" element={<AgencyInvoices />} />
          <Route path="consent-logs" element={<ConsentLogs />} />
          <Route path="agent-payouts" element={<AgencyAgentPayouts />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="reports" element={<AgencyReports />} />
          <Route path="resources" element={<AgentResources />} />
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
          <Route path="resources" element={<AgentResources />} />
        </Route>

        <Route
          path="/blog_editor"
          element={
            <ProtectedRoute roles={['blog_editor']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminBlog />} />
          <Route path="blog" element={<AdminBlog />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
