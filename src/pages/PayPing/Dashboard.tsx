import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
    BarChart, Bar, Legend
} from 'recharts';
import {
    Menu, X, User, MessageSquare, Send, History,
    Settings, LogOut, MessageCircle, Mail, AlertTriangle,
    TrendingUp, CheckCircle, HelpCircle, ShieldAlert, Users, ExternalLink, UserPlus, Building2
} from 'lucide-react';
import api from '../../api';
import ErrorBanner from '../../components/ErrorBanner';

// TypeScript payload interfaces
interface DashboardData {
    businessName: string;
    ownerName: string;
    phone: string;
    whatsappStatus: 'CONNECTED' | 'DISCONNECTED' | 'SERVER_ISSUE';
    upiUrl: string;
    estimatedRevenue: number;
    totalPaidAmount: number;
    dueAmount: number;
    revenueLeakage: number;
    paidCustomersCount: number;
    unpaidCustomersCount: number;
    overdueCustomersCount: number;
    paymentStatus?: string;
    hasBusinessDetails: boolean;
    hasCustomers: boolean;
}

interface ChartRecord {
    month: string;
    collected: number;
    due: number;
    paidCustomers: number;
    unpaidCustomers: number;
}

interface AccountDTO {
    id: string;
    accountName: string;
    businessName: string;
    productName: string;
    status: string;
    customerCount?: number;
}

const Dashboard = () => {
    const navigate = useNavigate();
    const { metrics, refreshMetrics, reconnecting } = useOutletContext<{
        metrics: DashboardData | null,
        refreshMetrics: () => void,
        reconnecting: boolean
    }>();

    // UI Layout States
    const [timeFrame, setTimeFrame] = useState<'3M' | '6M' | '1Y'>('3M');
    const [chartMode, setChartMode] = useState<'financial' | 'customers'>('financial');
    const [loading, setLoading] = useState(true);

    // Business Metric States
    const [chartData, setChartData] = useState<ChartRecord[]>([]);

    // Accounts state
    const [accounts, setAccounts] = useState<AccountDTO[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);

    // Payment message states
    const [paymentMessage, setPaymentMessage] = useState<string>('');
    const [loadingPaymentMessage, setLoadingPaymentMessage] = useState<boolean>(false);

    useEffect(() => {
        // Fetch dashboard data on mount (this ensures Gatekeeper always syncs when viewing dashboard)
        refreshMetrics();
        // Initial performance charts load
        fetchDashboardPerformance();
        // Fetch linked accounts
        fetchAccounts();
    }, []);

    useEffect(() => {
        fetchDashboardPerformance();
    }, [timeFrame]);

    const fetchDashboardPerformance = async () => {
        try {
            setLoading(true);
            const chartRes = await api.get(`/payping/dashboard/performance?range=${timeFrame}`);
            setChartData(chartRes.data);
        } catch (err) {
            console.error("Performance loading error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAccounts = async () => {
        try {
            setLoadingAccounts(true);
            const res = await api.get('/payping/accounts/getAll');
            const data = Array.isArray(res.data) ? res.data : [];
            setAccounts(data);
        } catch (err) {
            console.error("Failed to load accounts:", err);
        } finally {
            setLoadingAccounts(false);
        }
    };

    const handleSwitchWorkspace = (accountId: string, businessName: string) => {
        try {
            localStorage.setItem('selected_account_id', accountId);
            window.dispatchEvent(new CustomEvent('PAYPING_REFRESH_METRICS'));
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                detail: `Switched to workspace: ${businessName || accountId}`
            }));
            refreshMetrics();
            fetchDashboardPerformance();
            fetchAccounts();
        } catch (err) {
            console.error("Failed to switch workspace:", err);
        }
    };

    useEffect(() => {
        if (metrics && (metrics.paymentStatus === 'GRACE_PERIOD' || metrics.paymentStatus === 'INACTIVE')) {
            const fetchPaymentMessage = async () => {
                try {
                    setLoadingPaymentMessage(true);
                    const res = await api.get('/payping/dashboard/payment-message');
                    // Treat string or object response
                    setPaymentMessage(typeof res.data === 'string' ? res.data : (res.data?.message || 'Please make a payment soon to avoid service interruption.'));
                } catch (err) {
                    console.error("Failed to load payment status message:", err);
                    setPaymentMessage('Please make a payment soon to avoid service interruption.');
                } finally {
                    setLoadingPaymentMessage(false);
                }
            };
            fetchPaymentMessage();
        }
    }, [metrics]);

    if (!metrics) {
        return (
            <div className="min-h-screen bg-transparent flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-t-transparent border-indigo-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <main className="flex-1 w-full max-w-none mx-auto px-4 md:px-8 py-4 space-y-4 pb-16 animate-in fade-in duration-300">

            {/* Page Header */}
            <div className="mb-2">
                <h1 className="text-3xl font-extrabold uppercase tracking-wider text-text-heading">Dashboard</h1>
                <p className="text-xs text-text-muted mt-1">Real-time business performance metrics & action vectors.</p>
            </div>

            {/* ALERT BOXES AT THE TOP */}
            <div className="space-y-4">
                {/* 1. Subscription & Payment Warning Box */}
                {metrics.paymentStatus && metrics.paymentStatus !== 'ACTIVE' && (
                    <div className={`p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm border ${metrics.paymentStatus === 'GRACE_PERIOD'
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-350 border-amber-200/50 dark:border-amber-900/30'
                            : 'bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-350 border-rose-200/50 dark:border-rose-900/30'
                        }`}>
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl shrink-0 ${metrics.paymentStatus === 'GRACE_PERIOD' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                }`}>
                                <AlertTriangle className="w-6 h-6 animate-bounce" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold tracking-tight">
                                    {metrics.paymentStatus === 'GRACE_PERIOD' ? 'Action Required: Subscription Grace Period' : 'Account Dues Penalty: System Inactive'}
                                </h4>
                                {loadingPaymentMessage ? (
                                    <div className="h-4 w-48 bg-border rounded animate-pulse" />
                                ) : (
                                    <p className="text-xs text-text-muted leading-relaxed">
                                        {paymentMessage || (metrics.paymentStatus === 'GRACE_PERIOD'
                                            ? 'Your subscription is currently in a grace period. Please settle pending dues to avoid interruption.'
                                            : 'Please clear your billing dues to restore automatic text relays and system configurations.')}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                                    detail: "Redirecting to subscription portal... Secure payment processor initialized!"
                                }));
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 cursor-pointer self-start md:self-center"
                        >
                            Make Payment
                        </button>
                    </div>
                )}

                {/* 2. WhatsApp Disconnection Warning Box */}
                {metrics.whatsappStatus === 'DISCONNECTED' && !reconnecting && (
                    <div className="p-5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 border border-rose-200/50 dark:border-rose-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-600 dark:text-rose-400 shrink-0">
                                <ShieldAlert className="w-6 h-6 animate-pulse" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold tracking-tight">WhatsApp Link Disconnected</h4>
                                <p className="text-xs text-text-muted leading-relaxed">
                                    Your WhatsApp is disconnected. Please click the connect button to link your device.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/payping/connect')}
                            className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold py-2 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 cursor-pointer self-start md:self-center"
                        >
                            Connect
                        </button>
                    </div>
                )}

                {/* 3. Business Details Warning Box */}
                {metrics.hasBusinessDetails === false && (
                    <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-600 dark:text-orange-400 shrink-0">
                                <Settings className="w-6 h-6 animate-pulse" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold tracking-tight">Complete Business Details</h4>
                                <p className="text-xs text-text-muted leading-relaxed">
                                    Your business profile is incomplete. Please provide the necessary details to configure automated reminders.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/payping/business-details')}
                            className="bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-bold py-2 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 cursor-pointer self-start md:self-center"
                        >
                            <Settings className="w-4 h-4" /> Setup Details
                        </button>
                    </div>
                )}

                {/* 4. Add Customers Warning Box */}
                {metrics.hasCustomers === false && (
                    <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-600 dark:text-orange-400 shrink-0">
                                <UserPlus className="w-6 h-6 animate-pulse" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold tracking-tight">Add Your Customers</h4>
                                <p className="text-xs text-text-muted leading-relaxed">
                                    You have no customers in your registry. Add customers to start tracking and sending reminders.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/payping/customers', { state: { action: 'add' } })}
                            className="bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-bold py-2 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 cursor-pointer self-start md:self-center"
                        >
                            <UserPlus className="w-4 h-4" /> Add Customers
                        </button>
                    </div>
                )}
            </div>

            {/* BLOCK 1: INTEGRATED BUSINESS METRICS SUMMARY */}
            <section className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Business Summary</h3>

                {/* Unified, Borderless Stats Row & Ledger Switcher */}
                <div className="bg-bg-card border border-border/50 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
                    {/* Seamless Stats Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative">
                        <div className="space-y-1">
                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Est. Revenue</span>
                            <div className="text-2xl font-sans font-semibold text-text-heading">
                                ₹{metrics?.estimatedRevenue?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>

                        {/* Divider lines on wide screen */}
                        <div className="absolute top-1/2 -translate-y-1/2 left-[25%] w-px h-8 bg-border/40 hidden lg:block" />

                        <div className="space-y-1 lg:pl-6">
                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Collected Vol</span>
                            <div className="text-2xl font-sans font-semibold text-emerald-600 dark:text-emerald-400">
                                ₹{metrics?.totalPaidAmount?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>

                        <div className="absolute top-1/2 -translate-y-1/2 left-[50%] w-px h-8 bg-border/40 hidden lg:block" />

                        <div className="space-y-1 lg:pl-6">
                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Outstanding Due</span>
                            <div className="text-2xl font-sans font-semibold text-amber-600 dark:text-amber-500">
                                ₹{metrics?.dueAmount?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>

                        <div className="absolute top-1/2 -translate-y-1/2 left-[75%] w-px h-8 bg-border/40 hidden lg:block" />

                        <div className="space-y-1 lg:pl-6">
                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block flex items-center gap-1">
                                Leakage <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                            </span>
                            <div className="text-2xl font-sans font-semibold text-rose-600 dark:text-rose-500">
                                ₹{metrics?.revenueLeakage?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-border/40" />

                    {/* Integrated Clickable Ledger Status Segment Controller */}
                    <div className="grid grid-cols-3 gap-3 bg-bg-subtle p-1.5 rounded-xl border border-border/50">
                        <button
                            onClick={() => navigate('/payping/customers', { state: { filter: 'PAID' } })}
                            className="bg-transparent hover:bg-bg-hover py-3 rounded-lg text-center transition-all cursor-pointer group active:scale-[0.98] flex flex-col items-center border-0 outline-none"
                        >
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1 group-hover:text-emerald-500 transition-colors">Paid Users</span>
                            <span className="text-2xl font-sans font-semibold text-text-heading">{metrics?.paidCustomersCount || 0}</span>
                        </button>

                        <button
                            onClick={() => navigate('/payping/customers', { state: { filter: 'UNPAID' } })}
                            className="bg-transparent hover:bg-bg-hover py-3 rounded-lg text-center transition-all cursor-pointer group active:scale-[0.98] flex flex-col items-center border-0 outline-none"
                        >
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1 group-hover:text-amber-500 transition-colors">Unpaid</span>
                            <span className="text-2xl font-sans font-semibold text-text-heading">{metrics?.unpaidCustomersCount || 0}</span>
                        </button>

                        <button
                            onClick={() => navigate('/payping/customers', { state: { filter: 'OVERDUE' } })}
                            className="bg-transparent hover:bg-bg-hover py-3 rounded-lg text-center transition-all cursor-pointer group active:scale-[0.98] flex flex-col items-center border-0 outline-none"
                        >
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1 group-hover:text-rose-500 transition-colors">Overdue</span>
                            <span className="text-2xl font-sans font-semibold text-rose-600 dark:text-rose-400">{metrics?.overdueCustomersCount || 0}</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* BLOCK 2: HISTORICAL CHARTS */}
            <section className="bg-bg-card border border-border/50 rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">Business Performance</h3>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Chart Toggle */}
                        <div className="flex p-0.5 bg-bg-subtle border border-border/40 rounded-lg text-[10px] font-bold shadow-inner">
                            <button
                                onClick={() => setChartMode('financial')}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer border-0 outline-none ${chartMode === 'financial' ? 'bg-indigo-600 dark:bg-indigo-600 text-white shadow' : 'text-text-muted'}`}
                            >
                                Valuation
                            </button>
                            <button
                                onClick={() => setChartMode('customers')}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer border-0 outline-none ${chartMode === 'customers' ? 'bg-indigo-600 dark:bg-indigo-600 text-white shadow' : 'text-text-muted'}`}
                            >
                                Volumes
                            </button>
                        </div>
                    </div>
                </div>

                {/* Dynamic Chart Container */}
                <div className="w-full h-72 bg-bg-subtle border border-slate-200/40 dark:border-transparent rounded-xl p-4 pt-14 relative flex items-center justify-center font-mono text-xs shadow-inner">
                    {/* Range Delta Selector Inside Chart Container Block */}
                    <div className="absolute top-3 right-3 z-10 flex p-0.5 bg-bg-elevated/90 border border-border/50 rounded-lg text-[10px] font-bold shadow-lg">
                        {(['3M', '6M', '1Y'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeFrame(range)}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer border-0 outline-none ${timeFrame === range ? 'bg-bg-subtle text-text-heading shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-2 text-text-muted">
                            <div className="w-5 h-5 border-2 border-t-transparent border-indigo-500 rounded-full animate-spin" />
                            <span className="text-[10px] uppercase font-bold tracking-wider">Syncing historical performance...</span>
                        </div>
                    ) : chartData.length === 0 ? (
                        <span className="text-text-muted italic">No historical traces available</span>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            {chartMode === 'financial' ? (
                                <AreaChart data={chartData} margin={{ top: 5, right: 30, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorDue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} interval={0} tickFormatter={(tick) => tick.substring(0, 3)} />
                                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'transparent', borderRadius: '12px', fontSize: '11px', color: '#f1f5f9', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }} />
                                    <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCollected)" />
                                    <Area type="monotone" dataKey="due" name="Due" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDue)" />
                                </AreaChart>
                            ) : (
                                <BarChart data={chartData} margin={{ top: 5, right: 30, left: -10, bottom: 0 }}>
                                    <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} interval={0} tickFormatter={(tick) => tick.substring(0, 3)} />
                                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'transparent', borderRadius: '12px', fontSize: '11px', color: '#f1f5f9', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }} />
                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                                    <Bar dataKey="paidCustomers" name="Paid Customers" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="unpaidCustomers" name="Unpaid Customers" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    )}
                </div>
            </section>
            {/* BLOCK 3: QUICK RELAYS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="bg-bg-card border border-border/50 rounded-2xl p-4 md:p-5 space-y-3 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted dark:text-zinc-400 mb-1">Quick Vector Relays</h4>

                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/payping/customers', { state: { action: 'add' } })}
                            className="flex-1 bg-bg-subtle hover:bg-bg-hover p-5 rounded-xl border border-border/40 flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer group outline-none"
                        >
                            <UserPlus className="w-5 h-5 text-indigo-500" />
                            <span className="text-xs font-bold text-text-primary">Add Customer</span>
                        </button>

                        <button
                            onClick={() => navigate('/payping/message-templates')}
                            className="flex-1 bg-bg-subtle hover:bg-bg-hover p-5 rounded-xl border border-border/40 flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer group outline-none"
                        >
                            <Send className="w-5 h-5 text-emerald-500" />
                            <span className="text-xs font-bold text-text-primary">Manage Templates</span>
                        </button>
                    </div>
                </section>

                {/* BLOCK 4: OPERATIONAL METADATA & SUPPORT */}
                <section className="bg-bg-card border border-border/50 rounded-2xl p-4 md:p-5 flex flex-col justify-between gap-3 shadow-sm">
                    <div className="space-y-1">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Operational Payment Router VPA</span>
                        <span className="text-sm font-mono font-bold text-text-primary block truncate mt-1">
                            {metrics?.upiUrl || "No Active Routing Channel Registered"}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <a
                            href="https://wa.me/919876543210"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 p-3 bg-bg-subtle hover:bg-bg-hover rounded-xl border border-border/40 active:scale-[0.98] transition-all group shrink-0"
                        >
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20 transition-colors shrink-0">
                                <MessageCircle className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs font-bold block text-text-primary">WhatsApp Help</span>
                                <span className="text-[9px] text-text-muted block truncate">Support Node</span>
                            </div>
                        </a>

                        <a
                            href="mailto:support@payping.in"
                            className="flex items-center gap-3 p-3 bg-bg-subtle hover:bg-bg-hover rounded-xl border border-border/40 active:scale-[0.98] transition-all group shrink-0"
                        >
                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500/20 transition-colors shrink-0">
                                <Mail className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs font-bold block text-text-primary">Email Desk</span>
                                <span className="text-[9px] text-text-muted block truncate">Support Desk</span>
                            </div>
                        </a>
                    </div>
                </section>
            </div>

            {/* BLOCK 5: PAYPING WORKSPACES */}
            {(accounts.length > 0 || loadingAccounts) && (
                <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted ml-1">PayPing Workspaces</h3>
                    {loadingAccounts ? (
                        <div className="flex items-center gap-2 text-text-muted py-4">
                            <div className="w-4 h-4 border-2 border-t-transparent border-indigo-500 rounded-full animate-spin" />
                            <span className="text-xs">Loading workspaces...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {accounts.map((account) => {
                                const isActive = account.id === localStorage.getItem('selected_account_id');
                                const customerCount = account.customerCount ?? (account as any).customersCount ?? 0;
                                return (
                                    <div
                                        key={account.id}
                                        onClick={() => !isActive && handleSwitchWorkspace(account.id, account.businessName || account.accountName)}
                                        className={`bg-bg-card border rounded-xl p-4 flex flex-col gap-3 shadow-sm transition-all ${
                                            isActive
                                                ? 'border-indigo-400/60 dark:border-indigo-500/40'
                                                : 'border-border/40 cursor-pointer hover:border-indigo-400/60 dark:hover:border-indigo-500/40'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
                                                    <Building2 className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-text-primary truncate">
                                                        {account.businessName || account.accountName || `Workspace`}
                                                    </p>
                                                    <p className="text-[9px] text-text-muted font-mono truncate">
                                                        {account.id?.slice(0, 12)}...
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`shrink-0 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded tracking-widest border ${
                                                isActive
                                                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                                    : account.status === 'ACTIVE'
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                        : 'bg-bg-subtle text-text-muted border-border'
                                            }`}>
                                                {isActive ? 'Current' : (account.status || 'Active')}
                                            </span>
                                        </div>

                                        {/* Customer count row */}
                                        <div className="flex items-center gap-1.5 pt-2 border-t border-border-subtle">
                                            <Users className="w-3.5 h-3.5 text-text-muted" />
                                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                                {customerCount} Customers
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}
        </main>
    );
};

export default Dashboard;