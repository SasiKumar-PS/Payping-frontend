import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export const InstallAppBanner = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        if (showBanner) {
            const timer = setTimeout(() => {
                setShowBanner(false);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [showBanner]);

    useEffect(() => {
        const handler = (e: any) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            setShowBanner(true);
        };
        
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
            setShowBanner(false);
        } else {
            console.log('User dismissed the install prompt');
        }
        setDeferredPrompt(null);
    };

    if (!showBanner) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center p-4 pt-6 pointer-events-none">
            <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-3 shadow-2xl w-full max-w-sm animate-in slide-in-from-top-full duration-500 pointer-events-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#050505] rounded-lg flex items-center justify-center border border-zinc-800 shrink-0 overflow-hidden">
                        <img src="/payping-logo.png" alt="PayPing Logo" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-white tracking-tight">PayPing App</h3>
                        <p className="text-[10px] text-zinc-400">Install for native experience</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleInstall}
                        className="bg-[#128C7E] hover:bg-[#0e7569] text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs shadow-lg transition-all outline-none"
                    >
                        <Download className="w-3.5 h-3.5" /> Install
                    </button>
                    <button 
                        onClick={() => setShowBanner(false)}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors outline-none p-1"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
