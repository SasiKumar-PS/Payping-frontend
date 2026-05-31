import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    Users, ChevronDown, ArrowUpDown, Filter, Search, X, 
    MessageCircle, Edit2, CheckSquare, Square, 
    ChevronLeft, ChevronRight, Check, RefreshCw, Phone,
    LayoutDashboard, MessageSquare, UserPlus, AlertCircle,
    AlertTriangle
} from 'lucide-react';
import api from '../../api';
import AddCustomers from './AddCustomers';

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
                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" /> Customers
                    </h2>
                    <button 
                        onClick={() => setShowAddCustomers(true)}
                        className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-indigo-600/10 border-0 outline-none cursor-pointer"
                    >
                        <UserPlus className="w-4 h-4" />
                    </button>
                </div>

                {/* ZONE 2: CONTROL BAR / SEARCH BOX (Fixed Height prevents jumping) */}
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
            </header>

            {/* ======================================================= */}
            {/* MAIN CONTENT AREA */}
            {/* ======================================================= */}
            <main className="flex-1 px-4 max-w-md lg:max-w-6xl mx-auto w-full space-y-5 pt-3 animate-in fade-in duration-300">

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

            {/* DETAILS & EDIT MODAL */}
            {selectedCustomerContext && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0">
                    <div className="absolute inset-0 bg-[#0f0f0f]/80 backdrop-blur-sm" onClick={() => setSelectedCustomerContext(null)} />
                    <div className="relative bg-[#0f0f0f] border border-zinc-800/60 w-full max-w-3xl rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88vh]">
                        
                        <div className="p-4 flex items-center justify-between bg-[#0f0f0f]/50">
                            <h3 className="font-bold text-sm text-zinc-300">
                                {isEditMode ? "Edit Record" : "Customer Details"}
                            </h3>
                            <button onClick={() => setSelectedCustomerContext(null)} className="text-zinc-400"><X className="w-5 h-5" /></button>
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
                                {((isEditMode ? editFormDraft?.paymentStatus : selectedCustomerContext.paymentStatus) === 'PAID' && originalPaymentStatus !== 'PAID') && (
                                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-[10px] font-bold leading-normal animate-in slide-in-from-top-1 duration-150 flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                        <span>Please update the new expiry date for the next cycle.</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-[9px] font-bold text-zinc-500 block uppercase tracking-wider mb-1 ml-0.5">Expiry Date</span>
                                        {!isEditMode ? (
                                            <span className="text-xs font-black text-zinc-305 font-mono">{selectedCustomerContext.expiryDate}</span>
                                        ) : (
                                            <input 
                                                type="date" 
                                                required 
                                                value={editFormDraft?.expiryDate || ''} 
                                                onChange={(e) => setEditFormDraft(prev => prev ? { ...prev, expiryDate: e.target.value } : null)} 
                                                className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-xl text-xs text-zinc-305 font-mono font-bold outline-none focus:border-indigo-500" 
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
                                                    setIsEditMode(true);
                                                    setEditFormDraft(prev => prev ? { ...prev, paymentStatus: 'PAID' } : null);
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
                                                setEditFormDraft(prev => prev ? { ...prev, paymentStatus: nextVal } : null);
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
                            <AlertCircle className="w-5 h-5 absolute" />
                            <AlertCircle className="w-5 h-5 animate-ping" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-zinc-200">Confirm Deactivation</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                confirm deactivating the {selectedCustomerContext.name}, the customer will no longer recieve automatic notifications and business tracking
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
                    {preSelectedTemplate ? (
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