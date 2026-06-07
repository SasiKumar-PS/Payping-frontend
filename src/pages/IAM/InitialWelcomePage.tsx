import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BotMessageSquare, MessageSquare, Users, BellRing, Settings, ShieldCheck, Sun, Moon } from 'lucide-react';

const InitialWelcomePage = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('payping_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('payping_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Sync class on load
  useState(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  return (
    <div className="min-h-screen bg-bg-main text-text-primary transition-colors duration-300 flex flex-col">
      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <BotMessageSquare className="w-7 h-7 text-accent transform scale-x-[-1]" />
          <span className="brand-logo-text text-text-primary select-none">PayPing</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme} 
            className="p-2 rounded hover:bg-slate-100 dark:hover:bg-[#1E2222] transition-colors border-0 bg-transparent text-text-muted cursor-pointer"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button
            onClick={() => navigate('/login')}
            className="premium-btn-secondary py-2 px-5 text-sm"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow max-w-5xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center text-center space-y-8">
        <div className="category-label">PayPing Unified Platform</div>
        
        <h1 className="hero-metric text-slate-900 dark:text-white max-w-3xl leading-tight">
          The Backbone of Your <span className="text-accent">Business Growth</span>
        </h1>

        <p className="text-text-muted text-lg max-w-2xl font-normal leading-relaxed">
          Manage customers, automate WhatsApp payment notifications, and review incoming transactions in one professional, clean, and unified workspace.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button
            onClick={() => navigate('/login')}
            className="premium-btn-primary flex items-center justify-center gap-2 group px-8 py-3 text-base shadow-sm"
          >
            Get Started Now
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <a
            href="#features"
            className="premium-btn-secondary inline-flex items-center justify-center px-8 py-3 text-base text-center"
          >
            Explore Features
          </a>
        </div>

        {/* WhatsApp Mockup Display */}
        <div className="w-full max-w-2xl pt-10">
          <div className="premium-card p-4 text-left border-border flex flex-col md:flex-row gap-4 items-center">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-text-primary">WhatsApp Billing Engine</h4>
                <p className="text-[10px] text-text-muted">Status: Connected</p>
              </div>
            </div>
            <div className="w-full bg-slate-50 dark:bg-[#0E1111] p-3 rounded border border-border">
              <div className="text-[11px] font-bold text-accent uppercase tracking-wider mb-1">Message Preview</div>
              <p className="text-xs text-text-primary leading-relaxed">
                "Hello <strong className="text-accent">Sasikumar</strong>, your subscription for <strong className="text-text-primary">PayPing Premium</strong> is due on <strong>2026-06-15</strong>. Click here to pay: <span className="text-blue-500 underline cursor-pointer">upi://pay?pa=payping...</span>"
              </p>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="w-full pt-20 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <div className="premium-card space-y-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 w-fit rounded border border-emerald-100 dark:border-emerald-900/40">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-lg font-bold">Ledger & CRM</h3>
            <p className="text-text-muted text-sm leading-relaxed">
              Track paid, unpaid, and overdue statuses. Search, sort, filter, and edit customers' payment details in real-time.
            </p>
          </div>

          <div className="premium-card space-y-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 w-fit rounded border border-emerald-100 dark:border-emerald-900/40">
              <BellRing className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-lg font-bold">WhatsApp Automation</h3>
            <p className="text-text-muted text-sm leading-relaxed">
              Send automatic, scheduled reminders or instant messages using customizable variables, tags, and QR engine codes.
            </p>
          </div>

          <div className="premium-card space-y-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 w-fit rounded border border-emerald-100 dark:border-emerald-900/40">
              <ShieldCheck className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-lg font-bold">Payment Review Queue</h3>
            <p className="text-text-muted text-sm leading-relaxed">
              Keep full control over transactions. Approve and register subscriptions or reject them directly with manual logs.
            </p>
          </div>

          <div className="premium-card space-y-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 w-fit rounded border border-emerald-100 dark:border-emerald-900/40">
              <Settings className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-lg font-bold">Business Configuration</h3>
            <p className="text-text-muted text-sm leading-relaxed">
              Configure flat subscription amounts, custom overdue offsets, payment review frequencies, and static daily delivery schedules.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border py-8 text-center text-text-muted text-xs bg-bg-sidebar">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} PayPing CRM & Billing. All rights reserved.</div>
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>PayPing Secure Gatekeeper</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default InitialWelcomePage;
