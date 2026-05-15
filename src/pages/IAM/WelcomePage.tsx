import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';

const WelcomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden px-4 bg-slate-950 text-white">
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="z-10 text-center space-y-6 max-w-2xl">
        <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20">
                <ShieldCheck className="w-12 h-12 text-blue-500"/>
            </div>
        </div>

        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight">
          Welcome to <span className="text-blue-500">Vantus</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 font-medium leading-relaxed">
          The backbone of your business growth. 
          <br className="hidden md:block" />
          Manage finance, CRM, and payments in one unified platform.
        </p>

        <div className="pt-8">
          <button
            onClick={() => navigate('/login')}
            className="group relative inline-flex items-center justify-center px-8 py-4 font-semibold text-white transition-all duration-200 bg-blue-600 rounded-xl hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95 cursor-pointer"
          >
            Get Started
            <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1"/>
          </button>
        </div>
      </div>

      <div className="absolute bottom-10 text-slate-600 text-sm font-medium tracking-widest uppercase">
        Vantus IAM Secure Gateway
      </div>
    </div>
  );
};

export default WelcomePage;