import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronDown, ChevronUp, ClipboardCheck, AlertTriangle,
    ArrowUpRight, MessageSquare, AlertCircle, RefreshCw,
    Check, X, FileText, User, HelpCircle, CheckCircle, XCircle,
    Search
} from 'lucide-react';
import api from '../../api';

interface CustomerDTO {
    id: string;
    name: string;
    phone: string;
    amount: number;
    expiryDate: string;
    paymentStatus: 'PAID' | 'UNPAID' | 'OVERDUE';
    status: 'ACTIVE' | 'INACTIVE';
    reviewStatus: string;
}

const STATUS_ORDER = ['NOTIFIED', 'URL_ACCESSED', 'PAID', 'APPROVED', 'REJECTED'];

const STATUS_LABELS: Record<string, string> = {
    PAID: 'Payments Claimed',
    URL_ACCESSED: 'Link Accessed',
    NOTIFIED: 'Notified',
    APPROVED: 'Approved',
    REJECTED: 'Rejected'
};

const PaymentReview = () => {
    const navigate = useNavigate();

    // API States
    const [customers, setCustomers] = useState<CustomerDTO[]>([]);
    const [reviewStatuses, setReviewStatuses] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // UI Accordion State
    const [openSection, setOpenSection] = useState<string | null>('PAID');

    // Search Query State
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Popup Decision Modal State
    const [confirmingCustomer, setConfirmingCustomer] = useState<CustomerDTO | null>(null);

    // Payment Form Modal State
    const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
    const [paymentModes, setPaymentModes] = useState<string[]>([]);
    const [paymentForm, setPaymentForm] = useState({
        amount: 0,
        expiryDate: '',
        paymentMode: 'UPI',
        comments: ''
    });

    // Warning Toast Notification State
    const [toastMessage, setToastMessage] = useState<string>('');

    // Fetch initial datasets
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);

            // 1. Fetch review status enum values
            const statusRes = await api.get('/payping/customers/getreviewstatus');
            if (Array.isArray(statusRes.data)) {
                setReviewStatuses(statusRes.data);
            } else {
                setReviewStatuses(STATUS_ORDER);
            }

            // 2. Fetch customers (fetch up to 1000 active customers)
            const customerRes = await api.post('/payping/customers/get', {
                status: 'ACTIVE',
                search: '',
                sort: 'name_asc',
                page: 0,
                size: 1000
            });

            // Extract the list from response content or direct array
            const dataContent = customerRes.data || customerRes.data.content || [];
            setCustomers(dataContent);
        } catch (err) {
            console.error("Failed to load review data:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        // Fetch payment modes once
        const fetchPaymentModes = async () => {
            try {
                const res = await api.get('/payping/customers/payments/getPaymentModes');
                if (Array.isArray(res.data)) {
                    setPaymentModes(res.data);
                } else {
                    setPaymentModes(['UPI', 'CASH', 'OTHERS']);
                }
            } catch (err) {
                console.error("Failed to load payment modes:", err);
                setPaymentModes(['UPI', 'CASH', 'OTHERS']);
            }
        };
        fetchPaymentModes();
    }, [fetchData]);

    // Toast Timer trigger
    const triggerToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => {
            setToastMessage('');
        }, 3000);
    };

    // Date computation helpers
    const getNextMonthSameDate = (currentDateStr: string) => {
        if (!currentDateStr) return '';
        const date = new Date(currentDateStr);
        if (isNaN(date.getTime())) return '';

        const currentDay = date.getDate();
        date.setDate(1);
        date.setMonth(date.getMonth() + 1);

        const lastDayOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const targetDay = Math.min(currentDay, lastDayOfTargetMonth);
        date.setDate(targetDay);

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const isFutureDate = (dateStr: string) => {
        if (!dateStr) return false;
        const inputDate = new Date(dateStr);
        inputDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return inputDate.getTime() > today.getTime();
    };

    // Action clicks on customer row
    const handleCustomerRowClick = (customer: CustomerDTO, status: string) => {
        if (status !== 'PAID') return; // Only PAID block rows are clickable to confirm

        // 8. If customer has paymentStatus as PAID, trigger the 3s toast warning and exit
        if (customer.paymentStatus === 'PAID') {
            triggerToast("the customer has already made payment go to customers view to modify this customers");
            return;
        }

        // Open decision popup
        setConfirmingCustomer(customer);
    };

    // Action handlers for Reject / Approve
    const handleRejectPayment = async () => {
        if (!confirmingCustomer) return;

        try {
            setActionLoading(true);
            const updated = {
                ...confirmingCustomer,
                reviewStatus: 'REJECTED'
            };
            await api.put(`/payping/customers/${confirmingCustomer.id}`, updated, {
                headers: { 'X-Trigger-Success': 'true' }
            });

            setConfirmingCustomer(null);
            await fetchData();
        } catch (err) {
            console.error("Failed to reject customer payment status:", err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleApprovePayment = () => {
        if (!confirmingCustomer) return;

        // Auto-calculate defaults for payment form popup
        const defaultNextExpiry = getNextMonthSameDate(confirmingCustomer.expiryDate || new Date().toISOString().split('T')[0]);
        setPaymentForm({
            amount: confirmingCustomer.amount || 0,
            expiryDate: defaultNextExpiry,
            paymentMode: 'UPI',
            comments: ''
        });

        setShowPaymentModal(true);
    };

    const submitApprovedPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmingCustomer) return;

        if (!isFutureDate(paymentForm.expiryDate)) {
            alert("Expiry date must be in the future.");
            return;
        }

        try {
            setActionLoading(true);

            // 1. Update customer paymentStatus to 'PAID', reviewStatus to 'APPROVED', and set new expiryDate
            const updatedCustomer = {
                ...confirmingCustomer,
                paymentStatus: 'PAID' as const,
                reviewStatus: 'APPROVED',
                expiryDate: paymentForm.expiryDate
            };
            await api.put(`/payping/customers/${confirmingCustomer.id}`, updatedCustomer, {
                headers: { 'X-Trigger-Success': 'true' }
            });

            // 2. Post payment history record to backend
            const paymentPayload = {
                amount: Number(paymentForm.amount),
                paymentMode: paymentForm.paymentMode,
                comments: paymentForm.comments || '',
                customerId: confirmingCustomer.id
            };
            await api.post('/payping/customers/payments', paymentPayload);

            // 3. Clear modal states and reload
            setShowPaymentModal(false);
            setConfirmingCustomer(null);
            await fetchData();
        } catch (err) {
            console.error("Failed to complete approved payment configuration:", err);
            alert("Failed to confirm approved payment details.");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-transparent min-h-[60vh] relative overflow-hidden">
                <div className="absolute w-[300px] h-[300px] bg-indigo-500/5 rounded blur-[100px] animate-pulse pointer-events-none" />
                <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin mb-4" />
                <p className="text-slate-500 dark:text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">Syncing review status...</p>
            </div>
        );
    }

    // Filter customers on client side based on search query
    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery)
    );

    // Filter statuses to display: only statuses present in STATUS_ORDER, that actually have customers mapped to them
    const activeStatuses = STATUS_ORDER.filter(status => {
        const groupCount = filteredCustomers.filter(c => c.reviewStatus === status).length;
        return groupCount > 0;
    });

    // Counts for the summary widgets (always calculated from raw customers list)
    const paidCount = customers.filter(c => c.reviewStatus === 'PAID').length;
    const accessedCount = customers.filter(c => c.reviewStatus === 'URL_ACCESSED').length;
    const notifiedCount = customers.filter(c => c.reviewStatus === 'NOTIFIED').length;

    return (
        <main className="flex-1 w-full max-w-none mx-auto px-4 md:px-8 py-4 space-y-4 pb-20 relative select-none">
            {/* 8. Toast Banner (dismisses after 3s) */}
            {toastMessage && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-amber-500 text-black px-5 py-3 rounded font-bold text-xs uppercase tracking-wider shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top-10 duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0 text-black" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Header Area */}
            <div className="space-y-1.5 pb-3 border-b border-slate-200/60 dark:border-zinc-900">
                <div className="flex items-center gap-3">
                    <ClipboardCheck className="w-8 h-8 text-indigo-500" />
                    <h1 className="text-2xl font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">Payment Review</h1>
                </div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-500 pl-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Billing Verification Portal</span>
                </div>
            </div>

            {/* Accordion List Container */}
            <div className="space-y-4">
                {STATUS_ORDER.map((status) => {
                    const statusGroup = customers.filter(c => c.reviewStatus === status);
                    const isExpanded = openSection === status;
                    const count = statusGroup.length;
                    const label = STATUS_LABELS[status] || status;
                    
                    const isPaid = status === 'PAID';
                    const isPulse = isPaid && count > 0;

                    return (
                        <div
                            key={status}
                            className="border border-slate-200/60 dark:border-zinc-800/40 rounded bg-slate-50/50 dark:bg-[#09090b]/40 shadow-sm relative"
                        >
                            {/* Glowing Outline Layer: ONLY when PAID has count > 0 */}
                            {isPulse && (
                                <div className="absolute -inset-px border-2 border-indigo-500/80 rounded pointer-events-none animate-pulse shadow-[0_0_12px_rgba(99,102,241,0.45)] z-10" />
                            )}

                            {/* Accordion Header */}
                            <button
                                onClick={() => setOpenSection(isExpanded ? null : status)}
                                className="w-full flex items-center justify-between p-3.5 bg-white dark:bg-[#0f0f0f] hover:bg-slate-50 dark:hover:bg-zinc-900/50 text-left font-bold border-0 rounded outline-none cursor-pointer relative z-20"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded ${status === 'PAID' ? 'bg-emerald-500 animate-pulse' :
                                            status === 'URL_ACCESSED' ? 'bg-indigo-400' :
                                                status === 'NOTIFIED' ? 'bg-amber-400' :
                                                    status === 'APPROVED' ? 'bg-indigo-500' : 'bg-rose-500'
                                        }`} />
                                    <span className="text-xs text-slate-800 dark:text-zinc-200 tracking-wide font-bold uppercase">{label}</span>
                                    <span className="text-[10px] bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-650 dark:text-zinc-450 px-2 py-0.5 rounded font-semibold">{count}</span>
                                </div>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500 dark:text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-slate-500 dark:text-zinc-400" />}
                            </button>

                            {/* Accordion Content (Collapsible) */}
                            <div
                                className={`overflow-hidden rounded transition-all duration-300 ${isExpanded ? 'max-h-[1000px] border-t border-slate-100 dark:border-zinc-900/50' : 'max-h-0'}`}
                            >
                                <div className="divide-y divide-slate-100 dark:divide-zinc-800/40 bg-slate-50/20 dark:bg-zinc-950/10">
                                    {/* Helper Prompt Text: inside expanded PAID section above list */}
                                    {isPaid && (
                                        <div className="px-3.5 py-2.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-500/5 border-b border-slate-100 dark:border-zinc-900/50">
                                            click a customer to confirm the payment
                                        </div>
                                    )}

                                    {count > 0 ? (
                                        statusGroup.map((customer, index) => {
                                            const isClickable = status === 'PAID';
                                            return (
                                                <div
                                                    key={customer.id}
                                                    onClick={() => handleCustomerRowClick(customer, status)}
                                                    className={`p-3 flex items-center justify-between transition-all duration-200 min-h-[46px] ${isClickable
                                                            ? "hover:bg-slate-100 dark:hover:bg-zinc-900/30 cursor-pointer active:bg-slate-200 dark:active:bg-zinc-900/60"
                                                            : "bg-slate-100/30 dark:bg-[#050506]/15"
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3.5 min-w-0">
                                                        <span className="font-mono text-slate-400 dark:text-zinc-500 text-xs font-bold w-6">{String(index + 1).padStart(2, '0')}</span>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-xs text-slate-800 dark:text-zinc-200 tracking-wide truncate">{customer.name}</p>
                                                            <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-semibold tracking-wider mt-0.5 block">
                                                                {customer.phone}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4 shrink-0 pl-3">
                                                        <div className="text-right">
                                                            <p className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400 font-bold">₹{customer.amount}</p>
                                                        </div>
                                                        <div className="w-24 hidden md:flex justify-end">
                                                            <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded tracking-widest border ${status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                                                                    status === 'URL_ACCESSED' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' :
                                                                        status === 'NOTIFIED' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20' :
                                                                            status === 'APPROVED' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' :
                                                                                'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                                                }`}>
                                                                {label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center py-6 bg-slate-50/50 dark:bg-zinc-950/10 flex flex-col items-center justify-center gap-1.5">
                                            <p className="text-slate-500 dark:text-zinc-500 text-[10px] uppercase tracking-widest font-bold">No customers in queue</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ======================================================== */}
            {/* POPUP MODAL 1: DECISION MODAL (APPROVE OR REJECT)        */}
            {/* ======================================================== */}
            {confirmingCustomer && !showPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setConfirmingCustomer(null)} />

                    {/* Container */}
                    <div className="relative bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/80 w-full max-w-sm rounded shadow-xl p-6 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                        <div className="space-y-3">
                            <div className="w-12 h-12 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
                                <HelpCircle className="w-6 h-6" />
                            </div>
                            <h3 className="font-extrabold text-sm uppercase tracking-widest text-slate-500 dark:text-zinc-400">Confirm Payment Status</h3>
                            <p className="text-sm text-slate-800 dark:text-zinc-200 leading-relaxed max-w-[280px] mx-auto">
                                Confirm <span className="font-bold text-indigo-600 dark:text-indigo-400">{confirmingCustomer.name}</span> payment of <span className="font-bold text-slate-900 dark:text-white font-mono">₹{confirmingCustomer.amount}</span>
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={handleRejectPayment}
                                className="flex-1 py-3 bg-slate-100 hover:bg-rose-50/50 dark:bg-[#0f0f0f] dark:hover:bg-rose-950/20 text-slate-600 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-500 border border-slate-200 dark:border-zinc-800 dark:hover:border-rose-900/30 rounded font-bold text-xs transition-all duration-200 cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                            >
                                <XCircle className="w-4 h-4" /> Reject
                            </button>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={handleApprovePayment}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs transition-all duration-200 cursor-pointer active:scale-95 shadow-sm flex items-center justify-center gap-1.5"
                            >
                                <CheckCircle className="w-4 h-4" /> Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* POPUP MODAL 2: APPROVED PAYMENT FORM CONFIGURATION       */}
            {/* ======================================================== */}
            {showPaymentModal && confirmingCustomer && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)} />

                    {/* Form Container */}
                    <div className="relative bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/80 w-full max-w-sm rounded sm:rounded shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                        {/* Header */}
                        <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 bg-slate-50 dark:bg-[#0f0f0f]/30">
                            <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200">
                                Update {confirmingCustomer.name} payment status
                            </h3>
                            <button type="button" onClick={() => setShowPaymentModal(false)} className="text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white outline-none border-0 bg-transparent cursor-pointer"><X className="w-5 h-5" /></button>
                        </div>

                        {/* Form */}
                        <form onSubmit={submitApprovedPayment} className="p-5 overflow-y-auto flex-1 text-sm space-y-4">
                            <div className="p-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded text-xs font-semibold leading-relaxed flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <span>Please update the new expiry date for the next cycle.</span>
                            </div>

                            {/* Expiry Date */}
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest ml-1">New Expiry Date <span className="text-rose-500">*</span></label>
                                <input
                                    type="date"
                                    required
                                    value={paymentForm.expiryDate}
                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-[#050506] border border-slate-200 dark:border-zinc-800 p-2.5 rounded text-slate-800 dark:text-white font-mono font-bold outline-none focus:border-indigo-500 transition-colors"
                                />
                                {!isFutureDate(paymentForm.expiryDate) && paymentForm.expiryDate && (
                                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold ml-1">Expiry date must be in the future.</p>
                                )}
                            </div>

                            {/* Amount */}
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest ml-1">Paid Amount (₹)</label>
                                <input
                                    type="number"
                                    required
                                    value={paymentForm.amount || ''}
                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                                    className="w-full bg-slate-50 dark:bg-[#050506] border border-slate-200 dark:border-zinc-800 p-2.5 rounded text-slate-800 dark:text-white font-mono font-bold outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>

                            {/* Payment Mode */}
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest ml-1">Payment Mode</label>
                                <select
                                    value={paymentForm.paymentMode}
                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMode: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-[#050506] border border-slate-200 dark:border-zinc-800 p-2.5 rounded text-slate-800 dark:text-white font-bold outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                                >
                                    {paymentModes.map(mode => (
                                        <option key={mode} value={mode}>{mode}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Comments */}
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest ml-1 font-bold">Comments</label>
                                <textarea
                                    value={paymentForm.comments}
                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, comments: e.target.value }))}
                                    placeholder="Add payment comments (e.g. transaction ref, cash notes)..."
                                    rows={3}
                                    className="w-full bg-slate-50 dark:bg-[#050506] border border-slate-200 dark:border-zinc-800 p-2.5 rounded text-slate-800 dark:text-white outline-none focus:border-indigo-5 transition-colors resize-none"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(false)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white font-bold py-2.5 rounded text-xs transition-colors cursor-pointer outline-none border-0"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading || !paymentForm.amount || !paymentForm.expiryDate || !isFutureDate(paymentForm.expiryDate)}
                                    className={`flex-1 font-bold py-2.5 rounded text-xs transition-all cursor-pointer ${(actionLoading || !paymentForm.amount || !paymentForm.expiryDate || !isFutureDate(paymentForm.expiryDate))
                                            ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed border border-slate-200 dark:border-transparent'
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                                        }`}
                                >
                                    {actionLoading ? "Saving..." : "Save Payment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
};

export default PaymentReview;
