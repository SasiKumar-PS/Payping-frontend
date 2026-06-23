import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Phone } from 'lucide-react';
import api from '../../api';

const LoginRequestPage = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    // Synchronize Theme from localStorage on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('payping_theme') || 'dark';
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
    
        try {
            // 1. Check if user exists (GET call with Path Variable)
            const existRes = await api.get(`auth/userexist/${phoneNumber}`);
            const userExists = existRes.data; // True/False response
    
            // 2. Trigger OTP (POST call)
            await api.post(`auth/getotp`, {
                phone: phoneNumber
            });
    
            // 3. Move to verify, passing the "exists" status in the state
            navigate('/verify', { 
                state: { 
                    phone: phoneNumber, 
                    isNewUser: !userExists 
                } 
            });
            
        } catch (error) {
            console.error(error);
            alert("Something went wrong. Check console for details.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-bg-main px-4 transition-colors duration-300 relative overflow-hidden">
            {/* Ambient decorative glowing backdrops */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-md p-8 sm:p-10 bg-bg-card border border-border/60 rounded-2xl shadow-xl relative z-10">
                <div className="text-center mb-8">
                    <div className="inline-flex p-3 bg-accent/10 text-accent rounded-2xl mb-4 shadow-sm border border-accent/10">
                        <Phone className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-wider text-text-heading uppercase">Login to Vantus</h2>
                    <p className="text-text-muted text-xs font-medium mt-2">Enter your number to receive a WhatsApp OTP</p>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-6">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                            <span className="text-text-muted font-bold font-mono text-sm">+91</span>
                        </div>
                        <input
                            type="tel"
                            required
                            maxLength={10}
                            placeholder="98765 43210"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="w-full pl-14 pr-4 py-3.5 bg-bg-input border border-border text-text-primary rounded-xl outline-none transition-all placeholder:text-text-muted/40 focus:border-accent focus:ring-4 focus:ring-accent/15 font-semibold font-mono"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || phoneNumber.length < 10}
                        className="w-full flex items-center justify-center py-3.5 px-4 bg-accent hover:opacity-90 disabled:bg-bg-subtle disabled:border disabled:border-border/50 disabled:text-text-muted disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md group cursor-pointer outline-none border-0 active:scale-98 text-xs uppercase tracking-widest"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                Send OTP via WhatsApp
                                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginRequestPage;