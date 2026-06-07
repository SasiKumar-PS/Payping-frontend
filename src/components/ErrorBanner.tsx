import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';

interface ErrorBannerProps {
    message: string;
}

const ErrorBanner = ({ message }: ErrorBannerProps) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (message) {
            setIsVisible(true);
            const slideUpTimer = setTimeout(() => setIsVisible(false), 2000);  // 2 seconds
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
            <div className="w-full bg-rose-50 dark:bg-[#2b1416] border border-rose-200/60 dark:border-rose-900/40 px-5 py-3 rounded-full flex items-center gap-2.5 text-rose-800 dark:text-rose-300 text-xs font-medium shadow-xl backdrop-blur-md">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-450" />
                <span className="truncate">{message}</span>
            </div>
        </div>,
        document.body
    );
};

export default ErrorBanner;