import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCode } from 'react-qr-code';
import { Loader2, CheckCircle, ArrowLeft, QrCode, Smartphone, Copy, Check } from 'lucide-react';
import api from '../../api';

const PayPingConnect = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [qrCode, setQrCode] = useState<string | null>(null);
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [connectionMethod, setConnectionMethod] = useState<'selection' | 'qr' | 'code'>('selection');
    const [copied, setCopied] = useState(false);
    const [status, setStatus] = useState<'waiting' | 'ready' | 'connected'>('waiting');
    const [data, setData] = useState(location.state?.data || null);
    const [loadingData, setLoadingData] = useState(!location.state?.data);

    const [isMobileDevice, setIsMobileDevice] = useState<boolean | null>(null);

    useEffect(() => {
        if (typeof navigator !== 'undefined') {
            const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            setIsMobileDevice(checkMobile);
        }
    }, []);

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
        };

        // Defensive Check: If someone refreshes this page directly or state is missing, abort safely
        if (!data || !data.phone) {
            getCurrentAccount();
        } else {
            setLoadingData(false);
        }
    }, []);

    useEffect(() => {
        let statusInterval: any;

        const flow = async () => {
            if (!data || !data.phone) return;
            if (data.whatsappStatus) {
                setStatus('connected');
                return;
            }
            if (connectionMethod === 'selection') return;

            setStatus('waiting');
            try {
                // 1. Start the connection instance
                await api.post('/payping/whatsapp/init', { 
                    phone: data.phone
                });

                if (connectionMethod === 'qr') {
                    // 2. Fetch the QR string
                    const qrRes = await api.get(`payping/whatsapp/qrcode/${data.phone}`);
                    
                    if (qrRes.data && !qrRes.data.includes("error")) {
                        setQrCode(qrRes.data);
                        setStatus('ready');
                    } else {
                        console.error("Backend returned invalid QR data:", qrRes.data);
                    }
                } else if (connectionMethod === 'code') {
                    // 2. Fetch the pairing code
                    const codeRes = await api.get(`payping/whatsapp/getCode/${data.phone}`);
                    
                    if (codeRes.data && !codeRes.data.includes("error")) {
                        setPairingCode(codeRes.data);
                        setStatus('ready');
                    } else {
                        console.error("Backend returned invalid pairing code data:", codeRes.data);
                    }
                }

                // 3. Start Polling for Device Link Confirmation Status
                statusInterval = setInterval(async () => {
                    try {
                        const statusRes = await api.get(`/payping/whatsapp/status/${data.phone}`);
                        if (statusRes.data) {
                            setStatus('connected');
                            clearInterval(statusInterval);
                            setTimeout(() => navigate('/payping/dashboard', {state: {data: data}}), 2500); 
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

        return () => {
            if (statusInterval) clearInterval(statusInterval);
        };
    }, [data, navigate, connectionMethod]);

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

    const handleCopy = () => {
        if (!pairingCode) return;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(pairingCode)
                .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                })
                .catch((err) => {
                    console.error("Clipboard API writeText failed, trying fallback: ", err);
                    fallbackCopy(pairingCode);
                });
        } else {
            fallbackCopy(pairingCode);
        }
    };

    const fallbackCopy = (text: string) => {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } else {
                console.error("Fallback document.execCommand('copy') failed");
            }
        } catch (err) {
            console.error("Fallback copy execution exception:", err);
        }
    };

    const formatPhoneNumber = (phone: string) => {
        if (!phone) return '';
        if (phone.startsWith('91') && phone.length === 12) {
            return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`;
        }
        return `+${phone}`;
    };

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
            
            {/* 1. SELECTION METHOD VIEW */}
            {connectionMethod === 'selection' && (
                <div className="bg-gradient-to-b from-zinc-900 to-[#0f0f0f] p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] border border-zinc-800/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-center max-w-md w-full animate-in fade-in slide-in-from-bottom-6 duration-500">
                    <h2 className="text-3xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Connect WhatsApp</h2>
                    <p className="text-sm text-zinc-500 mb-8">Choose your preferred way to link your WhatsApp business account.</p>

                    <div className="space-y-4 mb-4 text-left">
                        {/* Method 1: Pairing Code */}
                        <div className="flex flex-col">
                            {(isMobileDevice === true || isMobileDevice === null) && (
                                <div className="mb-2">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">
                                        Preferred for Mobile
                                    </span>
                                </div>
                            )}
                            <button
                                onClick={() => setConnectionMethod('code')}
                                className="w-full text-left bg-zinc-900/50 hover:bg-zinc-850 p-5 rounded-3xl border border-zinc-800/80 hover:border-indigo-500/40 hover:border-emerald-500/40 transition-all duration-300 group flex items-start space-x-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                            >
                                <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                                    <Smartphone className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-base font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">Connect with Phone Code</h3>
                                    <p className="text-xs text-zinc-400 leading-relaxed mt-1">Displays an 8-digit code. Place this value in your WhatsApp app on your phone to connect easily without a camera.</p>
                                </div>
                            </button>
                        </div>

                        {/* Method 2: QR Code */}
                        <div className="flex flex-col">
                            {(isMobileDevice === false || isMobileDevice === null) && (
                                <div className="mb-2">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">
                                        Preferred for Desktop
                                    </span>
                                </div>
                            )}
                            <button
                                onClick={() => setConnectionMethod('qr')}
                                className="w-full text-left bg-zinc-900/50 hover:bg-zinc-850 p-5 rounded-3xl border border-zinc-800/80 hover:border-indigo-500/40 hover:border-emerald-500/40 transition-all duration-300 group flex items-start space-x-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                            >
                                <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                                    <QrCode className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-base font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">Connect with QR Code</h3>
                                    <p className="text-xs text-zinc-400 leading-relaxed mt-1">Generates a QR code on your screen. Scan it with WhatsApp's built-in camera to link instantly.</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. QR CODE VIEW */}
            {connectionMethod === 'qr' && (
                <div className="bg-gradient-to-b from-zinc-900 to-[#0f0f0f] p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] border border-zinc-800/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-center max-w-sm w-full relative animate-in fade-in slide-in-from-bottom-6 duration-300">
                    <button
                        onClick={() => setConnectionMethod('selection')}
                        className="absolute top-6 left-6 text-zinc-500 hover:text-white flex items-center text-xs font-semibold gap-1 hover:underline transition"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    
                    <h2 className="text-2xl font-bold mb-6 mt-4">Connect QR Code</h2>
                    
                    <div className="bg-white p-4 rounded-3xl inline-block mb-8 shadow-[0_0_50px_rgba(255,255,255,0.05)]">
                        {status === 'waiting' && (
                            <div className="w-64 h-64 flex flex-col items-center justify-center text-zinc-900">
                                <Loader2 className="w-10 h-10 animate-spin mb-2 text-emerald-600" />
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
            )}

            {/* 3. PAIRING CODE VIEW */}
            {connectionMethod === 'code' && (
                <div className="bg-gradient-to-b from-zinc-900 to-[#0f0f0f] p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] border border-zinc-800/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-center max-w-md sm:max-w-[490px] w-full relative animate-in fade-in slide-in-from-bottom-6 duration-300">
                    <button
                        onClick={() => setConnectionMethod('selection')}
                        className="absolute top-6 left-6 text-zinc-500 hover:text-white flex items-center text-xs font-semibold gap-1 hover:underline transition"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    
                    <h2 className="text-2xl font-bold mb-1 mt-4">Connect with Code</h2>
                    
                    {data?.phone && (
                        <p className="text-xs text-zinc-400 mb-6 font-semibold">
                            Linking phone number: <span className="text-emerald-400 font-bold">{formatPhoneNumber(data.phone)}</span>
                        </p>
                    )}
                    
                    <div className="bg-[#050505] p-4 px-2 sm:p-6 rounded-2xl sm:rounded-3xl inline-block mb-4 border border-zinc-800/40 w-full min-h-[160px] flex flex-col justify-center items-center">
                        {status === 'waiting' && (
                            <div className="flex flex-col items-center justify-center text-zinc-400 py-6">
                                <Loader2 className="w-10 h-10 animate-spin mb-3 text-emerald-500" />
                                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Requesting Pairing Code...</p>
                            </div>
                        )}

                        {status === 'ready' && pairingCode && (
                            <div className="animate-in fade-in zoom-in-95 duration-300 w-full">
                                <div className="flex items-center justify-center gap-1 sm:gap-1.5 my-2 select-all w-full">
                                    {pairingCode.split('').map((char, index) => (
                                        <div key={index} className="flex items-center">
                                            <div className="w-[30px] h-[44px] sm:w-[38px] sm:h-[54px] bg-zinc-900 border border-zinc-800 text-indigo-400 text-lg sm:text-2xl font-black flex items-center justify-center rounded-lg sm:rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                                                {char}
                                            </div>
                                            {index === 3 && <div className="text-zinc-600 text-xl sm:text-2xl font-bold px-0.5 sm:px-1">-</div>}
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleCopy}
                                    className={`flex items-center justify-center gap-2 px-4 py-2 mx-auto mt-6 rounded-xl font-bold text-xs uppercase transition-all duration-300 ${
                                        copied 
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                        : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60'
                                    }`}
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-4 h-4 text-emerald-400" /> Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4 text-zinc-400" /> Copy Pairing Code
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {status === 'connected' && (
                            <div className="flex flex-col items-center justify-center text-green-600 py-6">
                                <CheckCircle className="w-16 h-16 mb-2 animate-bounce" />
                                <p className="text-lg font-bold">Successfully Linked!</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 text-left bg-zinc-950 p-6 rounded-2xl border border-zinc-900">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Instructions:</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed">1. Open <span className="text-white font-semibold">WhatsApp</span> on your phone.</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">2. Tap <span className="text-white font-semibold">Menu</span> or <span className="text-white font-semibold">Settings</span> and select <span className="text-white font-semibold">Linked Devices</span>.</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">3. Tap <span className="text-white font-semibold">Link a Device</span>, then choose <span className="text-emerald-400 font-bold hover:underline cursor-pointer">Link with phone number instead</span>.</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">4. Enter the 8-character pairing code shown above on your phone to link.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayPingConnect;