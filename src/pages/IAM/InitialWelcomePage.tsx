import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, BotMessageSquare, MessageSquare, Users, BellRing, 
  Settings, ShieldCheck, Sun, Moon, Search, Check, Sparkles, Sliders
} from 'lucide-react';

const InitialWelcomePage = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('payping_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Sync class and default value in localStorage on mount and theme changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    const saved = localStorage.getItem('payping_theme');
    if (!saved) {
      localStorage.setItem('payping_theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('payping_theme', newTheme);
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-primary transition-colors duration-300 flex flex-col relative overflow-hidden select-none">
      
      {/* Decorative Blur Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      
      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-border/60 relative z-20">
        <div className="flex items-center gap-2">
          <BotMessageSquare className="w-7 h-7 text-accent transform scale-x-[-1]" />
          <span className="brand-logo-text text-text-primary select-none">PayPing</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme} 
            className="p-2 rounded-xl hover:bg-bg-hover transition-colors border-0 bg-transparent text-text-muted cursor-pointer outline-none"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-500" />}
          </button>
          <button
            onClick={() => navigate('/login')}
            className="premium-btn-secondary py-2 px-5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main Hero & Bento Section */}
      <main className="flex-grow max-w-7xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center relative z-10 w-full">
        {/* Intro Tag */}
        <div className="category-label inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-tint/15 border border-accent/10 text-accent mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          PayPing Unified Billing Suite
        </div>
        
        {/* Hero Headline */}
        <h1 className="hero-metric text-text-heading max-w-3xl leading-tight text-center tracking-tight">
          The Backbone of Your <span className="text-accent bg-gradient-to-r from-accent to-indigo-500 bg-clip-text text-transparent">Business Growth</span>
        </h1>

        {/* Hero Subtitle */}
        <p className="text-text-muted text-base sm:text-lg max-w-2xl font-normal leading-relaxed text-center mt-4">
          Manage customers, automate WhatsApp payment notifications, and review incoming transactions in one professional, clean, and unified workspace.
        </p>

        {/* Hero Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 pb-12 w-full sm:w-auto">
          <button
            onClick={() => navigate('/login')}
            className="premium-btn-primary flex items-center justify-center gap-2 group px-8 py-3.5 text-xs uppercase tracking-widest shadow-md rounded-xl active:scale-98"
          >
            Get Started Now
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <a
            href="#features"
            className="premium-btn-secondary inline-flex items-center justify-center px-8 py-3.5 text-xs uppercase tracking-widest text-center rounded-xl"
          >
            Explore Features
          </a>
        </div>

        {/* Bento Grid Features Section */}
        <div id="features" className="w-full pt-16 space-y-8">
          <div className="text-left max-w-xl">
            <h2 className="text-2xl font-extrabold text-text-heading uppercase tracking-wide">Enterprise Toolkit</h2>
            <p className="text-text-muted text-xs font-semibold mt-1">Supercharge operations with dedicated tools built for speed and clarity.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Bento Card 1: Ledger & CRM (Spans 2 columns on desktop) */}
            <div className="premium-card md:col-span-2 flex flex-col md:flex-row gap-6 justify-between items-stretch group hover:-translate-y-1 transition-all duration-300 bg-bg-card border-border/60">
              <div className="flex flex-col justify-between space-y-4 max-w-md">
                <div className="space-y-2">
                  <div className="p-2.5 bg-accent/10 w-fit rounded-2xl text-accent border border-accent/10">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-text-heading">Ledger & CRM</h3>
                  <p className="text-text-muted text-xs leading-relaxed">
                    Track paid, unpaid, and overdue statuses. Search, sort, filter, and edit customers' payment details in real-time.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-accent">
                  Learn more about CRM <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* CRM Interactive Mockup Widget */}
              <div className="bg-bg-subtle/60 dark:bg-bg-sidebar/40 border border-border/40 p-4 rounded-2xl md:w-80 flex flex-col space-y-3 shrink-0 select-none pointer-events-none">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Customer Registry</span>
                  <Search className="w-3.5 h-3.5 text-text-muted/65" />
                </div>
                <div className="space-y-2">
                  {/* Row 1 */}
                  <div className="flex items-center justify-between bg-bg-card p-2 rounded-xl border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-extrabold">S</div>
                      <div>
                        <div className="text-[11px] font-bold text-text-primary">Sasikumar</div>
                        <div className="text-[9px] text-text-muted font-mono">+91 98765...</div>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Paid</span>
                  </div>
                  {/* Row 2 */}
                  <div className="flex items-center justify-between bg-bg-card p-2 rounded-xl border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-extrabold">J</div>
                      <div>
                        <div className="text-[11px] font-bold text-text-primary">John Doe</div>
                        <div className="text-[9px] text-text-muted font-mono">+91 99887...</div>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20">Overdue</span>
                  </div>
                  {/* Row 3 */}
                  <div className="flex items-center justify-between bg-bg-card p-2 rounded-xl border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-extrabold">J</div>
                      <div>
                        <div className="text-[11px] font-bold text-text-primary">Jane Smith</div>
                        <div className="text-[9px] text-text-muted font-mono">+91 97766...</div>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Unpaid</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 2: WhatsApp Automation (Spans 1 column) */}
            <div className="premium-card flex flex-col justify-between items-stretch gap-6 hover:-translate-y-1 transition-all duration-300 bg-bg-card border-border/60 group">
              <div className="space-y-4">
                <div className="p-2.5 bg-emerald-500/10 w-fit rounded-2xl text-emerald-600 dark:text-emerald-450 border border-emerald-500/10">
                  <BellRing className="w-5 h-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-text-heading">WhatsApp Reminders</h3>
                  <p className="text-text-muted text-xs leading-relaxed">
                    Send automatic, scheduled reminders or instant messages using customizable templates and dynamic variables.
                  </p>
                </div>
              </div>

              {/* Chat Bubble Mockup Widget */}
              <div className="bg-bg-subtle/60 dark:bg-bg-sidebar/40 border border-border/40 p-4 rounded-2xl flex flex-col space-y-2.5 select-none pointer-events-none">
                <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> connected
                  </span>
                  <span className="text-[8px] font-mono text-text-muted">WhatsApp Live</span>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/15 p-3 rounded-xl rounded-tr-none text-left space-y-1 max-w-[90%] self-end">
                  <p className="text-[10px] text-text-primary leading-normal">
                    Hello Sasikumar, your subscription for <strong>PayPing Premium</strong> is due on <strong>2026-06-15</strong>.
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[8px] text-text-muted font-medium">
                    10:32 AM <Check className="w-3 h-3 text-emerald-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 3: Payment Review Queue (Spans 1 column) */}
            <div className="premium-card flex flex-col justify-between items-stretch gap-6 hover:-translate-y-1 transition-all duration-300 bg-bg-card border-border/60 group">
              <div className="space-y-4">
                <div className="p-2.5 bg-indigo-500/10 w-fit rounded-2xl text-accent border border-accent/15">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-text-heading">Payment Review</h3>
                  <p className="text-text-muted text-xs leading-relaxed">
                    Keep full control. Approve and register incoming UPI subscriptions or reject them with detailed manual transaction logs.
                  </p>
                </div>
              </div>

              {/* Payment Queue Mockup Widget */}
              <div className="bg-bg-subtle/60 dark:bg-bg-sidebar/40 border border-border/40 p-4 rounded-2xl flex flex-col space-y-3 select-none pointer-events-none">
                <div className="bg-bg-card border border-border/60 p-3 rounded-xl shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-text-muted uppercase">Ref: 6128...87a</span>
                    <span className="text-[10px] font-bold text-text-primary">₹999</span>
                  </div>
                  <div className="text-[10px] font-bold text-text-heading flex items-center justify-between">
                    <span>Sasikumar</span>
                    <span className="text-[8px] uppercase px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">Pending</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <div className="flex-1 text-center py-1 text-[8px] font-black uppercase border border-border rounded-lg text-text-muted">Reject</div>
                    <div className="flex-1 text-center py-1 text-[8px] font-black uppercase bg-accent text-white rounded-lg shadow-sm">Approve</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 4: Business Configuration (Spans 2 columns on desktop) */}
            <div className="premium-card md:col-span-2 flex flex-col md:flex-row gap-6 justify-between items-stretch group hover:-translate-y-1 transition-all duration-300 bg-bg-card border-border/60">
              <div className="flex flex-col justify-between space-y-4 max-w-md">
                <div className="space-y-2">
                  <div className="p-2.5 bg-accent/10 w-fit rounded-2xl text-accent border border-accent/10">
                    <Settings className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-text-heading">Business Configuration</h3>
                  <p className="text-text-muted text-xs leading-relaxed">
                    Configure flat subscription amounts, custom overdue offsets, payment review frequencies, and static daily delivery schedules.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-accent">
                  Configure workspace parameters <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Slider & Switch Mockup Widget */}
              <div className="bg-bg-subtle/60 dark:bg-bg-sidebar/40 border border-border/40 p-4 rounded-2xl md:w-80 flex flex-col justify-center space-y-4 shrink-0 select-none pointer-events-none">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-text-primary">
                    <span>Reminder Frequency</span>
                    <span className="text-accent">Every 3 Days</span>
                  </div>
                  <div className="w-full bg-border/80 h-1.5 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 bottom-0 left-0 bg-accent w-[60%] rounded-full" />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-3">
                  <div>
                    <div className="text-[10px] font-bold text-text-primary">Automated Reminders</div>
                    <div className="text-[8px] text-text-muted font-medium mt-0.5">Send messages dynamically</div>
                  </div>
                  <div className="w-9 h-5 rounded-full bg-accent relative flex items-center justify-end px-0.5 border border-accent">
                    <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Climax Call-To-Action Block */}
        <div className="w-full mt-24 relative overflow-hidden bg-bg-card border border-border/60 rounded-3xl p-10 md:p-14 text-center space-y-6 shadow-2xl">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
          <h2 className="text-3xl font-extrabold text-text-heading tracking-tight uppercase max-w-lg mx-auto leading-tight">Ready to streamline your billing?</h2>
          <p className="text-text-muted text-sm max-w-md mx-auto font-normal leading-relaxed">
            Join other growing businesses managing their customer ledgers and automated payment processes with PayPing.
          </p>
          <div className="pt-4 flex justify-center">
            <button
              onClick={() => navigate('/login')}
              className="premium-btn-primary flex items-center gap-2 group px-8 py-4 text-xs font-bold uppercase tracking-widest shadow-md rounded-xl active:scale-98"
            >
              Get Started Now
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border/60 py-8 text-center text-text-muted text-xs bg-bg-sidebar transition-colors duration-300 relative z-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} PayPing CRM & Billing. All rights reserved.</div>
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-[10px]">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>PayPing Secure Gatekeeper</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default InitialWelcomePage;
