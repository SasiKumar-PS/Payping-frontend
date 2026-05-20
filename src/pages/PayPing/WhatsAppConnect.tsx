import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCode } from 'react-qr-code';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../../api';

const PayPingConnect = () => {
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [status, setStatus] = useState<'waiting' | 'ready' | 'connected'>('waiting');

    const location = useLocation();
    const navigate = useNavigate();

    // Safely extract the forwarded registration data
    const data = location.state?.data;

    useEffect(() => {
        // Defensive Check: If someone refreshes this page directly or state is missing, abort safely
        if (!data || !data.phone) {
            // need to fetch the current account data here
        }

        const flow = async () => {
            try {
                // 1. Start the connection instance
                await api.post('/payping/whatsapp/init', { 
                    phone: data.phone, 
                    //businessName: data.businessName 
                });

                // 2. Fetch the QR string (Blocks on backend until future completes)
                const qrRes = await api.get(`payping/whatsapp/qrcode/${data.phone}`);
                
                if (qrRes.data && !qrRes.data.includes("error")) {
                    setQrCode(qrRes.data);
                    setStatus('ready');
                } else {
                    console.error("Backend returned invalid QR data:", qrRes.data);
                }

                // 3. Start Polling for Device Link Confirmation Status
                const statusInterval = setInterval(async () => {
                    try {
                        const statusRes = await api.get(`/payping/whatsapp/status/${data.phone}`);
                        if (statusRes.data) {
                            setStatus('connected');
                            clearInterval(statusInterval);
                            // Ensure this matches your route name (lowercase/uppercase check)
                            setTimeout(() => navigate('/payping/business-details', {state: {data: data}}), 5000); 
                        }
                    } catch (pollErr) {
                        console.error("Status polling error:", pollErr);
                    }
                }, 10000); // 10 seconds

            } catch (err) {
                console.error("WhatsApp initialization sequence failed:", err);
            }
        };

        flow();
    }, [data, navigate]);

    // Render a helpful fallback UI if the route state data is missing
    if (!data) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 text-center max-w-sm w-full space-y-4">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                    <h3 className="text-xl font-bold">Session Missing</h3>
                    <p className="text-sm text-slate-400">Please fill out your profile configurations before attempting to link a device.</p>
                    <button onClick={() => navigate('/payping/onboard')} className="w-full bg-white text-black py-3 rounded-xl font-bold text-sm">
                        Go to Onboarding
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
            <div className="bg-slate-900 p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl text-center max-w-sm w-full">
                <h2 className="text-2xl font-bold mb-6">Connect WhatsApp</h2>
                
                <div className="bg-white p-4 rounded-3xl inline-block mb-8 shadow-[0_0_50px_rgba(255,255,255,0.05)]">
                    {status === 'waiting' && (
                        <div className="w-64 h-64 flex flex-col items-center justify-center text-slate-900">
                            <Loader2 className="w-10 h-10 animate-spin mb-2 text-blue-600" />
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Generating QR...</p>
                        </div>
                    )}

                    {status === 'ready' && qrCode && (
                        <div className="p-1 animate-in fade-in zoom-in-95 duration-300">
                            <QRCode value={qrCode} size={240} />
                        </div>
                    )}

                    {status === 'connected' && (
                        <div className="w-64 h-64 flex flex-col items-center justify-center text-green-600">
                            <CheckCircle className="w-16 h-16 mb-2 animate-bounce" />
                            <p className="text-lg font-bold">Successfully Linked!</p>
                        </div>
                    )}
                </div>

                <div className="space-y-4 text-left">
                    <p className="text-sm text-slate-400">1. Open WhatsApp on your phone</p>
                    <p className="text-sm text-slate-400">2. Tap <span className="text-white font-bold">Menu</span> or <span className="text-white font-bold">Settings</span> and select <span className="text-white font-bold">Linked Devices</span></p>
                    <p className="text-sm text-slate-400">3. Point your phone to this screen to capture the code</p>
                </div>
            </div>
        </div>
    );
};

export default PayPingConnect;