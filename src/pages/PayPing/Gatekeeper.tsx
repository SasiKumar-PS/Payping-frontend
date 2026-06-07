import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
    Loader2, X, User, MessageCircle, TrendingUp, Users,
    MessageSquare, History, Settings, LogOut, BellRing, BotMessageSquare,
    ClipboardCheck, Sun, Moon, MoreHorizontal, ChevronRight
} from 'lucide-react';
import api from '../../api';
import ErrorBanner from '../../components/ErrorBanner';
import SuccessBanner from '../../components/SuccessBanner';

const Gatekeeper = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Theme Management
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('payping_theme') as 'light' | 'dark') || 'dark';
    });

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('payping_theme', theme);
    }, [theme]);

    // Global notification states
    const [globalError, setGlobalError] = useState<string>('');
    const [globalSuccess, setGlobalSuccess] = useState<string>('');

    // Side panels / Drawers
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
    const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

    // Global Account Metrics State
    const [metrics, setMetrics] = useState<any>(() => {
        const saved = sessionStorage.getItem('payping_global_metrics');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved global metrics", e);
            }
        }
        return null;
    });

    const [reconnecting, setReconnecting] = useState(false);
    const [hasAttemptedReconnect, setHasAttemptedReconnect] = useState(false);

    // Fetch core dashboard metrics payload
    const fetchDashboardCorePayload = useCallback(async () => {
        try {
            const res = await api.get('/payping/dashboard/getdata');
            setMetrics(res.data);
            sessionStorage.setItem('payping_global_metrics', JSON.stringify(res.data));
        } catch (err) {
            console.error("Failed to load global metrics:", err);
        }
    }, []);

    const currentAccountId = localStorage.getItem('selected_account_id');

    useEffect(() => {
        setHasAttemptedReconnect(false);
        setReconnecting(false);
    }, [currentAccountId]);

    // Handle automatic WhatsApp reconnect in background
    useEffect(() => {
        if (!metrics) return;

        if (metrics.whatsappStatus === 'CONNECTED') {
            if (hasAttemptedReconnect) {
                setHasAttemptedReconnect(false);
            }
            return;
        }

        if (metrics.whatsappStatus === 'DISCONNECTED' && !reconnecting && !hasAttemptedReconnect) {
            if (metrics.phone) {
                setReconnecting(true);
                setHasAttemptedReconnect(true);
                api.get(`/payping/whatsapp/session/reconnect/${metrics.phone}`)
                    .then((res) => {
                        const resolvedStatus = res.data;
                        setReconnecting(false);
                        setMetrics((prev: any) => {
                            if (!prev) return null;
                            const updated = { ...prev, whatsappStatus: resolvedStatus };
                            sessionStorage.setItem('payping_global_metrics', JSON.stringify(updated));
                            return updated;
                        });
                    })
                    .catch((err) => {
                        console.error("Error reconnecting WhatsApp session:", err);
                        setReconnecting(false);
                    });
            }
        }
    }, [metrics, reconnecting, hasAttemptedReconnect]);

    // Fetch core metrics when account ID changes or on mount
    useEffect(() => {
        setMetrics(null);
        fetchDashboardCorePayload();
    }, [currentAccountId, fetchDashboardCorePayload]);

    // Global event listeners
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

    const handleSignOut = () => {
        sessionStorage.clear();
        localStorage.clear();
        navigate('/', { replace: true });
    };

    // Navigation configuration
    const sidebarNavItems = [
        { path: '/payping/dashboard', label: 'Dashboard', icon: TrendingUp },
        { path: '/payping/customers', label: 'Customers', icon: Users },
        { path: '/payping/message-templates', label: 'Alert Templates', icon: MessageSquare },
        { path: '/payping/auto-alerts', label: 'Auto Alerts', icon: BellRing },
        { path: '/payping/alert-history', label: 'Alert History', icon: History },
        { path: '/payping/payment-review', label: 'Payment Review', icon: ClipboardCheck },
        { path: '/payping/connect', label: 'WhatsApp', icon: MessageCircle },
        { path: '/payping/settings', label: 'Settings', icon: Settings },
    ];

    // Mobile Bottom Nav Primary Items (exactly 4 items)
    const mobilePrimaryNav = [
        { path: '/payping/dashboard', label: 'Dashboard', icon: TrendingUp },
        { path: '/payping/customers', label: 'Customers', icon: Users },
        { path: '/payping/auto-alerts', label: 'Auto Alerts', icon: BellRing },
        { path: '/payping/alert-history', label: 'Alert History', icon: History },
    ];

    // Mobile More Drawer Items
    const mobileMoreNav = [
        { path: '/payping/connect', label: 'Whatsapp', icon: MessageCircle },
        { path: '/payping/settings', label: 'Settings', icon: Settings },
        { path: '/payping/message-templates', label: 'Alert Templates', icon: MessageSquare },
        { path: '/payping/payment-review', label: 'Payment Review', icon: ClipboardCheck },
    ];

    const renderNavLinks = () => {
        return (
            <nav className="flex-grow overflow-y-auto px-4 py-6 space-y-1 bg-bg-sidebar">
                {sidebarNavItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left font-semibold transition-all border border-transparent outline-none cursor-pointer ${
                                isActive 
                                    ? 'text-accent bg-accent-tint/15 font-bold shadow-sm'
                                    : 'text-text-muted hover:text-text-primary hover:bg-slate-100/40 dark:hover:bg-zinc-800/10'
                            }`}
                        >
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
                            <span className="text-xs">{item.label}</span>
                        </button>
                    );
                })}
            </nav>
        );
    };

    const renderBusinessInfoBox = () => {
        return (
            <div className="premium-card p-4 space-y-4 border-border bg-bg-sidebar">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-bg-main border border-border rounded text-text-muted shrink-0 shadow-sm">
                        <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-xs font-bold truncate text-text-primary uppercase tracking-wide">
                            {metrics?.businessName || "Workspace"}
                        </h4>
                        <p className="text-[11px] text-text-muted font-medium truncate mt-0.5">
                            {metrics?.phone || "No Connection"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">WhatsApp Link</span>
                    <div className="flex items-center gap-1.5">
                        {reconnecting ? (
                            <div className="flex items-center gap-1">
                                <Loader2 className="w-3 h-3 text-accent animate-spin" />
                                <span className="text-[9px] font-bold uppercase text-accent tracking-wider">Connecting</span>
                            </div>
                        ) : metrics?.whatsappStatus === 'CONNECTED' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-widest animate-pulse">
                                Active
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20 uppercase tracking-widest">
                                Inactive
                            </span>
                        )}
                    </div>
                </div>

                {metrics?.whatsappStatus === 'DISCONNECTED' && metrics && !reconnecting && (
                    <button
                        onClick={() => {
                            setIsRightPanelOpen(false);
                            navigate('/payping/connect');
                        }}
                        className="w-full bg-[#128C7E] hover:opacity-95 text-white font-bold py-2 px-3 rounded flex items-center justify-center gap-1.5 text-xs transition-all border-0 shadow-sm cursor-pointer"
                    >
                        <MessageCircle className="w-4 h-4 text-[#128C7E] fill-white" /> Connect WhatsApp
                    </button>
                )}
            </div>
        );
    };



    return (
        <div className="min-h-screen bg-bg-main text-text-primary flex flex-col font-sans select-none overflow-x-hidden relative transition-colors duration-300">
            {/* Global Error & Success Banners */}
            <ErrorBanner message={globalError} />
            <SuccessBanner message={globalSuccess} />

            <div className="flex flex-1 relative min-h-0">

                {/* 1. Permanent docked sidebar on computer screens (lg and up) */}
                <aside className="hidden lg:flex flex-col w-60 border-r border-border shrink-0 h-screen sticky top-0 z-20 bg-bg-sidebar transition-colors duration-300">
                    <div className="flex items-center gap-2 border-b border-border py-5 px-6 shrink-0 bg-bg-sidebar">
                        <BotMessageSquare className="w-6 h-6 text-accent transform scale-x-[-1]" />
                        <span className="brand-logo-text text-text-primary select-none">PayPing</span>
                    </div>
                    {renderNavLinks()}
                </aside>

                {/* 2. Sliding Right Sidepanel Drawer (Desktop & Mobile) */}
                <div className={`fixed inset-0 z-50 transition-all duration-300 ${isRightPanelOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'}`}>
                    <div
                        onClick={() => setIsRightPanelOpen(false)}
                        className={`absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isRightPanelOpen ? 'opacity-100' : 'opacity-0'}`}
                    />
                    <aside className={`absolute top-0 bottom-0 right-0 w-[300px] bg-bg-card border-l border-border flex flex-col justify-between p-6 transition-transform duration-300 transform ${isRightPanelOpen ? 'translate-x-0' : 'translate-x-full'} shadow-2xl z-50`}>
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-border pb-4">
                                <h3 className="text-base font-bold">Account Drawer</h3>
                                <button
                                    onClick={() => setIsRightPanelOpen(false)}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800/25 rounded text-text-muted border-0 bg-transparent cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Business details info box */}
                            {renderBusinessInfoBox()}

                            {/* Navigation button details */}
                            <div className="space-y-2">
                                <button
                                    onClick={() => {
                                        setIsRightPanelOpen(false);
                                        navigate('/payping/settings');
                                    }}
                                    className="w-full premium-btn-secondary flex items-center justify-between py-2.5 px-4 text-xs font-semibold"
                                >
                                    <span className="flex items-center gap-2">
                                        <Settings className="w-4 h-4 text-text-muted" /> Account Settings
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-text-muted" />
                                </button>

                                <button
                                    onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                                    className="w-full premium-btn-secondary flex items-center justify-between py-2.5 px-4 text-xs font-semibold"
                                >
                                    <span className="flex items-center gap-2">
                                        {theme === 'dark' ? (
                                            <>
                                                <Sun className="w-4 h-4 text-amber-500" /> Light Theme Mode
                                            </>
                                        ) : (
                                            <>
                                                <Moon className="w-4 h-4 text-indigo-600" /> Dark Theme Mode
                                            </>
                                        )}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold text-accent">Toggle</span>
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleSignOut}
                            className="w-full premium-btn-secondary border-rose-200 hover:border-rose-500 text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 py-3 flex items-center justify-center gap-2 font-bold text-xs"
                        >
                            <LogOut className="w-4 h-4" /> Terminate Session
                        </button>
                    </aside>
                </div>

                {/* 3. Mobile Bottom Navigation "More" Popover Drawer */}
                <div className={`fixed inset-0 z-50 transition-all duration-300 ${isMobileMoreOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'}`}>
                    <div
                        onClick={() => setIsMobileMoreOpen(false)}
                        className={`absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isMobileMoreOpen ? 'opacity-100' : 'opacity-0'}`}
                    />
                    <div className={`absolute bottom-0 left-0 right-0 bg-bg-card border-t border-border rounded-t-2xl p-6 transition-transform duration-300 transform ${isMobileMoreOpen ? 'translate-y-0' : 'translate-y-full'} shadow-2xl space-y-4 z-50`}>
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <span className="category-label">Operational Menu</span>
                            <button
                                onClick={() => setIsMobileMoreOpen(false)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800/20 rounded text-text-muted border-0 bg-transparent cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {mobileMoreNav.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.path}
                                        onClick={() => {
                                            setIsMobileMoreOpen(false);
                                            navigate(item.path);
                                        }}
                                        className="flex flex-col items-center justify-center gap-2 p-4 border border-border rounded bg-bg-sidebar hover:border-accent text-text-primary hover:text-accent font-semibold transition-all cursor-pointer outline-none"
                                    >
                                        <Icon className="w-5 h-5 text-text-muted group-hover:text-accent" />
                                        <span className="text-xs">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 4. Main Workspace Area */}
                <div className="flex-grow flex flex-col min-w-0 min-h-screen relative pb-16 lg:pb-0">
                    {/* Sticky top layout header */}
                    <header className="sticky top-0 z-30 bg-bg-main/80 backdrop-blur-md px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            {/* Logo Display (Hamburger menu completely removed on mobile) */}
                            <div className="flex items-center gap-2">
                                <BotMessageSquare className="w-5 h-5 text-accent transform scale-x-[-1]" />
                                <span className="brand-logo-text text-text-primary text-base select-none">
                                    PayPing
                                </span>
                            </div>

                            <span className="hidden lg:inline text-xs font-bold text-text-muted uppercase tracking-wider">
                                Operational Workspace
                            </span>
                        </div>

                        {/* Top Bar Right Items */}
                        <div className="flex items-center gap-3">
                            {/* Theme Toggle Button */}
                            <button
                                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-text-muted hover:text-text-primary transition-all cursor-pointer border-0 bg-transparent outline-none"
                                title="Toggle Theme"
                            >
                                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                            </button>

                            {/* Profile avatar button triggering right account drawer (avatar only, no name) */}
                            <button
                                onClick={() => setIsRightPanelOpen(true)}
                                className="w-8 h-8 rounded bg-accent text-white font-extrabold text-sm flex items-center justify-center uppercase shrink-0 hover:opacity-90 transition-all outline-none cursor-pointer border-0 shadow-sm"
                                title={metrics?.ownerName || 'Account'}
                            >
                                {metrics?.ownerName?.charAt(0).toUpperCase() || 'U'}
                            </button>
                        </div>
                    </header>

                    {/* Nested route outlet wrapper */}
                    <div className="flex-grow p-0 overflow-y-auto">
                        <Outlet context={{ metrics, refreshMetrics: fetchDashboardCorePayload, reconnecting }} />
                    </div>
                </div>

                {/* 5. Mobile Bottom Navigation Bar (Mobile only, docked bottom) */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-card border-t border-border flex items-center justify-around py-2 shadow-lg">
                    {mobilePrimaryNav.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`flex flex-col items-center gap-1 border-0 bg-transparent cursor-pointer outline-none transition-all ${
                                    isActive ? 'text-accent' : 'text-text-muted'
                                }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-[10px] font-bold">{item.label}</span>
                            </button>
                        );
                    })}

                    <button
                        onClick={() => setIsMobileMoreOpen(true)}
                        className="flex flex-col items-center gap-1 border-0 bg-transparent cursor-pointer outline-none text-text-muted hover:text-text-primary"
                    >
                        <MoreHorizontal className="w-5 h-5" />
                        <span className="text-[10px] font-bold">More</span>
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Gatekeeper;