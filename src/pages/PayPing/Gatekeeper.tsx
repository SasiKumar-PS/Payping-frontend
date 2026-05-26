import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { 
    Loader2, Menu, X, User, MessageCircle, TrendingUp, Users, 
    MessageSquare, Send, History, Settings, LogOut, Bell 
} from 'lucide-react';
import api from '../../api';
import ErrorBanner from '../../components/ErrorBanner';
import SuccessBanner from '../../components/SuccessBanner';

const Gatekeeper = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isVerified, setIsVerified] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Global notification states
    const [globalError, setGlobalError] = useState<string>('');
    const [globalSuccess, setGlobalSuccess] = useState<string>('');

    // Left Panel Drawer State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Global Account Metrics State
    const [metrics, setMetrics] = useState<any>(null);

    // Fetch metrics callback
    const fetchDashboardCorePayload = useCallback(async () => {
        try {
            const res = await api.get('/payping/dashboard/getdata');
            setMetrics(res.data);
        } catch (err) {
            console.error("Failed to load global metrics:", err);
        }
    }, []);

    // Fetch once verified
    useEffect(() => {
        if (isVerified) {
            fetchDashboardCorePayload();
        }
    }, [isVerified, fetchDashboardCorePayload]);

    // ==========================================
    // EFFECT 1: CENTRALIZED NETWORK ERROR/SUCCESS CAPTURE
    // ==========================================
    useEffect(() => {
        const handleGlobalError = (event: Event) => {
            const customEvent = event as CustomEvent<string>;
            setGlobalError(customEvent.detail);
            setTimeout(() => setGlobalError(''), 10000);
        };

        const handleGlobalSuccess = (event: Event) => {
            const customEvent = event as CustomEvent<string>;
            setGlobalSuccess(customEvent.detail);
            setTimeout(() => setGlobalSuccess(''), 10000);
        };

        const handleClearError = () => {
            setGlobalError('');
        };

        const handleSessionExpiry = () => {
            navigate('/', { replace: true });
        };

        const handleRefreshTrigger = () => {
            fetchDashboardCorePayload();
        };

        // Listeners matching Axios Interceptor and custom broadcasts
        window.addEventListener('PAYPING_SYSTEM_ERROR', handleGlobalError);
        window.addEventListener('PAYPING_SYSTEM_SUCCESS', handleGlobalSuccess);
        window.addEventListener('PAYPING_CLEAR_ERROR', handleClearError);
        window.addEventListener('SESSION_EXPIRED', handleSessionExpiry);
        window.addEventListener('PAYPING_REFRESH_METRICS', handleRefreshTrigger);
        
        return () => {
            window.removeEventListener('PAYPING_SYSTEM_ERROR', handleGlobalError);
            window.removeEventListener('PAYPING_SYSTEM_SUCCESS', handleGlobalSuccess);
            window.removeEventListener('PAYPING_CLEAR_ERROR', handleClearError);
            window.removeEventListener('SESSION_EXPIRED', handleSessionExpiry);
            window.removeEventListener('PAYPING_REFRESH_METRICS', handleRefreshTrigger);
        };
    }, [navigate, fetchDashboardCorePayload]);

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
                // const targetPath = location.pathname === '/payping' ? '/payping/dashboard' : location.pathname;
                const targetPath = '/payping/dashboard';    // testing

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

    // ==========================================
    // DYNAMIC RENDER INTERACTION HELPERS
    // ==========================================
    const handleSignOut = () => {
        sessionStorage.clear();
        localStorage.removeItem('token');
        navigate('/', { replace: true });
    };

    const navItems = [
        { path: '/payping/dashboard', label: 'Dashboard Overview', icon: TrendingUp },
        { path: '/payping/customers', label: 'Customer Ledger', icon: Users },
        { path: '/payping/message-templates', label: 'Alert Templates', icon: MessageSquare },
        { path: '/payping/auto-alerts', label: 'Auto Alerts', icon: Bell },
        { path: '/payping/connect', label: 'WhatsApp Connect', icon: MessageCircle },
        { path: '/payping/business-details', label: 'Node Configuration', icon: Settings },
    ];

    const renderNavLinks = () => {
        return (
            <nav className="px-3 py-2 space-y-1 overflow-y-auto flex-1 scrollbar-none">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                        <button 
                            key={item.path}
                            onClick={() => { setIsDrawerOpen(false); navigate(item.path); }} 
                            className={`w-full flex items-center gap-3.5 px-4 py-3 text-sm font-semibold rounded-xl text-left transition-all border ${
                                isActive 
                                    ? 'text-blue-400 bg-blue-500/5 border-blue-500/10' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-850/60 border-transparent'
                            }`}
                        >
                            <Icon className="w-4 h-4 shrink-0" /> {item.label}
                        </button>
                    );
                })}
            </nav>
        );
    };

    const renderProfileCard = () => {
        return (
            <div className="p-4 m-4 bg-slate-950 border border-slate-850/60 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 bg-slate-900 rounded-xl text-slate-400 border border-slate-800 shrink-0">
                            <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-xs font-bold truncate text-slate-200">{metrics?.businessName || "Workspace"}</h4>
                            <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{metrics?.phone || "Disconnected"}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${metrics?.whatsappStatus ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-rose-500'}`} />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            {metrics?.whatsappStatus ? "Active" : "Inactive"}
                        </span>
                    </div>
                </div>

                {!metrics?.whatsappStatus && metrics && (
                    <button 
                        onClick={() => { setIsDrawerOpen(false); navigate('/payping/connect'); }}
                        className="w-full bg-[#128C7E] hover:bg-[#075E54] text-white font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-lg shadow-[#25D366]/10 animate-in fade-in slide-in-from-top-2 duration-200"
                    >
                        <MessageCircle className="w-4 h-4 fill-white text-[#128C7E]" />
                        Connect WhatsApp
                    </button>
                )}
            </div>
        );
    };

    const renderSignOutButton = () => {
        return (
            <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 shrink-0">
                <button 
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 py-3 border border-slate-800 hover:border-red-500/30 hover:bg-red-500/5 text-slate-400 hover:text-red-400 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                    <LogOut className="w-4 h-4" /> Terminate Session
                </button>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-slate-500 text-sm animate-pulse">Checking workspace configuration...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none overflow-x-hidden relative">
            {/* Global Error & Success Banners */}
            <ErrorBanner message={globalError} />
            <SuccessBanner message={globalSuccess} />

            {/* Central layout pane */}
            <div className="flex flex-1 relative min-h-0">
                
                {/* 1. Permanent docked sidebar on computer screens (lg and up) */}
                <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0 h-screen sticky top-0 justify-between z-20">
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <span className="font-black italic tracking-tighter text-xl bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">PayPing</span>
                        </div>
                        {renderProfileCard()}
                        {renderNavLinks()}
                    </div>
                    {renderSignOutButton()}
                </aside>

                {/* 2. Sliding drawer overlay sidebar for mobile/tablets */}
                <div className={`fixed inset-0 z-50 transition-all duration-300 lg:hidden ${isDrawerOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'}`}>
                    <div 
                        onClick={() => setIsDrawerOpen(false)}
                        className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0'}`} 
                    />
                    <aside className={`absolute top-0 bottom-0 left-0 w-[280px] bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-300 transform ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                                <span className="font-black italic tracking-tighter text-lg">WORKSPACE</span>
                                <button onClick={() => setIsDrawerOpen(false)} className="p-1 hover:bg-slate-850 rounded-lg text-slate-400">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            {renderProfileCard()}
                            {renderNavLinks()}
                        </div>
                        {renderSignOutButton()}
                    </aside>
                </div>

                {/* 3. Main Workspace Area */}
                <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">
                    {/* Sticky top layout header */}
                    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md px-5 py-4 border-b border-slate-900 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3.5">
                            {/* Hamburger menu - visible only on mobile/tablet */}
                            <button 
                                onClick={() => setIsDrawerOpen(true)}
                                className="lg:hidden p-1.5 active:bg-slate-900 rounded-xl transition-colors text-slate-300 border-0 bg-transparent outline-none cursor-pointer"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                            <span className="text-xl font-black italic tracking-tighter bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent lg:hidden">
                                PayPing
                            </span>
                            
                            <span className="hidden lg:inline text-sm font-bold text-slate-400">
                                Operational Environment
                            </span>
                        </div>
                        
                        {/* Profile Quick Avatar */}
                        <div 
                            onClick={() => navigate('/payping/business-details')}
                            className="w-9 h-9 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 font-bold text-sm flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                        >
                            {metrics?.ownerName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                    </header>

                    {/* Nested route outlet wrapper */}
                    <div className="flex-1 flex flex-col">
                        <Outlet context={{ metrics, refreshMetrics: fetchDashboardCorePayload }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Gatekeeper;