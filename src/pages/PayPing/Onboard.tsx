import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import api from '../../api';

const PayPingOnboard = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Extract pre-filled data from IAM Profile
    const initialData = location.state?.user || {};

    const [formData, setFormData] = useState(() => {
        const saved = sessionStorage.getItem('payping_onboard_form');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved onboard draft", e);
            }
        }
        return {
            name: initialData.name || '',
            businessName: initialData.businessName || '',
            phone: initialData.phone || ''
        };
    });

    useEffect(() => {
        sessionStorage.setItem('payping_onboard_form', JSON.stringify(formData));
    }, [formData]);

    const handleGetStarted = async () => {
        try {
            // Trigger the Cobalt session initialization on the backend
            await api.post('/payping/accounts/register', formData);

            sessionStorage.removeItem('payping_onboard_form');

            // Navigate directly to dashboard
            navigate('/payping/dashboard', { replace: true });
        } catch (err) {
            alert("Failed to start WhatsApp engine. Check backend logs.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-800 dark:text-white flex items-center justify-center p-4 sm:p-6">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-[#0f0f0f] p-8 sm:p-10 rounded-2xl border border-slate-200/50 dark:border-zinc-800/40 shadow-sm">
                <div className="text-center">
                    <div className="inline-flex p-3 bg-emerald-500/10 rounded-2xl mb-4">
                        <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-500" />
                    </div>
                    <h2 className="font-sans text-2xl font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">PayPing <span className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider ml-1">CRM</span></h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">Confirm your business details to begin.</p>
                </div>

                <div className="space-y-4">
                    {/* Your Name Input */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase ml-1 tracking-wider">Your Name</label>
                        <input
                            type="text"
                            required
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-slate-800 p-4 rounded-lg focus:border-slate-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none transition-colors text-slate-800 dark:text-zinc-200"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase ml-1 tracking-wider">Business Name</label>
                        <input
                            value={formData.businessName}
                            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                            placeholder="My Business"
                            className="w-full bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-slate-800 p-4 rounded-lg focus:border-slate-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-slate-800 dark:text-zinc-200"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase ml-1 tracking-wider">Support Phone</label>
                        <input
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+91 99999 99999"
                            className="w-full bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-slate-800 p-4 rounded-lg focus:border-slate-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-slate-800 dark:text-zinc-200"
                        />
                    </div>
                </div>

                <button
                    onClick={handleGetStarted}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold py-4 rounded-lg flex items-center justify-center transition-all group cursor-pointer border-0 outline-none shadow-md shadow-indigo-600/10"
                >
                    Get Started
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
};

export default PayPingOnboard;