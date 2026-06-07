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
            className={`fixed left-1/2 -translate-x-1/2 z-[999999] px-4 max-w-md w-full transform transition-all duration-500 ease-out ${
                isVisible 
                    ? 'top-6 opacity-100 translate-y-0' 
                    : 'top-0 opacity-0 -translate-y-full'
            }`}
        >
            <div className="w-full bg-emerald-50 dark:bg-[#0c1f16] border border-emerald-200/60 dark:border-emerald-900/40 px-5 py-3 rounded-full flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs font-medium shadow-xl backdrop-blur-md">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">{message}</span>
            </div>
        </div>,
        document.body
    );
};

export default SuccessBanner;
