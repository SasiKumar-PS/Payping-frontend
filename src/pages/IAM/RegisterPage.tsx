import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';

const RegisterPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const phone = location.state?.phone || "";

    const [formData, setFormData] = useState({
        name: '',
        businessName: '',
        phone: phone
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        
        try {
            const response = await api.post('users/register', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
    
            // 'response.data' contains your User details from Spring Boot
            // We pass it to the next page using the 'state' property
            navigate('/profile', { state: { user: response.data } });
    
        } catch (err) {
            alert("Registration failed");
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
            <form onSubmit={handleSubmit} className="bg-slate-900 p-8 rounded-2xl border border-slate-800 w-full max-w-md space-y-5">
                <h2 className="text-3xl font-bold">Complete Profile</h2>
                
                <div>
                    <label className="block text-sm text-slate-400 mb-1">Phone Number</label>
                    <input type="text" value={phone} readOnly className="w-full p-3 bg-slate-800 rounded-xl border border-slate-700 text-slate-500 cursor-not-allowed" />
                </div>

                <div>
                    <label className="block text-sm text-slate-400 mb-1">Full Name</label>
                    <input required type="text" onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-slate-800 rounded-xl border border-slate-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Doe" />
                </div>

                <div>
                    <label className="block text-sm text-slate-400 mb-1">Business Name</label>
                    <input required type="text" onChange={(e) => setFormData({...formData, businessName: e.target.value})} className="w-full p-3 bg-slate-800 rounded-xl border border-slate-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Acme Corp" />
                </div>

                <button className="w-full bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition-all">
                    Finish Registration
                </button>
            </form>
        </div>
    );
};

export default RegisterPage;