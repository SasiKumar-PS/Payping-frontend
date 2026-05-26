import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';

interface SuccessBannerProps {
    message: string;
}

const SuccessBanner = ({ message }: SuccessBannerProps) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (message) {
            setIsVisible(true);
            const slideUpTimer = setTimeout(() => setIsVisible(false), 4500);  // 4.5 seconds
            return () => clearTimeout(slideUpTimer);
        }
    }, [message]);

    if (!message) return null;
    
    return createPortal(
        <div 
            className={`fixed left-4 right-4 z-[999999] p-4 max-w-sm sm:max-w-md mx-auto transform transition-all duration-500 ease-out ${
                isVisible 
                    ? 'top-4 opacity-100 translate-y-0' 
                    : 'top-0 opacity-0 -translate-y-full'
            }`}
        >
            <div className="w-full bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-start gap-3 text-emerald-400 text-sm shadow-2xl backdrop-blur-md">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400 animate-pulse" />
                <div>
                    <span className="font-bold block text-emerald-250 mb-0.5">Operation Successful</span>
                    <p className="text-xs leading-relaxed text-emerald-400/90">{message}</p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SuccessBanner;
