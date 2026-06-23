import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import InitialWelcomePage from './pages/IAM/InitialWelcomePage';
import LoginRequestPage from './pages/IAM/LoginRequestPage';
import VerifyOtpPage from './pages/IAM/VerifyOtpPage';
import RegisterPage from './pages/IAM/RegisterPage';
import ProfilePage from './pages/IAM/ProfilePage';
import Onboard from './pages/PayPing/Onboard';
import WhatsAppConnect from './pages/PayPing/WhatsAppConnect';

import Gatekeeper from './pages/PayPing/Gatekeeper';
import AccountSettingsPage from './pages/PayPing/AccountSettingsPage';
import Dashboard from './pages/PayPing/Dashboard';
import Customers from './pages/PayPing/Customers';
import MessageTemplates from './pages/PayPing/MessageTemplates';
import AutoAlerts from './pages/PayPing/AutoAlerts';
import AlertHistory from './pages/PayPing/AlertHistory';
import PaymentReview from './pages/PayPing/PaymentReview';
import ProtectedRoute from './components/ProtectedRoute';
import { InstallAppBanner } from './components/InstallAppBanner';

function App() {
  return (
    <Router>
      <InstallAppBanner />
      <Routes>
        <Route path="/" element={<InitialWelcomePage />} />
        <Route path="/login" element={<LoginRequestPage />} />
        <Route path="/verify" element={<VerifyOtpPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProfilePage />} />


        

        {/* Protected Routes (Only for logged-in users) */}
        <Route element={<ProtectedRoute />}>

          <Route path="/payping/onboard" element={<Onboard />} />
            {/* With gatekeeper comment started */}
            <Route path="/payping" element={<Gatekeeper />}>
              {/* These sub-routes are what <Outlet /> renders */}
              
              <Route path="connect" element={<WhatsAppConnect />} />
              <Route path="settings" element={<AccountSettingsPage />} />
              <Route path="business-details" element={<AccountSettingsPage />} />

              <Route path="dashboard" element={<Dashboard />} />
              <Route path="customers" element={<Customers />} />
              <Route path="message-templates" element={<MessageTemplates />} />
              <Route path="auto-alerts" element={<AutoAlerts />} />
              <Route path="alert-history" element={<AlertHistory />} />
              <Route path="payment-review" element={<PaymentReview />} />
              
              
              {/* Add any other payping sub-pages here */}
            </Route>
            {/* gatekeeper comment ends */}

            {/* <Route path="/payping/onboard" element={<Onboard />} />
            <Route path="/payping/connect" element={<WhatsAppConnect />} />

            <Route path="/payping/dashboard" element={<Dashboard />} /> */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;