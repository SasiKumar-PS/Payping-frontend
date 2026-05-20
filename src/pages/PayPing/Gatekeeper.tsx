import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../../api';
import ErrorBanner from '../../components/ErrorBanner'; // Import your custom error block

const Gatekeeper = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isVerified, setIsVerified] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // NEW: Global error message state shared across all child views
    const [globalError, setGlobalError] = useState<string>('');

    // ==========================================
    // EFFECT 1: CENTRALIZED NETWORK ERROR CAPTURE
    // ==========================================
    useEffect(() => {
        const handleGlobalError = (event: Event) => {
            const customEvent = event as CustomEvent<string>;
            setGlobalError(customEvent.detail);
            
            // Optional: Automatically auto-dismiss the banner window after 7 seconds
            setTimeout(() => setGlobalError(''), 20000);
        };

        const handleClearError = () => {
            setGlobalError('');
        };

        const handleSessionExpiry = () => {
            navigate('/', { replace: true });
        };

        // Bind listener strings matching your Axios Interceptor streams
        window.addEventListener('PAYPING_SYSTEM_ERROR', handleGlobalError);
        window.addEventListener('PAYPING_CLEAR_ERROR', handleClearError);
        window.addEventListener('SESSION_EXPIRED', handleSessionExpiry);
        
        return () => {
            window.removeEventListener('PAYPING_SYSTEM_ERROR', handleGlobalError);
            window.removeEventListener('PAYPING_CLEAR_ERROR', handleClearError);
            window.removeEventListener('SESSION_EXPIRED', handleSessionExpiry);
        };
    }, [navigate]);

    // ==========================================
    // EFFECT 2: PRE-EXISTING ONBOARDING ROUTE CHECKS
    // ==========================================
    useEffect(() => {
        const sessionVerified = sessionStorage.getItem('payping_setup_verified');

        if (sessionVerified === 'true') {
            setIsVerified(true);
            setLoading(false);
            return;
        }

        const runSetupCheck = async () => {
            try {
                const res = await api.get('/payping/accounts/status');
                const { hasAccount, hasWhatsapp, hasBusinessDetails, hasCustomers } = res.data || {};
                const targetPath = location.pathname === '/payping' ? '/payping/dashboard' : location.pathname;

                if (!hasAccount) {
                    navigate('/payping/onboard');
                } else if (!hasWhatsapp) {
                    navigate('/payping/connect');
                } else if (!hasBusinessDetails) {
                    navigate('/payping/business-details');
                } else if (!hasCustomers) {
                    navigate('/payping/add-customers');
                } else {
                    sessionStorage.setItem('payping_setup_verified', 'true');
                    setIsVerified(true);
                    navigate(targetPath, { replace: true });
                }
            } catch (err) {
                console.error("Setup check failed", err);
                navigate('/'); 
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

    // ==========================================
    // RENDER INTERCEPT: GLOBAL INJECTION LAYER
    // ==========================================
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col">
            <ErrorBanner message={globalError} />
            <div className="flex-1">
                <Outlet />
            </div>
        </div>
    );
};

export default Gatekeeper;