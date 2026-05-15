import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { LayoutGrid, ArrowUpRight, MessageSquare, IndianRupee, LogOut } from 'lucide-react';
import api from '../../api'; // Use our new 'api' instance
    

const ProfilePage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    // const [user, setUser] = useState<any>(location.state?.user ?? null);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                // This call automatically includes the Bearer token!
                const response = await api.get('users/me');
                setUser(response.data);
            } catch (err) {
                console.error("Session expired");
                localStorage.removeItem('token');
                window.location.href = '/';
            } finally {
                setLoading(false); // Stop loading regardless of success/fail
            }
        };
        fetchProfile();
    }, [navigate]);

    const vantusProducts = [
        {
            id: 'payping',
            name: 'PayPing CRM',
            icon: <MessageSquare className="w-6 h-6 text-green-500" />,
            accounts: [
                { id: 'acc1', name: 'Main Business Account', slug: 'main-biz' }
            ]
        },
        {
            id: 'fin-track',
            name: 'Finance Tracker',
            icon: <IndianRupee className="w-6 h-6 text-blue-500" />,
            accounts: [
                { id: 'acc3', name: 'Personal Finances', slug: 'personal' }
            ]
        }
    ];

    if (loading || !user) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="text-slate-400 text-lg">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12">
            {/* Profile Header */}
            <div className="max-w-5xl mx-auto flex items-center justify-between mb-12 bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
                <div className="flex items-center space-x-6">
                    <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-3xl font-bold border-4 border-slate-800 shadow-xl">
                        {user.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">{user.name}</h1>
                        <p className="text-blue-500 font-medium">{user.businessName}</p>
                    </div>
                </div>
                
                <button 
                    onClick={() => { localStorage.clear(); navigate('/'); }}
                    className="p-3 bg-slate-800 hover:bg-red-900/20 hover:text-red-500 rounded-xl transition-all"
                >
                    <LogOut className="w-6 h-6" />
                </button>
            </div>

            {/* Products Grid */}
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center space-x-2 mb-6">
                    <LayoutGrid className="w-6 h-6 text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-[0.2em]">Available Solutions</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {vantusProducts.map((product) => (
                        <div key={product.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <div className="flex items-center space-x-3 mb-6">
                                <div className="p-2 bg-slate-950 rounded-lg">{product.icon}</div>
                                <h3 className="text-xl font-bold">{product.name}</h3>
                            </div>

                            <div className="space-y-3">
                                {product.accounts.map((account) => (
                                    <button
                                        key={account.id}
                                        className="w-full flex items-center justify-between p-4 bg-slate-950/40 rounded-xl border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800 transition-all group"
                                    >
                                        <span className="font-medium text-slate-300">{account.name}</span>
                                        <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;