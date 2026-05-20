import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import api from '../../api';

const PayPingOnboard = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Extract pre-filled data from IAM Profile
    const initialData = location.state?.user || {};

    const [formData, setFormData] = useState({
        name: initialData.name || 'Tester',
        businessName: initialData.businessName || 'Payping testing',
        phone: initialData.phone || '9876987987'
    });

    const handleGetStarted = async () => {
        try {
            // Trigger the Cobalt session initialization on the backend
            await api.post('/payping/accounts/register', formData);
            
            // Move to the QR scanning page
            navigate('/payping/connect', { state: { data: formData } });
        } catch (err) {
            alert("Failed to start WhatsApp engine. Check backend logs.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
            <div className="max-w-md w-full space-y-8 bg-slate-900 p-10 rounded-3xl border border-slate-800">
                <div className="text-center">
                    <div className="inline-flex p-3 bg-green-500/10 rounded-2xl mb-4">
                        <ShieldCheck className="w-10 h-10 text-green-500" />
                    </div>
                    <h2 className="text-3xl font-bold italic tracking-tighter">PayPing <span className="text-slate-500">CRM</span></h2>
                    <p className="text-slate-400 mt-2">Confirm your business details to begin.</p>
                </div>

                <div className="space-y-4">
                    {/* NEW: Full Name Input */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Your Name</label>
                        <input 
                            type="text"
                            required
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl focus:border-green-500 outline-none transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Business Name</label>
                        <input 
                            value={formData.businessName}
                            onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl focus:border-green-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Support Phone</label>
                        <input 
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl focus:border-green-500 outline-none"
                        />
                    </div>
                </div>

                <button 
                    onClick={handleGetStarted}
                    className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-all group"
                >
                    Get Started
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
};

export default PayPingOnboard;