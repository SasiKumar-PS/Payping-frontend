import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../../api';

const Gatekeeper = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isVerified, setIsVerified] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Check if we have already verified the setup in THIS browser session
        const sessionVerified = sessionStorage.getItem('payping_setup_verified');

        // 2. Logic: If verified and we aren't on a setup page, just show the content
        if (sessionVerified === 'true') {
            setIsVerified(true);
            setLoading(false);
            return;
        }

        const runSetupCheck = async () => {
            try {
                const res = await api.get('/payping/accounts/status');
                const { hasAccount, hasWhatsapp, hasBusinessDetails, hasCustomers } = res.data || {};

                // Capture where the user WANTED to go (e.g., /payping/settings)
                const targetPath = location.pathname === '/payping' ? '/payping/dashboard' : location.pathname;

                // The Onboarding Logic Chain
                if (!hasAccount) {
                    navigate('/payping/onboard');
                }else if (!hasWhatsapp) {
                    navigate('/payping/connect');
                } else if (!hasBusinessDetails) {
                    navigate('/payping/business-details');
                } else if (!hasCustomers) {
                    navigate('/payping/add-customers');
                } else {
                    // All satisfied! 
                    sessionStorage.setItem('payping_setup_verified', 'true');
                    setIsVerified(true);
                    
                    // If they came to /payping directly, send to dashboard. 
                    // Otherwise, let them go to their specific intended URL.
                    navigate(targetPath, { replace: true });
                }
            } catch (err) {
                console.error("Setup check failed", err);
                navigate('/'); // Kick back to IAM if backend fails
            } finally {
                setLoading(false);
            }
        };

        runSetupCheck();
    }, [navigate, location.pathname]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-slate-500 text-sm animate-pulse">Checking workspace configuration...</p>
            </div>
        );
    }

    // If verified, render the child routes (Dashboard, etc.)
    return <Outlet />;
};

export default Gatekeeper;