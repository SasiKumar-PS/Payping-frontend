import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Info } from 'lucide-react';
import api from '../../api';

const BusinessDetails = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const data = location.state?.data

    const [formData, setFormData] = useState(() => {
        const saved = sessionStorage.getItem('payping_business_details_form');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved business details draft", e);
            }
        }
        return {
            phone: data?.phone || '',
            upiUrl: '',
            subscriptionAmount: '',
            expiryDate: '',
            overdueOffSet: '',
            reviewType: 'IMMEDIATE', // Keep backend expectation
            staticReviewTime: ''
        };
    });

    useEffect(() => {
        sessionStorage.setItem('payping_business_details_form', JSON.stringify(formData));
    }, [formData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post(`/payping/accounts/business-details`, formData, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            sessionStorage.removeItem('payping_business_details_form');
            navigate('/payping/dashboard');
        } catch (err) {
            console.error("Failed to save details:", err);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f0f0f] text-white p-6 flex items-center justify-center">
            <form onSubmit={handleSubmit} className="max-w-2xl w-full bg-zinc-900 p-8 rounded-3xl space-y-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <Building2 className="text-indigo-500" />
                    </div>
                    <h2 className="text-2xl font-bold">Business Configuration</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* UPI URL */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Your UPI URL</label>
                        <input 
                            required
                            placeholder="upi://pay?pa=yourname@bank..."
                            className="w-full bg-[#0f0f0f] border border-zinc-800 p-3 rounded-xl focus:border-indigo-500 outline-none transition-all"
                            value={formData.upiUrl}
                            onChange={(e) => setFormData({...formData, upiUrl: e.target.value})}
                        />
                    </div>

                    {/* Subscription Amount */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Subscription Amount (Optional)</label>
                        <input 
                            type="number"
                            placeholder="₹ 0.00"
                            className="w-full bg-[#0f0f0f] border border-zinc-800 p-3 rounded-xl outline-none"
                            value={formData.subscriptionAmount}
                            onChange={(e) => setFormData({...formData, subscriptionAmount: e.target.value})}
                        />
                        <p className="text-[10px] text-zinc-500 mt-1">Flat rate applied to all users by default.</p>
                    </div>

                    {/* Expiry Date */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Expiry Date</label>
                        <input 
                            type="date"
                            className="w-full bg-[#0f0f0f] border border-zinc-800 p-3 rounded-xl outline-none"
                            value={formData.expiryDate}
                            onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                        />
                    </div>

                    {/* Overdue Date */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Overdue Threshold Date</label>
                        <input 
                            type="number"
                            className="w-full bg-[#0f0f0f] border border-zinc-800 p-3 rounded-xl outline-none"
                            value={formData.overdueOffSet}
                            onChange={(e) => setFormData({...formData, overdueOffSet: e.target.value})}
                        />
                    </div>

                    {/* Payment Review Notification Dropdown */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Payment Review Type</label>
                        <select 
                            className="w-full bg-[#0f0f0f] border border-zinc-800 p-3 rounded-xl outline-none"
                            value={formData.reviewType}
                            onChange={(e) => setFormData({...formData, reviewType: e.target.value})}
                        >
                            <option value="IMMEDIATE">Immediate</option>
                            <option value="STATIC">Static</option>
                            <option value="BOTH">Both</option>
                            <option value="INACTIVE">Inactive</option>
                        </select>
                    </div>
                </div>

                {/* Conditional Description for Review Types */}
                <div className="bg-[#0f0f0f]/30 p-4 rounded-xl flex gap-3 italic">
                    <Info className="w-5 h-5 text-zinc-500 shrink-0" />
                    <p className="text-xs text-zinc-400">
                        {formData.reviewType === 'IMMEDIATE' && "Notifications sent the moment a payment is detected."}
                        {formData.reviewType === 'STATIC' && "Summarized notifications sent at a specific time daily."}
                        {formData.reviewType === 'BOTH' && "Real-time alerts plus a daily summarized report."}
                        {formData.reviewType === 'INACTIVE' && "No payment review notifications will be sent."}
                    </p>
                </div>

                {/* Conditional Input for Static Time */}
                {(formData.reviewType === 'STATIC' || formData.reviewType === 'BOTH') && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Daily Review Time</label>
                        <input 
                            type="time"
                            required
                            className="w-full bg-[#0f0f0f] border border-zinc-800 p-3 rounded-xl outline-none focus:border-indigo-500"
                            value={formData.staticReviewTime}
                            onChange={(e) => setFormData({...formData, staticReviewTime: e.target.value})}
                        />
                    </div>
                )}

                <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-bold transition-all"
                >
                    Save & Continue
                </button>
            </form>
        </div>
    );
};

export default BusinessDetails;