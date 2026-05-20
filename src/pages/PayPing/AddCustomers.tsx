import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Users, Upload, UserPlus, ArrowRight, Download, 
    FileText, X, Check, AlertCircle, RefreshCw 
} from 'lucide-react';
import api from '../../api';

interface CustomerDTO {
    name: string;
    phone: string;
    amount: number;
    expiryDate: string;
}

const AddCustomers = () => {
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
    const [manualForm, setManualForm] = useState<CustomerDTO>({
        name: '',
        phone: '',
        amount: 0,
        expiryDate: ''
    });

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

        try {
            // Step A: Security Guard Interceptor Pre-Validation Check
            const validationRes = await api.post('/payping/customers/canAdd', manualForm);
            const validationMsg = validationRes.data;

            if (validationMsg === "success" || validationMsg.status === "success") {
                // Step B: Structural safe insert transaction
                await api.post('/payping/customers/add', manualForm);
                setShowManualModal(false);
                setManualForm({ name: '', phone: '', amount: 0, expiryDate: '' });
                await fetchCurrentCustomerCount();
            } else {
                alert(`Pre-validation rejected entry: ${validationMsg.message || validationMsg}`);
            }
        } catch (err: any) {
            alert(err.response?.data?.message || "Execution exception error occurred.");
        } finally {
            setGlobalLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center animate-in fade-in duration-300 relative overflow-hidden">

            {/* Structural UI Container Card */}
            <div className="max-w-xl w-full bg-slate-900 p-8 md:p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl text-center z-10 space-y-8">
                
                {/* Branding Core Context Header */}
                <div className="space-y-3">
                    <div className="inline-flex p-3.5 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-500 mx-auto">
                        <Users className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight">Populate Directory</h2>
                    <p className="text-sm text-slate-400 max-w-sm mx-auto">
                        Begin populating accounts to initiate tracking. Current ledger density:
                    </p>
                    
                    {/* Realtime Aggregation Dynamic Tag Counter */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-950 border border-slate-800 rounded-full mt-1">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                        <span className="text-xs font-mono tracking-wider text-slate-400">
                            SYSTEM TOTAL: <span className="text-white font-bold">{totalCount}</span> CONSUMERS
                        </span>
                    </div>
                </div>

                {/* Tactical Operation Options Grid Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Action Card Selector A: Bulk CSV Upload */}
                    <button 
                        onClick={() => setShowBulkModal(true)}
                        className="flex flex-col items-center justify-center p-6 bg-slate-950/40 hover:bg-slate-950 border border-slate-800/80 hover:border-blue-500/50 rounded-3xl transition-all duration-300 group space-y-3 text-center"
                    >
                        <div className="p-3 bg-blue-500/5 group-hover:bg-blue-500/10 rounded-xl text-blue-500 transition-colors">
                            <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-left w-full text-center">
                            <h4 className="font-bold text-sm text-slate-200">Bulk Directory Ingest</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">Parse structured spreadsheet matrices instantly.</p>
                        </div>
                    </button>

                    {/* Action Card Selector B: Manual Ingestion Form */}
                    <button 
                        onClick={() => setShowManualModal(true)}
                        className="flex flex-col items-center justify-center p-6 bg-slate-950/40 hover:bg-slate-950 border border-slate-800/80 hover:border-emerald-500/50 rounded-3xl transition-all duration-300 group space-y-3 text-center"
                    >
                        <div className="p-3 bg-emerald-500/5 group-hover:bg-emerald-500/10 rounded-xl text-emerald-500 transition-colors">
                            <UserPlus className="w-6 h-6" />
                        </div>
                        <div className="text-left w-full text-center">
                            <h4 className="font-bold text-sm text-slate-200">Manual Direct Entry</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">Input independent specific clients variables.</p>
                        </div>
                    </button>
                </div>

                {/* Navigation Terminal Workspace Dashboard Exit Action Button */}
                <div className="border-t border-slate-800/60 pt-6">
                    <button 
                        onClick={() => navigate('/payping/dashboard')}
                        className="w-full bg-white hover:bg-slate-200 text-black font-extrabold py-4 rounded-xl flex items-center justify-center transition-all duration-200 group shadow-lg shadow-white/5"
                    >
                        Launch Terminal Dashboard
                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>

            {/* ======================================================== */}
            {/* POPUP OVERLAY WINDOW 1: ADVANCED BULK INGESTION CONTROL  */}
            {/* ======================================================== */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl max-h-[85vh] flex flex-col shadow-2xl scale-in-center animate-in zoom-in-95 duration-200">
                        
                        {/* Internal Header Modal Bar */}
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Upload className="text-blue-500 w-5 h-5" />
                                <h3 className="font-bold text-lg">Batch Spreadsheet Processor</h3>
                            </div>
                            <button onClick={closeAndResetBulkPipeline} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Asynchronous Window Stage Controller Block Layouts */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {bulkStage === 'select' ? (
                                <div className="space-y-6">
                                    {/* Action Sub-Block: Download Matrix Blueprint */}
                                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <FileText className="text-blue-400 w-8 h-8 shrink-0 mt-0.5" />
                                            <div>
                                                <h5 className="font-bold text-sm">System Scheme File Blueprint</h5>
                                                <p className="text-xs text-slate-500 mt-0.5">Download the formatting layout matrix config before parsing system operations.</p>
                                            </div>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={downloadCsvTemplate}
                                            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 transition-colors shrink-0"
                                        >
                                            <Download className="w-3.5 h-3.5" /> Blueprint
                                        </button>
                                    </div>

                                    {/* Drop Area / Interactive Selection Block Target Window */}
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 bg-slate-950/40 hover:bg-slate-950 p-8 rounded-2xl text-center cursor-pointer transition-all group space-y-3"
                                    >
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={handleFileChange} 
                                            accept=".csv" 
                                            className="hidden" 
                                        />
                                        <div className="p-3 bg-slate-900 rounded-full inline-block text-slate-400 group-hover:text-blue-500 transition-colors">
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-300">
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
                                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-blue-600/10"
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

                                    <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold">
                                                    <th className="p-3.5">TARGET NAME</th>
                                                    <th className="p-3.5">PHONE CONNECTION</th>
                                                    <th className="p-3.5">VALUATION PRICE</th>
                                                    <th className="p-3.5">CHRONO EXPIRY</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-850 font-mono text-slate-300">
                                                {previewCustomers.map((c, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                                                        <td className="p-3.5 font-sans font-medium text-white">{c.name}</td>
                                                        <td className="p-3.5 text-slate-400">{c.phone}</td>
                                                        <td className="p-3.5 text-blue-400 font-semibold">₹{c.amount}</td>
                                                        <td className="p-3.5 text-slate-500">{c.expiryDate}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex items-center gap-3 pt-2">
                                        <button 
                                            onClick={() => setBulkStage('select')}
                                            className="w-1/3 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold py-3.5 rounded-xl transition-colors text-sm"
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
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <form 
                        onSubmit={executeManualCommit}
                        className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl scale-in-center animate-in zoom-in-95 duration-200 overflow-hidden"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <UserPlus className="text-emerald-500 w-5 h-5" />
                                <h3 className="font-bold text-lg">Direct Ingestion Console</h3>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setShowManualModal(false)} 
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Scrollable Form Body Container Inputs */}
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            
                            {/* Input Variable Block: Name */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Client Full Name</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="Jane Doe"
                                    value={manualForm.name}
                                    onChange={(e) => setManualForm({...manualForm, name: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:border-emerald-500 outline-none transition-colors placeholder:text-slate-700 text-sm"
                                />
                            </div>

                            {/* Input Variable Block: Phone */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">WhatsApp Matrix Vector Phone</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="919876543210"
                                    value={manualForm.phone}
                                    onChange={(e) => setManualForm({...manualForm, phone: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:border-emerald-500 outline-none transition-colors placeholder:text-slate-700 text-sm font-mono"
                                />
                            </div>

                            {/* Input Variable Block: Target Flat Fee Price Valuation */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Subscription Valuation Rate (₹)</label>
                                <input 
                                    type="number" 
                                    required
                                    placeholder="2000"
                                    value={manualForm.amount || ''}
                                    onChange={(e) => setManualForm({...manualForm, amount: Number(e.target.value)})}
                                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:border-emerald-500 outline-none transition-colors placeholder:text-slate-700 text-sm"
                                />
                            </div>

                            {/* Input Variable Block: Target Chronological Exp Date Deadline */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Chronological Expiry Milestone</label>
                                <input 
                                    type="date" 
                                    required
                                    value={manualForm.expiryDate}
                                    onChange={(e) => setManualForm({...manualForm, expiryDate: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:border-emerald-500 outline-none transition-colors text-slate-300 text-sm"
                                />
                            </div>
                        </div>

                        {/* Modal Action Transaction Trigger Footer Bar */}
                        <div className="p-6 border-t border-slate-800 bg-slate-950/40">
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

export default AddCustomers;