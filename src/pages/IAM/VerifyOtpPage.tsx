import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';

const VerifyOtpPage = () => {
    const [otp, setOtp] = useState('');
    const location = useLocation();
    const navigate = useNavigate();
    
    // Retrieve the data we passed from the Login page
    const { phone, isNewUser } = location.state || {};

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.post('auth/verify', {
                phone: phone,
                otp: otp
            });

            // Store the JWT in localStorage (Your "Session")
            localStorage.setItem('token', response.data);

            if (isNewUser) {
                navigate('/register', { state: { phone } });
            } else {
                navigate('/profile');
            }
        } catch (err) {
            alert("Invalid OTP");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">Verify OTP</h2>
                <p className="text-slate-400 mb-6">Sent to +91 {phone}</p>
                <form onSubmit={handleVerify} className="space-y-4">
                    <input 
                        type="text" 
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full p-3 bg-slate-800 rounded-xl border border-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="000000"
                    />
                    <button className="w-full bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition-all">
                        Verify & Continue
                    </button>
                </form>
            </div>
        </div>
    );
};

export default VerifyOtpPage;