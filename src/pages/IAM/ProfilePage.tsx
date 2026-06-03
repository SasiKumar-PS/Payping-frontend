import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
    LayoutGrid, ArrowUpRight, MessageSquare, IndianRupee, LogOut, 
    PlusCircle, Lock, Sparkles, User, RefreshCw
} from 'lucide-react';
import api from '../../api';

interface UserAccountDTO {
    accountId: string;
    accountName: string;
    productName: string;
}

const ProfilePage = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [accounts, setAccounts] = useState<UserAccountDTO[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfileAndAccounts = async () => {
            try {
                // Fetch profile
                const profileRes = await api.get('users/me');
                setUser(profileRes.data);

                // Fetch accounts
                const accountsRes = await api.get('users/getAccounts');
                setAccounts(accountsRes.data || []);
            } catch (err) {
                console.error("Session expired or fetch failed", err);
                localStorage.removeItem('token');
                localStorage.removeItem('selected_account_id');
                window.location.href = '/';
            } finally {
                setLoading(false);
            }
        };
        fetchProfileAndAccounts();
    }, [navigate]);

    const handleSelectAccount = (account: UserAccountDTO) => {
        localStorage.setItem('selected_account_id', account.accountId);
        
        // Clear cached global metrics so the new account's dashboard loads freshly
        sessionStorage.removeItem('payping_global_metrics');
        
        navigate('/payping/dashboard');
    };

    const handleCreateAccount = () => {
        navigate('/payping/onboard');
    };

    const handleSignOut = () => {
        localStorage.clear();
        sessionStorage.clear();
        navigate('/');
    };

    const paypingAccounts = accounts.filter(
        acc => acc.productName?.toLowerCase() === 'payping'
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-[#070708] text-white flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                {/* Radial Glow */}
                <div className="absolute w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-zinc-400 font-bold text-xs uppercase tracking-[0.2em] animate-pulse">Syncing Environment...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#070708] text-white p-6 md:p-12 relative overflow-hidden font-sans select-none">
            {/* Grid Pattern Background Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:18px_28px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none" />
            
            {/* Floating Gradient Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

            {/* Profile Header */}
            <div className="max-w-5xl mx-auto flex items-center justify-between mb-12 bg-zinc-900/20 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-zinc-800/60 shadow-2xl relative group overflow-hidden">
                {/* Visual glow on hover */}
                <div className="absolute inset-0 bg-indigo-500/2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                <div className="flex items-center space-x-5 md:space-x-6 z-10">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl md:text-3xl font-black border border-indigo-400/20 shadow-lg shadow-indigo-500/10 group-hover:scale-105 transition-transform duration-350">
                        {user?.name?.charAt(0).toUpperCase() || <User className="w-8 h-8" />}
                    </div>
                    <div>
                        <h1 className="text-xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">{user?.name}</h1>
                        <p className="text-indigo-400 text-xs md:text-sm font-semibold uppercase tracking-wider mt-1">{user?.businessName || "Administrator"}</p>
                    </div>
                </div>
                
                <button 
                    onClick={handleSignOut}
                    className="p-3.5 bg-zinc-900/80 hover:bg-rose-950/20 text-zinc-400 hover:text-rose-455 rounded-2xl border border-zinc-800 hover:border-rose-900/30 transition-all duration-300 shadow-md active:scale-95 cursor-pointer z-10 flex items-center justify-center"
                    title="Terminate Session"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            {/* Products & Accounts Section */}
            <div className="max-w-5xl mx-auto space-y-8 relative z-10">
                <div className="flex items-center space-x-2.5">
                    <LayoutGrid className="w-4 h-4 text-zinc-500" />
                    <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em]">Available Enterprise Solutions</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* PayPing CRM Card */}
                    <div className="bg-zinc-900/20 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-6 md:p-8 hover:border-zinc-700/40 transition-all duration-300 flex flex-col justify-between shadow-xl relative group">
                        <div className="absolute inset-0 bg-emerald-500/1 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl" />
                        
                        <div>
                            {/* Product Header */}
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center space-x-3.5">
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-450">
                                        <MessageSquare className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black tracking-tight text-zinc-100">PayPing CRM</h3>
                                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">WhatsApp Billing & Automations</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded tracking-widest">Active</span>
                            </div>

                            {/* Accounts List */}
                            {paypingAccounts.length > 0 ? (
                                <div className="space-y-3.5">
                                    {paypingAccounts.map((account) => (
                                        <button
                                            key={account.accountId}
                                            onClick={() => handleSelectAccount(account)}
                                            className="w-full flex items-center justify-between p-4 bg-zinc-950/40 hover:bg-zinc-950/90 rounded-2xl border border-zinc-850 hover:border-indigo-500/40 transition-all duration-300 group/acc shadow-md cursor-pointer relative overflow-hidden active:scale-[0.99]"
                                        >
                                            {/* Glow Accent Stripe */}
                                            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500 opacity-0 group-hover/acc:opacity-100 transition-opacity duration-300" />
                                            
                                            <div className="flex items-center gap-3.5 pl-1.5">
                                                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                                    <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                                                </div>
                                                <span className="font-bold text-xs md:text-sm text-zinc-300 group-hover/acc:text-white transition-colors tracking-wide">{account.accountName || `PayPing Workspace (${account.accountId.slice(0, 8)})`}</span>
                                            </div>
                                            
                                            <ArrowUpRight className="w-4 h-4 text-zinc-650 group-hover/acc:text-indigo-400 group-hover/acc:translate-x-0.5 group-hover/acc:-translate-y-0.5 transition-all duration-300" />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <button
                                    onClick={handleCreateAccount}
                                    className="w-full flex flex-col items-center justify-center p-8 bg-zinc-950/30 hover:bg-zinc-950/80 border-2 border-dashed border-zinc-800/80 hover:border-indigo-500/50 rounded-2xl transition-all duration-300 group/new cursor-pointer space-y-3.5 active:scale-[0.99]"
                                >
                                    <div className="p-3 bg-indigo-500/5 group-hover/new:bg-indigo-500/10 border border-indigo-500/10 group-hover/new:border-indigo-500/20 rounded-xl text-indigo-400 transition-all group-hover/new:scale-105 duration-300">
                                        <PlusCircle className="w-5 h-5" />
                                    </div>
                                    <div className="text-center">
                                        <h5 className="font-bold text-xs text-zinc-300 tracking-wide">Initialize PayPing Account</h5>
                                        <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px] mx-auto leading-relaxed">No workspaces configured. Click to register and setup billing flow.</p>
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Finance Tracker Locked Card */}
                    <div className="bg-zinc-900/10 border border-zinc-900 rounded-3xl p-6 md:p-8 opacity-60 select-none relative overflow-hidden flex flex-col justify-between shadow-xl group">
                        <div>
                            {/* Product Header */}
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center space-x-3.5">
                                    <div className="p-3 bg-zinc-800/30 border border-zinc-800/40 rounded-2xl text-zinc-500">
                                        <IndianRupee className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black tracking-tight text-zinc-400">Finance Tracker</h3>
                                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Asset & Liability Ledger</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black uppercase bg-zinc-800/60 text-zinc-500 border border-zinc-700/20 px-2 py-0.5 rounded tracking-widest flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5" /> Locked
                                </span>
                            </div>

                            {/* Coming Soon Showcase */}
                            <div className="bg-zinc-950/10 border border-zinc-900/60 p-5 rounded-2xl text-center space-y-2.5">
                                <Sparkles className="w-5 h-5 text-indigo-500/30 mx-auto animate-pulse" />
                                <h6 className="font-bold text-xs text-zinc-450 tracking-wide">Personal Wealth Analytics</h6>
                                <p className="text-[10px] text-zinc-650 max-w-xs mx-auto leading-relaxed">Integrated multi-bank syncing and custom tax calculation reports are arriving in the next release cycle.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;