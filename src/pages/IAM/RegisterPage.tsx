import { useState, useEffect } from 'react';
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

    // Synchronize Theme from localStorage on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('payping_theme') || 'dark';
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        
        try {
            const response = await api.post('users/register', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
    
            navigate('/profile', { state: { user: response.data } });
    
        } catch (err) {
            alert("Registration failed");
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-bg-main text-text-primary px-4 transition-colors duration-300 relative overflow-hidden">
            {/* Ambient decorative glowing backdrops */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

            <form onSubmit={handleSubmit} className="bg-bg-card p-8 rounded-2xl border border-border/60 w-full max-w-md space-y-5 shadow-2xl relative z-10">
                <h2 className="text-2xl font-extrabold tracking-wider text-text-heading uppercase text-center mb-6">Complete Profile</h2>
                
                <div>
                    <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Phone Number</label>
                    <input 
                        type="text" 
                        value={phone} 
                        readOnly 
                        className="w-full p-3.5 bg-bg-subtle rounded-xl border border-border text-text-muted font-mono cursor-not-allowed outline-none font-bold" 
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Full Name</label>
                    <input 
                        required 
                        type="text" 
                        onChange={(e) => setFormData({...formData, name: e.target.value})} 
                        className="w-full p-3.5 bg-bg-input rounded-xl border border-border text-text-primary outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/15 placeholder:text-text-muted/40 font-semibold" 
                        placeholder="John Doe" 
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Business Name</label>
                    <input 
                        required 
                        type="text" 
                        onChange={(e) => setFormData({...formData, businessName: e.target.value})} 
                        className="w-full p-3.5 bg-bg-input rounded-xl border border-border text-text-primary outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/15 placeholder:text-text-muted/40 font-semibold" 
                        placeholder="Acme Corp" 
                    />
                </div>

                <button className="w-full bg-accent hover:opacity-90 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest text-white transition-all shadow-md active:scale-98 border-0 cursor-pointer">
                    Finish Registration
                </button>
            </form>
        </div>
    );
};

export default RegisterPage;