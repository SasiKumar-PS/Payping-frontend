import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCode } from 'react-qr-code';
import { Loader2, CheckCircle } from 'lucide-react';
import api from '../../api';

const PayPingConnect = () => {
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [status, setStatus] = useState<'waiting' | 'ready' | 'connected'>('waiting');

    const location = useLocation();
    const navigate = useNavigate();

    const data = location.state?.data

    useEffect(() => {
        const flow = async () => {
            // 1. Start the connection
            await api.post('payping/whatsapp/init', {name: data.name, phone: data.phone, businessName: data.businessName});

            // 2. Fetch the QR (this API will wait until backend has the QR)
            const qrRes = await api.get(`payping/whatsapp/qrcode/${data.phone}`);
            setQrCode(qrRes.data);
            setStatus('ready');

            // 3. Start Polling for Status
            const statusInterval = setInterval(async () => {
                const statusRes = await api.get(`payping/whatsapp/status/${data.phone}`);
                if (statusRes.data) {
                    setStatus('connected');
                    clearInterval(statusInterval);
                    navigate('/payping/Home');
                }
            }, 5000);
            
        };
        flow();
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
            <div className="bg-slate-900 p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl text-center max-w-sm w-full">
                <h2 className="text-2xl font-bold mb-6">Connect WhatsApp</h2>
                
                <div className="bg-white p-4 rounded-3xl inline-block mb-8 shadow-[0_0_50px_rgba(255,255,255,0.05)]">
                    {status === 'waiting' && (
                        <div className="w-64 h-64 flex flex-col items-center justify-center text-slate-900">
                            <Loader2 className="w-10 h-10 animate-spin mb-2" />
                            <p className="text-xs font-bold uppercase tracking-widest">Generating QR...</p>
                        </div>
                    )}

                    {status === 'ready' && qrCode && (
                        <QRCode value={qrCode} size={256} />
                    )}

                    {status === 'connected' && (
                        <div className="w-64 h-64 flex flex-col items-center justify-center text-green-600">
                            <CheckCircle className="w-16 h-16 mb-2" />
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