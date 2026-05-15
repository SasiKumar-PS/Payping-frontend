import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WelcomePage from './pages/IAM/WelcomePage';
import LoginRequestPage from './pages/IAM/LoginRequestPage';
import VerifyOtpPage from './pages/IAM/VerifyOtpPage';
import RegisterPage from './pages/IAM/RegisterPage';
import ProfilePage from './pages/IAM/ProfilePage';
import Onboard from './pages/PayPing/Onboard';
import WhatsAppConnect from './pages/PayPing/WhatsAppConnect';
import Gatekeeper from './pages/PayPing/Gatekeeper';
import BusinessDetails from './pages/PayPing/BusinessDetails';
import ProtectedRoute from './components/ProtectedRoute';


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<LoginRequestPage />} />
        <Route path="/verify" element={<VerifyOtpPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes (Only for logged-in users) */}
        <Route element={<ProtectedRoute />}>
            <Route path="/payping" element={<Gatekeeper />}>
              {/* These sub-routes are what <Outlet /> renders */}
              
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/onboard" element={<Onboard />} />
              <Route path="/connect" element={<WhatsAppConnect />} />
              <Route path="/business-details" element={<BusinessDetails />} />
              {/* <Route path="add-customers" element={<AddCustomers />} /> */}
              {/* <Route path="dashboard" element={<Dashboard />} /> */}
              
              {/* Add any other payping sub-pages here */}
            </Route>



          {/* <Route path="/profile" element={<ProfilePage />} />
          <Route path="/payping/onboard" element={<PayPingOnboard />} />
          <Route path="/payping/connect" element={<WhatsAppConnect />} />
          <Route path="/payping/index" element={<Index />} />
          <Route path="/payping/business-details" element={<BusinessDetails />} /> */}
          {/* Future PayPing routes will go here too */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;