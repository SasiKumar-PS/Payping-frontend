import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import api from '../../api';

type AnimationState = 'idle' | 'verifying' | 'success' | 'error';

const VerifyOtpPage = () => {
    const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(''));
    const [animationState, setAnimationState] = useState<AnimationState>('idle');
    const [resendTimer, setResendTimer] = useState(30);
    const [canResend, setCanResend] = useState(false);
    
    const location = useLocation();
    const navigate = useNavigate();
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Retrieve the phone number and registration context passed from the Login request page
    const { phone, isNewUser } = location.state || {};

    // Redirect to login if phone number context is missing (direct access)
    useEffect(() => {
        if (!phone) {
            navigate('/login');
        }
    }, [phone, navigate]);

    // Synchronize Theme from localStorage on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('payping_theme') || 'dark';
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    // Auto focus the first input on load
    useEffect(() => {
        if (phone && inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, [phone]);

    // Countdown timer for Resend Code functionality
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [resendTimer]);

    const handleVerify = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const otpCode = otpValues.join('');
        if (otpCode.length < 6 || animationState !== 'idle') return;

        setAnimationState('verifying');
        
        try {
            const response = await api.post('auth/verify', {
                phone: phone,
                otp: otpCode
            });

            // Verification Success Sequence: Merge to green checkmark
            setAnimationState('success');
            
            setTimeout(() => {
                // Store authorization token in local storage
                localStorage.setItem('token', response.data);

                if (isNewUser) {
                    navigate('/register', { state: { phone } });
                } else {
                    navigate('/profile');
                }
            }, 1400);

        } catch (err) {
            console.error(err);
            // Verification Failure Sequence: Red borders and shake
            setAnimationState('error');

            setTimeout(() => {
                // Revert back to individual input cells
                setAnimationState('idle');
                // Timeout allows animation transition to complete before focusing
                setTimeout(() => {
                    inputRefs.current[5]?.focus();
                }, 100);
            }, 1500);
        }
    };

    const handleChange = (val: string, index: number) => {
        const cleanVal = val.replace(/\D/g, ''); // Accept only digits
        if (!cleanVal) {
            // Value was deleted
            const newValues = [...otpValues];
            newValues[index] = '';
            setOtpValues(newValues);
            return;
        }

        const newValues = [...otpValues];
        newValues[index] = cleanVal.slice(-1); // Only store last entered digit
        setOtpValues(newValues);

        // Auto-focus next input box
        if (index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Auto submit disabled at user request. User clicks "Verify & Continue" to submit.

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace') {
            if (!otpValues[index] && index > 0) {
                // Current input is already empty, clear previous input and focus it
                const newValues = [...otpValues];
                newValues[index - 1] = '';
                setOtpValues(newValues);
                inputRefs.current[index - 1]?.focus();
            }
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasteData.length === 0) return;

        const newValues = [...otpValues];
        for (let i = 0; i < Math.min(pasteData.length, 6); i++) {
            newValues[i] = pasteData[i];
        }
        setOtpValues(newValues);

        // Focus the last filled box, or the next empty box
        const focusIndex = Math.min(pasteData.length, 5);
        inputRefs.current[focusIndex]?.focus();
    };

    const handleResend = async () => {
        if (!canResend) return;
        setCanResend(false);
        setResendTimer(30);

        try {
            await api.post(`auth/getotp`, {
                phone: phone
            });
            alert("A new verification code has been dispatched to your WhatsApp.");
        } catch (error) {
            console.error("Resend OTP failed", error);
            alert("Failed to send verification code. Try again later.");
        }
    };

    const isSuccess = animationState === 'success';
    const isVerifying = animationState === 'verifying';
    const isError = animationState === 'error';
    const isOtpComplete = otpValues.every(val => val !== '');

    return (
        <div className="flex items-center justify-center min-h-screen bg-bg-main px-4 select-none relative overflow-hidden">
            {/* Custom keyframe animation style injection */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    15%, 45%, 75% { transform: translateX(-8px); }
                    30%, 60% { transform: translateX(8px); }
                }
                .shake-element {
                    animation: shake 0.4s ease-in-out;
                }
                @keyframes border-run {
                    0% { stroke-dashoffset: 200; }
                    100% { stroke-dashoffset: 0; }
                }
                .run-border {
                    stroke-dasharray: 60 140;
                    animation: border-run 1.2s linear infinite;
                }
                @keyframes draw-check {
                    to { stroke-dashoffset: 0; }
                }
                .draw-check-path {
                    stroke-dasharray: 20;
                    stroke-dashoffset: 20;
                    animation: draw-check 0.25s ease-out forwards 0.15s;
                }
            `}} />

            {/* Ambient decorative glowing backdrops */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-md bg-bg-card border border-border/60 p-8 sm:p-10 rounded-2xl shadow-xl relative z-10">
                {/* Back Link */}
                <button
                    onClick={() => navigate('/login')}
                    disabled={isSuccess || isVerifying}
                    className="absolute top-6 left-6 text-text-muted hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none flex items-center text-xs font-semibold gap-1.5 transition-colors cursor-pointer border-0 bg-transparent outline-none"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to login
                </button>

                <div className="text-center mt-6 mb-8">
                    <div className="inline-flex p-3 bg-accent/10 text-accent rounded-2xl mb-4 shadow-sm border border-accent/10">
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-wider text-text-heading uppercase">Enter Code</h2>
                    <p className="text-text-muted text-xs font-medium mt-2 leading-relaxed">
                        We sent a 6-digit confirmation code to <br />
                        <span className="text-text-primary font-bold font-mono text-xs">+91 {phone}</span>
                    </p>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="space-y-6">
                    {/* Morphing Verification Container Zone */}
                    <div className={`relative w-full h-14 mx-auto my-4 ${isError ? 'shake-element' : ''}`} style={{ maxWidth: '304px' }}>
                        
                        {/* Merged Success Circle */}
                        <div
                            className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ease-in-out border shadow-md z-20
                                ${isSuccess ? 'border-emerald-500 bg-emerald-500 text-white opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none border-transparent bg-transparent'}
                            `}
                        >
                            {isSuccess && (
                                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path className="draw-check-path" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>

                        {/* Sliding Inputs */}
                        {otpValues.map((val, idx) => {
                            const cellWidth = 44;
                            const cellGap = 8;
                            const totalWidth = 6 * cellWidth + 5 * cellGap; // 304
                            const halfTotalWidth = totalWidth / 2; // 152
                            const halfCellWidth = cellWidth / 2; // 22

                            const normalLeft = `calc(50% - ${halfTotalWidth}px + ${idx * (cellWidth + cellGap)}px)`;
                            const mergedLeft = `calc(50% - ${halfCellWidth}px)`;

                            return (
                                <div
                                    key={idx}
                                    style={{
                                        position: 'absolute',
                                        width: `${cellWidth}px`,
                                        height: '56px',
                                        left: isSuccess ? mergedLeft : normalLeft,
                                        top: '0px',
                                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                        opacity: isSuccess ? 0 : 1,
                                        transform: isSuccess ? 'scale(0.5) rotate(90deg)' : 'scale(1) rotate(0deg)',
                                        borderRadius: isSuccess ? '50%' : '12px',
                                        zIndex: 10
                                    }}
                                    className="relative flex items-center justify-center overflow-hidden"
                                >
                                    <input
                                        ref={(el) => { inputRefs.current[idx] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={1}
                                        value={val}
                                        disabled={isSuccess || isVerifying}
                                        onChange={(e) => handleChange(e.target.value, idx)}
                                        onKeyDown={(e) => handleKeyDown(e, idx)}
                                        onPaste={handlePaste}
                                        className={`w-full h-full bg-bg-input text-center text-lg font-bold font-mono text-text-heading rounded-xl outline-none transition-all duration-200
                                            ${isVerifying
                                                ? 'border-0 border-transparent ring-0 bg-accent/5'
                                                : isError
                                                    ? 'border border-rose-500 bg-rose-500/5 ring-2 ring-rose-500/15'
                                                    : val
                                                        ? 'border border-accent/40 bg-accent/5 ring-2 ring-accent/5 shadow-inner'
                                                        : 'border border-border focus:border-accent focus:ring-4 focus:ring-accent/15'
                                            }
                                        `}
                                    />

                                    {/* Animated Running Border Loader Ring (only active during verifying state) */}
                                    {isVerifying && (
                                        <svg className="absolute inset-0 w-full h-full pointer-events-none text-accent z-20" viewBox="0 0 44 56">
                                            <rect
                                                x="0.75"
                                                y="0.75"
                                                width="42.5"
                                                height="54.5"
                                                rx="11"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                className="run-border"
                                            />
                                        </svg>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Resend Action */}
                    <div className="text-center text-xs font-medium text-text-muted pt-2">
                        Didn't receive the text?{' '}
                        {canResend ? (
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={isSuccess || isVerifying}
                                className="text-accent hover:underline disabled:opacity-30 disabled:pointer-events-none font-bold bg-transparent border-0 outline-none cursor-pointer p-0"
                            >
                                Resend Code
                            </button>
                        ) : (
                            <span className="text-text-muted/60 font-mono">
                                Resend code in <strong className="text-text-primary font-bold">{resendTimer}s</strong>
                            </span>
                        )}
                    </div>

                    {/* Verification Action Button */}
                    <button
                        type="submit"
                        disabled={isSuccess || isVerifying || !isOtpComplete}
                        className={`w-full flex items-center justify-center py-3.5 px-4 font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-200 border-0 outline-none shadow-md
                            ${isSuccess || isVerifying || !isOtpComplete
                                ? 'bg-bg-subtle border border-border/50 text-text-muted cursor-not-allowed shadow-none'
                                : 'bg-accent hover:bg-indigo-700 text-white cursor-pointer active:scale-98 shadow-accent/10'
                            }`}
                    >
                        Verify & Continue
                    </button>
                </form>
            </div>
        </div>
    );
};

export default VerifyOtpPage;