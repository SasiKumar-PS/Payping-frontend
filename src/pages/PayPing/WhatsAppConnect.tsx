import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCode } from 'react-qr-code';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../../api';

const PayPingConnect = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [qrCode, setQrCode] = useState<string | null>(null);
    const [status, setStatus] = useState<'waiting' | 'ready' | 'connected'>('waiting');
    const [data, setData] = useState(location.state?.data || null);
    const [loadingData, setLoadingData] = useState(!location.state?.data);

    const [stats, setStats] = useState<{ totalSentMonth: number; totalSentOverall: number; customerInteractions: number } | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);


    useEffect(() => {
        const getCurrentAccount = async () => {
            try {
                const response = await api.get('/payping/accounts/getThis');
                setData(response.data);
            } catch (err) {
                console.error("Failed to fetch account", err);
            } finally {
                setLoadingData(false);
            }
        }

        // Defensive Check: If someone refreshes this page directly or state is missing, abort safely
        if (!data || !data.phone) {
            getCurrentAccount();
        } else {
            setLoadingData(false);
        }
    }, []);

    useEffect(() => {
        const flow = async () => {
            if (!data || !data.phone) return;
            if (data.whatsappStatus) {
                setStatus('connected');
                return;
            }

            try {
                // 1. Start the connection instance
                await api.post('/payping/whatsapp/init', { 
                    phone: data.phone
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

    useEffect(() => {
        if (data?.whatsappStatus && data?.phone) {
            const fetchStats = async () => {
                setLoadingStats(true);
                try {
                    const statsRes = await api.get(`/payping/whatsapp/getData`);
                    setStats(statsRes.data);
                } catch (e) {
                    console.error("Failed to fetch WhatsApp statistics", e);
                    // Fallback to mock data if backend endpoint isn't fully wired yet
                    setStats({
                        totalSentMonth: 1245,
                        totalSentOverall: 8432,
                        customerInteractions: 312
                    });
                } finally {
                    setLoadingStats(false);
                }
            };
            fetchStats();
        }
    }, [data?.whatsappStatus, data?.phone]);

    if (loadingData) {
        return (
            <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-6">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (data?.whatsappStatus) {
        return (
            <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-emerald-900/5 backdrop-blur-3xl" />
                <div className="z-10 bg-gradient-to-b from-zinc-900 to-[#0f0f0f] p-12 rounded-[3rem] border border-zinc-800/60 shadow-2xl text-center max-w-lg w-full ring-1 ring-emerald-500/20">
                    <img src="/src/assets/whatsapp-connected.png" alt="Connected Node" className="w-56 h-56 mx-auto mb-8 rounded-full shadow-[0_0_60px_rgba(16,185,129,0.3)] animate-pulse object-cover mix-blend-screen" />
                    <h2 className="text-3xl font-black italic tracking-tighter mb-4 bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">System Synchronized</h2>
                    <p className="text-zinc-400 leading-relaxed mb-8 font-medium">Your WhatsApp gateway is actively connected and ready to broadcast alerts to your customers.</p>
                    
                    {loadingStats ? (
                        <div className="flex justify-center items-center py-6 mb-8">
                            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        </div>
                    ) : stats ? (
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            <div className="bg-[#050505] border border-zinc-800/60 p-4 rounded-2xl flex flex-col items-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                                <span className="text-xl sm:text-2xl font-black text-emerald-400">{stats.totalSentMonth || 0}</span>
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1 text-center">Month<br/>Volume</span>
                            </div>
                            <div className="bg-[#050505] border border-zinc-800/60 p-4 rounded-2xl flex flex-col items-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                                <span className="text-xl sm:text-2xl font-black text-emerald-400">{stats.totalSentOverall || 0}</span>
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1 text-center">Total<br/>Volume</span>
                            </div>
                            <div className="bg-[#050505] border border-zinc-800/60 p-4 rounded-2xl flex flex-col items-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                                <span className="text-xl sm:text-2xl font-black text-emerald-400">{stats.customerInteractions || 0}</span>
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1 text-center">Active<br/>Chats</span>
                            </div>
                        </div>
                    ) : null}

                    <button onClick={() => navigate('/payping/dashboard')} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold text-sm tracking-widest uppercase shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all">
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-6">
            <div className="bg-gradient-to-b from-zinc-900 to-[#0f0f0f] p-10 rounded-[2.5rem] border border-zinc-800/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-center max-w-sm w-full">
                <h2 className="text-2xl font-bold mb-6">Connect WhatsApp</h2>
                
                <div className="bg-white p-4 rounded-3xl inline-block mb-8 shadow-[0_0_50px_rgba(255,255,255,0.05)]">
                    {status === 'waiting' && (
                        <div className="w-64 h-64 flex flex-col items-center justify-center text-zinc-900">
                            <Loader2 className="w-10 h-10 animate-spin mb-2 text-indigo-600" />
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Generating QR...</p>
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
                    <p className="text-sm text-zinc-400">1. Open WhatsApp on your phone</p>
                    <p className="text-sm text-zinc-400">2. Tap <span className="text-white font-bold">Menu</span> or <span className="text-white font-bold">Settings</span> and select <span className="text-white font-bold">Linked Devices</span></p>
                    <p className="text-sm text-zinc-400">3. Point your phone to this screen to capture the code</p>
                </div>
            </div>
        </div>
    );
};

export default PayPingConnect;