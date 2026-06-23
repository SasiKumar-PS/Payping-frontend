import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Users, ChevronDown, ArrowUpDown, Filter, Search, X,
    MessageCircle, Edit2, CheckSquare, Square,
    ChevronLeft, ChevronRight, Check, RefreshCw, Phone,
    LayoutDashboard, MessageSquare, UserPlus, AlertCircle,
    AlertTriangle,
    Upload, ArrowRight, Download, FileText,
    ArrowLeft, Trash2, Calendar, TrendingUp, Wallet, Bell, Zap, Clock, Plus
} from 'lucide-react';
import api from '../../api';

const parseDetailsFromPayload = (map?: Record<string, any>): { key: string; value: string }[] => {
    if (!map) return [];
    const list: { key: string; value: string }[] = [];
    Object.entries(map).forEach(([k, v]) => {
        if (Array.isArray(v)) {
            v.forEach(val => list.push({ key: k, value: String(val) }));
        } else if (v !== null && v !== undefined) {
            list.push({ key: k, value: String(v) });
        }
    });
    return list;
};

const compileDetailsToPayload = (list: { key: string; value: string }[]): Record<string, string[]> => {
    const map: Record<string, string[]> = {};
    list.forEach(item => {
        const k = String(item.key || '').trim();
        const v = String(item.value || '').trim();
        if (!k) return;
        if (map[k] === undefined) {
            map[k] = [v];
        } else {
            map[k].push(v);
        }
    });
    return map;
};

const getDaysDifference = (expiryStr: string) => {
    if (!expiryStr) return { days: 0, text: 'No Expiry', color: 'text-text-muted bg-bg-subtle border-border' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryStr);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 7) {
        return { 
            days: diffDays, 
            text: `${diffDays} Days Left`, 
            color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
        };
    } else if (diffDays > 0) {
        return { 
            days: diffDays, 
            text: `${diffDays} Days Left`, 
            color: 'text-amber-600 dark:text-amber-500 bg-amber-500/10 border-amber-500/20' 
        };
    } else if (diffDays === 0) {
        return { 
            days: 0, 
            text: 'Expires Today', 
            color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20 font-black animate-pulse' 
        };
    } else {
        return { 
            days: diffDays, 
            text: `${Math.abs(diffDays)} Days Overdue`, 
            color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20 font-bold' 
        };
    }
};

interface PaymentDTO {
    amount: number;
    paymentMode: string;
    confirmedAt: string;
    completedAt?: string;
    comments: string;
}

interface CustomerDTO {
    id: string;
    name: string;
    phone: string;
    amount: number;
    expiryDate: string;
    paymentStatus: 'PAID' | 'UNPAID' | 'OVERDUE';
    status: 'ACTIVE' | 'INACTIVE';
    notificationStatus?: 'ACTIVE' | 'INACTIVE';
    additionalDetails?: Record<string, string | string[]>;
    payments?: PaymentDTO[];
}

interface FilterDTO {
    [key: string]: string[];
}

interface CustomerFilterDTO {
    mainFilters: Record<string, string[]>;
    customFilters: Record<string, string[]>;
}


interface TemplateDTO {
    id: string;
    name: string;
    content: string;
}

const renderTemplateWithPills = (
    content: string,
    isEditable: boolean,
    onRemoveTag?: (tag: string) => void
) => {
    if (!content) return null;

    // Split by tags: e.g. "Hello {name}, amount is {Amount}"
    const parts = content.split(/({[^{}]+})/g);

    return (
        <>
            {parts.map((part, index) => {
                const match = part.match(/^{(.+)}$/);
                if (match) {
                    const tag = match[1];
                    return (
                        <span
                            key={index}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 bg-[#022c22]/90 text-emerald-400 border border-emerald-800/60 rounded text-[1em] font-semibold align-baseline select-none whitespace-nowrap"
                        >
                            {tag}
                            {isEditable && onRemoveTag && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveTag(tag);
                                    }}
                                    className="hover:text-red-400 transition-colors p-0.5 border-0 bg-transparent outline-none flex items-center justify-center rounded hover:bg-red-500/20 cursor-pointer"
                                >
                                    <X className="w-3 h-3 shrink-0" />
                                </button>
                            )}
                        </span>
                    );
                }
                return part;
            })}
        </>
    );
};

const formatDateToReadable = (dateStr: string | null | undefined) => {
    if (!dateStr || dateStr === 'N/A' || dateStr.trim() === '') return 'N/A';
    try {
        let cleanStr = dateStr.trim();
        let dateObj: Date;
        let hasTime = cleanStr.includes(':') || cleanStr.includes('T') || cleanStr.toLowerCase().includes('am') || cleanStr.toLowerCase().includes('pm');
        
        if (cleanStr.includes('T')) {
            dateObj = new Date(cleanStr);
        } else {
            const parts = cleanStr.split(/\s+/);
            const datePart = parts[0];
            const separator = datePart.includes('-') ? '-' : datePart.includes('/') ? '/' : '';
            if (separator) {
                const subparts = datePart.split(separator);
                if (subparts.length === 3) {
                    if (subparts[0].length === 4) {
                        const [year, month, day] = subparts.map(val => parseInt(val, 10));
                        dateObj = new Date(year, month - 1, day);
                    } else if (subparts[2].length === 4) {
                        const [day, month, year] = subparts.map(val => parseInt(val, 10));
                        dateObj = new Date(year, month - 1, day);
                    } else {
                        dateObj = new Date(cleanStr);
                    }
                } else {
                    dateObj = new Date(cleanStr);
                }
            } else {
                dateObj = new Date(cleanStr);
            }
        }

        if (isNaN(dateObj.getTime())) {
            return dateStr;
        }

        const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const day = dateObj.getDate();
        const monthName = MONTH_NAMES[dateObj.getMonth()];
        const year = dateObj.getFullYear();
        
        let formatted = `${day} ${monthName} ${year}`;
        
        if (hasTime) {
            let timeStr = '';
            const parts = cleanStr.split(/\s+/);
            if (parts.length > 1) {
                const timePart = parts[1];
                const ampmPart = parts[2];
                if (timePart.includes(':')) {
                    const [hStr, mStr] = timePart.split(':');
                    let h = parseInt(hStr, 10);
                    const m = mStr.substring(0, 2);
                    let suffix = ampmPart;
                    if (!suffix) {
                        if (timePart.toLowerCase().endsWith('pm')) {
                            suffix = 'PM';
                        } else if (timePart.toLowerCase().endsWith('am')) {
                            suffix = 'AM';
                        } else {
                            suffix = h >= 12 ? 'PM' : 'AM';
                        }
                    }
                    
                    if (suffix === 'PM' && h > 12) h -= 12;
                    if (suffix === 'AM' && h === 12) h = 12;
                    if (h > 12) {
                        h -= 12;
                        suffix = 'PM';
                    }
                    timeStr = `${h}:${m} ${suffix}`;
                }
            } else {
                timeStr = dateObj.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            }
            if (timeStr) {
                formatted += `, ${timeStr}`;
            }
        }
        return formatted;
    } catch (e) {
        return dateStr;
    }
};

const isFutureDate = (dateStr: string) => {
    if (!dateStr) return false;
    const inputDate = new Date(dateStr);
    inputDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inputDate.getTime() > today.getTime();
};

interface AddCustomersProps {
    isEmbedded?: boolean;
    onGoBack?: () => void;
}

