import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, User, HelpCircle, Layers, Plus, 
  ArrowUpRight, Info, Check, RefreshCw, ArrowLeft, LogOut, Pencil, X, Users
} from 'lucide-react';
import api from '../../api';

interface AccountDTO {
    id: string;
    accountName: string;
    businessName: string;
    productName: string;
    status: string;
    customerCount?: number;
}

const AccountSettingsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'workspace' | 'profile'>('workspace');
  const [user, setUser] = useState<any>(null);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const defaultForm = {
    phone: '',
    businessName: '',
    upiId: '',
    subscriptionAmount: '',
    expiryDate: '',
    overdueOffSet: '',
    reviewType: 'IMMEDIATE',
    staticReviewTime: ''
  };

  const [formData, setFormData] = useState(defaultForm);
  // savedData holds the last-persisted state for cancel revert
  const [savedData, setSavedData] = useState(defaultForm);

  useEffect(() => {
    const fetchProfileAndAccounts = async () => {
      try {
        const profileRes = await api.get('users/me');
        setUser(profileRes.data);

        const accountsRes = await api.get('/payping/accounts/getAll');
        setAccounts(accountsRes.data || []);
      } catch (err) {
        console.error("Failed to fetch profile details", err);
      } finally {
        setLoadingProfile(false);
      }
    };

    const fetchWorkspaceConfig = async () => {
      try {
        const configRes = await api.get('/payping/accounts/getThis');
        const config = configRes.data;
        if (config) {
          const loaded = {
            phone: config.phone || '',
            businessName: config.businessName || '',
            upiId: config.upiId || '',
            subscriptionAmount: config.subscriptionAmount?.toString() || '',
            expiryDate: config.expiryDate || '',
            overdueOffSet: config.overdueOffSet?.toString() || '',
            reviewType: config.reviewType || 'IMMEDIATE',
            staticReviewTime: config.staticReviewTime || ''
          };
          setFormData(loaded);
          setSavedData(loaded);
        }
      } catch (err) {
        console.error("Failed to fetch workspace configuration", err);
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchProfileAndAccounts();
    fetchWorkspaceConfig();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      let upiUrl = formData.upiId;
      if (upiUrl && !upiUrl.includes('pa=')) {
        upiUrl = `upi://pay?pa=${formData.upiId}&pn=Business`;
      }

      const postBody = {
        phone: formData.phone,
        upiUrl: upiUrl,
        subscriptionAmount: formData.subscriptionAmount ? parseFloat(formData.subscriptionAmount) : null,
        expiryDate: formData.expiryDate || null,
        overdueOffSet: formData.overdueOffSet ? parseInt(formData.overdueOffSet) : null,
        reviewType: formData.reviewType,
        staticReviewTime: formData.staticReviewTime || null
      };

      await api.post(`/payping/accounts/business-details`, postBody, {
        headers: { 'X-Trigger-Success': 'true' }
      });
      
      // Persist as saved baseline and exit edit mode
      setSavedData({ ...formData });
      setIsEditing(false);
      window.dispatchEvent(new CustomEvent('PAYPING_REFRESH_METRICS'));
    } catch (err) {
      console.error("Failed to save workspace configuration", err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData({ ...savedData });
    setIsEditing(false);
  };

  const handleSelectAccount = (account: AccountDTO) => {
    localStorage.setItem('selected_account_id', account.id);
    sessionStorage.removeItem('payping_global_metrics');
    window.location.href = '/payping/dashboard';
  };

  const handleCreateAccount = () => {
    navigate('/payping/onboard');
  };

  const handleSignOut = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate('/');
  };

  const paypingAccounts = accounts;

  const activeAccountId = localStorage.getItem('selected_account_id');

  if (loadingProfile || loadingConfig) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-text-muted">
        <RefreshCw className="w-6 h-6 animate-spin text-accent" />
        <span className="category-label animate-pulse">Synchronizing Settings...</span>
      </div>
    );
  }

  // Helper to render a view-mode field row
  const ViewField = ({ label, value }: { label: string; value: string }) => (
    <div className="space-y-1">
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">{label}</span>
      <p className="text-sm font-semibold text-text-primary truncate">
        {value || <span className="text-text-muted italic font-normal">Not configured</span>}
      </p>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-8 py-5 space-y-8 animate-in fade-in duration-300">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-slate-900 dark:text-white">Settings</h1>
          <p className="text-text-muted text-sm mt-1">Manage your active workspace, preferences, and enterprise accounts.</p>
        </div>
        <button 
          onClick={() => navigate('/payping/dashboard')}
          className="premium-btn-secondary inline-flex items-center gap-2 py-2 px-4 text-xs self-start"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </button>
      </div>

      {/* Tabs segment */}
      <div className="flex flex-wrap gap-1.5 p-0.5 bg-bg-sidebar/55 border border-border/60 rounded-xl max-w-fit animate-in fade-in duration-200">
        <button
          onClick={() => setActiveTab('workspace')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
            activeTab === 'workspace' 
              ? 'bg-white dark:bg-zinc-800 text-accent font-bold shadow-sm' 
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Workspace Config
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
            activeTab === 'profile' 
              ? 'bg-white dark:bg-zinc-800 text-accent font-bold shadow-sm' 
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Profile &amp; Workspaces
        </button>
      </div>

      {/* TAB CONTENT: Workspace Config */}
      {activeTab === 'workspace' && (
        <form onSubmit={handleSaveConfig} className="space-y-6">
          <div className="premium-card no-card-hover space-y-6">
            {/* Card header with Edit / Cancel controls */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent-tint rounded-lg text-accent">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Business Configuration</h3>
                  <p className="text-[11px] text-text-muted">Define UPI endpoints, default billing values, and delivery cycles.</p>
                </div>
              </div>

              {/* Edit / Cancel button */}
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border border-border bg-bg-sidebar hover:border-accent hover:text-accent text-text-muted transition-all cursor-pointer outline-none"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border border-border bg-bg-sidebar hover:border-rose-400 hover:text-rose-500 text-text-muted transition-all cursor-pointer outline-none"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              )}
            </div>

            {/* VIEW MODE */}
            {!isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ViewField label="Workspace Phone Number" value={formData.phone} />
                <ViewField label="UPI Address / URL" value={formData.upiId} />
                <ViewField label="Default Subscription Amount" value={formData.subscriptionAmount ? `₹ ${formData.subscriptionAmount}` : ''} />
                <ViewField label="Subscription Expiry Date" value={formData.expiryDate} />
                <ViewField label="Overdue Threshold Days Offset" value={formData.overdueOffSet ? `${formData.overdueOffSet} days` : ''} />
                <ViewField label="Payment Review Frequency" value={formData.reviewType} />
                {(formData.reviewType === 'STATIC' || formData.reviewType === 'BOTH') && (
                  <ViewField label="Daily Summary Delivery Time" value={formData.staticReviewTime} />
                )}
              </div>
            )}

            {/* EDIT MODE */}
            {isEditing && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Phone */}
                  <div>
                    <label className="block mb-2 font-medium text-text-muted">Workspace Phone Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. +919876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full premium-input font-medium"
                    />
                  </div>

                  {/* UPI ID */}
                  <div>
                    <label className="block mb-2 font-medium text-text-muted">UPI Address / URL</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. name@bank"
                      value={formData.upiId}
                      onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                      className="w-full premium-input font-medium"
                    />
                  </div>

                  {/* Subscription Amount */}
                  <div>
                    <label className="block mb-2 font-medium text-text-muted">Default Subscription Amount</label>
                    <input
                      type="number"
                      placeholder="₹ 0.00"
                      value={formData.subscriptionAmount}
                      onChange={(e) => setFormData({ ...formData, subscriptionAmount: e.target.value })}
                      className="w-full premium-input font-medium"
                    />
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="block mb-2 font-medium text-text-muted">Subscription Expiry Date</label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full premium-input font-medium text-text-primary"
                    />
                  </div>

                  {/* Overdue Threshold */}
                  <div>
                    <label className="block mb-2 font-medium text-text-muted">Overdue Threshold Days Offset</label>
                    <input
                      type="number"
                      placeholder="e.g. 5"
                      value={formData.overdueOffSet}
                      onChange={(e) => setFormData({ ...formData, overdueOffSet: e.target.value })}
                      className="w-full premium-input font-medium"
                    />
                  </div>

                  {/* Payment Review Type */}
                  <div>
                    <label className="block mb-2 font-medium text-text-muted">Payment Review Freq</label>
                    <select
                      value={formData.reviewType}
                      onChange={(e) => setFormData({ ...formData, reviewType: e.target.value })}
                      className="w-full premium-input font-medium text-text-primary"
                    >
                      <option value="IMMEDIATE">Immediate (Real-Time)</option>
                      <option value="STATIC">Static (Daily Batch)</option>
                      <option value="BOTH">Both (Real-Time + Batch)</option>
                      <option value="INACTIVE">Inactive (Disabled)</option>
                    </select>
                  </div>
                </div>

                {/* Helper Alert Text */}
                <div className="bg-bg-sidebar p-4 rounded-lg border border-border flex gap-3 text-xs italic text-text-muted">
                  <Info className="w-5 h-5 text-accent shrink-0" />
                  <p>
                    {formData.reviewType === 'IMMEDIATE' && "Reviews are triggered the moment a customer submits a transaction."}
                    {formData.reviewType === 'STATIC' && "Reviews are batched and notifications sent at your configured daily review time."}
                    {formData.reviewType === 'BOTH' && "Both real-time transaction notifications and daily summarized alerts are active."}
                    {formData.reviewType === 'INACTIVE' && "Notifications and alerts for payment reviews are currently disabled."}
                  </p>
                </div>

                {/* Daily Review Time Input */}
                {(formData.reviewType === 'STATIC' || formData.reviewType === 'BOTH') && (
                  <div className="animate-in slide-in-from-top duration-300 max-w-sm">
                    <label className="block mb-2 font-medium text-text-muted">Daily Summary Delivery Time</label>
                    <input
                      type="time"
                      required
                      value={formData.staticReviewTime}
                      onChange={(e) => setFormData({ ...formData, staticReviewTime: e.target.value })}
                      className="w-full premium-input font-medium text-text-primary"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Save button — only visible in edit mode */}
          {isEditing && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingConfig}
                className="premium-btn-primary py-3 px-8 flex items-center gap-2"
              >
                {savingConfig ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Save Configuration
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      )}

      {/* TAB CONTENT: Profile & Workspaces */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* User profile card */}
          <div className="premium-card no-card-hover flex items-center justify-between p-4 sm:p-5 gap-4">
            <div className="flex items-center gap-3 text-left min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent rounded flex items-center justify-center text-white text-sm sm:text-base font-black shadow-sm select-none shrink-0">
                {user?.name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-text-primary truncate">{user?.name}</h3>
                <p className="text-text-muted text-[10px] sm:text-xs uppercase tracking-wider mt-0.5 truncate">{user?.businessName || "Administrator"}</p>
              </div>
            </div>
            
            <button
              onClick={handleSignOut}
              className="premium-btn-secondary hover:border-red-500 hover:text-red-500 flex items-center gap-1.5 py-1.5 px-3 sm:py-2 sm:px-4 text-[11px] sm:text-xs shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>

          {/* Workspaces list */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-text-muted" />
                <span className="category-label">PayPing Workspaces</span>
              </div>
              <button
                onClick={handleCreateAccount}
                className="premium-btn-primary flex items-center justify-center gap-1 py-1.5 px-3 text-xs w-full sm:w-auto"
              >
                <Plus className="w-3.5 h-3.5" /> New Workspace
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paypingAccounts.map((account) => {
                const isActive = account.id === activeAccountId;
                const customersCount = account.customerCount ?? (account as any).customersCount ?? 0;
                return (
                  <div 
                    key={account.id}
                    className={`premium-card no-card-hover p-4 relative overflow-hidden transition-all flex flex-col justify-between min-h-[130px] ${
                      isActive 
                        ? 'border-accent bg-accent-tint/10' 
                        : 'hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-text-primary tracking-wide truncate pr-2">
                          {account.businessName || account.accountName || `Workspace (${account.id.slice(0, 8)})`}
                        </span>
                        {isActive ? (
                          <span className="text-[9px] font-bold uppercase bg-accent text-white px-2 py-0.5 rounded tracking-widest shrink-0">
                            Active
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-text-muted px-2 py-0.5 rounded tracking-widest shrink-0">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 mb-2">
                        {account.businessName && account.accountName && account.businessName !== account.accountName && (
                          <p className="text-[11px] text-text-muted font-medium truncate">{account.accountName}</p>
                        )}
                        <p className="text-[10px] text-text-muted font-mono truncate">ID: {account.id}</p>
                      </div>

                      {/* Customers count */}
                      <div className="flex items-center gap-1.5 text-xs text-text-muted mt-2">
                        <Users className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span className="font-semibold text-text-primary">{customersCount}</span>
                        <span className="text-[11px]">customers</span>
                      </div>
                    </div>

                    {!isActive && (
                      <button
                        onClick={() => handleSelectAccount(account)}
                        className="premium-btn-secondary w-full py-1.5 text-xs flex items-center justify-center gap-1.5 mt-3 group"
                      >
                        Switch to Workspace 
                        <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettingsPage;
