import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Info } from 'lucide-react';
import api from '../../api';

const BusinessDetails = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const data = location.state?.data

    const [formData, setFormData] = useState({
        phone: data.phone,
        upiUrl: '',
        subscriptionAmount: '',
        expiryDate: '',
        overdueDate: '',
        reviewType: 'Immediate', // Default
        staticReviewTime: ''
    });

    

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post(`/payping/accounts/business-details`, formData, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            navigate('/payping/add-customers');
        } catch (err) {
            console.error("Failed to save details:", err);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center">
            <form onSubmit={handleSubmit} className="max-w-2xl w-full bg-slate-900 p-8 rounded-3xl space-y-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Building2 className="text-blue-500" />
                    </div>
                    <h2 className="text-2xl font-bold">Business Configuration</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* UPI URL */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-400 mb-2">Your UPI URL</label>
                        <input 
                            required
                            placeholder="upi://pay?pa=yourname@bank..."
                            className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:border-blue-500 outline-none transition-all"
                            onChange={(e) => setFormData({...formData, upiUrl: e.target.value})}
                        />
                    </div>

                    {/* Subscription Amount */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Subscription Amount (Optional)</label>
                        <input 
                            type="number"
                            placeholder="₹ 0.00"
                            className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl outline-none"
                            onChange={(e) => setFormData({...formData, subscriptionAmount: e.target.value})}
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Flat rate applied to all users by default.</p>
                    </div>

                    {/* Expiry Date */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Expiry Date</label>
                        <input 
                            type="number"
                            className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl outline-none"
                            onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                        />
                    </div>

                    {/* Overdue Date */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Overdue Threshold Date</label>
                        <input 
                            type="number"
                            className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl outline-none"
                            onChange={(e) => setFormData({...formData, overdueDate: e.target.value})}
                        />
                    </div>

                    {/* Payment Review Notification Dropdown */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Payment Review Type</label>
                        <select 
                            className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl outline-none"
                            value={formData.reviewType}
                            onChange={(e) => setFormData({...formData, reviewType: e.target.value})}
                        >
                            <option value="Immediate">Immediate</option>
                            <option value="Static">Static</option>
                            <option value="Both">Both</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                {/* Conditional Description for Review Types */}
                <div className="bg-slate-950/30 p-4 rounded-xl flex gap-3 italic">
                    <Info className="w-5 h-5 text-slate-500 shrink-0" />
                    <p className="text-xs text-slate-400">
                        {formData.reviewType === 'Immediate' && "Notifications sent the moment a payment is detected."}
                        {formData.reviewType === 'Static' && "Summarized notifications sent at a specific time daily."}
                        {formData.reviewType === 'Both' && "Real-time alerts plus a daily summarized report."}
                        {formData.reviewType === 'Inactive' && "No payment review notifications will be sent."}
                    </p>
                </div>

                {/* Conditional Input for Static Time */}
                {(formData.reviewType === 'Static' || formData.reviewType === 'Both') && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm font-medium text-slate-400 mb-2">Daily Review Time</label>
                        <input 
                            type="time"
                            required
                            className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl outline-none focus:border-blue-500"
                            onChange={(e) => setFormData({...formData, staticReviewTime: e.target.value})}
                        />
                    </div>
                )}

                <button 
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold transition-all"
                >
                    Save & Continue
                </button>
            </form>
        </div>
    );
};

export default BusinessDetails;