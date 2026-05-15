import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowRight, Loader2 } from 'lucide-react';
import api from '../../api';

const LoginRequestPage = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
    
        try {
            // 1. Check if user exists (GET call with Path Variable)
            const existRes = await api.get(`auth/userexist/${phoneNumber}`);
            const userExists = existRes.data; // Assuming your Java code returns true/false
    
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
    <div className="flex items-center justify-center min-h-screen bg-slate-950 px-4">
      <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Login to Vantus</h2>
          <p className="text-slate-400">Enter your number to receive a WhatsApp OTP</p>
        </div>

        <form onSubmit={handleSendOtp} className="space-y-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <span className="text-slate-500 font-medium">+91</span>
            </div>
            <input
              type="tel"
              required
              placeholder="98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full pl-14 pr-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || phoneNumber.length < 10}
            className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all group cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Send OTP via WhatsApp
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginRequestPage;