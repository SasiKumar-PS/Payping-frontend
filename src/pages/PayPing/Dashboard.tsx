import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
    BarChart, Bar, Legend
} from 'recharts';
import { 
    Menu, X, User, MessageSquare, Send, History, 
    Settings, LogOut, MessageCircle, Mail, AlertTriangle,
    TrendingUp, CheckCircle, HelpCircle, ShieldAlert, Users, ExternalLink, UserPlus
} from 'lucide-react';
import api from '../../api';
import ErrorBanner from '../../components/ErrorBanner';

// TypeScript payload interfaces
interface DashboardData {
    businessName: string;
    ownerName: string;
    phone: string;
    whatsappStatus: boolean;
    upiUrl: string;
    estimatedRevenue: number;
    totalPaidAmount: number;
    dueAmount: number;
    revenueLeakage: number;
    paidCustomersCount: number;
    unpaidCustomersCount: number;
    overdueCustomersCount: number;
    paymentStatus?: string;
}

interface ChartRecord {
    month: string;
    collected: number;
    due: number;
    paidCustomers: number;
    unpaidCustomers: number;
}

const Dashboard = () => {
    const navigate = useNavigate();
    const { metrics, refreshMetrics } = useOutletContext<{ metrics: DashboardData | null, refreshMetrics: () => void }>();
    
    // UI Layout States
    const [timeFrame, setTimeFrame] = useState<'3M' | '6M' | '1Y'>('3M');
    const [chartMode, setChartMode] = useState<'financial' | 'customers'>('financial');
    const [loading, setLoading] = useState(true);

    // Business Metric States
    const [chartData, setChartData] = useState<ChartRecord[]>([]);

    // Payment message states
    const [paymentMessage, setPaymentMessage] = useState<string>('');
    const [loadingPaymentMessage, setLoadingPaymentMessage] = useState<boolean>(false);

    useEffect(() => {
        // Initial performance charts load
        fetchDashboardPerformance();
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
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-t-transparent border-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <main className="flex-1 px-4 lg:px-8 py-6 space-y-6 max-w-md lg:max-w-6xl mx-auto w-full pb-16 animate-in fade-in duration-300">
            
            {/* ALERT BOXES AT THE TOP */}
            <div className="space-y-4">
                {/* 1. Subscription & Payment Warning Box */}
                {metrics.paymentStatus && metrics.paymentStatus !== 'ACTIVE' && (
                    <div className={`p-5 rounded-[1.75rem] backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-xl ${
                        metrics.paymentStatus === 'GRACE_PERIOD' 
                            ? 'bg-amber-500/10 text-amber-200 border border-amber-500/10' 
                            : 'bg-rose-500/10 text-rose-200 border border-rose-500/10'
                    }`}>
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-2xl shrink-0 ${
                                metrics.paymentStatus === 'GRACE_PERIOD' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                                <AlertTriangle className="w-6 h-6 animate-bounce" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold tracking-tight">
                                    {metrics.paymentStatus === 'GRACE_PERIOD' ? 'Action Required: Subscription Grace Period' : 'Account Dues Penalty: System Inactive'}
                                </h4>
                                {loadingPaymentMessage ? (
                                    <div className="h-4 w-48 bg-slate-800 rounded animate-pulse" />
                                ) : (
                                    <p className="text-xs text-slate-350 leading-relaxed">
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
                            className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/10 shrink-0 cursor-pointer self-start md:self-center"
                        >
                            Make Payment
                        </button>
                    </div>
                )}

                {/* 2. WhatsApp Disconnection Warning Box */}
                {!metrics.whatsappStatus && (
                    <div className="p-5 rounded-[1.75rem] bg-rose-500/10 text-rose-200 border border-rose-500/10 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-xl">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-400 shrink-0">
                                <ShieldAlert className="w-6 h-6 animate-pulse" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold tracking-tight">WhatsApp Link Disconnected</h4>
                                <p className="text-xs text-slate-350 leading-relaxed">
                                    your whatsapp is disconnect, please click the connect button, to connect your whatsapp
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => navigate('/payping/connect')}
                            className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/10 shrink-0 cursor-pointer self-start md:self-center"
                        >
                            Connect WhatsApp
                        </button>
                    </div>
                )}
            </div>
            
            {/* BLOCK 1: INTEGRATED BUSINESS METRICS SUMMARY */}
            <section className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Business Summary</h3>
                
                {/* Unified, Borderless Stats Row & Ledger Switcher */}
                <div className="bg-slate-900/50 rounded-[2rem] p-6 shadow-xl space-y-6">
                    {/* Seamless Stats Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 relative">
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-505 uppercase tracking-wider block">Est. Revenue</span>
                            <div className="text-2xl font-black font-mono tracking-tight text-slate-100">
                                ₹{metrics?.estimatedRevenue?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>

                        {/* Divider lines on wide screen */}
                        <div className="absolute top-1/2 -translate-y-1/2 left-[25%] w-px h-8 bg-slate-800/40 hidden lg:block" />

                        <div className="space-y-1.5 lg:pl-6">
                            <span className="text-[10px] font-bold text-slate-505 uppercase tracking-wider block">Collected Vol</span>
                            <div className="text-2xl font-black font-mono tracking-tight text-emerald-400">
                                ₹{metrics?.totalPaidAmount?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>

                        <div className="absolute top-1/2 -translate-y-1/2 left-[50%] w-px h-8 bg-slate-800/40 hidden lg:block" />

                        <div className="space-y-1.5 lg:pl-6">
                            <span className="text-[10px] font-bold text-slate-505 uppercase tracking-wider block">Outstanding Due</span>
                            <div className="text-2xl font-black font-mono tracking-tight text-amber-500">
                                ₹{metrics?.dueAmount?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>

                        <div className="absolute top-1/2 -translate-y-1/2 left-[75%] w-px h-8 bg-slate-800/40 hidden lg:block" />

                        <div className="space-y-1.5 lg:pl-6">
                            <span className="text-[10px] font-bold text-slate-505 uppercase tracking-wider block flex items-center gap-1">
                                Leakage <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                            </span>
                            <div className="text-2xl font-black font-mono tracking-tight text-rose-500">
                                ₹{metrics?.revenueLeakage?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-slate-800/30" />

                    {/* Integrated Clickable Ledger Status Segment Controller */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-950/40 p-1.5 rounded-2xl shadow-inner">
                        <button 
                            onClick={() => navigate('/payping/customers', { state: { filter: 'PAID' } })}
                            className="bg-transparent hover:bg-slate-900/50 py-3 rounded-xl text-center transition-all cursor-pointer group active:scale-[0.98] flex flex-col items-center border-0 outline-none"
                        >
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 group-hover:text-emerald-450 transition-colors">Paid Users</span>
                            <span className="text-xl font-black text-slate-205 font-mono">{metrics?.paidCustomersCount || 0}</span>
                        </button>

                        <button 
                            onClick={() => navigate('/payping/customers', { state: { filter: 'UNPAID' } })}
                            className="bg-transparent hover:bg-slate-900/50 py-3 rounded-xl text-center transition-all cursor-pointer group active:scale-[0.98] flex flex-col items-center border-0 outline-none"
                        >
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 group-hover:text-amber-450 transition-colors">Unpaid</span>
                            <span className="text-xl font-black text-slate-205 font-mono">{metrics?.unpaidCustomersCount || 0}</span>
                        </button>

                        <button 
                            onClick={() => navigate('/payping/customers', { state: { filter: 'OVERDUE' } })}
                            className="bg-transparent hover:bg-slate-900/50 py-3 rounded-xl text-center transition-all cursor-pointer group active:scale-[0.98] flex flex-col items-center border-0 outline-none"
                        >
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 group-hover:text-rose-450 transition-colors">Overdue</span>
                            <span className="text-xl font-black text-rose-400 font-mono">{metrics?.overdueCustomersCount || 0}</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* BLOCK 2: HISTORICAL CHARTS */}
            <section className="bg-slate-900/50 rounded-[2rem] p-6 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/40 pb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Business Performance</h3>
                    
                    <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Chart Toggle */}
                        <div className="flex p-0.5 bg-slate-950/80 rounded-xl text-[10px] font-bold shadow-inner border-0">
                            <button 
                                onClick={() => setChartMode('financial')}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer border-0 outline-none ${chartMode === 'financial' ? 'bg-blue-600 text-white shadow' : 'text-slate-550'}`}
                            >
                                Valuation
                            </button>
                            <button 
                                onClick={() => setChartMode('customers')}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer border-0 outline-none ${chartMode === 'customers' ? 'bg-blue-600 text-white shadow' : 'text-slate-550'}`}
                            >
                                Volumes
                            </button>
                        </div>
                    </div>
                </div>

                {/* Dynamic Chart Container */}
                <div className="w-full h-72 bg-slate-950/30 rounded-2xl p-4 pt-14 relative flex items-center justify-center font-mono text-xs shadow-inner">
                    {/* Range Delta Selector Inside Chart Container Block */}
                    <div className="absolute top-3 right-3 z-10 flex p-0.5 bg-slate-950/90 border border-slate-900/40 rounded-xl text-[10px] font-bold shadow-2xl">
                        {(['3M', '6M', '1Y'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeFrame(range)}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer border-0 outline-none ${timeFrame === range ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-450'}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-2 text-slate-550">
                            <div className="w-5 h-5 border-2 border-t-transparent border-blue-500 rounded-full animate-spin" />
                            <span className="text-[10px] uppercase font-bold tracking-wider">Syncing historical performance...</span>
                        </div>
                    ) : chartData.length === 0 ? (
                        <span className="text-slate-600 italic">No historical traces available</span>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            {chartMode === 'financial' ? (
                                <AreaChart data={chartData} margin={{ top: 5, right: 30, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorDue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} interval={0} tickFormatter={(tick) => tick.substring(0, 3)}/>
                                    <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'transparent', borderRadius: '12px', fontSize: '11px', color: '#f1f5f9', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }} />
                                    <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCollected)" />
                                    <Area type="monotone" dataKey="due" name="Due" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDue)" />
                                </AreaChart>
                            ) : (
                                <BarChart data={chartData} margin={{ top: 5, right: 30, left: -10, bottom: 0 }}>
                                    <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} interval={0} tickFormatter={(tick) => tick.substring(0, 3)}/>
                                    <YAxis stroke="#475569" fontSize={10} tickLine={false} />
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
            <div className="flex flex-col gap-6">
                <section className="bg-slate-900/50 rounded-[2rem] p-6 space-y-4 shadow-xl">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Quick Vector Relays</h4>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={() => navigate('/payping/add-customers')}
                            className="flex-1 bg-slate-950/40 hover:bg-slate-900/60 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer group shadow-inner border-0 outline-none"
                        >
                            <UserPlus className="w-5 h-5 text-blue-500" />
                            <span className="text-xs font-bold text-slate-350">Add Customer</span>
                        </button>
                        
                        <button 
                            onClick={() => navigate('/payping/message-templates')}
                            className="flex-1 bg-slate-950/40 hover:bg-slate-900/60 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer group shadow-inner border-0 outline-none"
                        >
                            <Send className="w-5 h-5 text-emerald-500" />
                            <span className="text-xs font-bold text-slate-350">Manage Templates</span>
                        </button>
                    </div>
                </section>

                {/* BLOCK 4: OPERATIONAL METADATA & SUPPORT */}
                <section className="bg-slate-900/50 rounded-[2rem] p-6 flex flex-col justify-between gap-4 shadow-xl">
                    <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Operational Payment Router VPA</span>
                        <span className="text-sm font-mono font-bold text-slate-300 block truncate mt-1">
                            {metrics?.upiUrl || "No Active Routing Channel Registered"}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <a 
                            href="https://wa.me/919876543210" 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-3 p-3 bg-slate-950/40 hover:bg-slate-900/60 rounded-2xl active:scale-[0.98] transition-all group shrink-0 shadow-inner"
                        >
                            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 group-hover:bg-emerald-500/20 transition-colors shrink-0">
                                <MessageCircle className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs font-bold block text-slate-200">WhatsApp Help</span>
                                <span className="text-[9px] text-slate-500 block truncate">Direct Support Node</span>
                            </div>
                        </a>

                        <a 
                            href="mailto:support@payping.in"
                            className="flex items-center gap-3 p-3 bg-slate-950/40 hover:bg-slate-900/60 rounded-2xl active:scale-[0.98] transition-all group shrink-0 shadow-inner"
                        >
                            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 group-hover:bg-blue-500/20 transition-colors shrink-0">
                                <Mail className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs font-bold block text-slate-200">Email Desk</span>
                                <span className="text-[9px] text-slate-500 block truncate">Support Ticketing</span>
                            </div>
                        </a>
                    </div>
                </section>
            </div>
        </main>
    );
};

export default Dashboard;