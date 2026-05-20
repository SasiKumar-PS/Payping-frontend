import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Users, ChevronDown, ArrowUpDown, Filter, Search, X, 
    MessageCircle, Edit2, CheckSquare, Square, 
    ChevronLeft, ChevronRight, Check, RefreshCw, Phone
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
}

const Customers = () => {
    const navigate = useNavigate();

    // 1. Data States
    const [customers, setCustomers] = useState<CustomerDTO[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [totalPages, setTotalPages] = useState<number>(1);
    
    // 2. Query Payload (ONLY things that should trigger an API call)
    const [queryPayload, setQueryPayload] = useState({
        status: 'ACTIVE',
        search: '',
        sort: 'name_asc',
        filters: { paymentStatus: [] as string[] },
        page: 0,
        size: 30
    });

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
    const [selectedFilterDraft, setSelectedFilterDraft] = useState<string[]>([]);

    // 6. Refs
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout>| null>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ==========================================
    // CORE API EXECUTION (No Selection Dependencies)
    // ==========================================
    const executeLedgerQuery = useCallback(async (payload: typeof queryPayload) => {
        try {
            setLoading(true);
            const res = await api.post('/payping/customers/get', payload);
            const dataContent = res.data.customers || res.data.content || [];
            
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
        if (queryPayload.search.trim() !== '') {
            setQueryPayload(prev => ({ ...prev, search: '', page: 0 }));
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
        }, 2000);
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };

    const openCustomerDetails = async (id: string) => {
        if (isSelectionModeActive) return;
        try {
            const res = await api.get(`/payping/customers/get/${id}`);
            setSelectedCustomerContext(res.data);
            setEditFormDraft(res.data);
            setIsEditMode(false);
        } catch (err) {
            console.error("Context fetch exception:", err);
        }
    };

    const commitDirectManualUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editFormDraft) return;
        try {
            await api.post(`/payping/customers/save/${editFormDraft.id}`, editFormDraft);
            setSelectedCustomerContext(editFormDraft);
            setIsEditMode(false);
            executeLedgerQuery(queryPayload);
        } catch (err) {
            console.error("Update failed:", err);
        }
    };

    const activeFiltersCount = queryPayload.filters.paymentStatus.length;

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none overflow-x-hidden pb-12 relative">
            
            {/* ======================================================= */}
            {/* HEADER (ZONES 1 & 2): RIGID LAYOUT, NO BORDERS/OUTLINES */}
            {/* ======================================================= */}
            <header className="sticky top-0 z-30 bg-slate-950 px-4 pt-5 pb-3 max-w-md mx-auto w-full">
                
                {/* ZONE 1: CORE HEADER (Never shifts or hides) */}
                <div className="flex items-center justify-between pb-5">
                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" /> Customers
                    </h2>
                </div>

                {/* ZONE 2: CONTROL BAR / SEARCH BOX (Fixed Height prevents jumping) */}
                <div className="h-8 relative">
                    {!isSearchExpanded ? (
                        <div className="flex items-center justify-between h-full">
                            
                            {/* Left Dropdown (No borders, pure text/icon) */}
                            <div className="relative">
                                <button 
                                    onClick={() => setShowStatusDropdown(true)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-300 tracking-wider uppercase"
                                >
                                    {queryPayload.status} REGISTRY
                                    <ChevronDown className="w-4 h-4 text-slate-500" />
                                </button>
                                
                                {showStatusDropdown && (
                                    <>
                                        <div onClick={() => setShowStatusDropdown(false)} className="fixed inset-0 z-40" />
                                        <div className="absolute left-0 mt-3 w-40 bg-slate-900 rounded-xl p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                                            {['ACTIVE', 'INACTIVE', 'ALL'].map((opt) => (
                                                <button 
                                                    key={opt}
                                                    onClick={() => { setQueryPayload(prev => ({ ...prev, status: opt, page: 0 })); setShowStatusDropdown(false); }}
                                                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-800 font-semibold text-xs tracking-wide text-slate-300"
                                                >
                                                    {opt} DIRECTORY
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Right Icons (No borders, pure icons) */}
                            <div className="flex items-center gap-5 text-slate-400">
                                <div className="relative">
                                    <button onClick={() => setShowSortDropdown(true)} className="flex items-center justify-center hover:text-white transition-colors">
                                        <ArrowUpDown className="w-4 h-4" />
                                    </button>
                                    
                                    {/* Sort Dropdown (Absolutely positioned so it doesn't push Zone 3 down) */}
                                    {showSortDropdown && (
                                        <>
                                            <div onClick={() => setShowSortDropdown(false)} className="fixed inset-0 z-40" />
                                            <div className="absolute right-0 mt-3 w-48 bg-slate-900 rounded-xl p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                                                {[
                                                    { key: 'name_asc', label: 'Name (A-Z)' },
                                                    { key: 'name_desc', label: 'Name (Z-A)' },
                                                    { key: 'amount_desc', label: 'Amount (High-Low)' },
                                                    { key: 'amount_asc', label: 'Amount (Low-High)' }
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.key}
                                                        onClick={() => { setQueryPayload(prev => ({ ...prev, sort: opt.key, page: 0 })); setShowSortDropdown(false); }}
                                                        className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between text-xs font-semibold ${queryPayload.sort === opt.key ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300 hover:bg-slate-800'}`}
                                                    >
                                                        {opt.label}
                                                        {queryPayload.sort === opt.key && <Check className="w-3.5 h-3.5" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button onClick={() => { setShowFilterModal(true); setSelectedFilterDraft(queryPayload.filters.paymentStatus); }} className="relative flex items-center justify-center hover:text-white transition-colors">
                                    <Filter className="w-4 h-4" />
                                    {activeFiltersCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />}
                                </button>
                                <button onClick={() => { setIsSearchExpanded(true); setTimeout(() => searchInputRef.current?.focus(), 50); }} className="flex items-center justify-center hover:text-white transition-colors">
                                    <Search className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Search Box (Replaces Zone 2 entirely) */
                        <div className="flex items-center gap-3 h-full animate-in slide-in-from-right-3 duration-150">
                            <div className="flex-1 bg-slate-900 rounded-lg px-3 h-full flex items-center gap-2">
                                <Search className="w-4 h-4 text-slate-500" />
                                <input 
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search parameters..."
                                    defaultValue={queryPayload.search}
                                    onChange={handleSearchTextChange}
                                    onKeyDown={(e) => e.key === 'Enter' && searchInputRef.current?.blur()}
                                    className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                                />
                                {searchInputRef.current?.value && (
                                    <button onClick={() => { if(searchInputRef.current) searchInputRef.current.value = ''; setQueryPayload(prev => ({...prev, search: '', page: 0})); }}>
                                        <X className="w-4 h-4 text-slate-500" />
                                    </button>
                                )}
                            </div>
                            <button onClick={handleCancelSearch} className="text-xs font-bold text-slate-400">
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* ======================================================= */}
            {/* MAIN CONTENT AREA */}
            {/* ======================================================= */}
            <main className="flex-1 px-4 max-w-md mx-auto w-full space-y-5 pt-3">

                {/* ZONE 3: SELECT ALL & BATCH MESSAGE ACTION */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        {/* No borders, just icon and text */}
                        <button onClick={toggleGlobalSelectAll} className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            {isGlobalSelectAllActive ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4 text-slate-500" />}
                            SELECT LEDGER TOTAL
                        </button>
                        {selectedCustomerIds.size > 0 && (
                            <span className="text-xs font-mono text-slate-400">
                                SELECTED: {selectedCustomerIds.size}
                            </span>
                        )}
                    </div>

                    {/* Renders ONLY if at least 1 customer is selected, uses precise WhatsApp green */}
                    {selectedCustomerIds.size > 0 && (
                        <button 
                            onClick={() => navigate('/payping/dispatch', { state: { targetCustomerIds: Array.from(selectedCustomerIds) } })}
                            className="w-full bg-[#128C7E] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#128C7E]/20 animate-in fade-in zoom-in-95 duration-200"
                        >
                            <MessageCircle className="w-4 h-4 fill-white text-[#128C7E]" />
                            Send Message to Selected Customers
                        </button>
                    )}
                </div>

                {/* ZONE 4: ACTIVE FILTER PILLS */}
                {activeFiltersCount > 0 && (
                    <div className="flex flex-wrap gap-2 animate-in fade-in duration-100">
                        {queryPayload.filters.paymentStatus.map((pill) => (
                            <div key={pill} className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 rounded-full text-xs font-mono text-slate-300">
                                {pill}
                                <button onClick={() => setQueryPayload(prev => ({ ...prev, page: 0, filters: { paymentStatus: prev.filters.paymentStatus.filter(f => f !== pill) } }))} className="hover:text-red-400">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* ZONE 5: CUSTOMER ROWS */}
                <section className="space-y-3">
                    {loading && customers.length === 0 ? (
                        <div className="py-20 text-center flex flex-col items-center gap-2 text-slate-500 text-xs font-mono">
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-500" /> LOADING DIRECTORY...
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="py-16 text-center text-slate-500 text-sm">
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
                                    className={`w-full bg-slate-900 p-4 rounded-xl flex items-center justify-between gap-3 transition-colors ${isChecked ? 'ring-1 ring-blue-500 bg-slate-800' : ''}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {isSelectionModeActive && (
                                            <div className="shrink-0">
                                                {isChecked ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4 text-slate-600" />}
                                            </div>
                                        )}
                                        
                                        <div className="w-10 h-10 rounded-lg bg-slate-950 font-bold text-xs text-slate-400 flex items-center justify-center uppercase shrink-0">
                                            {customer.name.substring(0, 2)}
                                        </div>

                                        <div className="min-w-0">
                                            <h4 className="text-sm font-bold text-slate-200 truncate">{customer.name}</h4>
                                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{customer.phone}</p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0 space-y-1">
                                        <div className="text-sm font-bold text-slate-100">₹{customer.amount}</div>
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
                    <footer className="flex items-center justify-between pt-2 pb-6 text-xs text-slate-500 font-bold tracking-wider">
                        <button 
                            disabled={queryPayload.page === 0 || loading}
                            onClick={() => setQueryPayload(prev => ({ ...prev, page: prev.page - 1 }))}
                            className="px-4 py-2 bg-slate-900 rounded-lg disabled:opacity-30"
                        >
                            PREV
                        </button>
                        <span>PAGE {queryPayload.page + 1} OF {totalPages}</span>
                        <button 
                            disabled={queryPayload.page + 1 >= totalPages || loading}
                            onClick={() => setQueryPayload(prev => ({ ...prev, page: prev.page + 1 }))}
                            className="px-4 py-2 bg-slate-900 rounded-lg disabled:opacity-30"
                        >
                            NEXT
                        </button>
                    </footer>
                )}
            </main>

            {/* ======================================================= */}
            {/* OVERLAYS (FILTER & DETAILS) */}
            {/* ======================================================= */}

            {/* FILTER MODAL */}
            {showFilterModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowFilterModal(false)} />
                    <div className="relative bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-6 animate-in slide-in-from-bottom-10 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <h3 className="font-bold text-base flex items-center gap-2"><Filter className="w-4 h-4 text-blue-500" /> Filters</h3>
                            <button onClick={() => setShowFilterModal(false)} className="text-slate-500"><X className="w-5 h-5" /></button>
                        </div>
                        
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Status</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['PAID', 'UNPAID', 'OVERDUE'].map((val) => {
                                    const isSelected = selectedFilterDraft.includes(val);
                                    return (
                                        <button
                                            key={val}
                                            onClick={() => setSelectedFilterDraft(prev => isSelected ? prev.filter(item => item !== val) : [...prev, val])}
                                            className={`py-2 text-center text-xs font-bold rounded-lg transition-colors ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-950 text-slate-400'}`}
                                        >
                                            {val}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <button 
                            onClick={() => { setQueryPayload(prev => ({ ...prev, page: 0, filters: { paymentStatus: selectedFilterDraft } })); setShowFilterModal(false); }}
                            className="w-full bg-white text-black font-bold py-3.5 rounded-xl text-sm"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            )}

            {/* DETAILS & EDIT MODAL */}
            {selectedCustomerContext && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedCustomerContext(null)} />
                    <div className="relative bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-200 flex flex-col max-h-[85vh]">
                        
                        <div className="p-4 flex items-center justify-between bg-slate-950/50">
                            <h3 className="font-bold text-sm text-slate-300">
                                {isEditMode ? "Edit Record" : "Customer Details"}
                            </h3>
                            <button onClick={() => setSelectedCustomerContext(null)} className="text-slate-400"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1 text-sm">
                            {!isEditMode ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-xl bg-blue-500/10 text-blue-400 font-bold text-xl flex items-center justify-center uppercase">
                                            {selectedCustomerContext.name.substring(0,2)}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white">{selectedCustomerContext.name}</h2>
                                            <p className="text-slate-400 flex items-center gap-1 mt-1"><Phone className="w-3.5 h-3.5" /> {selectedCustomerContext.phone}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl">
                                        <div>
                                            <span className="text-xs text-slate-500 block mb-1">Amount</span>
                                            <span className="text-base font-bold text-white">₹{selectedCustomerContext.amount}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500 block mb-1">Expiry Date</span>
                                            <span className="text-sm font-bold text-slate-300">{selectedCustomerContext.expiryDate}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={commitDirectManualUpdate} id="contextForm" className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1">Name</label>
                                        <input type="text" required value={editFormDraft?.name || ''} onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, name: e.target.value } : null)} className="w-full bg-slate-950 p-3 rounded-lg text-sm outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1">Phone</label>
                                        <input type="text" required value={editFormDraft?.phone || ''} onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, phone: e.target.value } : null)} className="w-full bg-slate-950 p-3 rounded-lg text-sm outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1">Amount</label>
                                        <input type="number" required value={editFormDraft?.amount || 0} onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, amount: Number(e.target.value) } : null)} className="w-full bg-slate-950 p-3 rounded-lg text-sm outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1">Expiry Date</label>
                                        <input type="date" required value={editFormDraft?.expiryDate || ''} onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, expiryDate: e.target.value } : null)} className="w-full bg-slate-950 p-3 rounded-lg text-sm outline-none text-slate-300" />
                                    </div>
                                </form>
                            )}
                        </div>

                        <div className="p-4 bg-slate-950/50 flex gap-3">
                            {!isEditMode ? (
                                <>
                                    <button onClick={() => setIsEditMode(true)} className="w-1/2 bg-slate-900 text-slate-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                                        <Edit2 className="w-4 h-4" /> Edit
                                    </button>
                                    <button onClick={() => { const targetId = selectedCustomerContext.id; setSelectedCustomerContext(null); navigate('/payping/dispatch', { state: { targetCustomerIds: [targetId] } }); }} className="w-1/2 bg-[#128C7E] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                                        <MessageCircle className="w-4 h-4" /> Message
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" onClick={() => setIsEditMode(false)} className="w-1/3 bg-slate-900 text-slate-400 font-bold py-3 rounded-xl">Cancel</button>
                                    <button type="submit" form="contextForm" className="w-2/3 bg-blue-600 text-white font-bold py-3 rounded-xl">Save Changes</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Customers;