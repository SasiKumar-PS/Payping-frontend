import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    Users, ChevronDown, ArrowUpDown, Filter, Search, X, 
    MessageCircle, Edit2, CheckSquare, Square, 
    ChevronLeft, ChevronRight, Check, RefreshCw, Phone,
    LayoutDashboard, MessageSquare, UserPlus, AlertCircle,
    AlertTriangle,
    Upload, ArrowRight, Download, FileText,
    ArrowLeft, Trash2
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
        setGlobalLoading(true);

        const payload = {
            ...manualForm,
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
        <div className="min-h-screen bg-[#0f0f0f] text-white p-6 flex flex-col items-center justify-center animate-in fade-in duration-300 relative overflow-hidden">

            {/* Structural UI Container Card */}
            <div className="max-w-xl w-full bg-zinc-900 p-8 md:p-10 rounded-[2.5rem] border border-zinc-800 shadow-2xl text-center z-10 space-y-8">
                
                {/* Branding Core Context Header */}
                <div className="space-y-3">
                    <div className="inline-flex p-3.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-500 mx-auto">
                        <Users className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight">Populate Directory</h2>
                    <p className="text-sm text-zinc-400 max-w-sm mx-auto">
                        Begin populating accounts to initiate tracking. Current ledger density:
                    </p>
                    
                    {/* Realtime Aggregation Dynamic Tag Counter */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#0f0f0f] border border-zinc-800 rounded-full mt-1">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                        <span className="text-xs font-mono tracking-wider text-zinc-400">
                            SYSTEM TOTAL: <span className="text-white font-bold">{totalCount}</span> CONSUMERS
                        </span>
                    </div>
                </div>

                {/* Tactical Operation Options Grid Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Action Card Selector A: Bulk CSV Upload */}
                    <button 
                        onClick={() => setShowBulkModal(true)}
                        className="flex flex-col items-center justify-center p-6 bg-[#0f0f0f]/40 hover:bg-[#0f0f0f] border border-zinc-800/80 hover:border-indigo-500/50 rounded-3xl transition-all duration-300 group space-y-3 text-center"
                    >
                        <div className="p-3 bg-indigo-500/5 group-hover:bg-indigo-500/10 rounded-xl text-indigo-500 transition-colors">
                            <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-left w-full text-center">
                            <h4 className="font-bold text-sm text-zinc-200">Bulk Directory Ingest</h4>
                            <p className="text-[11px] text-zinc-500 mt-0.5">Parse structured spreadsheet matrices instantly.</p>
                        </div>
                    </button>

                    {/* Action Card Selector B: Manual Ingestion Form */}
                    <button 
                        onClick={() => setShowManualModal(true)}
                        className="flex flex-col items-center justify-center p-6 bg-[#0f0f0f]/40 hover:bg-[#0f0f0f] border border-zinc-800/80 hover:border-emerald-500/50 rounded-3xl transition-all duration-300 group space-y-3 text-center"
                    >
                        <div className="p-3 bg-emerald-500/5 group-hover:bg-emerald-500/10 rounded-xl text-emerald-500 transition-colors">
                            <UserPlus className="w-6 h-6" />
                        </div>
                        <div className="text-left w-full text-center">
                            <h4 className="font-bold text-sm text-zinc-200">Manual Direct Entry</h4>
                            <p className="text-[11px] text-zinc-500 mt-0.5">Input independent specific clients variables.</p>
                        </div>
                    </button>
                </div>

                {/* Navigation Terminal Workspace Dashboard Exit Action Button */}
                <div className="border-t border-zinc-800/60 pt-6 space-y-3">
                    {!isEmbedded ? (
                        <button 
                            onClick={() => navigate('/payping/dashboard')}
                            className="w-full bg-white hover:bg-zinc-200 text-black font-extrabold py-4 rounded-xl flex items-center justify-center transition-all duration-200 group shadow-lg shadow-white/5"
                        >
                            Launch Terminal Dashboard
                            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    ) : (
                        <>
                            <button 
                                type="button"
                                onClick={onGoBack}
                                className="w-full bg-[#0f0f0f] hover:bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-all"
                            >
                                <ChevronLeft className="w-4 h-4 text-zinc-400" /> Go Back
                            </button>
                            <button 
                                type="button"
                                onClick={() => navigate('/payping/dashboard')}
                                className="w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-350 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-all"
                            >
                                <LayoutDashboard className="w-4 h-4 text-zinc-400" /> Return to Dashboard
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ======================================================== */}
            {/* POPUP OVERLAY WINDOW 1: ADVANCED BULK INGESTION CONTROL  */}
            {/* ======================================================== */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-[#0f0f0f]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl max-h-[85vh] flex flex-col shadow-2xl scale-in-center animate-in zoom-in-95 duration-200">
                        
                        {/* Internal Header Modal Bar */}
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Upload className="text-indigo-500 w-5 h-5" />
                                <h3 className="font-bold text-lg">Batch Spreadsheet Processor</h3>
                            </div>
                            <button onClick={closeAndResetBulkPipeline} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Asynchronous Window Stage Controller Block Layouts */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {bulkStage === 'select' ? (
                                <div className="space-y-6">
                                    {/* Action Sub-Block: Download Matrix Blueprint */}
                                    <div className="bg-[#0f0f0f] border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <FileText className="text-indigo-400 w-8 h-8 shrink-0 mt-0.5" />
                                            <div>
                                                <h5 className="font-bold text-sm">System Scheme File Blueprint</h5>
                                                <p className="text-xs text-zinc-500 mt-0.5">Download the formatting layout matrix config before parsing system operations.</p>
                                            </div>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={downloadCsvTemplate}
                                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-xs font-bold rounded-xl border border-zinc-700 flex items-center gap-2 transition-colors shrink-0"
                                        >
                                            <Download className="w-3.5 h-3.5" /> Blueprint
                                        </button>
                                    </div>

                                    {/* Drop Area / Interactive Selection Block Target Window */}
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 bg-[#0f0f0f]/40 hover:bg-[#0f0f0f] p-8 rounded-2xl text-center cursor-pointer transition-all group space-y-3"
                                    >
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={handleFileChange} 
                                            accept=".csv" 
                                            className="hidden" 
                                        />
                                        <div className="p-3 bg-zinc-900 rounded-full inline-block text-zinc-400 group-hover:text-indigo-500 transition-colors">
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-300">
                                                {selectedFile ? selectedFile.name : "Select Operational CSV Matrix File"}
                                            </p>
                                            <p className="text-xs text-zinc-500 mt-1">Accepts system parsed raw plain text standard schemas up to 10MB</p>
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

                                    <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-[#0f0f0f]">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-bold">
                                                    <th className="p-3.5">TARGET NAME</th>
                                                    <th className="p-3.5">PHONE CONNECTION</th>
                                                    <th className="p-3.5">VALUATION PRICE</th>
                                                    <th className="p-3.5">CHRONO EXPIRY</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-850 font-mono text-zinc-300">
                                                {previewCustomers.map((c, idx) => (
                                                    <tr key={idx} className="hover:bg-zinc-900/40 transition-colors">
                                                        <td className="p-3.5 font-sans font-medium text-white">{c.name}</td>
                                                        <td className="p-3.5 text-zinc-400">{c.phone}</td>
                                                        <td className="p-3.5 text-indigo-400 font-semibold">₹{c.amount}</td>
                                                        <td className="p-3.5 text-zinc-500">{c.expiryDate}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex items-center gap-3 pt-2">
                                        <button 
                                            onClick={() => setBulkStage('select')}
                                            className="w-1/3 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold py-3.5 rounded-xl transition-colors text-sm"
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
                <div className="fixed inset-0 bg-[#0f0f0f]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <form 
                        onSubmit={executeManualCommit}
                        className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl shadow-2xl scale-in-center animate-in zoom-in-95 duration-200 overflow-hidden"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <UserPlus className="text-emerald-500 w-5 h-5" />
                                <h3 className="font-bold text-lg">Direct Ingestion Console</h3>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setShowManualModal(false)} 
                                className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Scrollable Form Body Container Inputs */}
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            
                            {/* Input Variable Block: Name */}
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">Client Full Name</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="Jane Doe"
                                    value={manualForm.name}
                                    onChange={(e) => setManualForm({...manualForm, name: e.target.value})}
                                    className="w-full bg-[#0f0f0f] border border-zinc-800 p-3 rounded-xl focus:border-emerald-500 outline-none transition-colors placeholder:text-zinc-700 text-sm"
                                />
                            </div>

                            {/* Input Variable Block: Phone */}
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">WhatsApp Matrix Vector Phone</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="919876543210"
                                    value={manualForm.phone}
                                    onChange={(e) => setManualForm({...manualForm, phone: e.target.value})}
                                    className="w-full bg-[#0f0f0f] border border-zinc-800 p-3 rounded-xl focus:border-emerald-500 outline-none transition-colors placeholder:text-zinc-700 text-sm font-mono"
                                />
                            </div>

                            {/* Input Variable Block: Target Flat Fee Price Valuation */}
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">Subscription Valuation Rate (₹)</label>
                                <input 
                                    type="number" 
                                    required
                                    placeholder="2000"
                                    value={manualForm.amount || ''}
                                    onChange={(e) => setManualForm({...manualForm, amount: Number(e.target.value)})}
                                    className="w-full bg-[#0f0f0f] border border-zinc-800 p-3 rounded-xl focus:border-emerald-500 outline-none transition-colors placeholder:text-zinc-700 text-sm"
                                />
                            </div>

                            {/* Input Variable Block: Target Chronological Exp Date Deadline */}
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">Chronological Expiry Milestone</label>
                                <input 
                                    type="date" 
                                    required
                                    value={manualForm.expiryDate}
                                    onChange={(e) => setManualForm({...manualForm, expiryDate: e.target.value})}
                                    className="w-full bg-[#0f0f0f] border border-zinc-800 p-3 rounded-xl focus:border-emerald-500 outline-none transition-colors text-zinc-300 text-sm"
                                />
                            </div>

                            {/* Additional Parameters Block */}
                            <div className="space-y-3 border-t border-zinc-800/60 pt-4">
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">Additional Parameters</label>
                                
                                {additionalDetailsList.length > 0 ? (
                                    <div className={`space-y-2 ${additionalDetailsList.length > 4 ? 'max-h-[220px] overflow-y-auto pr-1' : ''}`}>
                                        {additionalDetailsList.map(({ key, value }, index) => (
                                            <div 
                                                key={`${key}-${value}-${index}`} 
                                                className="flex items-center justify-between p-3.5 bg-[#0f0f0f] rounded-2xl shadow-sm border border-zinc-900/40 text-xs hover:bg-zinc-900/20 transition-all duration-150"
                                            >
                                                <span className="text-zinc-400 font-semibold uppercase text-[10px] tracking-wider truncate pr-2 max-w-[150px]">{key}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-zinc-200 font-bold font-mono text-xs truncate max-w-[150px]">{value}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAdditionalDetailsList(prev => prev.filter((_, i) => i !== index))}
                                                        className="text-rose-500 hover:text-rose-450 hover:bg-rose-500/10 p-1 rounded transition-colors border-0 outline-none bg-transparent cursor-pointer shrink-0"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 bg-[#0f0f0f]/40 rounded-2xl text-zinc-500 text-xs italic border border-zinc-800/30">
                                        No additional parameters added.
                                    </div>
                                )}

                                {/* Add Detail Form or Button */}
                                {!showDetailForm ? (
                                    <button
                                        type="button"
                                        onClick={() => { fetchApiDetailsData(); setShowDetailForm(true); }}
                                        className="w-full bg-[#0f0f0f] hover:bg-zinc-900 border border-zinc-800 text-zinc-350 hover:text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                                    >
                                        + Add Additional Detail
                                    </button>
                                ) : (
                                    <div className="p-4 bg-[#0f0f0f] rounded-2xl space-y-3 relative border border-zinc-850 animate-in slide-in-from-bottom-2 duration-150">
                                        <span className="text-[9px] font-bold text-zinc-500 block uppercase tracking-wider mb-1">New Parameter Field</span>
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
                                                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-emerald-500 transition-colors"
                                                />
                                                {detailsDropdownField === 'key' && apiDetailsData && (
                                                    <div className="absolute left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-2xl z-50 max-h-32 overflow-y-auto">
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
                                                                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-800 rounded text-zinc-300 font-medium"
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
                                                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-emerald-500 transition-colors"
                                                />
                                                {detailsDropdownField === 'value' && apiDetailsData && newDetailKey && apiDetailsData[newDetailKey] && (
                                                    <div className="absolute left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-2xl z-50 max-h-32 overflow-y-auto">
                                                        <button
                                                            key="suggested"
                                                            type="button"
                                                            onMouseDown={() => setNewDetailVal(String(apiDetailsData[newDetailKey]))}
                                                            className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-800 rounded text-emerald-400 font-bold flex items-center justify-between"
                                                        >
                                                            <span>{String(apiDetailsData[newDetailKey])}</span>
                                                            <span className="text-[8px] uppercase bg-emerald-500/10 text-emerald-500 px-1 py-0.5 rounded font-black">Suggested</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowDetailForm(false)}
                                                className="w-1/3 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 py-2 rounded-xl text-xs font-bold transition-colors"
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

                        {/* Modal Action Transaction Trigger Footer Bar */}
                        <div className="p-6 border-t border-zinc-800 bg-[#0f0f0f]/40">
                            <button
                                type="submit"
                                disabled={globalLoading}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-lg shadow-emerald-600/10"
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

    const isFutureDate = (dateStr: string) => {
        if (!dateStr) return false;
        const inputDate = new Date(dateStr);
        inputDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return inputDate.getTime() > today.getTime();
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
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout>| null>(null);
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
        }
    };

    const handlePaymentStatusChange = async (newPaymentStatus: string) => {
        if (!selectedCustomerContext) return;
        
        try {
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
        try {
            await api.put(`/payping/customers/${editFormDraft.id}`, editFormDraft, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            setSelectedCustomerContext(editFormDraft);
            setIsEditMode(false);
            executeLedgerQuery(queryPayload);
        } catch (err) {
            console.error("Update failed:", err);
        }
    };

    const activeFiltersCount = Object.values(queryPayload.filters || {}).reduce(
        (acc, val) => acc + (Array.isArray(val) ? val.length : 0),
        0
    );

    return (
        <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col font-sans select-none overflow-x-hidden pb-28 relative">
            
            {/* ======================================================= */}
            {/* HEADER (ZONES 1 & 2): RIGID LAYOUT, NO BORDERS/OUTLINES */}
            {/* ======================================================= */}
            <header className="sticky top-0 z-30 bg-[#0f0f0f] px-4 pt-5 pb-3 max-w-md lg:max-w-6xl mx-auto w-full">
                
                {/* ZONE 1: CORE HEADER (Never shifts or hides) */}
                <div className="flex items-center justify-between pb-5">
                    <div className="flex items-center gap-3">
                        {selectedCustomerContext && !isEditMode && (
                            <button onClick={() => setSelectedCustomerContext(null)} className="p-2 bg-zinc-900/50 hover:bg-zinc-800 rounded-lg border border-zinc-800/60 transition-colors cursor-pointer text-zinc-300 hover:text-white shadow-sm outline-none">
                                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        )}
                        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-500" /> Customers
                        </h2>
                    </div>
                    {(!selectedCustomerContext || isEditMode) && (
                        <button 
                            onClick={() => setShowAddCustomers(true)}
                            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-indigo-600/10 border-0 outline-none cursor-pointer"
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
                                
                                {/* Left Dropdown (No borders, pure text/icon) */}
                                <div className="relative">
                                    <button 
                                        onClick={() => setShowStatusDropdown(true)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 tracking-wider uppercase"
                                    >
                                        {queryPayload.status} REGISTRY
                                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                                    </button>
                                    
                                    {showStatusDropdown && (
                                        <>
                                            <div onClick={() => setShowStatusDropdown(false)} className="fixed inset-0 z-40" />
                                            <div className="absolute left-0 mt-3 w-40 bg-zinc-900 rounded-xl p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                                                {['ACTIVE', 'INACTIVE', 'ALL'].map((opt) => (
                                                    <button 
                                                        key={opt}
                                                        onClick={() => { setQueryPayload(prev => ({ ...prev, status: opt, page: 0 })); setShowStatusDropdown(false); }}
                                                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-zinc-800 font-semibold text-xs tracking-wide text-zinc-300"
                                                    >
                                                        {opt} DIRECTORY
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Right Icons (No borders, pure icons) */}
                                <div className="flex items-center gap-5 text-zinc-400">
                                    <div className="relative">
                                        <button onClick={() => setShowSortDropdown(true)} className="flex items-center justify-center hover:text-white transition-colors">
                                            <ArrowUpDown className="w-4 h-4" />
                                        </button>
                                        
                                        {/* Sort Dropdown (Absolutely positioned so it doesn't push Zone 3 down) */}
                                        {showSortDropdown && (
                                            <>
                                                <div onClick={() => setShowSortDropdown(false)} className="fixed inset-0 z-40" />
                                                <div className="absolute right-0 mt-3 w-48 bg-zinc-900 rounded-xl p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                                                    {[
                                                        { key: 'name_asc', label: 'Name (A-Z)' },
                                                        { key: 'name_desc', label: 'Name (Z-A)' },
                                                        { key: 'amount_desc', label: 'Amount (High-Low)' },
                                                        { key: 'amount_asc', label: 'Amount (Low-High)' }
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.key}
                                                            onClick={() => { setQueryPayload(prev => ({ ...prev, sort: opt.key, page: 0 })); setShowSortDropdown(false); }}
                                                            className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between text-xs font-semibold ${queryPayload.sort === opt.key ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-300 hover:bg-zinc-800'}`}
                                                        >
                                                            {opt.label}
                                                            {queryPayload.sort === opt.key && <Check className="w-3.5 h-3.5" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <button onClick={() => { setShowFilterModal(true); setSelectedFilterDraft(queryPayload.filters || {}); }} className="relative flex items-center justify-center hover:text-white transition-colors">
                                        <Filter className="w-4 h-4" />
                                        {activeFiltersCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full" />}
                                    </button>
                                    <button onClick={() => { setIsSearchExpanded(true); setTimeout(() => searchInputRef.current?.focus(), 50); }} className="flex items-center justify-center hover:text-white transition-colors">
                                        <Search className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Search Box (Replaces Zone 2 entirely) */
                            <div className="flex items-center gap-3 h-full animate-in slide-in-from-right-3 duration-150">
                                <div className="flex-1 bg-zinc-900/50 border border-zinc-800/60 focus-within:border-indigo-500 transition-colors rounded-lg px-3 h-full flex items-center gap-2">
                                    <Search className="w-4 h-4 text-zinc-500" />
                                    <input 
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Search parameters..."
                                        defaultValue={queryPayload.search}
                                        onChange={handleSearchTextChange}
                                        onKeyDown={(e) => e.key === 'Enter' && searchInputRef.current?.blur()}
                                        className="bg-transparent text-sm text-white outline-none w-full placeholder:text-zinc-500"
                                    />
                                    {searchInputRef.current?.value && (
                                        <button onClick={() => { if(searchInputRef.current) searchInputRef.current.value = ''; setQueryPayload(prev => ({...prev, search: '', page: 0})); }}>
                                            <X className="w-4 h-4 text-zinc-500" />
                                        </button>
                                    )}
                                </div>
                                <button onClick={handleCancelSearch} className="text-xs font-bold text-zinc-400">
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
            <main className="flex-1 px-4 max-w-md lg:max-w-6xl mx-auto w-full space-y-5 pt-3 animate-in fade-in duration-300">
                {selectedCustomerContext && !isEditMode ? (
                    <div className="animate-in slide-in-from-right duration-300 pb-20 w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Left Column: Details & Parameters */}
                        <div className="lg:col-span-5 space-y-3">
                            
                            {/* Actions Row */}
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => { const targetId = selectedCustomerContext.id; setSelectedCustomerContext(null); handleMessageClick(new Set([targetId])); }} className="px-4 py-2 bg-[#128C7E] hover:bg-[#0e7569] text-white font-bold rounded-xl text-xs flex items-center gap-2 outline-none transition-colors shadow-lg shadow-[#128C7E]/20">
                                    <MessageCircle className="w-4 h-4" /> Message
                                </button>
                                <button onClick={() => { setIsEditMode(true); setEditFormDraft(selectedCustomerContext); }} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 outline-none transition-colors">
                                    <Edit2 className="w-4 h-4" /> Edit
                                </button>
                                <button onClick={() => setShowDeactivationConfirm(true)} className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold rounded-xl text-xs flex items-center gap-2 outline-none transition-colors">
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                            </div>

                            {/* Profile & Status Card */}
                            <div className="bg-gradient-to-b from-zinc-900/80 to-zinc-900/30 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                                    <Users className="w-32 h-32" />
                                </div>
                                
                                <div className="flex items-center gap-4 mb-8 relative z-10">
                                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 font-black text-2xl flex items-center justify-center uppercase shrink-0 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                                        {selectedCustomerContext.name.substring(0, 2)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-xl font-black text-white tracking-tight truncate">{selectedCustomerContext.name}</h3>
                                        <p className="text-sm text-zinc-400 font-mono mt-1 flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5" />
                                            {selectedCustomerContext.phone}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 relative z-10 mb-6">
                                    <div className="bg-[#0f0f0f]/60 rounded-2xl p-4 border border-zinc-800/40 hover:border-zinc-700/50 transition-colors">
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Account Status</span>
                                        <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                                            selectedCustomerContext.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-450' : 'bg-zinc-800 text-zinc-500'
                                        }`}>
                                            {selectedCustomerContext.status}
                                        </span>
                                    </div>
                                    <div className="bg-[#0f0f0f]/60 rounded-2xl p-4 border border-zinc-800/40 hover:border-zinc-700/50 transition-colors">
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Payment Status</span>
                                        <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                                            selectedCustomerContext.paymentStatus === 'PAID' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-rose-500/10 text-rose-400'
                                        }`}>
                                            {selectedCustomerContext.paymentStatus}
                                        </span>
                                    </div>
                                    <div className="bg-[#0f0f0f]/60 rounded-2xl p-4 border border-zinc-800/40 hover:border-zinc-700/50 transition-colors">
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Expiry Date</span>
                                        <span className="text-sm font-bold text-zinc-300 font-mono">{selectedCustomerContext.expiryDate}</span>
                                    </div>
                                    <div className="bg-[#0f0f0f]/60 rounded-2xl p-4 border border-zinc-800/40 hover:border-zinc-700/50 transition-colors">
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Valuation</span>
                                        <span className="text-sm font-bold text-emerald-400 font-mono">₹{selectedCustomerContext.amount}</span>
                                    </div>
                                </div>

                                {/* Additional Parameters */}
                                {selectedCustomerContext.additionalDetails && parseDetailsFromPayload(selectedCustomerContext.additionalDetails).length > 0 && (
                                    <div className="pt-4 border-t border-zinc-800/60 relative z-10">
                                        <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <FileText className="w-3.5 h-3.5" /> Additional Parameters
                                        </h4>
                                        <div className="flex flex-col gap-1">
                                            {parseDetailsFromPayload(selectedCustomerContext.additionalDetails).map(({ key, value }, index) => (
                                                <div key={index} className="flex justify-between items-center py-2 border-b border-zinc-800/40 last:border-0">
                                                    <span className="text-[11px] text-zinc-300 font-bold uppercase tracking-wider pr-4">{key}</span>
                                                    <span className="text-xs font-bold text-white text-right truncate max-w-[60%] font-mono">{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Payments */}
                        <div className="lg:col-span-7 space-y-6 pt-0 lg:pt-11">
                            {/* Payment History Card */}
                            <div className="bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-black text-sm text-zinc-200 uppercase tracking-widest flex items-center gap-2">
                                        <CheckSquare className="w-4 h-4 text-emerald-500" /> Payment History
                                    </h3>
                                    {selectedCustomerContext.payments && selectedCustomerContext.payments.length > 0 && (
                                        <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/50 px-2.5 py-1 rounded-md uppercase tracking-wider border border-zinc-700/50">
                                            {selectedCustomerContext.payments.length} Records
                                        </span>
                                    )}
                                </div>
                                
                                {selectedCustomerContext.payments && selectedCustomerContext.payments.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedCustomerContext.payments.map((payment, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => handlePaymentRecordClick(payment)}
                                                className="bg-[#0f0f0f]/80 p-4 rounded-2xl border border-zinc-800/60 flex flex-col gap-2 relative overflow-hidden transition-all hover:border-indigo-500/50 cursor-pointer active:scale-[0.99] shadow-sm hover:shadow-[0_0_15px_rgba(99,102,241,0.05)]"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex gap-3 items-center">
                                                        <span className="text-zinc-600 font-black text-l w-6">{String(selectedCustomerContext.payments!.length - idx).padStart(2, '0')}</span>
                                                        <div>
                                                            <p className="text-[11px] text-zinc-300 font-bold tracking-wider">{new Date(payment.confirmedAt || payment.completedAt || new Date()).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-base font-black text-emerald-400 font-mono">₹{payment.amount}</p>
                                                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">{payment.paymentMode}</p>
                                                    </div>
                                                </div>
                                                {payment.comments && (
                                                    <div className="pt-3 border-t border-zinc-800/40 mt-1.5">
                                                        <p className="text-[10px] text-zinc-400 leading-relaxed break-words">
                                                            {payment.comments}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-[#0f0f0f]/40 rounded-2xl border border-zinc-800/30 flex flex-col items-center justify-center gap-2">
                                        <FileText className="w-8 h-8 text-zinc-700" />
                                        <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold mt-2">No payment history</p>
                                        <p className="text-zinc-600 text-[10px]">There are no recorded transactions for this account.</p>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                ) : (
                    <>

                {/* ZONE 3: SELECT ALL & BATCH MESSAGE ACTION */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        {/* No borders, just icon and text */}
                        <button onClick={toggleGlobalSelectAll} className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                            {isGlobalSelectAllActive ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-zinc-500" />}
                            SELECT LEDGER TOTAL
                        </button>
                        {selectedCustomerIds.size > 0 && (
                            <span className="text-xs font-mono text-zinc-400">
                                SELECTED: {selectedCustomerIds.size}
                            </span>
                        )}
                    </div>

                    {/* Renders ONLY if at least 1 customer is selected, uses precise WhatsApp green */}
                    {selectedCustomerIds.size > 0 && (
                        <button 
                            onClick={() => handleMessageClick()}
                            className="w-full bg-[#128C7E] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#128C7E]/20 animate-in fade-in zoom-in-95 duration-200"
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
                                <div key={`${key}-${pill}`} className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-mono text-zinc-300">
                                    <span className="text-[9px] font-bold text-zinc-555 uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
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
                                        className="hover:text-red-400 border-0 outline-none bg-transparent cursor-pointer p-0.5"
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
                    {loading && customers.length === 0 ? (
                        <div className="py-20 text-center flex flex-col items-center gap-2 text-zinc-500 text-xs font-mono">
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" /> LOADING DIRECTORY...
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="py-16 text-center text-zinc-500 text-sm">
                            No records match current parameters.
                        </div>
                    ) : (
                        customers.map((customer) => {
                            const isChecked = selectedCustomerIds.has(customer.id);
                            
                            // Badge Styles
                            let badgeStyle = '';
                            if (customer.paymentStatus === 'PAID') badgeStyle = 'bg-emerald-500/10 text-emerald-400';
                            if (customer.paymentStatus === 'UNPAID') badgeStyle = 'bg-amber-500/10 text-amber-500';
                            if (customer.paymentStatus === 'OVERDUE') badgeStyle = 'bg-red-500/10 text-red-400';

                            return (
                                <div 
                                    key={customer.id}
                                    onTouchStart={() => handleTouchStart(customer.id)}
                                    onTouchEnd={handleTouchEnd}
                                    onMouseDown={() => handleTouchStart(customer.id)}
                                    onMouseUp={handleTouchEnd}
                                    onClick={() => isSelectionModeActive ? handleRowCheckboxToggle(customer.id) : openCustomerDetails(customer.id)}
                                    className={`w-full bg-zinc-900/40 hover:bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/60 flex items-center justify-between gap-3 transition-colors cursor-pointer ${isChecked ? 'ring-1 ring-indigo-500 bg-zinc-900/60' : ''}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {isSelectionModeActive && (
                                            <div className="shrink-0">
                                                {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-zinc-600" />}
                                            </div>
                                        )}
                                        
                                        <div className="w-10 h-10 rounded-lg bg-[#0f0f0f] font-bold text-xs text-zinc-400 flex items-center justify-center uppercase shrink-0">
                                            {customer.name.substring(0, 2)}
                                        </div>

                                        <div className="min-w-0">
                                            <h4 className="text-sm font-bold text-zinc-200 truncate">{customer.name}</h4>
                                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{customer.phone}</p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0 space-y-1">
                                        <div className="text-sm font-bold text-zinc-100">₹{customer.amount}</div>
                                        <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded ${badgeStyle}`}>
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
                    <footer className="flex items-center justify-between pt-2 pb-6 text-xs text-zinc-500 font-bold tracking-wider">
                        <button 
                            disabled={queryPayload.page === 0 || loading}
                            onClick={() => setQueryPayload(prev => ({ ...prev, page: prev.page - 1 }))}
                            className="px-4 py-2 bg-zinc-900 rounded-lg disabled:opacity-30"
                        >
                            PREV
                        </button>
                        <span>PAGE {queryPayload.page + 1} OF {totalPages}</span>
                        <button 
                            disabled={queryPayload.page + 1 >= totalPages || loading}
                            onClick={() => setQueryPayload(prev => ({ ...prev, page: prev.page + 1 }))}
                            className="px-4 py-2 bg-zinc-900 rounded-lg disabled:opacity-30"
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
                    <div className="absolute inset-0 bg-[#0f0f0f]/80 backdrop-blur-sm" onClick={() => setShowFilterModal(false)} />
                    <div className="relative bg-zinc-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-6 animate-in slide-in-from-bottom-10 duration-200">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                            <h3 className="font-bold text-base flex items-center gap-2"><Filter className="w-4 h-4 text-indigo-500" /> Filters</h3>
                            <button onClick={() => setShowFilterModal(false)} className="text-zinc-500"><X className="w-5 h-5" /></button>
                        </div>
                        
                        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
                            {/* Section 1: Filters (mainFilters) */}
                            {Object.keys(filters.mainFilters || {}).length > 0 && (
                                <div className="space-y-4">
                                    {Object.entries(filters.mainFilters || {}).map(([category, options]) => (
                                        <div key={category} className="space-y-2">
                                            <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">
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
                                                            className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-colors truncate ${isSelected ? 'bg-indigo-600 text-white' : 'bg-[#0f0f0f] text-zinc-400 hover:text-zinc-200'}`}
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
                                <div className="space-y-4 pt-4 border-t border-zinc-800/60">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Custom Filter</span>
                                    {Object.entries(filters.customFilters || {}).map(([category, options]) => (
                                        <div key={category} className="space-y-2">
                                            <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">
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
                                                            className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-colors truncate ${isSelected ? 'bg-indigo-600 text-white' : 'bg-[#0f0f0f] text-zinc-400 hover:text-zinc-200'}`}
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
                            className="w-full bg-white text-black font-bold py-3.5 rounded-xl text-sm"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            )}



            {/* DETAILS & EDIT MODAL (Legacy Popup repurposed for Edit Mode) */}
            {selectedCustomerContext && isEditMode && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0">
                    <div className="absolute inset-0 bg-[#0f0f0f]/80 backdrop-blur-sm" onClick={() => setIsEditMode(false)} />
                    <div className="relative bg-[#0f0f0f] border border-zinc-800/60 w-full max-w-3xl rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88vh]">
                        
                        <div className="p-4 flex items-center justify-between bg-[#0f0f0f]/50">
                            <h3 className="font-bold text-sm text-zinc-300">
                                Edit Record
                            </h3>
                            <button type="button" onClick={() => setIsEditMode(false)} className="text-zinc-400"><X className="w-5 h-5" /></button>
                        </div>

                        <form onSubmit={commitDirectManualUpdate} id="contextForm" className="p-5 overflow-y-auto flex-1 text-sm space-y-5">
                            {/* 1. Header Profile & Status Toggle */}
                            <div className="flex items-center justify-between p-1 rounded-2.5rem pr-4 shadow-sm bg-[#0f0f0f]/20">
                                <div className="flex items-center gap-3 w-full min-w-0 mr-2">
                                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 font-bold text-sm flex items-center justify-center uppercase shrink-0 border border-indigo-500/20">
                                        {(isEditMode ? editFormDraft?.name || 'C' : selectedCustomerContext.name).substring(0, 2)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        {!isEditMode ? (
                                            <>
                                                <h2 className="text-sm font-bold text-white truncate">{selectedCustomerContext.name}</h2>
                                                <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                                                    <Phone className="w-3 h-3 text-zinc-600" /> {selectedCustomerContext.phone}
                                                </p>
                                            </>
                                        ) : (
                                            <div className="space-y-1.5 w-full">
                                                <input 
                                                    type="text" 
                                                    required 
                                                    value={editFormDraft?.name || ''} 
                                                    onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, name: e.target.value } : null)} 
                                                    className="w-full bg-[#0f0f0f] border border-zinc-800 p-2 rounded-xl text-xs text-white font-bold outline-none focus:border-indigo-500" 
                                                    placeholder="Name"
                                                />
                                                <input 
                                                    type="text" 
                                                    required 
                                                    value={editFormDraft?.phone || ''} 
                                                    onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, phone: e.target.value } : null)} 
                                                    className="w-full bg-[#0f0f0f] border border-zinc-800 p-2 rounded-xl text-[10px] text-zinc-300 font-mono outline-none focus:border-indigo-500" 
                                                    placeholder="Phone"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Customer status toggle switch */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                                        (isEditMode ? editFormDraft?.status : selectedCustomerContext.status) === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-450' : 'bg-zinc-800 text-zinc-500'
                                    }`}>
                                        {isEditMode ? editFormDraft?.status : selectedCustomerContext.status}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isEditMode) {
                                                const nextStatus = (editFormDraft?.status === 'ACTIVE') ? 'INACTIVE' : 'ACTIVE';
                                                setEditFormDraft(prev => prev ? { ...prev, status: nextStatus } : null);
                                            } else {
                                                handleCustomerStatusToggle();
                                            }
                                        }}
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            ((isEditMode ? editFormDraft?.status : selectedCustomerContext.status) === 'ACTIVE') ? 'bg-indigo-600' : 'bg-zinc-800'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                ((isEditMode ? editFormDraft?.status : selectedCustomerContext.status) === 'ACTIVE') ? 'translate-x-4' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* 2. Core Details Matrix */}
                            <div className="bg-[#0f0f0f] p-4 rounded-2xl shadow-sm space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-[9px] font-bold text-zinc-500 block uppercase tracking-wider mb-1 ml-0.5">Expiry Date</span>
                                        {!isEditMode ? (
                                            <span className="text-xs font-black text-zinc-350 font-mono">{selectedCustomerContext.expiryDate}</span>
                                        ) : (
                                            <input 
                                                type="date" 
                                                required 
                                                value={editFormDraft?.expiryDate || ''} 
                                                onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, expiryDate: e.target.value } : null)} 
                                                className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-xl text-xs text-zinc-350 font-mono font-bold outline-none focus:border-indigo-500" 
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold text-zinc-500 block uppercase tracking-wider mb-1 ml-0.5">Subscription Amount</span>
                                        {!isEditMode ? (
                                            <span className="text-base font-black text-white font-mono">₹{selectedCustomerContext.amount}</span>
                                        ) : (
                                            <input 
                                                type="number" 
                                                required 
                                                value={editFormDraft?.amount ?? 0} 
                                                onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, amount: Number(e.target.value) } : null)} 
                                                className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-xl text-xs text-white font-mono font-bold outline-none focus:border-indigo-500" 
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 3. Toggles Matrix (Payment Status Dropdown & Notification Status) */}
                            <div className="p-4 bg-[#0f0f0f]/40 rounded-2xl space-y-3.5 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-zinc-400">Payment Status</span>
                                    {!isEditMode ? (
                                        <select 
                                            value={selectedCustomerContext.paymentStatus || 'UNPAID'} 
                                            onChange={(e) => {
                                                const nextVal = e.target.value as 'PAID' | 'UNPAID' | 'OVERDUE';
                                                if (nextVal === 'PAID') {
                                                    triggerPaymentModalForCustomer(selectedCustomerContext);
                                                } else {
                                                    handlePaymentStatusChange(nextVal);
                                                }
                                            }}
                                            className="bg-zinc-900 border border-zinc-800 p-2 rounded-xl text-xs text-white font-bold outline-none focus:border-indigo-500 cursor-pointer"
                                        >
                                            <option value="PAID">Paid</option>
                                            <option value="UNPAID">Unpaid</option>
                                            <option value="OVERDUE">Overdue</option>
                                        </select>
                                    ) : (
                                        <select 
                                            value={editFormDraft?.paymentStatus || 'UNPAID'} 
                                            onChange={(e) => {
                                                const nextVal = e.target.value as 'PAID' | 'UNPAID' | 'OVERDUE';
                                                if (nextVal === 'PAID') {
                                                    triggerPaymentModalForCustomer(editFormDraft || selectedCustomerContext);
                                                } else {
                                                    setEditFormDraft(prev => prev ? { ...prev, paymentStatus: nextVal } : null);
                                                }
                                            }}
                                            className="bg-zinc-900 border border-zinc-800 p-2 rounded-xl text-xs text-white font-bold outline-none focus:border-indigo-500 cursor-pointer"
                                        >
                                            <option value="PAID">Paid</option>
                                            <option value="UNPAID">Unpaid</option>
                                            <option value="OVERDUE">Overdue</option>
                                        </select>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-zinc-900/40">
                                    <span className="text-xs font-bold text-zinc-400">Notification Alerts</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider ${
                                            (isEditMode ? editFormDraft?.notificationStatus : selectedCustomerContext.notificationStatus) === 'ACTIVE' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-800 text-zinc-500'
                                        }`}>
                                            {isEditMode ? (editFormDraft?.notificationStatus || 'ACTIVE') : (selectedCustomerContext.notificationStatus || 'ACTIVE')}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (isEditMode) {
                                                    const nextNotif = (editFormDraft?.notificationStatus || 'ACTIVE') === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                                                    setEditFormDraft(prev => prev ? { ...prev, notificationStatus: nextNotif } : null);
                                                } else {
                                                    handleNotificationStatusToggle();
                                                }
                                            }}
                                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                (isEditMode ? (editFormDraft?.notificationStatus || 'ACTIVE') : (selectedCustomerContext.notificationStatus || 'ACTIVE')) === 'ACTIVE' ? 'bg-indigo-600' : 'bg-zinc-700'
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                    (isEditMode ? (editFormDraft?.notificationStatus || 'ACTIVE') : (selectedCustomerContext.notificationStatus || 'ACTIVE')) === 'ACTIVE' ? 'translate-x-4' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Scrollable Additional Parameters List */}
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block ml-0.5">Additional Info Parameters</span>
                                
                                {((isEditMode ? editFormDraft?.additionalDetails : selectedCustomerContext.additionalDetails) && parseDetailsFromPayload(isEditMode ? editFormDraft?.additionalDetails : selectedCustomerContext.additionalDetails).length > 0) ? (
                                    (() => {
                                        const list = parseDetailsFromPayload(isEditMode ? editFormDraft?.additionalDetails : selectedCustomerContext.additionalDetails);
                                        return (
                                            <div className={`space-y-2 ${list.length > 4 ? 'max-h-[220px] overflow-y-auto pr-1' : ''}`}>
                                                {list.map(({ key, value }, index) => (
                                                    <div 
                                                        key={`${key}-${value}-${index}`} 
                                                        className="flex items-center justify-between p-3.5 bg-[#0f0f0f] rounded-2xl shadow-sm border border-zinc-900/40 text-xs hover:bg-zinc-900/20 transition-all duration-150"
                                                    >
                                                        <span className="text-zinc-400 font-semibold uppercase text-[10px] tracking-wider truncate pr-2 max-w-[150px]">{key}</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-zinc-200 font-bold font-mono text-xs truncate max-w-[150px]">{value}</span>
                                                            {isEditMode && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (editFormDraft) {
                                                                            const currentList = parseDetailsFromPayload(editFormDraft.additionalDetails);
                                                                            const nextList = currentList.filter((_, i) => i !== index);
                                                                            const nextDetails = compileDetailsToPayload(nextList);
                                                                            setEditFormDraft({ ...editFormDraft, additionalDetails: nextDetails });
                                                                        }
                                                                    }}
                                                                    className="text-rose-500 hover:text-rose-450 hover:bg-rose-500/10 p-1 rounded-md transition-colors border-0 outline-none bg-transparent cursor-pointer shrink-0"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <div className="text-center py-5 bg-[#0f0f0f]/40 rounded-2xl text-zinc-500 text-xs italic shadow-sm">
                                        No additional parameters registered.
                                    </div>
                                )}
                            </div>

                            {/* 5. Add details inline button & form */}
                            {isEditMode && (
                                <>
                                    {!showDetailForm ? (
                                        <button
                                            type="button"
                                            onClick={() => {fetchApiDetailsData(); setShowDetailForm(true)}}
                                            className="w-full bg-[#0f0f0f] hover:bg-zinc-900 border-0 text-zinc-350 hover:text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                                        >
                                            + Add Additional Detail
                                        </button>
                                    ) : (
                                        <div className="p-4 bg-[#0f0f0f] rounded-2xl space-y-3 shadow-inner relative animate-in slide-in-from-bottom-2 duration-150">
                                            <span className="text-[9px] font-bold text-zinc-500 block uppercase tracking-wider mb-1 ml-0.5">New Parameter Field</span>
                                            <div className="grid grid-cols-2 gap-2.5">
                                                {/* Key */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Detail Name"
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
                                                        className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-emerald-500 transition-colors"
                                                    />
                                                    {detailsDropdownField === 'key' && apiDetailsData && (
                                                        <div className="absolute left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-2xl z-50 max-h-32 overflow-y-auto">
                                                            {Object.keys(apiDetailsData)
                                                                .filter(k => k.toLowerCase().includes(newDetailKey.toLowerCase()))
                                                                .map(k => (
                                                                    <button
                                                                        key={k}
                                                                        type="button"
                                                                        onMouseDown={() => {
                                                                            setNewDetailKey(k);
                                                                            if (apiDetailsData[k]) setNewDetailVal(apiDetailsData[k]);
                                                                        }}
                                                                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-800 rounded text-zinc-300 font-medium"
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
                                                        className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-emerald-500 transition-colors"
                                                    />
                                                    {detailsDropdownField === 'value' && apiDetailsData && newDetailKey && apiDetailsData[newDetailKey] && (
                                                        <div className="absolute left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-2xl z-50 max-h-32 overflow-y-auto">
                                                            <button
                                                                key="suggested"
                                                                type="button"
                                                                onMouseDown={() => setNewDetailVal(apiDetailsData[newDetailKey])}
                                                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-800 rounded text-emerald-400 font-bold flex items-center justify-between"
                                                            >
                                                                <span>{apiDetailsData[newDetailKey]}</span>
                                                                <span className="text-[8px] uppercase bg-emerald-500/10 text-emerald-555 px-1 py-0.5 rounded font-black">Suggested</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDetailForm(false)}
                                                    className="w-1/3 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 py-2 rounded-xl text-xs font-bold transition-colors"
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
                                </>
                            )}
                        </form>

                        <div className="p-4 bg-[#0f0f0f]/50 flex gap-3">
                            {!isEditMode ? (
                                <>
                                    <button onClick={() => setIsEditMode(true)} className="w-1/2 bg-zinc-900 text-zinc-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                                        <Edit2 className="w-4 h-4" /> Edit
                                    </button>
                                    <button onClick={() => { const targetId = selectedCustomerContext.id; setSelectedCustomerContext(null); handleMessageClick(new Set([targetId])); }} className="w-1/2 bg-[#128C7E] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                                        <MessageCircle className="w-4 h-4" /> Message
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" onClick={() => setIsEditMode(false)} className="w-1/3 bg-zinc-900 text-zinc-400 font-bold py-3 rounded-xl">Cancel</button>
                                    <button type="submit" form="contextForm" className="w-2/3 bg-indigo-600 text-white font-bold py-3 rounded-xl">Save Changes</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOMER DEACTIVATION DUAL-CONFIRM DIALOG OVERLAY */}
            {showDeactivationConfirm && selectedCustomerContext && (
                <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f0f0f]/90 backdrop-blur-sm" onClick={() => setShowDeactivationConfirm(false)} />
                    <div className="relative bg-zinc-900 w-full max-w-sm rounded-[2rem] p-6 space-y-5 text-center animate-in zoom-in-95 duration-150 shadow-2xl z-50">
                        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                            <Trash2 className="w-5 h-5 absolute" />
                            <Trash2 className="w-5 h-5 animate-ping" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-zinc-200">Confirm Deletion</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                confirm deleting the {selectedCustomerContext.name}, the customer will no longer recieve automatic notifications and business tracking
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                type="button"
                                onClick={() => setShowDeactivationConfirm(false)}
                                className="w-1/2 bg-[#0f0f0f] hover:bg-zinc-900 text-zinc-400 font-bold py-3 rounded-xl text-xs"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    setShowDeactivationConfirm(false);
                                    commitCustomerStatusChange('INACTIVE');
                                }}
                                className="w-1/2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-red-600/10"
                            >
                                Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* BOTTOM NAV BAR INTERACTION ACTION REGISTRY */}
            <div className="fixed bottom-5 left-0 lg:left-64 right-0 z-10 pointer-events-none flex justify-center animate-in fade-in duration-200">
                <div className="w-full px-4 max-w-md pointer-events-auto">
                    {selectedCustomerContext && !isEditMode ? (
                        <button 
                            onClick={() => setSelectedCustomerContext(null)}
                            className="w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-xl shadow-black"
                        >
                            <ArrowLeft className="w-4 h-4 text-zinc-400" /> Go Back
                        </button>
                    ) : preSelectedTemplate ? (
                        <button 
                            onClick={() => navigate('/payping/message-templates')}
                            className="w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-xl shadow-black"
                        >
                            <X className="w-4 h-4 text-zinc-400" /> Cancel Customer Selection
                        </button>
                    ) : (
                        <button 
                            onClick={() => navigate('/payping/dashboard')}
                            className="w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-xl shadow-black"
                        >
                            <LayoutDashboard className="w-4 h-4 text-zinc-400" /> Return to Dashboard
                        </button>
                    )}
                </div>
            </div>

            {/* ======================================================= */}
            {/* FULL INLINE TEMPLATE VIEW MODAL INJECTED TEMPLATE PICKER */}
            {/* ======================================================= */}
            {/* FINAL CONFIRMATION MODAL */}
            {showConfirmationModal && preSelectedTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f0f0f]/90 backdrop-blur-sm" onClick={() => setShowConfirmationModal(false)} />
                    <div className="relative bg-zinc-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-zinc-800 z-50 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                <MessageCircle className="w-5 h-5 text-[#128C7E]" /> Confirm Dispatch
                            </h3>
                            <button onClick={() => setShowConfirmationModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-5">
                            {/* Alert Name Input */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Alert Name <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    value={alertName}
                                    onChange={(e) => setAlertName(e.target.value)}
                                    placeholder="e.g. Monthly Payment Reminder"
                                    className="w-full bg-[#050505] border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-indigo-500 outline-none transition-colors"
                                />
                            </div>

                            {/* Selected Template Info */}
                            <div className="bg-[#050505] border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                                <div className="min-w-0 pr-4">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Template</p>
                                    <p className="text-sm text-zinc-200 font-medium truncate">{preSelectedTemplate.name}</p>
                                </div>
                                <button 
                                    onClick={() => navigate('/payping/message-templates', { state: { preSelectedCustomerIds: Array.from(selectedCustomerIds) } })}
                                    className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 font-bold px-3 py-1.5 bg-indigo-500/10 rounded-lg transition-colors"
                                >
                                    Modify
                                </button>
                            </div>

                            {/* Selected Customers Info */}
                            <div className="bg-[#050505] border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                                <div className="min-w-0 pr-4">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Customers</p>
                                    <p className="text-sm text-zinc-200 font-medium">{selectedCustomerIds.size} recipient(s) selected</p>
                                </div>
                                <button 
                                    onClick={() => setShowConfirmationModal(false)}
                                    className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 font-bold px-3 py-1.5 bg-indigo-500/10 rounded-lg transition-colors"
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
                                className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all ${
                                    !alertName.trim() || isSending 
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                                    : 'bg-[#128C7E] hover:bg-[#0e7569] text-white shadow-lg shadow-[#128C7E]/20'
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
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0">
                    <div className="absolute inset-0 bg-[#0f0f0f]/80 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)} />
                    <div className="relative bg-[#0f0f0f] border border-zinc-800/60 w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
                        
                        <div className="p-4 flex items-center justify-between border-b border-zinc-900 bg-[#0f0f0f]/50">
                            <h3 className="font-bold text-sm text-zinc-305">
                                {paymentModalMode === 'create' 
                                    ? `Update ${(editFormDraft || selectedCustomerContext)?.name || ''} payment status` 
                                    : `Payment Details - ${(editFormDraft || selectedCustomerContext)?.name || ''}`
                                }
                            </h3>
                            <button type="button" onClick={() => setShowPaymentModal(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>

                        <form onSubmit={submitPaymentDetails} className="p-5 overflow-y-auto flex-1 text-sm space-y-4">
                            {paymentModalMode === 'create' && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs font-semibold leading-relaxed flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                    <span>Please update the new expiry date for the next cycle.</span>
                                </div>
                            )}

                            {/* New Expiry Date */}
                            {paymentModalMode === 'create' ? (
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">New Expiry Date <span className="text-rose-500">*</span></label>
                                    <input 
                                        type="date"
                                        required
                                        value={paymentForm.expiryDate}
                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                                        className="w-full bg-[#050505] border border-zinc-800 p-3.5 rounded-xl text-white font-mono font-bold outline-none focus:border-indigo-500 transition-colors"
                                    />
                                    {!isFutureDate(paymentForm.expiryDate) && paymentForm.expiryDate && (
                                        <p className="text-[10px] text-rose-400 font-bold ml-1">Expiry date must be in the future.</p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 font-bold">Confirmed Time</label>
                                    <div className="w-full bg-[#050505] border border-zinc-800 p-3.5 rounded-xl text-zinc-300 font-bold">
                                        {selectedPaymentRecord ? formatPaymentTimestamp(selectedPaymentRecord.confirmedAt || selectedPaymentRecord.completedAt || '') : ''}
                                    </div>
                                </div>
                            )}

                            {/* Paid Amount */}
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                                    {paymentModalMode === 'create' ? 'Paid Amount (₹)' : 'Paid Amount'}
                                </label>
                                <input 
                                    type="number"
                                    required
                                    readOnly={paymentModalMode === 'view'}
                                    value={paymentForm.amount || ''}
                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                                    className={`w-full bg-[#050505] border border-zinc-800 p-3.5 rounded-xl text-white font-mono font-bold outline-none focus:border-indigo-500 transition-colors ${paymentModalMode === 'view' ? 'text-zinc-400 select-none' : ''}`}
                                />
                            </div>

                            {/* Payment Mode */}
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Mode</label>
                                {paymentModalMode === 'create' ? (
                                    <select
                                        value={paymentForm.paymentMode}
                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMode: e.target.value }))}
                                        className="w-full bg-[#050505] border border-zinc-800 p-3.5 rounded-xl text-white font-bold outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                                    >
                                        {paymentModes.map(mode => (
                                            <option key={mode} value={mode}>{mode}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="w-full bg-[#050505] border border-zinc-800 p-3.5 rounded-xl text-zinc-300 font-bold">
                                        {paymentForm.paymentMode}
                                    </div>
                                )}
                            </div>

                            {/* Comments */}
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 font-bold font-bold">Comments</label>
                                <textarea
                                    readOnly={paymentModalMode === 'view'}
                                    value={paymentForm.comments}
                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, comments: e.target.value }))}
                                    placeholder={paymentModalMode === 'create' ? "Add payment comments (e.g. transaction ref, cash notes)..." : "No comments."}
                                    rows={3}
                                    className={`w-full bg-[#050505] border border-zinc-800 p-3.5 rounded-xl text-white outline-none focus:border-indigo-500 transition-colors resize-none ${paymentModalMode === 'view' ? 'text-zinc-400 select-none' : ''}`}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-3">
                                <button 
                                    type="button" 
                                    onClick={() => setShowPaymentModal(false)}
                                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 rounded-xl text-xs transition-colors"
                                >
                                    {paymentModalMode === 'create' ? 'Cancel' : 'Close'}
                                </button>
                                {paymentModalMode === 'create' && (
                                    <button 
                                        type="submit" 
                                        disabled={!paymentForm.amount || !paymentForm.expiryDate || !isFutureDate(paymentForm.expiryDate)}
                                        className={`flex-1 font-bold py-3.5 rounded-xl text-xs transition-all ${
                                            (!paymentForm.amount || !paymentForm.expiryDate || !isFutureDate(paymentForm.expiryDate))
                                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
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
                    className={`fixed inset-0 z-40 bg-[#0f0f0f] overflow-y-auto ${isAddCustomersClosing ? 'animate-out slide-out-to-left duration-300' : 'animate-in slide-in-from-left duration-300'}`}
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