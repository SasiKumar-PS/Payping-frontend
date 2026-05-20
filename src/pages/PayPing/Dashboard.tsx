import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
    BarChart, Bar, Legend
} from 'recharts';
import { 
    Menu, X, User, MessageSquare, Send, History, 
    Settings, LogOut, MessageCircle, Mail, AlertTriangle,
    TrendingUp, CheckCircle, HelpCircle, ShieldAlert, Users, ExternalLink
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
    
    // UI Layout States
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [timeFrame, setTimeFrame] = useState<'3M' | '6M' | '1Y'>('3M');
    const [chartMode, setChartMode] = useState<'financial' | 'customers'>('financial');
    const [loading, setLoading] = useState(true);

    // Business Metric States
    const [metrics, setMetrics] = useState<DashboardData | null>(null);
    const [chartData, setChartData] = useState<ChartRecord[]>([]);

    useEffect(() => {
        fetchDashboardCorePayload();
    }, []);

    useEffect(() => {
        fetchDashboardPerformance();
    }, [timeFrame]);

    const fetchDashboardCorePayload = async () => {
        setLoading(true);
        
        // 1. Fetch main business metrics metadata configuration parameters
        const dataRes = await api.get('/payping/dashboard/getdata');
        setMetrics(dataRes.data);

        // 2. Fetch specific timeline parameters for graphs
        fetchDashboardPerformance();
        setLoading(false);
    };

    const fetchDashboardPerformance = async () => {
        const chartRes = await api.get(`/payping/dashboard/performance?range=${timeFrame}`);
        setChartData(chartRes.data);
    };

    const handleSignOut = () => {
        sessionStorage.clear();
        localStorage.removeItem('token');
        navigate('/', { replace: true });
    };

    if (loading && !metrics) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-t-transparent border-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none overflow-x-hidden pb-12 relative">

            {/* TOP NAVIGATION HEADER ACTION BAR */}
            <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md px-5 py-4 border-b border-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                    <button 
                        onClick={() => setIsDrawerOpen(true)}
                        className="p-1.5 active:bg-slate-900 rounded-xl transition-colors text-slate-300"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="text-xl font-black italic tracking-tighter bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        PayPing
                    </span>
                </div>
                
                {/* Micro-Identity Quick Avatar Badge Toggle Button */}
                <div 
                    onClick={() => navigate('/payping/profile')}
                    className="w-9 h-9 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 font-bold text-sm flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                >
                    {metrics?.ownerName?.charAt(0).toUpperCase() || 'U'}
                </div>
            </header>

            {/* SLIDING NAVIGATION DRAWER OVERLAY WRAPPER PANEL */}
            <div className={`fixed inset-0 z-50 transition-all duration-300 ${isDrawerOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'}`}>
                {/* Backdrop transparency shield blur element */}
                <div 
                    onClick={() => setIsDrawerOpen(false)}
                    className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0'}`} 
                />
                
                {/* Left sliding sheet block element */}
                <aside className={`absolute top-0 bottom-0 left-0 w-[280px] bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-300 transform ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    
                    {/* Drawer Content Body Top Section */}
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Drawer Heading context wrapper element */}
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <span className="font-black italic tracking-tighter text-lg">WORKSPACE</span>
                            <button onClick={() => setIsDrawerOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Interactive Profile Session Node Indicator Card */}
                        <div className="p-4 m-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col gap-3">
                            <div className="flex items-center justify-between min-w-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2.5 bg-slate-900 rounded-xl text-slate-400 border border-slate-800">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-bold truncate text-slate-200">{metrics?.businessName || "Test Firm"}</h4>
                                        <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{metrics?.phone}</p>
                                    </div>
                                </div>

                                {/* Dynamic connection state tracking dot */}
                                <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                    <span className={`w-1.5 h-1.5 rounded-full ${metrics?.whatsappStatus ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-rose-500'}`} />
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                        {metrics?.whatsappStatus ? "Active" : "Inactive"}
                                    </span>
                                </div>
                            </div>

                            {/* NEW: Conditional exact green WhatsApp button visible ONLY when status is false */}
                            {!metrics?.whatsappStatus && (
                                <button 
                                    onClick={() => { setIsDrawerOpen(false); navigate('/payping/connect'); }}
                                    className="w-full bg-[#128C7E] hover:bg-[#075E54] text-white font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-lg shadow-[#25D366]/10 animate-in fade-in slide-in-from-top-2 duration-200"
                                >
                                    <MessageCircle className="w-4 h-4 fill-white text-[#128C7E]" />
                                    Connect WhatsApp
                                </button>
                            )}
                        </div>

                        {/* Navigation Actions Menu Option Stack links */}
                        <nav className="px-3 py-2 space-y-1 overflow-y-auto flex-1 scrollbar-none">
                            <button onClick={() => { setIsDrawerOpen(false); navigate('/payping/dashboard'); }} className="w-full flex items-center gap-3.5 px-4 py-3 text-sm font-semibold text-blue-400 bg-blue-500/5 border border-blue-500/10 rounded-xl text-left">
                                <TrendingUp className="w-4 h-4" /> Dashboard Overview
                            </button>
                            <button onClick={() => { setIsDrawerOpen(false); navigate('/payping/customers'); }} className="w-full flex items-center gap-3.5 px-4 py-3 text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-850 rounded-xl text-left transition-colors">
                                <Users className="w-4 h-4" /> Customer Ledger
                            </button>
                            <button onClick={() => { setIsDrawerOpen(false); navigate('/payping/templates'); }} className="w-full flex items-center gap-3.5 px-4 py-3 text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-850 rounded-xl text-left transition-colors">
                                <MessageSquare className="w-4 h-4" /> Alert Templates
                            </button>
                            <button onClick={() => { setIsDrawerOpen(false); navigate('/payping/dispatch'); }} className="w-full flex items-center gap-3.5 px-4 py-3 text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-850 rounded-xl text-left transition-colors">
                                <Send className="w-4 h-4" /> Manual Dispatch
                            </button>
                            <button onClick={() => { setIsDrawerOpen(false); navigate('/payping/audit-logs'); }} className="w-full flex items-center gap-3.5 px-4 py-3 text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-850 rounded-xl text-left transition-colors">
                                <History className="w-4 h-4" /> Transaction Logs
                            </button>
                            <button onClick={() => { setIsDrawerOpen(false); navigate('/payping/business-details'); }} className="w-full flex items-center gap-3.5 px-4 py-3 text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-850 rounded-xl text-left transition-colors">
                                <Settings className="w-4 h-4" /> Node Configuration
                            </button>
                        </nav>
                    </div>

                    {/* Terminate Session Actions Module Footer Panel section */}
                    <div className="p-4 border-t border-slate-800 bg-slate-950/40">
                        <button 
                            onClick={handleSignOut}
                            className="w-full flex items-center justify-center gap-2 py-3 border border-slate-800 hover:border-red-500/30 hover:bg-red-500/5 text-slate-400 hover:text-red-400 font-bold text-xs rounded-xl transition-all"
                        >
                            <LogOut className="w-4 h-4" /> Terminate Session
                        </button>
                    </div>
                </aside>
            </div>

            {/* DASHBOARD SCANNABLE VIEW BODY WRAPPER ELEMENTS */}
            <main className="flex-1 px-5 py-6 space-y-6 max-w-md mx-auto w-full">
                
                {/* BLOCK 1: INTEGRATED BUSINESS METRICS MATRIX SUMMARY BLOCK */}
                <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Business Summary</h3>
                    
                    {/* Matrix Row Grid Layout Layer A */}
                    <div className="grid grid-cols-2 gap-3.5">
                        <div className="bg-slate-900 border border-slate-850 p-4.5 rounded-[1.75rem] space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Est. Revenue</span>
                            <div className="text-xl font-extrabold font-mono tracking-tight text-slate-100">
                                ₹{metrics?.estimatedRevenue?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-850 p-4.5 rounded-[1.75rem] space-y-1 border-l-2 border-l-emerald-500/30">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Collected Vol</span>
                            <div className="text-xl font-extrabold font-mono tracking-tight text-emerald-400">
                                ₹{metrics?.totalPaidAmount?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>
                    </div>

                    {/* Matrix Row Grid Layout Layer B */}
                    <div className="grid grid-cols-2 gap-3.5">
                        <div className="bg-slate-900 border border-slate-850 p-4.5 rounded-[1.75rem] space-y-1 border-l-2 border-l-amber-500/30">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Outstanding Due</span>
                            <div className="text-xl font-extrabold font-mono tracking-tight text-amber-500">
                                ₹{metrics?.dueAmount?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-850 p-4.5 rounded-[1.75rem] space-y-1 border-l-2 border-l-rose-500/30">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                                Leakage <ShieldAlert className="w-3 h-3 text-rose-500 animate-pulse" />
                            </span>
                            <div className="text-xl font-extrabold font-mono tracking-tight text-rose-500">
                                ₹{metrics?.revenueLeakage?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>
                    </div>

                    {/* Consolidated Block 2 Data Row Layer C (Attached Client Counts) */}
                    <div className="grid grid-cols-3 gap-2.5 pt-1">
                        <div className="bg-slate-900/60 border border-slate-850/80 p-3 rounded-2xl text-center">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Paid Users</span>
                            <span className="text-base font-black text-slate-200 font-mono">{metrics?.paidCustomersCount || 0}</span>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-850/80 p-3 rounded-2xl text-center">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Unpaid</span>
                            <span className="text-base font-black text-slate-200 font-mono">{metrics?.unpaidCustomersCount || 0}</span>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-850/80 p-3 rounded-2xl text-center">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Overdue</span>
                            <span className="text-base font-black text-rose-400 font-mono">{metrics?.overdueCustomersCount || 0}</span>
                        </div>
                    </div>
                </section>

                {/* BLOCK 2: DYNAMIC CHRONOLOGICAL BUSINESS PERFORMANCE CHARTS */}
                <section className="bg-slate-900 border border-slate-850 rounded-[2rem] p-5 space-y-5 shadow-xl">
                    <div className="flex flex-col gap-3">
                        {/* Interactive Section Tab Toggle Navigation */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Business Performance</h3>
                            
                            {/* Chart Data Mode Toggle Tabs */}
                            <div className="flex p-0.5 bg-slate-950 border border-slate-850 rounded-xl text-[10px] font-bold">
                                <button 
                                    onClick={() => setChartMode('financial')}
                                    className={`px-3 py-1.5 rounded-lg transition-all ${chartMode === 'financial' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                                >
                                    Valuation
                                </button>
                                <button 
                                    onClick={() => setChartMode('customers')}
                                    className={`px-3 py-1.5 rounded-lg transition-all ${chartMode === 'customers' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                                >
                                    Volumes
                                </button>
                            </div>
                        </div>

                        {/* Chronological Range Timeline Button Segments Selector Grid */}
                        <div className="flex items-center justify-between bg-slate-950/60 p-1.5 border border-slate-850 rounded-xl">
                            <span className="text-[10px] font-bold tracking-wide uppercase text-slate-500 ml-1.5">Timeline Delta:</span>
                            <div className="flex gap-1">
                                {(['3M', '6M', '1Y'] as const).map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeFrame(range)}
                                        className={`px-4 py-1 rounded-lg text-xs font-bold transition-all ${timeFrame === range ? 'bg-slate-800 border border-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Graphic Dynamic Engine Matrix Container */}
                    <div className="w-full h-48 bg-slate-950/40 border border-slate-850 rounded-2xl p-2 flex items-center justify-center font-mono text-xs">
                        {chartData.length === 0 ? (
                            <span className="text-slate-600 italic">No historical traces available</span>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                {chartMode === 'financial' ? (
                                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
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
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '11px' }} />
                                        <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCollected)" />
                                        <Area type="monotone" dataKey="due" name="Due" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorDue)" />
                                    </AreaChart>
                                ) : (
                                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                        <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} interval={0} tickFormatter={(tick) => tick.substring(0, 3)}/>
                                        <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '11px' }} />
                                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                                        <Bar dataKey="paidCustomers" name="Paid Customers" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="unpaidCustomers" name="Unpaid Customers" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        )}
                    </div>
                </section>

                {/* BLOCK 3: QUICK RUNTIME WORKSPACE LINK ACTION SHORTCUTS */}
                <section className="bg-slate-900 border border-slate-850 rounded-[2rem] p-5 space-y-3 shadow-xl">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Quick Vector Relays</h4>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={() => navigate('/payping/add-customers')}
                            className="flex-1 bg-slate-950 border border-slate-800 hover:border-blue-500/30 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-colors group"
                        >
                            <Users className="w-5 h-5 text-blue-500" />
                            <span className="text-xs font-bold text-slate-300">Add Consumer</span>
                        </button>
                        
                        <button 
                            onClick={() => navigate('/payping/dispatch')}
                            className="flex-1 bg-slate-950 border border-slate-800 hover:border-blue-500/30 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-colors group"
                        >
                            <Send className="w-5 h-5 text-emerald-500" />
                            <span className="text-xs font-bold text-slate-300">Trigger Alert</span>
                        </button>
                    </div>
                </section>

                {/* BLOCK 4: RUNTIME HARDWARE SETTINGS METADATA & DEVELOPER SUPPORT */}
                <section className="space-y-4 pt-2">
                    
                    {/* Active Configuration Anchor Summary Card */}
                    <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Operational Payment Router VPA</span>
                            <span className="text-xs font-mono font-bold text-slate-300 block truncate mt-1">
                                {metrics?.upiUrl || "No Active Routing Channel Registered"}
                            </span>
                        </div>
                        <button 
                            onClick={() => navigate('/payping/business-details')}
                            className="p-2 hover:bg-slate-850 rounded-xl text-slate-400 hover:text-white transition-colors border border-slate-800 shrink-0"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Developer Contact Support Touch Targets Block */}
                    <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1 block">Help Desk Signature Channels</span>
                        <div className="grid grid-cols-2 gap-3">
                            <a 
                                href="https://wa.me/919876543210" 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-3 p-3.5 bg-slate-900 border border-slate-850 rounded-2xl hover:border-emerald-500/30 active:scale-[0.98] transition-all group"
                            >
                                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                                    <MessageCircle className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-xs font-bold block text-slate-200">WhatsApp Help</span>
                                    <span className="text-[10px] text-slate-500 block truncate mt-0.5">Direct Relay Node</span>
                                </div>
                            </a>

                            <a 
                                href="mailto:support@payping.in"
                                className="flex items-center gap-3 p-3.5 bg-slate-900 border border-slate-850 rounded-2xl hover:border-blue-500/30 active:scale-[0.98] transition-all group"
                            >
                                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-xs font-bold block text-slate-200">Email Desk</span>
                                    <span className="text-[10px] text-slate-500 block truncate mt-0.5">Ticketing Core Node</span>
                                </div>
                            </a>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Dashboard;