const AddCustomers = ({ isEmbedded = false, onGoBack }: AddCustomersProps) => {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Global Workspace State
    const [totalCount, setTotalCount] = useState<number>(0);
    const [globalLoading, setGlobalLoading] = useState<boolean>(false);

    // Modal Visibility Controllers
    const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
    const [showManualModal, setShowManualModal] = useState<boolean>(false);

    // Bulk Processing State Machine
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewCustomers, setPreviewCustomers] = useState<CustomerDTO[]>([]);
    const [bulkStage, setBulkStage] = useState<'select' | 'preview'>('select');

    // Manual Form Input State
    const [manualForm, setManualForm] = useState<Partial<CustomerDTO>>(() => {
        const saved = sessionStorage.getItem('payping_manual_customer_form');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved manual customer form", e);
            }
        }
        return {
            name: '',
            phone: '',
            amount: 0,
            expiryDate: ''
        };
    });

    // Additional Details State
    const [additionalDetailsList, setAdditionalDetailsList] = useState<{ key: string; value: string }[]>(() => {
        const saved = sessionStorage.getItem('payping_additional_details_list');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved additional details list", e);
            }
        }
        return [];
    });

    useEffect(() => {
        sessionStorage.setItem('payping_manual_customer_form', JSON.stringify(manualForm));
    }, [manualForm]);

    useEffect(() => {
        sessionStorage.setItem('payping_additional_details_list', JSON.stringify(additionalDetailsList));
    }, [additionalDetailsList]);

    const [showDetailForm, setShowDetailForm] = useState<boolean>(false);
    const [newDetailKey, setNewDetailKey] = useState<string>('');
    const [newDetailVal, setNewDetailVal] = useState<string>('');
    const [apiDetailsData, setApiDetailsData] = useState<Record<string, string> | null>(null);
    const [loadingApiDetails, setLoadingApiDetails] = useState<boolean>(false);
    const [detailsDropdownField, setDetailsDropdownField] = useState<'key' | 'value' | null>(null);

    const fetchApiDetailsData = async () => {
        if (apiDetailsData !== null || loadingApiDetails) return;
        try {
            setLoadingApiDetails(true);
            const res = await api.get('/payping/accounts/getall-Additional-details');
            setApiDetailsData(res.data || {});
        } catch (err) {
            console.error("Failed to load details reference data:", err);
            setApiDetailsData({});
        } finally {
            setLoadingApiDetails(false);
        }
    };

    const handleSaveNewDetailInline = () => {
        const kStr = String(newDetailKey || '').trim();
        const vStr = String(newDetailVal || '').trim();
        if (!kStr || !vStr) return;
        setAdditionalDetailsList(prev => [...prev, { key: kStr, value: vStr }]);
        setShowDetailForm(false);
        setNewDetailKey('');
        setNewDetailVal('');
    };

    // Lifecycle Hook: Load live account statistics
    useEffect(() => {
        fetchCurrentCustomerCount();
    }, []);

    const fetchCurrentCustomerCount = async () => {
        try {
            const res = await api.get('/payping/accounts/count');
            // Backend should return an integer or an object containing the count
            setTotalCount(typeof res.data === 'object' ? res.data.count : res.data);
        } catch (err) {
            console.error("Failed to query runtime workspace stats:", err);
        }
    };

    // ==========================================
    // MODULE FLOW 1: BULK CSV HANDLING PIPELINE
    // ==========================================

    const downloadCsvTemplate = () => {
        const csvHeaders = "Name,Phone,Amount,Expiry Date\n";
        const csvExampleRow = "Suresh Kumar,919876543210,1500,2026-12-31\n";
        const blob = new Blob([csvHeaders + csvExampleRow], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "payping_customer_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const triggerFileCheck = async () => {
        if (!selectedFile) return;
        setGlobalLoading(true);
        const formData = new FormData();
        formData.append("file", selectedFile);

        try {
            const res = await api.post('/payping/customers/checkCSV', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setPreviewCustomers(res.data);
            setBulkStage('preview');
        } catch (err: any) {
            alert(err.response?.data?.message || "Parsing error. Verify column layout standards.");
        } finally {
            setGlobalLoading(false);
        }
    };

    const executeBulkCommit = async () => {
        setGlobalLoading(true);
        try {
            await api.post('/payping/customers/addBulk', previewCustomers);
            closeAndResetBulkPipeline();
            await fetchCurrentCustomerCount();
        } catch (err: any) {
            alert("Bulk ingestion aborted: " + (err.response?.data?.message || "Network Fault"));
        } finally {
            setGlobalLoading(false);
        }
    };

    const closeAndResetBulkPipeline = () => {
        setShowBulkModal(false);
        setSelectedFile(null);
        setPreviewCustomers([]);
        setBulkStage('select');
    };

    // ==========================================
    // MODULE FLOW 2: MANUAL INTEGRITY PIPELINE
    // ==========================================

    const executeManualCommit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (manualForm.expiryDate && !isFutureDate(manualForm.expiryDate)) {
            alert("Expiry date must be in the future.");
            return;
        }
        setGlobalLoading(true);

        const payload = {
            ...manualForm,
            phone: (manualForm.phone || '').replace(/\D/g, '').slice(-10),
            additionalDetails: compileDetailsToPayload(additionalDetailsList)
        };

        try {
            await api.post('/payping/customers/add', payload);
            setShowManualModal(false);
            setManualForm({ name: '', phone: '', amount: 0, expiryDate: '' });
            setAdditionalDetailsList([]);
            sessionStorage.removeItem('payping_manual_customer_form');
            sessionStorage.removeItem('payping_additional_details_list');
            await fetchCurrentCustomerCount();

            // // Step A: Security Guard Interceptor Pre-Validation Check
            // const validationRes = await api.post('/payping/customers/canAdd', payload);
            // const validationMsg = validationRes.data;

            // if (validationMsg === "success" || validationMsg.status === "success") {
            //     // Step B: Structural safe insert transaction
            //     await api.post('/payping/customers/add', payload);
            //     setShowManualModal(false);
            //     setManualForm({ name: '', phone: '', amount: 0, expiryDate: '' });
            //     setAdditionalDetailsList([]);
            //     await fetchCurrentCustomerCount();
            // } else {
            //     alert(`Pre-validation rejected entry: ${validationMsg.message || validationMsg}`);
            // }
        } catch (err: any) {
            alert(err.response?.data?.message || "Execution exception error occurred.");
        } finally {
            setGlobalLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-subtle text-text-heading p-6 flex flex-col items-center justify-center animate-in fade-in duration-300 relative overflow-hidden">

            {/* Structural UI Container Card */}
            <div className="max-w-xl w-full bg-bg-card p-8 md:p-10 rounded-[2.5rem] border border-border shadow-2xl text-center z-10 space-y-8">

                {/* Branding Core Context Header */}
                <div className="space-y-3">
                    <div className="inline-flex p-3.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-500 mx-auto">
                        <Users className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-extrabold uppercase tracking-wider text-text-heading">Populate Directory</h2>
                    <p className="text-sm text-text-muted max-w-sm mx-auto">
                        Begin populating accounts to initiate tracking. Current ledger density:
                    </p>

                    {/* Realtime Aggregation Dynamic Tag Counter */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-bg-subtle border border-border rounded-full mt-1">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                        <span className="text-xs font-mono tracking-wider text-text-muted">
                            SYSTEM TOTAL: <span className="text-text-heading font-bold">{totalCount}</span> CONSUMERS
                        </span>
                    </div>
                </div>

                {/* Tactical Operation Options Grid Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Action Card Selector A: Bulk CSV Upload */}
                    <button
                        onClick={() => setShowBulkModal(true)}
                        className="flex flex-col items-center justify-center p-6 bg-bg-card hover:bg-bg-hover active:scale-[0.98] border border-border hover:border-accent/50 rounded-3xl transition-all duration-300 group space-y-3 text-center cursor-pointer outline-none"
                    >
                        <div className="p-3 bg-accent/5 group-hover:bg-accent/10 rounded-xl text-accent transition-colors">
                            <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-left w-full text-center">
                            <h4 className="font-bold text-sm text-text-primary">Bulk Directory Ingest</h4>
                            <p className="text-[11px] text-text-muted mt-0.5">Parse structured spreadsheet matrices instantly.</p>
                        </div>
                    </button>

                    {/* Action Card Selector B: Manual Ingestion Form */}
                    <button
                        onClick={() => setShowManualModal(true)}
                        className="flex flex-col items-center justify-center p-6 bg-bg-card hover:bg-bg-hover active:scale-[0.98] border border-border hover:border-accent/50 rounded-3xl transition-all duration-300 group space-y-3 text-center cursor-pointer outline-none"
                    >
                        <div className="p-3 bg-accent/5 group-hover:bg-accent/10 rounded-xl text-accent transition-colors">
                            <UserPlus className="w-6 h-6" />
                        </div>
                        <div className="text-left w-full text-center">
                            <h4 className="font-bold text-sm text-text-primary">Manual Direct Entry</h4>
                            <p className="text-[11px] text-text-muted mt-0.5">Input independent specific clients variables.</p>
                        </div>
                    </button>
                </div>

                {/* Navigation Terminal Workspace Dashboard Exit Action Button */}
                {isEmbedded && (
                    <div className="border-t border-zinc-800/60 pt-6 space-y-3">
                        <button
                            type="button"
                            onClick={onGoBack}
                            className="w-full bg-bg-card hover:bg-bg-hover border border-border text-text-primary font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all"
                        >
                            <ChevronLeft className="w-4 h-4 text-text-muted" /> Go Back
                        </button>
                    </div>
                )}
            </div>

            {/* ======================================================== */}
            {/* POPUP OVERLAY WINDOW 1: ADVANCED BULK INGESTION CONTROL  */}
            {/* ======================================================== */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-overlay backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-bg-card border border-border w-full max-w-2xl rounded-3xl max-h-[85vh] flex flex-col shadow-2xl scale-in-center animate-in zoom-in-95 duration-200">

                        {/* Internal Header Modal Bar */}
                        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between text-text-heading">
                            <div className="flex items-center gap-3">
                                <Upload className="text-indigo-500 w-5 h-5" />
                                <h3 className="text-lg font-bold uppercase tracking-wider text-slate-950 dark:text-white">Batch Spreadsheet Processor</h3>
                            </div>
                            <button onClick={closeAndResetBulkPipeline} className="p-1.5 hover:bg-bg-hover rounded-lg text-text-muted transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Asynchronous Window Stage Controller Block Layouts */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {bulkStage === 'select' ? (
                                <div className="space-y-6">
                                    {/* Action Sub-Block: Download Matrix Blueprint */}
                                    <div className="bg-bg-subtle border border-border rounded-2xl p-4 flex items-center justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <FileText className="text-indigo-400 w-8 h-8 shrink-0 mt-0.5" />
                                            <div>
                                                <h5 className="font-bold text-sm text-text-heading">System Scheme File Blueprint</h5>
                                                <p className="text-xs text-text-muted mt-0.5">Download the formatting layout matrix config before parsing system operations.</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={downloadCsvTemplate}
                                            className="px-4 py-2 bg-bg-card hover:bg-bg-hover text-text-primary text-xs font-bold rounded-xl border border-border flex items-center gap-2 transition-all duration-200 active:scale-95 shrink-0 cursor-pointer"
                                        >
                                            <Download className="w-3.5 h-3.5" /> Blueprint
                                        </button>
                                    </div>

                                    {/* Drop Area / Interactive Selection Block Target Window */}
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-border hover:border-accent bg-bg-subtle/30 hover:bg-bg-hover/40 p-8 rounded-2xl text-center cursor-pointer transition-all duration-300 group space-y-3 active:scale-[0.99]"
                                    >
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept=".csv"
                                            className="hidden"
                                        />
                                        <div className="p-3 bg-bg-subtle rounded-full inline-block text-text-muted group-hover:text-indigo-500 transition-colors">
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">
                                                {selectedFile ? selectedFile.name : "Select Operational CSV Matrix File"}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">Accepts system parsed raw plain text standard schemas up to 10MB</p>
                                        </div>
                                    </div>

                                    {selectedFile && (
                                        <button
                                            type="button"
                                            disabled={globalLoading}
                                            onClick={triggerFileCheck}
                                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-indigo-600/10"
                                        >
                                            {globalLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Verify Directory Integrity Alignment"}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                /* Sub-Stage View Layout Matrix: Data Array Schema Verification Mapping Screen Preview */
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-amber-500 bg-amber-500/5 border border-amber-500/10 px-4 py-3 rounded-xl text-xs">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <p>Review the identified records parsed from your ledger matrix template below before committing mutations.</p>
                                    </div>

                                    <div className="border border-border rounded-xl overflow-hidden bg-bg-card">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-bg-subtle border-b border-border text-text-muted font-bold">
                                                    <th className="p-3.5">TARGET NAME</th>
                                                    <th className="p-3.5">PHONE CONNECTION</th>
                                                    <th className="p-3.5">VALUATION PRICE</th>
                                                    <th className="p-3.5">CHRONO EXPIRY</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-text-primary">
                                                {previewCustomers.map((c, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/40 transition-colors">
                                                        <td className="p-3.5 font-sans font-medium text-text-heading">{c.name}</td>
                                                        <td className="p-3.5 text-text-muted">{c.phone}</td>
                                                        <td className="p-3.5 text-indigo-600 dark:text-indigo-400 font-semibold">₹{c.amount}</td>
                                                        <td className="p-3.5 text-text-muted dark:text-zinc-500 font-sans">{formatDateToReadable(c.expiryDate)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            onClick={() => setBulkStage('select')}
                                            className="w-1/3 border border-slate-200 hover:bg-slate-50 dark:border-zinc-750 dark:hover:bg-zinc-800 text-text-primary font-bold py-3.5 rounded-xl transition-colors text-sm"
                                        >
                                            Re-select Matrix
                                        </button>
                                        <button
                                            onClick={executeBulkCommit}
                                            disabled={globalLoading}
                                            className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-lg shadow-emerald-600/10"
                                        >
                                            {globalLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Commit Batch Mutations</>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* POPUP OVERLAY WINDOW 2: CUSTOM DIRECT MANUAL ENTRY FORM  */}
            {/* ======================================================== */}
            {showManualModal && (
                <div className="fixed inset-0 bg-overlay backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <form
                        onSubmit={executeManualCommit}
                        className="bg-bg-elevated border border-border/60 w-full max-w-md rounded-3xl shadow-2xl scale-in-center animate-in zoom-in-95 duration-200 overflow-hidden"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between text-text-heading">
                            <div className="flex items-center gap-3">
                                <UserPlus className="text-emerald-500 w-5 h-5" />
                                <h3 className="text-lg font-bold uppercase tracking-wider text-slate-950 dark:text-white">Direct Ingestion Console</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowManualModal(false)}
                                className="p-1.5 hover:bg-bg-hover rounded-lg text-text-muted transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Scrollable Form Body Container Inputs */}
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                            {/* Input Variable Block: Name */}
                            <div>
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 ml-1">Client Full Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Jane Doe"
                                    value={manualForm.name}
                                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                                    className="w-full bg-bg-subtle border border-border p-3 rounded-xl focus:border-accent outline-none transition-colors placeholder:text-text-muted text-text-heading text-sm font-semibold"
                                />
                            </div>

                            {/* Input Variable Block: Phone */}
                            <div>
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 ml-1">WhatsApp Matrix Vector Phone</label>
                                <input
                                    type="tel"
                                    required
                                    maxLength={10}
                                    placeholder="9876543210"
                                    value={manualForm.phone}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                        setManualForm({ ...manualForm, phone: val });
                                    }}
                                    className="w-full bg-bg-subtle border border-border p-3 rounded-xl focus:border-accent outline-none transition-colors placeholder:text-text-muted text-text-heading text-sm font-mono font-semibold"
                                />
                            </div>

                            {/* Input Variable Block: Target Flat Fee Price Valuation */}
                            <div>
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 ml-1">Subscription Valuation Rate (₹)</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="2000"
                                    value={manualForm.amount || ''}
                                    onChange={(e) => setManualForm({ ...manualForm, amount: Number(e.target.value) })}
                                    className="w-full bg-bg-subtle border border-border p-3 rounded-xl focus:border-accent outline-none transition-colors placeholder:text-text-muted text-text-heading text-sm font-mono font-semibold"
                                />
                            </div>

                            {/* Input Variable Block: Target Chronological Exp Date Deadline */}
                            <div>
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 ml-1">Chronological Expiry Milestone</label>
                                <input
                                    type="date"
                                    required
                                    value={manualForm.expiryDate}
                                    onChange={(e) => setManualForm({ ...manualForm, expiryDate: e.target.value })}
                                    className="w-full bg-bg-subtle border border-border p-3 rounded-xl focus:border-accent outline-none transition-colors text-text-primary text-sm font-mono font-semibold"
                                />
                                {manualForm.expiryDate && !isFutureDate(manualForm.expiryDate) && (
                                    <p className="text-[10px] text-rose-500 dark:text-rose-400 font-bold ml-1 mt-1">Expiry date must be in the future.</p>
                                )}
                            </div>

                            {/* Additional Parameters Block */}
                            <div className="space-y-3 border-t border-slate-100 dark:border-zinc-800/60 pt-4">
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 ml-1">Additional Parameters</label>

                                {additionalDetailsList.length > 0 ? (
                                    <div className={`space-y-2 ${additionalDetailsList.length > 4 ? 'max-h-[220px] overflow-y-auto pr-1' : ''}`}>
                                        {additionalDetailsList.map(({ key, value }, index) => (
                                            <div
                                                key={`${key}-${value}-${index}`}
                                                className="flex items-center justify-between p-3.5 bg-bg-subtle rounded-xl shadow-sm border border-slate-200/60 dark:border-zinc-900/40 text-xs hover:bg-slate-100/50 dark:hover:bg-zinc-900/20 transition-all duration-150"
                                            >
                                                <span className="text-text-muted font-semibold uppercase text-[10px] tracking-wider truncate pr-2 max-w-[150px]">{key}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-text-primary font-bold font-mono text-xs truncate max-w-[150px]">{value}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAdditionalDetailsList(prev => prev.filter((_, i) => i !== index))}
                                                        className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 p-1 rounded transition-colors border-0 outline-none bg-transparent cursor-pointer shrink-0"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 bg-bg-subtle/40 rounded-xl text-slate-500 text-xs italic border border-slate-150 dark:border-zinc-800/30">
                                        No additional parameters added.
                                    </div>
                                )}

                                {/* Add Detail Form or Button */}
                                {!showDetailForm ? (
                                    <button
                                        type="button"
                                        onClick={() => { fetchApiDetailsData(); setShowDetailForm(true); }}
                                        className="w-full bg-slate-100 hover:bg-bg-subtle dark:hover:bg-zinc-900 border border-border text-text-primary hover:text-text-heading font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                                    >
                                        + Add Additional Detail
                                    </button>
                                ) : (
                                    <div className="p-4 bg-bg-subtle rounded-xl space-y-3 relative border border-border animate-in slide-in-from-bottom-2 duration-150">
                                        <span className="text-[9px] font-bold text-text-muted block uppercase tracking-wider mb-1">New Parameter Field</span>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            {/* Key */}
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Detail Name"
                                                    value={newDetailKey}
                                                    onFocus={() => setDetailsDropdownField('key')}
                                                    onBlur={() => setTimeout(() => setDetailsDropdownField(null), 200)}
                                                    onChange={(e) => setNewDetailKey(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSaveNewDetailInline();
                                                        }
                                                    }}
                                                    className="w-full bg-bg-subtle border border-border p-2.5 rounded-xl text-xs text-text-primary outline-none focus:border-emerald-500 transition-colors"
                                                />
                                                {detailsDropdownField === 'key' && apiDetailsData && (
                                                    <div className="absolute left-0 right-0 mt-1 bg-bg-card border border-border rounded-xl p-1 shadow-2xl z-50 max-h-32 overflow-y-auto">
                                                        {Object.keys(apiDetailsData)
                                                            .filter(k => k.toLowerCase().includes((newDetailKey || '').toLowerCase()))
                                                            .map(k => (
                                                                <button
                                                                    key={k}
                                                                    type="button"
                                                                    onMouseDown={() => {
                                                                        setNewDetailKey(k);
                                                                        if (apiDetailsData[k]) setNewDetailVal(String(apiDetailsData[k]));
                                                                    }}
                                                                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-bg-hover rounded text-text-primary font-medium"
                                                                >
                                                                    {k}
                                                                </button>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Value */}
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Value"
                                                    value={newDetailVal}
                                                    onFocus={() => { fetchApiDetailsData(); setDetailsDropdownField('value'); }}
                                                    onBlur={() => setTimeout(() => setDetailsDropdownField(null), 200)}
                                                    onChange={(e) => setNewDetailVal(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSaveNewDetailInline();
                                                        }
                                                    }}
                                                    className="w-full bg-bg-subtle border border-border p-2.5 rounded-xl text-xs text-slate-800 dark:text-zinc-355 outline-none focus:border-emerald-500 transition-colors"
                                                />
                                                {detailsDropdownField === 'value' && apiDetailsData && newDetailKey && apiDetailsData[newDetailKey] && (
                                                    <div className="absolute left-0 right-0 mt-1 bg-bg-card border border-border rounded-xl p-1 shadow-2xl z-50 max-h-32 overflow-y-auto">
                                                        <button
                                                            key="suggested"
                                                            type="button"
                                                            onMouseDown={() => setNewDetailVal(String(apiDetailsData[newDetailKey]))}
                                                            className="w-full text-left px-2 py-1.5 text-xs hover:bg-bg-hover rounded text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between"
                                                        >
                                                            <span>{String(apiDetailsData[newDetailKey])}</span>
                                                            <span className="text-[8px] uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 px-1 py-0.5 rounded font-bold">Suggested</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowDetailForm(false)}
                                                className="w-1/3 bg-bg-subtle hover:bg-bg-hover text-text-muted py-2 rounded-xl text-xs font-bold transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveNewDetailInline}
                                                className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold transition-colors"
                                            >
                                                Save Parameter
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-border bg-bg-subtle/40">
                            <button
                                type="submit"
                                disabled={globalLoading || (manualForm.expiryDate ? !isFutureDate(manualForm.expiryDate) : false)}
                                className={`w-full font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 text-sm shadow-md cursor-pointer ${
                                    (manualForm.expiryDate && !isFutureDate(manualForm.expiryDate))
                                        ? 'bg-border text-text-muted cursor-not-allowed shadow-none'
                                        : 'bg-accent hover:opacity-90 active:scale-[0.98] text-white shadow-accent/15'
                                    }`}
                            >
                                {globalLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Verify & Commit Entry"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};



const Customers = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // 1. Data States
    const [customers, setCustomers] = useState<CustomerDTO[]>([]);
    const [filters, setFilters] = useState<CustomerFilterDTO>({ mainFilters: {}, customFilters: {} });
    const [loading, setLoading] = useState<boolean>(true);
    const [totalPages, setTotalPages] = useState<number>(1);

    // 2. Query Payload (ONLY things that should trigger an API call)
    const [queryPayload, setQueryPayload] = useState({
        status: 'ACTIVE',
        search: '',
        sort: 'name_asc',
        filters: {} as Record<string, string[]>,
        page: 0,
        size: 30
    });

    useEffect(() => {
        const state = location.state as { filter?: string; preSelectedTemplate?: TemplateDTO } | null;
        if (state?.filter) {
            setQueryPayload(prev => ({
                ...prev,
                filters: { paymentStatus: [state.filter!] }
            }));
            window.history.replaceState({ ...state, filter: undefined }, document.title);
        }
        if (state?.preSelectedTemplate) {
            setPreSelectedTemplate(state.preSelectedTemplate);
            setIsSelectionModeActive(true);
        }
    }, [location.state]);

    // 3. Selection States (Decoupled from API calls)
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
    const [isSelectionModeActive, setIsSelectionModeActive] = useState<boolean>(false);
    const [isGlobalSelectAllActive, setIsGlobalSelectAllActive] = useState<boolean>(false);

    // 4. UI Toggles
    const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(false);
    const [showStatusDropdown, setShowStatusDropdown] = useState<boolean>(false);
    const [showSortDropdown, setShowSortDropdown] = useState<boolean>(false);
    const [showFilterModal, setShowFilterModal] = useState<boolean>(false);

    // 5. Context / Edit States
    const [selectedCustomerContext, setSelectedCustomerContext] = useState<CustomerDTO | null>(null);
    const [isEditMode, setIsEditMode] = useState<boolean>(false);
    const [editFormDraft, setEditFormDraft] = useState<CustomerDTO | null>(null);
    const [selectedFilterDraft, setSelectedFilterDraft] = useState<Record<string, string[]>>({});

    // 7. WhatsApp Send Flow States
    const [preSelectedTemplate, setPreSelectedTemplate] = useState<TemplateDTO | null>(null);
    const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);
    const [alertName, setAlertName] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);

    // 8. AddCustomers Overlay States
    const [showAddCustomers, setShowAddCustomers] = useState<boolean>(false);
    const [isAddCustomersClosing, setIsAddCustomersClosing] = useState<boolean>(false);

    useEffect(() => {
        if (location.state?.action === 'add') {
            setShowAddCustomers(true);
            // Clean up state so a simple page refresh doesn't repeatedly trigger it
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Detailed customer view toggles & additional details states
    const [showPaidExpiryWarning, setShowPaidExpiryWarning] = useState<boolean>(false);
    const [originalPaymentStatus, setOriginalPaymentStatus] = useState<'PAID' | 'UNPAID' | 'OVERDUE' | null>(null);
    const [showDeactivationConfirm, setShowDeactivationConfirm] = useState<boolean>(false);

    // Add additional details inside detailed view
    const [showDetailForm, setShowDetailForm] = useState<boolean>(false);
    const [newDetailKey, setNewDetailKey] = useState<string>('');
    const [newDetailVal, setNewDetailVal] = useState<string>('');
    const [apiDetailsData, setApiDetailsData] = useState<Record<string, string> | null>(null);
    const [loadingApiDetails, setLoadingApiDetails] = useState<boolean>(false);

    // Payment processing states
    const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
    const [paymentModalMode, setPaymentModalMode] = useState<'create' | 'view'>('create');
    const [paymentModes, setPaymentModes] = useState<string[]>([]);
    const [paymentForm, setPaymentForm] = useState({
        amount: 0,
        expiryDate: '',
        paymentMode: 'UPI',
        comments: ''
    });
    const [selectedPaymentRecord, setSelectedPaymentRecord] = useState<PaymentDTO | null>(null);
    const [globalLoading, setGlobalLoading] = useState<boolean>(false);

    // Fetch payment modes once on mount
    useEffect(() => {
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
    }, []);

    // Utility helpers for payments
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

    const formatPaymentTimestamp = (timestampStr: string) => {
        if (!timestampStr) return '';
        const date = new Date(timestampStr);
        if (isNaN(date.getTime())) return '';

        const day = date.getDate();
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;

        return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
    };
    const [detailsDropdownField, setDetailsDropdownField] = useState<'key' | 'value' | null>(null);

    // 6. Refs
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch filter categories once on mount to avoid infinite render loop
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const res = await api.get('/payping/customers/getfilters');
                const fetchedFilters = res.data || { mainFilters: {}, customFilters: {} };
                setFilters(fetchedFilters);

                const getExactKey = (target: string) => {
                    const norm = target.toLowerCase().replace(/\s+/g, '');
                    for (const k of Object.keys(fetchedFilters.mainFilters || {})) {
                        if (k.toLowerCase().replace(/\s+/g, '') === norm) return k;
                    }
                    for (const k of Object.keys(fetchedFilters.customFilters || {})) {
                        if (k.toLowerCase().replace(/\s+/g, '') === norm) return k;
                    }
                    return target;
                };

                setQueryPayload(prev => {
                    const migratedFilters: Record<string, string[]> = {};
                    let changed = false;
                    Object.entries(prev.filters || {}).forEach(([k, v]) => {
                        const exactKey = getExactKey(k);
                        migratedFilters[exactKey] = v;
                        if (exactKey !== k) changed = true;
                    });
                    if (changed) {
                        setSelectedFilterDraft(migratedFilters);
                        return { ...prev, filters: migratedFilters };
                    }
                    return prev;
                });
            } catch (err) {
                console.error("Failed to load filter metadata:", err);
            }
        };
        fetchFilters();
    }, []);

    // ==========================================
    // CORE API EXECUTION (No Selection Dependencies)
    // ==========================================
    const executeLedgerQuery = useCallback(async (payload: typeof queryPayload) => {
        try {
            setLoading(true);

            // Format payload filters to send empty object {} if no actual filters are active, and drop empty arrays
            const processedPayload = { ...payload };
            const newFilters: Record<string, string[]> = {};
            Object.entries(processedPayload.filters || {}).forEach(([key, arr]) => {
                if (Array.isArray(arr)) {
                    const cleanArr = arr.filter(v => typeof v === 'string' && v.trim() !== '');
                    if (cleanArr.length > 0) {
                        newFilters[key] = cleanArr;
                    }
                }
            });
            processedPayload.filters = newFilters;

            const res = await api.post('/payping/customers/get', processedPayload);
            const dataContent = res.data || res.data.content || [];

            setCustomers(dataContent);
            setTotalPages(res.data.totalPages || 1);
        } catch (err) {
            console.error("Failed to fetch customers:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // ONLY fires when search, sort, filter, or page changes.
    useEffect(() => {
        executeLedgerQuery(queryPayload);
    }, [queryPayload, executeLedgerQuery]);

    // Keeps checkboxes alive across pagination WITHOUT triggering APIs
    useEffect(() => {
        if (isGlobalSelectAllActive && customers.length > 0) {
            setSelectedCustomerIds(prev => {
                const updated = new Set(prev);
                customers.forEach(c => updated.add(c.id));
                return updated;
            });
        }
    }, [customers, isGlobalSelectAllActive]);

    // ==========================================
    // ACTION HANDLERS
    // ==========================================
    const handleCloseAddCustomers = () => {
        setIsAddCustomersClosing(true);
        setTimeout(() => {
            setShowAddCustomers(false);
            setIsAddCustomersClosing(false);
            // Re-fetch customer list to reflect any new additions
            executeLedgerQuery(queryPayload);
        }, 300);
    };

    const handleSearchTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setQueryPayload(prev => ({ ...prev, search: value, page: 0 }));
        }, 500);
    };

    const handleCancelSearch = () => {
        setIsSearchExpanded(false);
        // Only trigger API if we are actually clearing an active search
        if (queryPayload.search) {
            setQueryPayload(prev => ({ ...prev, search: '', page: 0 }));
        }
    };

    const handleMessageClick = (overrideIds?: Set<string>) => {
        const targetIds = overrideIds || selectedCustomerIds;
        if (targetIds.size === 0) return;

        if (preSelectedTemplate) {
            setSelectedCustomerIds(targetIds);
            setShowConfirmationModal(true);
        } else {
            navigate('/payping/message-templates', {
                state: { preSelectedCustomerIds: Array.from(targetIds) }
            });
        }
    };

    const toggleGlobalSelectAll = () => {
        if (isGlobalSelectAllActive) {
            setSelectedCustomerIds(new Set());
            setIsGlobalSelectAllActive(false);
            setIsSelectionModeActive(false);
        } else {
            const allIds = customers.map(c => c.id);
            setSelectedCustomerIds(new Set(allIds));
            setIsGlobalSelectAllActive(true);
            setIsSelectionModeActive(true);
        }
    };

    const handleRowCheckboxToggle = (id: string) => {
        setSelectedCustomerIds(prev => {
            const updated = new Set(prev);
            if (updated.has(id)) {
                updated.delete(id);
                if (updated.size === 0) setIsSelectionModeActive(false);
            } else {
                updated.add(id);
            }
            return updated;
        });
    };

    const handleTouchStart = (id: string) => {
        longPressTimerRef.current = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(50);
            setIsSelectionModeActive(true);
            handleRowCheckboxToggle(id);
        }, 800);
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };

    const fetchApiDetailsData = async () => {
        if (apiDetailsData !== null || loadingApiDetails) return;
        try {
            setLoadingApiDetails(true);
            const res = await api.get('/payping/accounts/getall-Additional-details');
            setApiDetailsData(res.data || {});
        } catch (err) {
            console.error("Failed to load details reference data:", err);
            setApiDetailsData({});
        } finally {
            setLoadingApiDetails(false);
        }
    };

    const handleCustomerStatusToggle = () => {
        if (!selectedCustomerContext) return;
        if (selectedCustomerContext.status === 'ACTIVE') {
            setShowDeactivationConfirm(true);
        } else {
            commitCustomerStatusChange('ACTIVE');
        }
    };

    const commitCustomerStatusChange = async (newStatus: 'ACTIVE' | 'INACTIVE') => {
        if (!selectedCustomerContext) return;
        try {
            setLoading(true);
            const updated = {
                ...selectedCustomerContext,
                status: newStatus
            };
            const res = await api.put(`/payping/customers/${selectedCustomerContext.id}`, updated, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            setSelectedCustomerContext(res.data);
            executeLedgerQuery(queryPayload);
        } catch (err) {
            console.error("Failed to toggle status:", err);
            setLoading(false);
        }
    };

    const handlePaymentStatusChange = async (newPaymentStatus: string) => {
        if (!selectedCustomerContext) return;

        try {
            setLoading(true);
            const updated = {
                ...selectedCustomerContext,
                paymentStatus: newPaymentStatus
            };
            const res = await api.put(`/payping/customers/${selectedCustomerContext.id}`, updated, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            setSelectedCustomerContext(res.data);
            setEditFormDraft(res.data);
            executeLedgerQuery(queryPayload);
        } catch (err) {
            console.error("Failed to change payment status:", err);
            setLoading(false);
        }
    };

    const triggerPaymentModalForCustomer = (customer: CustomerDTO) => {
        const defaultNextExpiry = getNextMonthSameDate(customer.expiryDate || new Date().toISOString().split('T')[0]);
        setPaymentForm({
            amount: customer.amount || 0,
            expiryDate: defaultNextExpiry,
            paymentMode: 'UPI',
            comments: ''
        });
        setPaymentModalMode('create');
        setShowPaymentModal(true);
    };

    const submitPaymentDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        const customer = editFormDraft || selectedCustomerContext;
        if (!customer) return;

        if (!isFutureDate(paymentForm.expiryDate)) {
            alert("Expiry date must be in the future.");
            return;
        }

        setGlobalLoading(true);
        setLoading(true);
        try {
            // 1. Update customer paymentStatus to 'PAID' and set new expiryDate
            const updatedCustomer = {
                ...customer,
                paymentStatus: 'PAID' as const,
                expiryDate: paymentForm.expiryDate
            };
            await api.put(`/payping/customers/${customer.id}`, updatedCustomer, {
                headers: { 'X-Trigger-Success': 'true' }
            });

            // 2. Post payment history record to backend
            const paymentPayload = {
                amount: Number(paymentForm.amount),
                paymentMode: paymentForm.paymentMode,
                comments: paymentForm.comments || '',
                customerId: customer.id
            };
            await api.post('/payping/customers/payments', paymentPayload);

            // 3. Clear modal states and set detailed view updated context
            setShowPaymentModal(false);
            setIsEditMode(false); // Close edit view modal as well

            // Refresh main ledger lists
            await executeLedgerQuery(queryPayload);

            // Refresh detailed customer view data to show new payments list
            const refreshedCustomerRes = await api.get(`/payping/customers/get/${customer.id}`);
            setSelectedCustomerContext(refreshedCustomerRes.data);
            setEditFormDraft(refreshedCustomerRes.data);
        } catch (err: any) {
            console.error("Failed to complete payment transaction:", err);
            alert(err.response?.data?.message || "Failed to process payment details.");
            setLoading(false);
        } finally {
            setGlobalLoading(false);
        }
    };

    const handlePaymentRecordClick = (payment: PaymentDTO) => {
        setSelectedPaymentRecord(payment);
        setPaymentForm({
            amount: payment.amount,
            expiryDate: '', // Not used in view mode
            paymentMode: payment.paymentMode,
            comments: payment.comments || ''
        });
        setPaymentModalMode('view');
        setShowPaymentModal(true);
    };

    const handleNotificationStatusToggle = async () => {
        if (!selectedCustomerContext) return;
        const newNotifStatus = selectedCustomerContext.notificationStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
            setLoading(true);
            const updated = {
                ...selectedCustomerContext,
                notificationStatus: newNotifStatus
            };
            const res = await api.put(`/payping/customers/${selectedCustomerContext.id}`, updated, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            setSelectedCustomerContext(res.data);
            executeLedgerQuery(queryPayload);
        } catch (err) {
            console.error("Failed to toggle notification status:", err);
            setLoading(false);
        }
    };

    const handleSaveNewDetailInline = async () => {
        const kStr = String(newDetailKey || '').trim();
        const vStr = String(newDetailVal || '').trim();
        if (!kStr || !vStr) return;

        if (isEditMode) {
            const currentList = parseDetailsFromPayload(editFormDraft?.additionalDetails);
            const nextList = [...currentList, { key: kStr, value: vStr }];
            const updatedDetails = compileDetailsToPayload(nextList);
            setEditFormDraft(prev => prev ? { ...prev, additionalDetails: updatedDetails } : null);
            setShowDetailForm(false);
            setNewDetailKey('');
            setNewDetailVal('');
        } else if (selectedCustomerContext) {
            try {
                const currentList = parseDetailsFromPayload(selectedCustomerContext?.additionalDetails);
                const nextList = [...currentList, { key: kStr, value: vStr }];
                const updatedDetails = compileDetailsToPayload(nextList);
                const updated = {
                    ...selectedCustomerContext,
                    additionalDetails: updatedDetails
                };
                const res = await api.put(`/payping/customers/${selectedCustomerContext.id}`, updated, {
                    headers: { 'X-Trigger-Success': 'true' }
                });
                setSelectedCustomerContext(res.data);
                setShowDetailForm(false);
                setNewDetailKey('');
                setNewDetailVal('');
            } catch (err) {
                console.error("Failed to add new detail inline:", err);
            }
        }
    };

    const openCustomerDetails = async (id: string) => {
        if (isSelectionModeActive) return;
        try {
            const res = await api.get(`/payping/customers/get/${id}`);
            setSelectedCustomerContext(res.data);
            setEditFormDraft(res.data);
            setIsEditMode(false);
            setOriginalPaymentStatus(res.data.paymentStatus);
            setShowPaidExpiryWarning(false);
        } catch (err) {
            console.error("Context fetch exception:", err);
        }
    };

    const commitDirectManualUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editFormDraft) return;
        if (editFormDraft.expiryDate && !isFutureDate(editFormDraft.expiryDate)) {
            alert("Expiry date must be in the future.");
            return;
        }
        try {
            setLoading(true);
            const payload = {
                ...editFormDraft,
                phone: (editFormDraft.phone || '').replace(/\D/g, '').slice(-10)
            };
            await api.put(`/payping/customers/${editFormDraft.id}`, payload, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            setSelectedCustomerContext(payload);
            setIsEditMode(false);
            executeLedgerQuery(queryPayload);
        } catch (err) {
            console.error("Update failed:", err);
            setLoading(false);
        }
    };

    const activeFiltersCount = Object.values(queryPayload.filters || {}).reduce(
        (acc, val) => acc + (Array.isArray(val) ? val.length : 0),
        0
    );

    return (
        <div className="min-h-screen bg-transparent text-text-primary flex flex-col font-sans select-none overflow-x-hidden pb-28 relative">

            {/* ======================================================= */}
            {/* HEADER (ZONES 1 & 2): RIGID LAYOUT, NO BORDERS/OUTLINES */}
            {/* ======================================================= */}
            <header className="sticky top-0 z-30 bg-bg-main/85 backdrop-blur-md px-4 md:px-8 pt-4 pb-3 max-w-none mx-auto w-full border-b border-border/20">

                {/* ZONE 1: CORE HEADER (Never shifts or hides) */}
                <div className={`flex items-center justify-between ${(!selectedCustomerContext || isEditMode) ? 'pb-5' : ''}`}>
                    <div className="flex items-center gap-3">
                        {selectedCustomerContext && !isEditMode && (
                            <button onClick={() => setSelectedCustomerContext(null)} className="p-2 bg-bg-subtle hover:bg-bg-hover active:scale-90 rounded-lg border border-border/60 transition-all cursor-pointer text-text-primary hover:text-text-heading shadow-sm outline-none">
                                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        )}
                        <h2 className="text-2xl font-extrabold uppercase tracking-wider flex items-center gap-2 text-text-heading">
                            <Users className="w-5 h-5 text-accent" /> Customers
                        </h2>
                    </div>
                    {(!selectedCustomerContext || isEditMode) && (
                        <button
                            onClick={() => setShowAddCustomers(true)}
                            className="p-2 bg-accent hover:opacity-90 active:scale-95 text-white rounded-xl flex items-center justify-center transition-all shadow-md shadow-accent/10 border-0 outline-none cursor-pointer"
                        >
                            <UserPlus className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* ZONE 2: CONTROL BAR / SEARCH BOX (Fixed Height prevents jumping) */}
                {(!selectedCustomerContext || isEditMode) && (
                    <div className="h-8 relative">
                        {!isSearchExpanded ? (
                            <div className="flex items-center justify-between h-full">

                                {/* Status Tab Pill Selectors */}
                                <div className="flex gap-0.5 p-0.5 bg-bg-sidebar/55 border border-border/60 rounded-lg animate-in fade-in duration-200 shrink-0">
                                    {[
                                        { value: 'ALL', label: 'All' },
                                        { value: 'ACTIVE', label: 'Active' },
                                        { value: 'INACTIVE', label: 'Inactive' }
                                    ].map((opt) => {
                                        const isActive = queryPayload.status === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                onClick={() => setQueryPayload(prev => ({ ...prev, status: opt.value, page: 0 }))}
                                                className={`px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-md text-[9px] sm:text-[10px] font-semibold tracking-wide transition-all active:scale-95 cursor-pointer border-0 outline-none ${
                                                    isActive 
                                                        ? 'bg-bg-elevated text-accent font-bold shadow-sm' 
                                                        : 'text-text-muted hover:text-text-primary'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Right Icons (No borders, pure icons) */}
                                <div className="flex items-center gap-5 text-text-muted">
                                    <div className="relative">
                                        <button onClick={() => setShowSortDropdown(true)} className="flex items-center justify-center hover:text-text-primary transition-all active:scale-90 cursor-pointer">
                                            <ArrowUpDown className="w-4 h-4" />
                                        </button>

                                        {/* Sort Dropdown (Absolutely positioned so it doesn't push Zone 3 down) */}
                                        {showSortDropdown && (
                                            <>
                                                <div onClick={() => setShowSortDropdown(false)} className="fixed inset-0 z-40" />
                                                <div className="absolute right-0 mt-3 w-48 bg-bg-card border border-border rounded-lg p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                                                    {[
                                                        { key: 'name_asc', label: 'Name (A-Z)' },
                                                        { key: 'name_desc', label: 'Name (Z-A)' },
                                                        { key: 'amount_desc', label: 'Amount (High-Low)' },
                                                        { key: 'amount_asc', label: 'Amount (Low-High)' }
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.key}
                                                            onClick={() => { setQueryPayload(prev => ({ ...prev, sort: opt.key, page: 0 })); setShowSortDropdown(false); }}
                                                            className={`w-full text-left px-3 py-2.5 rounded-md flex items-center justify-between text-xs font-semibold cursor-pointer ${queryPayload.sort === opt.key ? 'text-accent bg-accent-tint' : 'text-text-primary hover:bg-bg-hover'}`}
                                                        >
                                                            {opt.label}
                                                            {queryPayload.sort === opt.key && <Check className="w-3.5 h-3.5" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <button onClick={() => { setShowFilterModal(true); setSelectedFilterDraft(queryPayload.filters || {}); }} className="relative flex items-center justify-center hover:text-text-primary transition-all active:scale-90 cursor-pointer">
                                        <Filter className="w-4 h-4" />
                                        {activeFiltersCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-pulse" />}
                                    </button>
                                    <button onClick={() => { setIsSearchExpanded(true); setTimeout(() => searchInputRef.current?.focus(), 50); }} className="flex items-center justify-center hover:text-text-primary transition-all active:scale-90 cursor-pointer">
                                        <Search className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Search Box (Replaces Zone 2 entirely) */
                            <div className="flex items-center gap-3 h-full animate-in slide-in-from-right-3 duration-150">
                                <div className="flex-1 bg-bg-subtle/50 border border-border/60 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 transition-all rounded-lg px-3 h-full flex items-center gap-2">
                                    <Search className="w-4 h-4 text-text-muted" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Search parameters..."
                                        defaultValue={queryPayload.search}
                                        onChange={handleSearchTextChange}
                                        onKeyDown={(e) => e.key === 'Enter' && searchInputRef.current?.blur()}
                                        className="bg-transparent text-sm text-text-heading outline-none w-full placeholder:text-text-muted"
                                    />
                                    {searchInputRef.current?.value && (
                                        <button onClick={() => { if (searchInputRef.current) searchInputRef.current.value = ''; setQueryPayload(prev => ({ ...prev, search: '', page: 0 })); }} className="cursor-pointer">
                                            <X className="w-4 h-4 text-text-muted" />
                                        </button>
                                    )}
                                </div>
                                <button onClick={handleCancelSearch} className="text-xs font-bold text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </header>

            {/* ======================================================= */}
            {/* MAIN CONTENT AREA */}
            {/* ======================================================= */}
            <main className="flex-1 px-4 md:px-8 max-w-none mx-auto w-full space-y-4 pt-2.5 animate-in fade-in duration-300">
                {selectedCustomerContext && !isEditMode ? (
                    <div className="animate-in slide-in-from-right-4 fade-in duration-300 ease-out pb-20 w-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        {/* Top Section: Profile Hero Banner */}
                        <div className="lg:col-span-12 w-full animate-in slide-in-from-right-4 fade-in duration-300">
                            <div className="bg-bg-card border border-border/60 rounded-2xl p-3.5 shadow-sm relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-accent/15 transition-all duration-300">
                                <div className="flex items-center gap-3.5 relative z-10 w-full sm:w-auto text-left">
                                    {/* Initials Avatar - simplified & clean */}
                                    <div className="w-11 h-11 rounded-xl bg-accent-tint/30 text-accent font-black text-sm flex items-center justify-center uppercase shrink-0 border border-accent/15">
                                        {selectedCustomerContext.name.substring(0, 2).toUpperCase()}
                                    </div>

                                    <div className="min-w-0 space-y-0.5">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <h3 className="font-sans text-base font-bold text-text-heading tracking-tight truncate">
                                                {selectedCustomerContext.name}
                                            </h3>
                                            <span className={`text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                                                selectedCustomerContext.status === 'ACTIVE' 
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                                    : 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20'
                                            }`}>
                                                {selectedCustomerContext.status}
                                            </span>
                                            {/* Payment status badge inside header */}
                                            <span className={`text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                                                selectedCustomerContext.paymentStatus === 'PAID'
                                                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                    : selectedCustomerContext.paymentStatus === 'OVERDUE'
                                                    ? 'text-rose-600 dark:text-rose-455 bg-rose-500/10 border-rose-500/20'
                                                    : 'text-amber-600 dark:text-amber-500 bg-amber-500/10 border-amber-500/20'
                                            }`}>
                                                {selectedCustomerContext.paymentStatus}
                                            </span>
                                        </div>
                                        <p className="text-xs text-text-muted font-medium flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5 text-text-muted" />
                                            {selectedCustomerContext.phone}
                                        </p>
                                    </div>
                                </div>

                                {/* Quick Action Controls Panel - tight padding */}
                                <div className="flex flex-wrap items-center gap-2 relative z-10 w-full sm:w-auto justify-start sm:justify-end border-t border-border/30 pt-2.5 sm:pt-0 sm:border-t-0">
                                    <button 
                                        onClick={() => { const targetId = selectedCustomerContext.id; setSelectedCustomerContext(null); handleMessageClick(new Set([targetId])); }} 
                                        className="flex-1 sm:flex-initial px-3 py-1.5 bg-[#128C7E] hover:bg-[#0e7065] text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all duration-200 active:scale-95 cursor-pointer border-0 outline-none"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5 fill-white text-[#128C7E]" /> Message
                                    </button>

                                    <button 
                                        onClick={() => { setIsEditMode(true); setEditFormDraft(selectedCustomerContext); }} 
                                        className="flex-1 sm:flex-initial px-3 py-1.5 bg-bg-subtle hover:bg-bg-hover text-text-heading font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-border transition-all duration-200 active:scale-95 cursor-pointer outline-none"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </button>

                                    <button 
                                        onClick={() => {
                                            setShowDeactivationConfirm(true);
                                        }}
                                        className="flex-1 sm:flex-initial px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-455 border border-rose-500/20 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 cursor-pointer outline-none shrink-0"
                                        title="Delete Profile"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Left Column: Compact Parameters Panel */}
                        <div className="lg:col-span-4 space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div className="bg-bg-card border border-border/60 rounded-2xl p-3.5 shadow-sm space-y-2.5 hover:border-accent/15 transition-all duration-200">
                                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border/20 pb-2 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-accent" /> Account Parameters
                                </div>
                                
                                <div className="divide-y divide-border/20 text-xs">
                                    {/* Valuation row */}
                                    <div className="flex justify-between items-center py-2.5">
                                        <span className="font-semibold text-text-muted">Plan Valuation</span>
                                        <span className="font-extrabold font-mono text-emerald-600 dark:text-emerald-400">₹{selectedCustomerContext.amount}</span>
                                    </div>

                                    {/* Expiry row */}
                                    {(() => {
                                        const diff = getDaysDifference(selectedCustomerContext.expiryDate);
                                        return (
                                            <>
                                                <div className="flex justify-between items-center py-2.5">
                                                    <span className="font-semibold text-text-muted">Subscription Expiry</span>
                                                    <span className="font-bold text-text-primary">{formatDateToReadable(selectedCustomerContext.expiryDate)}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2.5">
                                                    <span className="font-semibold text-text-muted">Milestone</span>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border ${diff.color}`}>
                                                        {diff.text}
                                                    </span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                    
                                    {/* Additional parameters listed flat */}
                                    {selectedCustomerContext.additionalDetails && parseDetailsFromPayload(selectedCustomerContext.additionalDetails).map(({ key, value }, index) => (
                                        <div key={index} className="flex justify-between items-center py-2.5">
                                            <span className="font-semibold text-text-muted uppercase text-[9px] tracking-wider">{key}</span>
                                            <span className="font-bold text-text-primary truncate max-w-[60%] font-mono">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Payments Timeline */}
                        <div className="lg:col-span-8 space-y-4">
                            <div className="bg-bg-card border border-border/60 rounded-2xl p-3.5 shadow-sm min-h-[250px] animate-in fade-in duration-300 flex flex-col">
                                <div className="mb-3 pb-2 border-b border-border/20">
                                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-widest">
                                        Payment Ledger
                                    </h3>
                                </div>

                                {selectedCustomerContext.payments && selectedCustomerContext.payments.length > 0 ? (
                                    <div className="divide-y divide-border/20 w-full flex-1">
                                        {selectedCustomerContext.payments.map((payment, idx) => {
                                            const isLatest = idx === 0;
                                            const dateStr = formatDateToReadable(payment.confirmedAt || payment.completedAt);
                                            return (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => handlePaymentRecordClick(payment)}
                                                    className="py-3 flex items-center justify-between gap-4 group transition-colors hover:bg-bg-hover/20 px-2 -mx-2 rounded-lg cursor-pointer active:scale-[0.995]"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {/* Simple status circle check */}
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 shrink-0 ${
                                                            isLatest 
                                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 ring-2 ring-emerald-500/10' 
                                                                : 'bg-bg-subtle text-text-muted border-border group-hover:border-text-primary'
                                                        }`}>
                                                            <Check className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0 space-y-0.5">
                                                            <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider block">
                                                                {payment.paymentMode} Payment
                                                            </span>
                                                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
                                                                <span>Record #{selectedCustomerContext.payments!.length - idx}</span>
                                                                <span>•</span>
                                                                <span>{dateStr}</span>
                                                                {payment.comments && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span className="italic truncate max-w-[150px]">"{payment.comments}"</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">₹{payment.amount}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-20 flex-1 flex flex-col items-center justify-center gap-2">
                                        <FileText className="w-10 h-10 text-text-muted" />
                                        <p className="text-text-muted text-xs uppercase tracking-widest font-black mt-2">No transaction record</p>
                                        <p className="text-text-muted text-[10px]">There are no recorded ledger payments for this customer.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Floating Action Button (FAB) to Record Payment */}
                        <div className="fixed bottom-24 right-6 z-40">
                            <button
                                onClick={() => triggerPaymentModalForCustomer(selectedCustomerContext)}
                                className="w-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:shadow-emerald-600/30 active:scale-95 transition-all duration-200 cursor-pointer border-0 outline-none"
                                title="Record Payment"
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <>

                        {/* ZONE 3: SELECT ALL & BATCH MESSAGE ACTION */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                {/* No borders, just icon and text */}
                                <button onClick={toggleGlobalSelectAll} className="flex items-center gap-2 text-xs font-bold text-text-primary hover:text-accent transition-colors active:scale-95 duration-150 cursor-pointer outline-none">
                                    <div className="shrink-0 transition-transform duration-200 active:scale-75">
                                        {isGlobalSelectAllActive ? (
                                            <CheckSquare className="w-4.5 h-4.5 text-accent animate-in zoom-in-50 duration-150" />
                                        ) : (
                                            <Square className="w-4.5 h-4.5 text-text-muted hover:text-text-primary transition-colors" />
                                        )}
                                    </div>
                                    SELECT ALL
                                </button>
                                {selectedCustomerIds.size > 0 && (
                                    <span className="text-xs font-mono text-text-muted animate-in fade-in duration-200">
                                        SELECTED: {selectedCustomerIds.size}
                                    </span>
                                )}
                            </div>

                            {/* Renders ONLY if at least 1 customer is selected, uses precise WhatsApp green */}
                            {selectedCustomerIds.size > 0 && (
                                <button
                                    onClick={() => handleMessageClick()}
                                    className="w-full bg-[#128C7E] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm animate-in fade-in zoom-in-95 duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all"
                                >
                                    <MessageCircle className="w-4 h-4 fill-white text-[#128C7E]" />
                                    {preSelectedTemplate ? `Send "${preSelectedTemplate.name}" to Selected Customers` : "Send Message to Selected Customers"}
                                </button>
                            )}
                        </div>

                        {/* ZONE 4: ACTIVE FILTER PILLS */}
                        {activeFiltersCount > 0 && (
                            <div className="flex flex-wrap gap-2 animate-in fade-in duration-100">
                                {Object.entries(queryPayload.filters || {}).flatMap(([key, values]) =>
                                    (values || []).map((pill) => (
                                        <div key={`${key}-${pill}`} className="inline-flex items-center gap-1.5 px-3 py-1 bg-bg-subtle border border-border rounded-full text-xs font-mono text-text-primary">
                                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                            <span>{pill}</span>
                                            <button
                                                onClick={() => setQueryPayload(prev => {
                                                    const updatedValues = (prev.filters[key] || []).filter(f => f !== pill);
                                                    return {
                                                        ...prev,
                                                        page: 0,
                                                        filters: {
                                                            ...prev.filters,
                                                            [key]: updatedValues
                                                        }
                                                    };
                                                })}
                                                className="hover:text-red-500 border-0 outline-none bg-transparent cursor-pointer p-0.5"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* ZONE 5: CUSTOMER ROWS */}
                        <section className="flex flex-col gap-3">
                            {loading ? (
                                <div className="space-y-3">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="w-full min-h-[58px] p-3 rounded-xl border border-border/60 bg-bg-card flex items-center justify-between animate-pulse shadow-sm">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {isSelectionModeActive && (
                                                    <div className="w-4.5 h-4.5 rounded bg-neutral-200 dark:bg-neutral-800 shrink-0" />
                                                )}
                                                <div className="w-10 h-10 rounded-md bg-neutral-200 dark:bg-neutral-800 shrink-0" />
                                                <div className="space-y-2 min-w-0">
                                                    <div className="h-3 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
                                                    <div className="h-2.5 w-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 shrink-0">
                                                <div className="h-3 w-14 bg-neutral-200 dark:bg-neutral-800 rounded font-mono" />
                                                <div className="h-4 w-12 bg-neutral-200 dark:bg-neutral-800 rounded" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : customers.length === 0 ? (
                                <div className="py-16 text-center text-text-muted text-sm bg-bg-card border border-border/40 rounded-2xl">
                                    No records match current parameters.
                                </div>
                            ) : (
                                customers.map((customer, idx) => {
                                    const isChecked = selectedCustomerIds.has(customer.id);

                                    // Badge Styles
                                    let badgeStyle = '';
                                    if (customer.paymentStatus === 'PAID') badgeStyle = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
                                    if (customer.paymentStatus === 'UNPAID') badgeStyle = 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20';
                                    if (customer.paymentStatus === 'OVERDUE') badgeStyle = 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';

                                    return (
                                        <div
                                            key={customer.id}
                                            onTouchStart={() => handleTouchStart(customer.id)}
                                            onTouchEnd={handleTouchEnd}
                                            onMouseDown={() => handleTouchStart(customer.id)}
                                            onMouseUp={handleTouchEnd}
                                            onClick={() => isSelectionModeActive ? handleRowCheckboxToggle(customer.id) : openCustomerDetails(customer.id)}
                                            className={`w-full min-h-[58px] p-3 rounded-xl border flex items-center justify-between gap-3 transition-all duration-300 ease-out cursor-pointer hover:scale-[1.008] hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] ${selectedCustomerContext?.id === customer.id
                                                    ? 'bg-bg-subtle border-accent font-semibold ring-1 ring-accent/30 shadow-sm'
                                                    : isChecked
                                                        ? 'ring-1 ring-accent bg-accent-tint border-accent/30'
                                                        : `bg-bg-card border-border hover:bg-bg-hover`
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                {isSelectionModeActive && (
                                                    <div className="shrink-0 transition-transform duration-200 active:scale-75">
                                                        {isChecked ? (
                                                            <CheckSquare className="w-4.5 h-4.5 text-accent animate-in zoom-in-50 duration-150" />
                                                        ) : (
                                                            <Square className="w-4.5 h-4.5 text-text-muted hover:text-text-primary transition-colors" />
                                                        )}
                                                    </div>
                                                )}

                                                <div className={`w-10 h-10 rounded-lg font-bold text-[11.5px] flex items-center justify-center uppercase shrink-0 border transition-all duration-300 ${
                                                    selectedCustomerContext?.id === customer.id || isChecked
                                                        ? 'bg-accent text-white border-transparent shadow-sm'
                                                        : 'bg-accent-tint/40 text-accent border-accent/10'
                                                }`}>
                                                    {customer.name.substring(0, 2)}
                                                </div>

                                                <div className="min-w-0">
                                                    <h4 className="text-xs font-semibold text-text-primary truncate">{customer.name}</h4>
                                                    <p className="text-[10px] text-text-muted mt-0.5 font-medium">{customer.phone}</p>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0 space-y-0.5 animate-in fade-in duration-200">
                                                <div className="text-xs font-bold text-text-heading">₹{customer.amount}</div>
                                                <span className={`inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded ${badgeStyle}`}>
                                                    {customer.paymentStatus}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </section>

                        {/* ZONE 6: PAGINATION */}
                        {totalPages > 1 && (
                            <footer className="flex items-center justify-between pt-2 pb-6 text-xs text-text-muted font-bold tracking-wider">
                                <button
                                    disabled={queryPayload.page === 0 || loading}
                                    onClick={() => setQueryPayload(prev => ({ ...prev, page: prev.page - 1 }))}
                                    className="px-4 py-2 bg-bg-subtle hover:bg-bg-hover rounded-md border border-border transition-colors disabled:opacity-30 cursor-pointer"
                                >
                                    PREV
                                </button>
                                <span>PAGE {queryPayload.page + 1} OF {totalPages}</span>
                                <button
                                    disabled={queryPayload.page + 1 >= totalPages || loading}
                                    onClick={() => setQueryPayload(prev => ({ ...prev, page: prev.page + 1 }))}
                                    className="px-4 py-2 bg-bg-subtle hover:bg-bg-hover rounded-md border border-border transition-colors disabled:opacity-30 cursor-pointer"
                                >
                                    NEXT
                                </button>
                            </footer>
                        )}
                    </>
                )}
            </main>

            {/* ======================================================= */}
            {/* OVERLAYS (FILTER & DETAILS) */}
            {/* ======================================================= */}

            {/* FILTER MODAL */}
            {showFilterModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0">
                    <div className="absolute inset-0 bg-overlay backdrop-blur-md animate-in fade-in duration-200" onClick={() => setShowFilterModal(false)} />
                    <div className="relative bg-bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-6 animate-in slide-in-from-bottom-10 sm:zoom-in-95 ease-out duration-250 border border-border shadow-2xl">
                        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                            <h3 className="text-base font-bold uppercase tracking-wider text-text-heading flex items-center gap-2"><Filter className="w-4 h-4 text-accent" /> Filters</h3>
                            <button onClick={() => setShowFilterModal(false)} className="text-text-muted hover:text-text-primary transition-colors border-0 bg-transparent outline-none cursor-pointer"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
                            {/* Section 1: Filters (mainFilters) */}
                            {Object.keys(filters.mainFilters || {}).length > 0 && (
                                <div className="space-y-4">
                                    {Object.entries(filters.mainFilters || {}).map(([category, options]) => (
                                        <div key={category} className="space-y-2">
                                            <label className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider block">
                                                {category.replace(/([A-Z])/g, ' $1').trim()}
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(options || []).map((val) => {
                                                    const isSelected = (selectedFilterDraft[category] || []).includes(val);
                                                    return (
                                                        <button
                                                            key={val}
                                                            type="button"
                                                            onClick={() => setSelectedFilterDraft(prev => {
                                                                const currentArr = prev[category] || [];
                                                                const nextArr = isSelected
                                                                    ? currentArr.filter(item => item !== val)
                                                                    : [...currentArr, val];
                                                                return {
                                                                    ...prev,
                                                                    [category]: nextArr
                                                                };
                                                            })}
                                                            className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-all duration-200 truncate border active:scale-95 cursor-pointer ${isSelected ? 'bg-accent text-white border-transparent' : 'bg-bg-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary border-border/60'}`}
                                                        >
                                                            {val}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Section 2: Custom Filter (customFilters) */}
                            {Object.keys(filters.customFilters || {}).length > 0 && (
                                <div className="space-y-4 pt-4 border-t border-border-subtle">
                                    <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">Custom Filter</span>
                                    {Object.entries(filters.customFilters || {}).map(([category, options]) => (
                                        <div key={category} className="space-y-2">
                                            <label className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider block">
                                                {category.replace(/([A-Z])/g, ' $1').trim()}
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(options || []).map((val) => {
                                                    const isSelected = (selectedFilterDraft[category] || []).includes(val);
                                                    return (
                                                        <button
                                                            key={val}
                                                            type="button"
                                                            onClick={() => setSelectedFilterDraft(prev => {
                                                                const currentArr = prev[category] || [];
                                                                const nextArr = isSelected
                                                                    ? currentArr.filter(item => item !== val)
                                                                    : [...currentArr, val];
                                                                return {
                                                                    ...prev,
                                                                    [category]: nextArr
                                                                };
                                                            })}
                                                            className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-all duration-200 truncate border active:scale-95 cursor-pointer ${isSelected ? 'bg-accent text-white border-transparent' : 'bg-bg-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary border-border/60'}`}
                                                        >
                                                            {val}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => { setQueryPayload(prev => ({ ...prev, page: 0, filters: selectedFilterDraft })); setShowFilterModal(false); }}
                            className="w-full bg-accent hover:opacity-90 text-white font-bold py-3.5 rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer border-0 outline-none shadow-md shadow-accent/15"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            )}

            {selectedCustomerContext && isEditMode && (
                <div className="fixed inset-0 z-50 flex items-end justify-center">
                    {/* Glassmorphic overlay */}
                    <div 
                        className="absolute inset-0 bg-overlay backdrop-blur-md animate-in fade-in duration-200" 
                        onClick={() => setIsEditMode(false)} 
                    />
                    
                    {/* Bottom Sheet dialog container */}
                    <div className="relative bg-bg-elevated border-t border-x border-border/60 w-full max-w-3xl rounded-t-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300 ease-out z-50">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-border/40 flex items-center justify-between bg-bg-card/50">
                            <div>
                                <h3 className="text-base font-bold uppercase tracking-wider text-text-heading">
                                    Edit Customer Profile
                                </h3>
                                <p className="text-[11px] text-text-muted mt-0.5 font-medium">Update details and configure notification alerts</p>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setIsEditMode(false)} 
                                className="text-text-muted hover:text-text-primary transition-colors border-0 bg-transparent outline-none cursor-pointer p-1"
                            >
                                <X className="w-5.5 h-5.5" />
                            </button>
                        </div>
                        
                        {/* Scrollable Form Body */}
                        <form onSubmit={commitDirectManualUpdate} id="contextForm" className="p-6 overflow-y-auto flex-1 space-y-6">
                            
                            {/* Card 1: Identity Info */}
                            <div className="p-5 rounded-2xl bg-bg-card border border-border/50 shadow-sm space-y-4">
                                <div className="flex items-center gap-3 border-b border-border/30 pb-3">
                                    <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent font-black text-sm flex items-center justify-center uppercase shrink-0 border border-accent/20">
                                        {((editFormDraft?.name) || 'C').substring(0, 2)}
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-text-heading">Identity Details</h4>
                                        <p className="text-[10px] text-text-muted">Primary customer contact information</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-extrabold text-text-muted block uppercase tracking-wider ml-0.5">Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={editFormDraft?.name || ''}
                                            onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, name: e.target.value } : null)}
                                            className="w-full bg-bg-input border border-border p-3 rounded-xl text-xs text-text-heading font-semibold outline-none focus:border-accent transition-all duration-200"
                                            placeholder="Enter name"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-extrabold text-text-muted block uppercase tracking-wider ml-0.5">Phone Number</label>
                                        <input
                                            type="text"
                                            required
                                            value={editFormDraft?.phone || ''}
                                            onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, phone: e.target.value } : null)}
                                            className="w-full bg-bg-input border border-border p-3 rounded-xl text-xs text-text-heading font-mono font-semibold outline-none focus:border-accent transition-all duration-200"
                                            placeholder="Enter phone number"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Subscription Info */}
                            <div className="p-5 rounded-2xl bg-bg-card border border-border/50 shadow-sm space-y-4">
                                <div className="flex items-center gap-3 border-b border-border/30 pb-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 font-bold flex items-center justify-center shrink-0 border border-amber-500/20">
                                        <Wallet className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-text-heading">Subscription Parameters</h4>
                                        <p className="text-[10px] text-text-muted">Subscription fees and expiry tracking date</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-extrabold text-text-muted block uppercase tracking-wider ml-0.5">Expiry Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={editFormDraft?.expiryDate || ''}
                                            onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, expiryDate: e.target.value } : null)}
                                            className="w-full bg-bg-input border border-border p-3 rounded-xl text-xs text-text-heading font-mono font-semibold outline-none focus:border-accent transition-all duration-200"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-extrabold text-text-muted block uppercase tracking-wider ml-0.5">Subscription Amount (₹)</label>
                                        <input
                                            type="number"
                                            required
                                            value={editFormDraft?.amount ?? 0}
                                            onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, amount: Number(e.target.value) } : null)}
                                            className="w-full bg-bg-input border border-border p-3 rounded-xl text-xs text-text-heading font-mono font-semibold outline-none focus:border-accent transition-all duration-200"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Ledger status & Auto Notifications */}
                            <div className="p-5 rounded-2xl bg-bg-card border border-border/50 shadow-sm space-y-5">
                                <div className="flex items-center gap-3 border-b border-border/30 pb-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 font-bold flex items-center justify-center shrink-0 border border-purple-500/20">
                                        <Bell className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-text-heading">Ledger & Notifications</h4>
                                        <p className="text-[10px] text-text-muted">Control alerts and general invoice payment status</p>
                                    </div>
                                </div>
                                <div className="space-y-5">
                                    {/* Segmented controls for Payment Status select */}
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-extrabold text-text-muted block uppercase tracking-wider ml-0.5">Payment Status</label>
                                        <div className="flex p-1 bg-bg-subtle border border-border rounded-xl">
                                            {(['PAID', 'UNPAID', 'OVERDUE'] as const).map((status) => {
                                                const isActive = (editFormDraft?.paymentStatus || 'UNPAID') === status;
                                                let activeColor = 'bg-bg-elevated text-text-heading border-border shadow-sm';
                                                if (isActive) {
                                                    if (status === 'PAID') activeColor = 'bg-emerald-600 text-white shadow-md shadow-emerald-600/15 border-transparent';
                                                    if (status === 'UNPAID') activeColor = 'bg-amber-500 text-white shadow-md shadow-amber-500/15 border-transparent';
                                                    if (status === 'OVERDUE') activeColor = 'bg-rose-600 text-white shadow-md shadow-rose-600/15 border-transparent';
                                                }
                                                return (
                                                    <button
                                                        key={status}
                                                        type="button"
                                                        onClick={() => {
                                                            if (status === 'PAID') {
                                                                triggerPaymentModalForCustomer(editFormDraft || selectedCustomerContext);
                                                            } else {
                                                                setEditFormDraft(prev => prev ? { ...prev, paymentStatus: status } : null);
                                                            }
                                                        }}
                                                        className={`flex-1 text-center py-2.5 rounded-lg text-xs font-bold transition-all border outline-none cursor-pointer duration-200 active:scale-[0.98] ${
                                                            isActive 
                                                                ? activeColor 
                                                                : 'text-text-muted bg-transparent border-transparent hover:text-text-primary'
                                                        }`}
                                                    >
                                                        {status}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* iOS-style Switch for WhatsApp Notifications */}
                                    <div className="flex items-center justify-between pt-3 border-t border-border/40">
                                        <div className="space-y-0.5">
                                            <span className="text-xs font-bold text-text-heading block">Auto Notifications</span>
                                            <span className="text-[10px] text-text-muted block">Send automated payment reminders via WhatsApp</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-full tracking-wider transition-all duration-200 ${
                                                (editFormDraft?.notificationStatus || 'ACTIVE') === 'ACTIVE' 
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                                    : 'bg-bg-subtle text-text-muted border border-border'
                                            }`}>
                                                {(editFormDraft?.notificationStatus || 'ACTIVE') === 'ACTIVE' ? 'Active' : 'Muted'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const nextNotif = (editFormDraft?.notificationStatus || 'ACTIVE') === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                                                    setEditFormDraft(prev => prev ? { ...prev, notificationStatus: nextNotif } : null);
                                                }}
                                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none items-center p-0.5 ${
                                                    (editFormDraft?.notificationStatus || 'ACTIVE') === 'ACTIVE' 
                                                        ? 'bg-emerald-500' 
                                                        : 'bg-neutral-300 dark:bg-neutral-700'
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                                                        (editFormDraft?.notificationStatus || 'ACTIVE') === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card 4: Additional parameters list */}
                            <div className="p-5 rounded-2xl bg-bg-card border border-border/50 shadow-sm space-y-4">
                                <div className="flex items-center gap-3 border-b border-border/30 pb-3">
                                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 font-bold flex items-center justify-center shrink-0 border border-sky-500/20">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-text-heading">Additional Information Parameters</h4>
                                        <p className="text-[10px] text-text-muted font-medium">Extra key-value details for metadata tracking</p>
                                    </div>
                                </div>

                                {editFormDraft?.additionalDetails && parseDetailsFromPayload(editFormDraft.additionalDetails).length > 0 ? (
                                    (() => {
                                        const list = parseDetailsFromPayload(editFormDraft.additionalDetails);
                                        return (
                                            <div className={`space-y-2 ${list.length > 4 ? 'max-h-[220px] overflow-y-auto pr-1' : ''}`}>
                                                {list.map(({ key, value }, index) => (
                                                    <div
                                                        key={`${key}-${value}-${index}`}
                                                        className="flex items-center justify-between p-3 bg-bg-subtle/50 rounded-xl border border-border text-xs hover:bg-bg-subtle/80 transition-all duration-150 animate-in fade-in"
                                                    >
                                                        <span className="text-text-muted font-bold uppercase text-[9px] tracking-wider truncate pr-2 max-w-[150px]">{key}</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-text-primary font-bold font-mono text-xs truncate max-w-[150px]">{value}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const currentList = parseDetailsFromPayload(editFormDraft.additionalDetails);
                                                                    const nextList = currentList.filter((_, i) => i !== index);
                                                                    const nextDetails = compileDetailsToPayload(nextList);
                                                                    setEditFormDraft({ ...editFormDraft, additionalDetails: nextDetails });
                                                                }}
                                                                className="text-rose-500 hover:text-rose-455 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors border-0 outline-none bg-transparent cursor-pointer shrink-0"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <div className="text-center py-5 bg-bg-subtle/40 rounded-xl text-text-muted text-xs italic border border-border/40">
                                        No additional parameters registered.
                                    </div>
                                )}

                                {/* Add details inline button & form */}
                                <div className="pt-2">
                                    {!showDetailForm ? (
                                        <button
                                            type="button"
                                            onClick={() => { fetchApiDetailsData(); setShowDetailForm(true) }}
                                            className="w-full bg-bg-subtle hover:bg-bg-hover border border-border text-text-primary hover:text-text-heading font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Add Additional Parameter
                                        </button>
                                    ) : (
                                        <div className="p-4 bg-bg-subtle rounded-xl space-y-3 relative border border-border animate-in slide-in-from-bottom-2 duration-150">
                                            <span className="text-[9px] font-bold text-text-muted block uppercase tracking-wider mb-1 ml-0.5">New Parameter Field</span>
                                            <div className="grid grid-cols-2 gap-2.5">
                                                {/* Key */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Detail Name (e.g. Hostname)"
                                                        value={newDetailKey}
                                                        onFocus={() => {
                                                            setDetailsDropdownField('key');
                                                        }}
                                                        onBlur={() => setTimeout(() => setDetailsDropdownField(null), 200)}
                                                        onChange={(e) => setNewDetailKey(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleSaveNewDetailInline();
                                                            }
                                                        }}
                                                        className="w-full bg-bg-input border border-border p-2.5 rounded-xl text-xs text-text-heading outline-none focus:border-emerald-500 transition-colors placeholder:text-text-muted/60"
                                                    />
                                                    {detailsDropdownField === 'key' && apiDetailsData && (
                                                        <div className="absolute left-0 right-0 mt-1 bg-bg-card border border-border rounded-xl p-1 shadow-2xl z-50 max-h-32 overflow-y-auto">
                                                            {Object.keys(apiDetailsData)
                                                                .filter(k => k.toLowerCase().includes((newDetailKey || '').toLowerCase()))
                                                                .map(k => (
                                                                    <button
                                                                        key={k}
                                                                        type="button"
                                                                        onMouseDown={() => {
                                                                            setNewDetailKey(k);
                                                                            if (apiDetailsData[k]) setNewDetailVal(String(apiDetailsData[k]));
                                                                        }}
                                                                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-bg-hover rounded text-text-primary"
                                                                    >
                                                                        {k}
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Value */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Value"
                                                        value={newDetailVal}
                                                        onFocus={() => {
                                                            fetchApiDetailsData();
                                                            setDetailsDropdownField('value');
                                                        }}
                                                        onBlur={() => setTimeout(() => setDetailsDropdownField(null), 200)}
                                                        onChange={(e) => setNewDetailVal(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleSaveNewDetailInline();
                                                            }
                                                        }}
                                                        className="w-full bg-bg-input border border-border p-2.5 rounded-xl text-xs text-text-heading outline-none focus:border-emerald-500 transition-colors placeholder:text-text-muted/60"
                                                    />
                                                    {detailsDropdownField === 'value' && apiDetailsData && newDetailKey && apiDetailsData[newDetailKey] && (
                                                        <div className="absolute left-0 right-0 mt-1 bg-bg-card border border-border rounded-xl p-1 shadow-2xl z-50 max-h-32 overflow-y-auto">
                                                            <button
                                                                key="suggested"
                                                                type="button"
                                                                onMouseDown={() => setNewDetailVal(String(apiDetailsData[newDetailKey]))}
                                                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-bg-hover rounded text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between"
                                                            >
                                                                <span>{String(apiDetailsData[newDetailKey])}</span>
                                                                <span className="text-[8px] uppercase bg-emerald-555/10 text-emerald-500 px-1 py-0.5 rounded font-bold">Suggested</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDetailForm(false)}
                                                    className="w-1/3 bg-bg-card hover:bg-bg-hover text-text-muted py-2 rounded-xl text-xs font-bold transition-all border border-border active:scale-95 cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveNewDetailInline}
                                                    className="w-2/3 bg-emerald-650 hover:opacity-90 text-white py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer border-0"
                                                >
                                                    Save Parameter
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                        
                        {/* Actions Footer */}
                        <div className="p-5 bg-bg-card border-t border-border/40 flex items-center justify-end gap-3">
                            <button 
                                type="button" 
                                onClick={() => setIsEditMode(false)} 
                                className="px-5 py-3 bg-bg-subtle hover:bg-bg-hover border border-border text-text-primary font-bold rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                form="contextForm" 
                                className="px-6 py-3 bg-accent hover:opacity-90 active:scale-95 text-white font-bold rounded-xl text-xs transition-all cursor-pointer border-0 shadow-md shadow-accent/15"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOMER DEACTIVATION DUAL-CONFIRM DIALOG OVERLAY */}
            {showDeactivationConfirm && selectedCustomerContext && (
                <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-overlay backdrop-blur-md animate-in fade-in duration-200" onClick={() => setShowDeactivationConfirm(false)} />
                    <div className="relative bg-bg-card w-full max-w-sm rounded-3xl p-6 space-y-5 text-center animate-in zoom-in-95 ease-out duration-250 shadow-2xl z-50 border border-border">
                        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                            <Trash2 className="w-5 h-5 absolute" />
                            <Trash2 className="w-5 h-5 animate-ping" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-text-heading">Confirm Deletion</h3>
                            <p className="text-xs text-text-muted leading-relaxed">
                                confirm deleting {selectedCustomerContext.name}, the customer will no longer receive automatic notifications and business tracking
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowDeactivationConfirm(false)}
                                className="w-1/2 bg-bg-subtle hover:bg-bg-hover text-text-muted font-bold py-3 rounded-xl text-xs border border-border transition-all active:scale-95 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDeactivationConfirm(false);
                                    commitCustomerStatusChange('INACTIVE');
                                }}
                                className="w-1/2 bg-rose-600 hover:opacity-90 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-rose-600/10 active:scale-95 transition-all cursor-pointer border-0"
                            >
                                Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* BOTTOM NAV BAR INTERACTION ACTION REGISTRY */}
            {(selectedCustomerContext && !isEditMode || preSelectedTemplate) && (
                <div className="fixed bottom-5 left-0 lg:left-64 right-0 z-10 pointer-events-none flex justify-center animate-in fade-in duration-200">
                    <div className="w-full px-4 max-w-md pointer-events-auto">
                        {selectedCustomerContext && !isEditMode ? (
                            <button
                                onClick={() => setSelectedCustomerContext(null)}
                                className="w-full bg-bg-card hover:bg-bg-hover border border-border text-text-primary font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all active:scale-95 shadow-xl cursor-pointer"
                            >
                                <ArrowLeft className="w-4 h-4 text-text-muted" /> Go Back
                            </button>
                        ) : (
                            <button
                                onClick={() => navigate('/payping/message-templates')}
                                className="w-full bg-bg-card hover:bg-bg-hover border border-border text-text-primary font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all active:scale-95 shadow-xl cursor-pointer"
                            >
                                <X className="w-4 h-4 text-text-muted" /> Cancel Customer Selection
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ======================================================= */}
            {/* FULL INLINE TEMPLATE VIEW MODAL INJECTED TEMPLATE PICKER */}
            {/* ======================================================= */}
            {/* FINAL CONFIRMATION MODAL */}
            {showConfirmationModal && preSelectedTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-overlay backdrop-blur-md animate-in fade-in duration-200" onClick={() => setShowConfirmationModal(false)} />
                    <div className="relative bg-bg-card w-full max-w-md rounded-3xl p-6 shadow-2xl border border-border z-50 animate-in zoom-in-95 ease-out duration-250">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold uppercase tracking-wider text-text-heading flex items-center gap-2">
                                <MessageCircle className="w-5 h-5 text-[#128C7E]" /> Confirm Dispatch
                            </h3>
                            <button onClick={() => setShowConfirmationModal(false)} className="text-text-muted hover:text-text-heading transition-colors border-0 bg-transparent outline-none cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            {/* Server downtime warning if status is SERVER_ISSUE */}
                            {(() => {
                                const saved = sessionStorage.getItem('payping_global_metrics');
                                if (saved) {
                                    try {
                                        const metrics = JSON.parse(saved);
                                        if (metrics?.whatsappStatus === 'SERVER_ISSUE') {
                                            return (
                                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300 text-xs flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                                                    <div className="space-y-1 text-left">
                                                        <h4 className="font-bold text-amber-600 dark:text-amber-400">WhatsApp Gateway Connection Issue</h4>
                                                        <p className="text-text-muted leading-relaxed">
                                                            Our WhatsApp delivery channel is currently experiencing connectivity issues. You can proceed to queue your messages; they will be automatically dispatched once connection is restored. You can track progress in the Alert History log.
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }
                                return null;
                            })()}

                            {/* Alert Name Input */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Alert Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={alertName}
                                    onChange={(e) => setAlertName(e.target.value)}
                                    placeholder="e.g. Monthly Payment Reminder"
                                    className="w-full bg-bg-input border border-border text-text-primary rounded-xl p-3 text-sm focus:border-accent outline-none transition-colors font-medium"
                                />
                            </div>

                            {/* Selected Template Info */}
                            <div className="bg-bg-subtle border border-border rounded-xl p-4 flex items-center justify-between">
                                <div className="min-w-0 pr-4">
                                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-1">Template</p>
                                    <p className="text-sm text-text-heading font-medium truncate">{preSelectedTemplate.name}</p>
                                </div>
                                <button
                                    onClick={() => navigate('/payping/message-templates', { state: { preSelectedCustomerIds: Array.from(selectedCustomerIds) } })}
                                    className="shrink-0 text-xs text-accent hover:opacity-85 font-bold px-3 py-1.5 bg-accent-tint rounded-lg transition-all active:scale-95 cursor-pointer border-0"
                                >
                                    Modify
                                </button>
                            </div>

                            {/* Selected Customers Info */}
                            <div className="bg-bg-subtle border border-border rounded-xl p-4 flex items-center justify-between">
                                <div className="min-w-0 pr-4">
                                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-1">Customers</p>
                                    <p className="text-sm text-text-heading font-medium">{selectedCustomerIds.size} recipient(s) selected</p>
                                </div>
                                <button
                                    onClick={() => setShowConfirmationModal(false)}
                                    className="shrink-0 text-xs text-accent hover:opacity-85 font-bold px-3 py-1.5 bg-accent-tint rounded-lg transition-all active:scale-95 cursor-pointer border-0"
                                >
                                    Modify
                                </button>
                            </div>

                            <button
                                disabled={!alertName.trim() || isSending}
                                onClick={async () => {
                                    if (!alertName.trim()) return;
                                    setIsSending(true);
                                    try {
                                        await api.post('/payping/whatsapp/send', {
                                            name: alertName.trim(),
                                            templateId: preSelectedTemplate.id,
                                            customerIds: Array.from(selectedCustomerIds)
                                        }, { headers: { 'X-Trigger-Success': 'true' } });

                                        // Reset and navigate away
                                        setShowConfirmationModal(false);
                                        setAlertName('');
                                        navigate('/payping/dashboard');
                                    } catch (err) {
                                        console.error("Failed to send message", err);
                                        setIsSending(false);
                                    }
                                }}
                                className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${!alertName.trim() || isSending
                                        ? 'bg-bg-subtle text-text-muted border border-border cursor-not-allowed'
                                        : 'bg-[#128C7E] hover:opacity-90 text-white shadow-lg shadow-[#128C7E]/10 active:scale-[0.98]'
                                    }`}
                            >
                                {isSending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                                {isSending ? 'Dispatching...' : 'Confirm Send Message'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center">
                    {/* Glassmorphic overlay */}
                    <div 
                        className="absolute inset-0 bg-overlay backdrop-blur-md animate-in fade-in duration-200" 
                        onClick={() => setShowPaymentModal(false)} 
                    />
                    
                    {/* Bottom Sheet dialog container */}
                    <div className="relative bg-bg-elevated border-t border-x border-border/60 w-full max-w-lg rounded-t-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300 ease-out z-50">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-border/40 flex items-center justify-between bg-bg-card/50">
                            <div>
                                <h3 className="text-base font-bold uppercase tracking-wider text-text-heading">
                                    {paymentModalMode === 'create' ? 'Record Payment' : 'Payment Details'}
                                </h3>
                                <p className="text-[11px] text-text-muted mt-0.5 font-medium">
                                    {paymentModalMode === 'create'
                                        ? `Update ${(editFormDraft || selectedCustomerContext)?.name || ''} payment status`
                                        : `Transaction details for ${(editFormDraft || selectedCustomerContext)?.name || ''}`
                                    }
                                </p>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setShowPaymentModal(false)} 
                                className="text-text-muted hover:text-text-primary transition-colors border-0 bg-transparent outline-none cursor-pointer p-1"
                            >
                                <X className="w-5.5 h-5.5" />
                            </button>
                        </div>

                        <form onSubmit={submitPaymentDetails} className="p-6 overflow-y-auto flex-1 space-y-5">
                            {paymentModalMode === 'create' && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300 rounded-xl text-xs font-semibold leading-relaxed flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <span>Please update the new expiry date for the next cycle.</span>
                                </div>
                            )}

                            <div className="p-5 rounded-2xl bg-bg-card border border-border/50 shadow-sm space-y-4">
                                {/* New Expiry Date */}
                                {paymentModalMode === 'create' ? (
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-extrabold text-text-muted block uppercase tracking-wider ml-0.5">New Expiry Date <span className="text-rose-500">*</span></label>
                                        <input
                                            type="date"
                                            required
                                            value={paymentForm.expiryDate}
                                            onChange={(e) => setPaymentForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                                            className="w-full bg-bg-input border border-border p-3 rounded-xl text-xs text-text-heading font-mono font-semibold outline-none focus:border-accent transition-all duration-200"
                                        />
                                        {!isFutureDate(paymentForm.expiryDate) && paymentForm.expiryDate && (
                                            <p className="text-[10px] text-rose-500 font-bold ml-1 mt-1">Expiry date must be in the future.</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-extrabold text-text-muted block uppercase tracking-wider ml-0.5">Confirmed Time</label>
                                        <div className="w-full bg-bg-input border border-border p-3 rounded-xl text-xs text-text-primary font-mono font-semibold">
                                            {selectedPaymentRecord ? formatPaymentTimestamp(selectedPaymentRecord.confirmedAt || selectedPaymentRecord.completedAt || '') : ''}
                                        </div>
                                    </div>
                                )}

                                {/* Paid Amount */}
                                <div className="space-y-1">
                                    <label className="text-[9px] font-extrabold text-text-muted block uppercase tracking-wider ml-0.5">
                                        {paymentModalMode === 'create' ? 'Paid Amount (₹)' : 'Paid Amount (₹)'}
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        readOnly={paymentModalMode === 'view'}
                                        value={paymentForm.amount || ''}
                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                                        className={`w-full bg-bg-input border border-border p-3 rounded-xl text-xs text-text-heading font-mono font-semibold outline-none focus:border-accent transition-all duration-200 ${paymentModalMode === 'view' ? 'text-text-muted select-none bg-bg-subtle/50' : ''}`}
                                    />
                                </div>

                                {/* Payment Mode */}
                                <div className="space-y-1">
                                    <label className="text-[9px] font-extrabold text-text-muted block uppercase tracking-wider ml-0.5">Payment Mode</label>
                                    {paymentModalMode === 'create' ? (
                                        <select
                                            value={paymentForm.paymentMode}
                                            onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMode: e.target.value }))}
                                            className="w-full bg-bg-input border border-border p-3 rounded-xl text-xs text-text-heading font-semibold outline-none focus:border-accent transition-all duration-200 cursor-pointer"
                                        >
                                            {paymentModes.map(mode => (
                                                <option key={mode} value={mode}>{mode}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="w-full bg-bg-input border border-border p-3 rounded-xl text-xs text-text-primary font-semibold">
                                            {paymentForm.paymentMode}
                                        </div>
                                    )}
                                </div>

                                {/* Comments */}
                                <div className="space-y-1">
                                    <label className="text-[9px] font-extrabold text-text-muted block uppercase tracking-wider ml-0.5">Comments</label>
                                    <textarea
                                        readOnly={paymentModalMode === 'view'}
                                        value={paymentForm.comments}
                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, comments: e.target.value }))}
                                        placeholder={paymentModalMode === 'create' ? "Add transaction notes..." : "No comments."}
                                        rows={3}
                                        className={`w-full bg-bg-input border border-border p-3 rounded-xl text-xs text-text-heading outline-none focus:border-accent transition-all duration-200 resize-none ${paymentModalMode === 'view' ? 'text-text-muted select-none bg-bg-subtle/50' : ''}`}
                                    />
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(false)}
                                    className="flex-1 bg-bg-subtle hover:bg-bg-hover text-text-heading font-bold py-3.5 rounded-xl text-xs transition-colors border border-border cursor-pointer active:scale-95"
                                >
                                    {paymentModalMode === 'create' ? 'Cancel' : 'Close'}
                                </button>
                                {paymentModalMode === 'create' && (
                                    <button
                                        type="submit"
                                        disabled={!paymentForm.amount || !paymentForm.expiryDate || !isFutureDate(paymentForm.expiryDate)}
                                        className={`flex-1 font-bold py-3.5 rounded-xl text-xs transition-all cursor-pointer ${(!paymentForm.amount || !paymentForm.expiryDate || !isFutureDate(paymentForm.expiryDate))
                                                ? 'bg-bg-subtle text-text-muted border border-border cursor-not-allowed'
                                                : 'bg-accent hover:opacity-90 active:scale-98 text-white shadow-lg shadow-accent/15'
                                            }`}
                                    >
                                        Save Payment
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================= */}
            {/* EMBEDDED SLIDING ADDCUSTOMERS PANEL OVERLAY             */}
            {/* ======================================================= */}
            {showAddCustomers && (
                <div
                    className={`fixed inset-0 z-40 bg-bg-subtle overflow-y-auto ${isAddCustomersClosing ? 'animate-out slide-out-to-left duration-300' : 'animate-in slide-in-from-left duration-300'}`}
                    style={{
                        animationFillMode: 'forwards'
                    }}
                >
                    <AddCustomers isEmbedded={true} onGoBack={handleCloseAddCustomers} />
                </div>
            )}
        </div>
    );
};

export default Customers;