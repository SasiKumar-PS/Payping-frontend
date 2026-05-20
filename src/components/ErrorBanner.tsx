import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorBannerProps {
    message: string;
}

const ErrorBanner = ({ message }: ErrorBannerProps) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (message) {
            setIsVisible(true);
            // Slide back up slightly before the Gatekeeper completely clears the message state
            const slideUpTimer = setTimeout(() => setIsVisible(false), 2000);  // 2 seconds
            return () => clearTimeout(slideUpTimer);
        }
    }, [message]);

    if (!message) return null;
    
    return (
        <div 
            className={`fixed left-0 right-0 z-50 p-4 max-w-md mx-auto transform transition-all duration-500 ease-out ${
                isVisible 
                    ? 'top-[68px] opacity-100 translate-y-0' // Slide down directly below header
                    : 'top-0 opacity-0 -translate-y-full'    // Hide away above the screen
            }`}
        >
            <div className="w-full bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 text-red-400 text-sm shadow-2xl backdrop-blur-md">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                    <span className="font-bold block text-red-200 mb-0.5">Error Encountered</span>
                    <p className="text-xs leading-relaxed text-red-400/90">{message}</p>
                </div>
            </div>
        </div>
    );
};

export default ErrorBanner;