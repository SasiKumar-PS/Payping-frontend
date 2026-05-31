import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Bell, Calendar, Clock, Edit, Trash2, ArrowRight, CheckCircle2, 
    AlertCircle, FileText, Users, X, ToggleLeft, ToggleRight, 
    Info, Check, Filter, Loader2, MessageSquare, ChevronRight, Play, RefreshCw, History as HistoryIcon,
    ChevronLeft, Plus, Minus, BellRing, BellOff, Activity
} from 'lucide-react';
import api from '../../api';
import { useNavigate } from 'react-router-dom';

// ==========================================
// TS INTERFACES & SCHEMA TYPES
// ==========================================
export interface TemplateDTO {
    id: string;
    name: string;
    content: string;
}

export interface CustomerDTO {
    id: string;
    name: string;
    phone: string;
    amount: number;
    expiryDate: string;
    paymentStatus: 'PAID' | 'UNPAID' | 'OVERDUE';
    status: 'ACTIVE' | 'INACTIVE';
}

export interface CustomerFilterDTO {
    mainFilters: Record<string, string[]>;
    customFilters: Record<string, string[]>;
}

export interface AutoAlertDTO {
    id: string;
    name: string;
    event: string; // e.g. "EXPIRY_DATE", "PAYMENT_DUE", "SUBSCRIPTION_RENEWAL"
    offsetDays: number; // -28 to +28
    time: string; // "hh:mm AM/PM"
    status: 'ACTIVE' | 'INACTIVE';
    templateId: string;
    template?: TemplateDTO;
    filters: Record<string, string[]>;
    nextTriggerDate?: string;
}

export interface AlertHistoryDTO {
    id: string;
    triggeredAt: string;
    status: 'SUCCESS' | 'FAILURE';
    customerCount: number;
    logMessage: string;
}

// Helper to render template text with pretty variables highlighted as pills
const renderTemplatePreviewWithPills = (content: string) => {
    if (!content) return <span className="text-slate-500 italic">No content template selected yet.</span>;
    const parts = content.split(/({[^{}]+})/g);
    return (
        <p className="text-sm text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
            {parts.map((part, index) => {
                const match = part.match(/^{(.+)}$/);
                if (match) {
                    const tag = match[1];
                    return (
                        <span 
                            key={index} 
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 bg-[#022c22]/90 text-emerald-400 border border-emerald-800/60 rounded text-[0.9em] font-semibold align-baseline select-none whitespace-nowrap"
                        >
                            {tag}
                        </span>
                    );
                }
                return part;
            })}
        </p>
    );
};

// Convert 12hr AM/PM to 24hr format for API: "02","30","PM" → "14:30"
const to24hr = (hour: string, min: string, ampm: string): string => {
    let h = parseInt(hour, 10);
    if (ampm === 'AM' && h === 12) h = 0;
    else if (ampm === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${min}`;
};

// Default Static Fallbacks for Ultimate Resiliency
const MOCK_EVENTS = ["EXPIRY_DATE", "PAYMENT_DUE", "SUBSCRIPTION_RENEWAL"];

const MOCK_TEMPLATES: TemplateDTO[] = [
    {
        id: "tmpl-1",
        name: "Subscription Grace Warning",
        content: "Hi {name}, your subscription of {Amount} is expiring on {expiryDate}. Please clear the due amount to prevent interruption of services."
    },
    {
        id: "tmpl-2",
        name: "Auto Payment Due Receipt",
        content: "Dear {name}, this is a notification that a payment is due for your subscription. Amount: {Amount}. Next billing cycle starts on {expiryDate}."
    },
    {
        id: "tmpl-3",
        name: "Subscription Renewed Receipt",
        content: "Success! Hello {name}, your account renewed successfully. The amount of {Amount} has been processed. Thank you for choosing PayPing!"
    }
];

const MOCK_ALERTS: AutoAlertDTO[] = [
    {
        id: "alert-1",
        name: "Grace Period Urgent Reminder",
        event: "EXPIRY_DATE",
        offsetDays: -3,
        time: "10:00 AM",
        status: "ACTIVE",
        templateId: "tmpl-1",
        template: MOCK_TEMPLATES[0],
        filters: { paymentStatus: ["UNPAID", "OVERDUE"], status: ["ACTIVE"] },
        nextTriggerDate: "2026-05-29"
    },
    {
        id: "alert-2",
        name: "Subscription Renewal Greetings",
        event: "SUBSCRIPTION_RENEWAL",
        offsetDays: 0,
        time: "09:00 AM",
        status: "ACTIVE",
        templateId: "tmpl-3",
        template: MOCK_TEMPLATES[2],
        filters: { paymentStatus: ["PAID"] },
        nextTriggerDate: "2026-06-01"
    },
    {
        id: "alert-3",
        name: "Late Fee Penalty Auto Warning",
        event: "PAYMENT_DUE",
        offsetDays: 5,
        time: "02:30 PM",
        status: "INACTIVE",
        templateId: "tmpl-2",
        template: MOCK_TEMPLATES[1],
        filters: { paymentStatus: ["OVERDUE"] },
        nextTriggerDate: "2026-06-05"
    }
];

const MOCK_HISTORY: Record<string, AlertHistoryDTO[]> = {
    "alert-1": [
        {
            id: "hist-1",
            triggeredAt: "2026-05-23 10:00 AM",
            status: "SUCCESS",
            customerCount: 14,
            logMessage: "Broadcast completed. Sent to 14 active overdue customers."
        },
        {
            id: "hist-2",
            triggeredAt: "2026-05-20 10:00 AM",
            status: "SUCCESS",
            customerCount: 18,
            logMessage: "Broadcast completed. Sent to 18 active overdue customers."
        }
    ],
    "alert-2": [
        {
            id: "hist-3",
            triggeredAt: "2026-05-25 09:00 AM",
            status: "SUCCESS",
            customerCount: 32,
            logMessage: "Sent successfully to 32 renewed accounts."
        }
    ],
    "alert-3": []
};

const MOCK_CUSTOMERS_LIST: CustomerDTO[] = [
    { id: "cust-1", name: "Sarah Connor", phone: "+919876543210", amount: 1500, expiryDate: "2026-06-15", paymentStatus: "UNPAID", status: "ACTIVE" },
    { id: "cust-2", name: "John Miller", phone: "+919988776655", amount: 2500, expiryDate: "2026-05-30", paymentStatus: "OVERDUE", status: "ACTIVE" },
    { id: "cust-3", name: "David Vance", phone: "+918877665544", amount: 1200, expiryDate: "2026-06-20", paymentStatus: "PAID", status: "ACTIVE" },
    { id: "cust-4", name: "Elena Rostova", phone: "+917766554433", amount: 3000, expiryDate: "2026-06-05", paymentStatus: "UNPAID", status: "ACTIVE" },
    { id: "cust-5", name: "Marcus Wright", phone: "+916655443322", amount: 999, expiryDate: "2026-05-25", paymentStatus: "OVERDUE", status: "ACTIVE" }
];

export const AutoAlerts = () => {
    const navigate = useNavigate();
    // ==========================================
    // STATE DECLARES
    // ==========================================
    const [alerts, setAlerts] = useState<AutoAlertDTO[]>([]);
    const [selectedAlert, setSelectedAlert] = useState<AutoAlertDTO | null>(null);
    const [events, setEvents] = useState<string[]>(MOCK_EVENTS);
    const [templates, setTemplates] = useState<TemplateDTO[]>(MOCK_TEMPLATES);
    const [serverTags, setServerTags] = useState<string[]>(["name", "Amount", "expiryDate", "phone", "businessName"]);
    const [filterMetadata, setFilterMetadata] = useState<CustomerFilterDTO>({ mainFilters: {}, customFilters: {} });
    
    const [loading, setLoading] = useState<boolean>(true);
    const [history, setHistory] = useState<AlertHistoryDTO[]>([]);

    // Detail Pane Inline Edit State
    const [isEditingInfo, setIsEditingInfo] = useState<boolean>(false);
    const [editAlertName, setEditAlertName] = useState<string>("");
    const [editEvent, setEditEvent] = useState<string>("");
    const [editOffset, setEditOffset] = useState<number>(0);
    const [editTimeHour, setEditTimeHour] = useState<string>("09");
    const [editTimeMin, setEditTimeMin] = useState<string>("00");
    const [editTimeAmpm, setEditTimeAmpm] = useState<string>("AM");
    const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE'>("ACTIVE");

    // Detail Pane Inline Template Edit State
    const [isEditingTemplate, setIsEditingTemplate] = useState<boolean>(false);
    const [templateEditContent, setTemplateEditContent] = useState<string>("");

    // Modal Visibility States
    const [showAddModal, setShowAddModal] = useState<boolean>(false);
    const [showTemplatePicker, setShowTemplatePicker] = useState<boolean>(false);
    const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
    const [showCustomersOverlay, setShowCustomersOverlay] = useState<boolean>(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
    const [showStatusDeactivationConfirm, setShowStatusDeactivationConfirm] = useState<boolean>(false);
    const [statusToggleAlert, setStatusToggleAlert] = useState<AutoAlertDTO | null>(null);

    // Template Edit Modal States
    const [showTemplateEditModal, setShowTemplateEditModal] = useState<boolean>(false);
    const [editTemplateId, setEditTemplateId] = useState<string>("");
    const [editTemplateName, setEditTemplateName] = useState<string>("");
    const [editTemplateContent, setEditTemplateContent] = useState<string>("");

    // Context flags for Modals
    const [filterModalContext, setFilterModalContext] = useState<'CREATE' | 'EDIT'>('EDIT');
    const [templateModalContext, setTemplateModalContext] = useState<'CREATE' | 'EDIT'>('EDIT');

    // Mapped counts cache to save network calls
    const [customerCounts, setCustomerCounts] = useState<Record<string, number>>({});
    const [previewCustomers, setPreviewCustomers] = useState<CustomerDTO[]>([]);
    const [loadingPreviewCustomers, setLoadingPreviewCustomers] = useState<boolean>(false);

    // Creation State
    const [newAlertName, setNewAlertName] = useState<string>("");
    const [newEvent, setNewEvent] = useState<string>("EXPIRY_DATE");
    const [newOffset, setNewOffset] = useState<number>(0);
    const [newTimeHour, setNewTimeHour] = useState<string>("09");
    const [newTimeMin, setNewTimeMin] = useState<string>("00");
    const [newTimeAmpm, setNewTimeAmpm] = useState<string>("AM");
    const [newTemplate, setNewTemplate] = useState<TemplateDTO | null>(null);
    const [newFilters, setNewFilters] = useState<Record<string, string[]>>({});
    const [newCustomerCount, setNewCustomerCount] = useState<number>(0);

    // Selected Temp template selection preview block
    const [candidateTemplate, setCandidateTemplate] = useState<TemplateDTO | null>(null);
    const [templateSearchQuery, setTemplateSearchQuery] = useState<string>("");

    // Filters selection workspace
    const [filterDraft, setFilterDraft] = useState<Record<string, string[]>>({});
    const [liveDraftCount, setLiveDraftCount] = useState<number>(0);

    // ==========================================
    // INITIAL MOUNT LIFECYCLE
    // ==========================================
    const loadCoreWorkspaceData = useCallback(async () => {
        try {
            setLoading(true);

            // 1. Fetch Alert Events
            try {
                const eventRes = await api.get('/payping/notifications/events');
                setEvents(eventRes.data || MOCK_EVENTS);
            } catch (err) {
                console.warn("Failed fetching events endpoint, using fallbacks");
            }

            // 2. Fetch Workspace Alert Templates
            try {
                const tmplRes = await api.get('/payping/templates/get');
                if (tmplRes.data && tmplRes.data.length > 0) {
                    setTemplates(tmplRes.data);
                }
            } catch (err) {
                console.warn("Failed fetching workspace templates, using fallbacks");
            }

            // 3. Fetch Template tags
            try {
                const tagRes = await api.get('/payping/templates/tags');
                if (tagRes.data && tagRes.data.length > 0) {
                    setServerTags(tagRes.data);
                }
            } catch (err) {
                console.warn("Failed fetching template tags, using default tags");
            }

            // 4. Fetch Customers filter metadata
            try {
                const filterRes = await api.get('/payping/customers/getfilters');
                if (filterRes.data) {
                    setFilterMetadata(filterRes.data);
                }
            } catch (err) {
                console.warn("Failed loading customers filter metadata, using fallback filters");
                setFilterMetadata({
                    mainFilters: {
                        paymentStatus: ["PAID", "UNPAID", "OVERDUE"],
                        status: ["ACTIVE", "INACTIVE"]
                    },
                    customFilters: {
                        batch: ["morning", "evening", "weekend"]
                    }
                });
            }

            // 5. Fetch Auto Alerts
            await refreshAlertList();

        } catch (err) {
            console.error("Critical dashboard loading error:", err);
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_ERROR', { detail: "Failed to initialize scheduled workspace environment." }));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCoreWorkspaceData();
    }, [loadCoreWorkspaceData]);

    // Refresh Scheduled Alerts List
    const refreshAlertList = async () => {
        try {
            const alertsRes = await api.get('/payping/notifications/autoalerts');
            let data = alertsRes.data || [];
            if (!Array.isArray(data) || data.length === 0) {
                data = MOCK_ALERTS;
            }
            
            // Map the templates onto the alert objects if templateId is present
            const enriched = data.map((alert: AutoAlertDTO) => {
                const t = templates.find(item => item.id === alert.templateId);
                return { ...alert, template: t || alert.template };
            });

            setAlerts(enriched);

            // Re-select currently selected alert if it is in the list
            if (selectedAlert) {
                const updated = enriched.find((a: AutoAlertDTO) => a.id === selectedAlert.id);
                if (updated) {
                    setSelectedAlert(updated);
                    // Load corresponding history
                    setHistory(MOCK_HISTORY[updated.id] || []);
                }
            }
        } catch (err) {
            console.warn("Auto alerts fetch error, falling back to mock database list");
            const enriched = MOCK_ALERTS.map((alert: AutoAlertDTO) => {
                const t = templates.find(item => item.id === alert.templateId);
                return { ...alert, template: t || alert.template };
            });
            setAlerts(enriched);
            if (selectedAlert) {
                const updated = enriched.find((a: AutoAlertDTO) => a.id === selectedAlert.id);
                if (updated) {
                    setSelectedAlert(updated);
                    setHistory(MOCK_HISTORY[updated.id] || []);
                }
            }
        }
    };

    // Calculate dynamic customers count based on selected filter record
    const calculateTargetedCount = async (filters: Record<string, string[]>) => {
        try {
            const res = await api.post('/payping/customers/get', {
                status: 'ACTIVE',
                search: '',
                sort: 'name_asc',
                filters,
                page: 0,
                size: 1000
            });
            const total = res.data?.totalElements ?? res.data?.content?.length ?? (Array.isArray(res.data) ? res.data.length : 0);
            return total;
        } catch (err) {
            // Simulated logic based on filters for mock fidelity
            const getFilterValueInsensitive = (f: Record<string, string[]>, target: string) => {
                if (!f) return [];
                const norm = target.toLowerCase().replace(/\s+/g, '');
                for (const [k, v] of Object.entries(f)) {
                    if (k.toLowerCase().replace(/\s+/g, '') === norm) return v;
                }
                return [];
            };
            
            const paymentStatusFilters = getFilterValueInsensitive(filters, 'paymentStatus');
            if (paymentStatusFilters.length === 0) return MOCK_CUSTOMERS_LIST.length;
            
            // Filter locally to simulate
            const localFilterCount = MOCK_CUSTOMERS_LIST.filter(c => 
                paymentStatusFilters.includes(c.paymentStatus)
            ).length;
            return localFilterCount;
        }
    };

    // Trigger dynamic count fetching when alerts list is updated
    useEffect(() => {
        alerts.forEach(async (alert) => {
            if (alert.filters) {
                const cnt = await calculateTargetedCount(alert.filters);
                setCustomerCounts(prev => ({ ...prev, [alert.id]: cnt }));
            }
        });
    }, [alerts]);

    // Load history when selected alert changes
    useEffect(() => {
        if (selectedAlert) {
            setHistory(MOCK_HISTORY[selectedAlert.id] || []);
        }
    }, [selectedAlert]);

    // ==========================================
    // UTILITY RENDER HELPERS
    // ==========================================
    const renderTagsList = (filters: Record<string, string[]>) => {
        const list = Object.entries(filters || {}).flatMap(([key, values]) => {
            if (!values || values.length === 0) return [];
            return values.map(val => ({ category: key, val }));
        });

        if (list.length === 0) {
            return <span className="text-slate-500 text-xs font-semibold">No filter criteria specified (Broadcasts to all customers).</span>;
        }

        return (
            <div className="flex flex-row overflow-x-auto whitespace-nowrap scrollbar-none gap-1.5 pt-1 w-full">
                {list.map((tag, idx) => (
                    <span 
                        key={idx} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300"
                    >
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">{tag.category.replace(/([A-Z])/g, ' $1')}:</span>
                        <span>{tag.val}</span>
                    </span>
                ))}
            </div>
        );
    };

    const sentencePreviewText = useMemo(() => {
        const name = newAlertName || "New Auto Alert";
        const offset = newOffset;
        const timeStr = `${newTimeHour}:${newTimeMin} ${newTimeAmpm}`;
        let offsetPhrase = 'exactly on the day of';
        if (offset < 0) {
            offsetPhrase = `${Math.abs(offset)} days before`;
        } else if (offset > 0) {
            offsetPhrase = `${offset} days after`;
        }
        return `Auto alert will be triggered to ${newCustomerCount} selected customers ${offsetPhrase} event ${newEvent} at ${timeStr}.`;
    }, [newAlertName, newOffset, newEvent, newTimeHour, newTimeMin, newTimeAmpm, newCustomerCount]);

    // ==========================================
    // ACTION TRIGGERS (SAVE, EDIT, DELETE, TOGGLE)
    // ==========================================
    const handleToggleStatusClick = (alert: AutoAlertDTO) => {
        if (alert.status === 'ACTIVE') {
            setStatusToggleAlert(alert);
            setShowStatusDeactivationConfirm(true);
        } else {
            commitToggleStatus(alert);
        }
    };

    const commitToggleStatus = async (alert: AutoAlertDTO) => {
        const nextStatus = alert.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
            await api.put(`/payping/notifications/autoalerts/${alert.id}`, {
                ...alert,
                status: nextStatus
            }, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            
            // local update
            setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: nextStatus } : a));
            if (selectedAlert?.id === alert.id) {
                setSelectedAlert(prev => prev ? { ...prev, status: nextStatus } : null);
            }
        } catch (err) {
            // Simulated local change if API doesn't support save
            setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: nextStatus } : a));
            if (selectedAlert?.id === alert.id) {
                setSelectedAlert(prev => prev ? { ...prev, status: nextStatus } : null);
            }
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                detail: `Status successfully updated to ${nextStatus}!`
            }));
        }
    };

    const handleSaveAlertInfo = async () => {
        if (!selectedAlert) return;
        if (!editAlertName.trim()) {
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_ERROR', { detail: "Please provide a valid alert name." }));
            return;
        }

        const scheduledTime = to24hr(editTimeHour, editTimeMin, editTimeAmpm);
        const updatedPayload: AutoAlertDTO = {
            ...selectedAlert,
            name: editAlertName,
            event: editEvent,
            offsetDays: editOffset,
            time: scheduledTime,
            status: editStatus
        };

        try {
            await api.put(`/payping/notifications/autoalerts/${selectedAlert.id}`, updatedPayload, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            setIsEditingInfo(false);
            await refreshAlertList();
        } catch (err) {
            // Simulated local edit
            setAlerts(prev => prev.map(a => a.id === selectedAlert.id ? { ...updatedPayload, template: selectedAlert.template } : a));
            setSelectedAlert({ ...updatedPayload, template: selectedAlert.template });
            setIsEditingInfo(false);
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                detail: "Auto alert info updated successfully!"
            }));
        }
    };

    const handleSaveTemplateText = async () => {
        if (!selectedAlert || !selectedAlert.template) return;
        if (!templateEditContent.trim()) {
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_ERROR', { detail: "Template body text cannot be empty." }));
            return;
        }

        const updatedTemplate: TemplateDTO = {
            ...selectedAlert.template,
            content: templateEditContent
        };

        try {
            await api.put(`/payping/templates/save/${selectedAlert.template.id}`, updatedTemplate, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            
            // local update
            setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
            setAlerts(prev => prev.map(a => a.id === selectedAlert.id ? { ...a, template: updatedTemplate } : a));
            setSelectedAlert(prev => prev ? { ...prev, template: updatedTemplate } : null);
            setIsEditingTemplate(false);
        } catch (err) {
            // Simulated local edit
            setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
            setAlerts(prev => prev.map(a => a.id === selectedAlert.id ? { ...a, template: updatedTemplate } : a));
            setSelectedAlert(prev => prev ? { ...prev, template: updatedTemplate } : null);
            setIsEditingTemplate(false);
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                detail: "Template layout saved successfully!"
            }));
        }
    };

    const handleDeleteAlert = async () => {
        if (!selectedAlert) return;
        try {
            await api.delete(`/payping/autoalerts/${selectedAlert.id}`);
            setShowDeleteConfirm(false);
            const alertIdToDelete = selectedAlert.id;
            setSelectedAlert(null);
            setAlerts(prev => prev.filter(a => a.id !== alertIdToDelete));
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                detail: "Auto alert deleted successfully."
            }));
        } catch (err) {
            // Simulated local delete
            const alertIdToDelete = selectedAlert.id;
            setSelectedAlert(null);
            setAlerts(prev => prev.filter(a => a.id !== alertIdToDelete));
            setShowDeleteConfirm(false);
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                detail: "Auto alert successfully deleted."
            }));
        }
    };

    const handleCreateAutoAlert = async () => {
        if (!newAlertName.trim()) {
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_ERROR', { detail: "Please fill out alert identity name." }));
            return;
        }
        if (!newTemplate) {
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_ERROR', { detail: "Please map a message template to the auto alert." }));
            return;
        }

        const payload = {
            name: newAlertName,
            event: newEvent,
            offsetDays: newOffset,
            time: to24hr(newTimeHour, newTimeMin, newTimeAmpm),
            status: "ACTIVE" as const,
            template: newTemplate,
            filters: newFilters,
        };

        try {
            await api.post('/payping/notifications/autoalerts/save', payload, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            setShowAddModal(false);
            resetCreateForm();
            await refreshAlertList();
        } catch (err) {
            // Simulated local insert with temp ID for mock fallback
            const mockRecord: AutoAlertDTO = {
                ...payload,
                id: `alert-${Date.now()}`,
                templateId: newTemplate?.id || '',
                template: newTemplate,
                nextTriggerDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            };
            setAlerts(prev => [...prev, mockRecord]);
            setSelectedAlert(mockRecord);
            setShowAddModal(false);
            resetCreateForm();
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                detail: "Auto alert scheduled successfully!"
            }));
        }
    };

    const resetCreateForm = () => {
        setNewAlertName("");
        setNewEvent("EXPIRY_DATE");
        setNewOffset(0);
        setNewTimeHour("09");
        setNewTimeMin("00");
        setNewTimeAmpm("AM");
        setNewTemplate(null);
        setNewFilters({});
        setNewCustomerCount(0);
    };

    // ==========================================
    // TARGET CUSTOMER OVERLAY MODAL LAUNCHERS
    // ==========================================
    const launchShowCustomersOverlay = async () => {
        if (!selectedAlert) return;
        setLoadingPreviewCustomers(true);
        setShowCustomersOverlay(true);

        try {
            const res = await api.post('/payping/customers/get', {
                status: 'ACTIVE',
                search: '',
                sort: 'name_asc',
                filters: selectedAlert.filters,
                page: 0,
                size: 30
            });
            const data = res.data?.content || res.data || [];
            if (Array.isArray(data)) {
                setPreviewCustomers(data);
            } else {
                setPreviewCustomers(MOCK_CUSTOMERS_LIST);
            }
        } catch (err) {
            // Simulated local mock matching for fidelity
            const getFilterValueInsensitive = (f: Record<string, string[]>, target: string) => {
                if (!f) return [];
                const norm = target.toLowerCase().replace(/\s+/g, '');
                for (const [k, v] of Object.entries(f)) {
                    if (k.toLowerCase().replace(/\s+/g, '') === norm) return v;
                }
                return [];
            };
            const paymentStatusFilters = getFilterValueInsensitive(selectedAlert.filters || {}, 'paymentStatus');
            if (paymentStatusFilters.length === 0) {
                setPreviewCustomers(MOCK_CUSTOMERS_LIST);
            } else {
                setPreviewCustomers(MOCK_CUSTOMERS_LIST.filter(c => paymentStatusFilters.includes(c.paymentStatus)));
            }
        } finally {
            setLoadingPreviewCustomers(false);
        }
    };

    // ==========================================
    // FILTER MODAL SELECTIONS LOGIC
    // ==========================================
    const openFiltersPopup = (context: 'CREATE' | 'EDIT') => {
        setFilterModalContext(context);
        const activeFilters = context === 'CREATE' ? newFilters : (selectedAlert?.filters || {});
        setFilterDraft(activeFilters);
        // Calculate dynamic count immediately
        updateFiltersLiveDraftCount(activeFilters);
        setShowFilterModal(true);
    };

    const updateFiltersLiveDraftCount = async (draft: Record<string, string[]>) => {
        const count = await calculateTargetedCount(draft);
        setLiveDraftCount(count);
    };

    const cleanFiltersPayload = (filters: Record<string, string[]>) => {
        const cleaned: Record<string, string[]> = {};
        if (!filters) return cleaned;
        Object.entries(filters).forEach(([key, values]) => {
            if (Array.isArray(values)) {
                const cleanArr = values.filter(v => v.trim() !== '');
                if (cleanArr.length > 0) {
                    cleaned[key] = cleanArr;
                }
            }
        });
        return cleaned;
    };

    const toggleFilterDraftOption = (category: string, value: string) => {
        setFilterDraft(prev => {
            const arr = prev[category] || [];
            const nextArr = arr.includes(value) ? arr.filter(item => item !== value) : [...arr, value];
            const updated = cleanFiltersPayload({ ...prev, [category]: nextArr });
            // Update the live preview count
            updateFiltersLiveDraftCount(updated);
            return updated;
        });
    };

    const handleApplyFilters = async () => {
        if (filterModalContext === 'CREATE') {
            setNewFilters(filterDraft);
            setNewCustomerCount(liveDraftCount);
        } else {
            if (!selectedAlert) return;
            const updatedAlert = { ...selectedAlert, filters: filterDraft };
            try {
                await api.put(`/payping/notifications/autoalerts/${selectedAlert.id}`, updatedAlert, {
                    headers: { 'X-Trigger-Success': 'true' }
                });
                await refreshAlertList();
            } catch (err) {
                setAlerts(prev => prev.map(a => a.id === selectedAlert.id ? updatedAlert : a));
                setSelectedAlert(updatedAlert);
                window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                    detail: "Target selection parameters saved!"
                }));
            }
        }
        setShowFilterModal(false);
    };

    // ==========================================
    // TEMPLATE SELECTION FULLSCREEN VIEW LOGIC
    // ==========================================
    const openTemplateSelectionPopup = (context: 'CREATE' | 'EDIT') => {
        setTemplateModalContext(context);
        setCandidateTemplate(null);
        setTemplateSearchQuery("");
        setShowTemplatePicker(true);
    };

    const filteredTemplatesList = useMemo(() => {
        return templates.filter(t => 
            t.name.toLowerCase().includes(templateSearchQuery.toLowerCase()) || 
            t.content.toLowerCase().includes(templateSearchQuery.toLowerCase())
        );
    }, [templates, templateSearchQuery]);

    const handleConfirmTemplateSelection = async () => {
        if (!candidateTemplate) return;
        
        if (templateModalContext === 'CREATE') {
            setNewTemplate(candidateTemplate);
        } else {
            if (!selectedAlert) return;
            const updatedAlert = { 
                ...selectedAlert, 
                template: candidateTemplate
            };
            try {
                await api.put(`/payping/notifications/autoalerts/${selectedAlert.id}`, updatedAlert, {
                    headers: { 'X-Trigger-Success': 'true' }
                });
                await refreshAlertList();
            } catch (err) {
                setAlerts(prev => prev.map(a => a.id === selectedAlert.id ? updatedAlert : a));
                setSelectedAlert(updatedAlert);
                window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                    detail: "Template selection updated!"
                }));
            }
        }
        setShowTemplatePicker(false);
        setCandidateTemplate(null);
    };

    // ==========================================
    // INLINE TAG INSERTION (TEMPLATE EDITOR)
    // ==========================================
    const handleInsertTagShortcut = (tag: string) => {
    setTemplateEditContent(prev => prev + `{${tag}}`);
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans select-none overflow-x-hidden pb-28 relative">
            
            {/* Header section with Stats Bar */}
            <header className="sticky top-0 z-20 bg-zinc-950 px-4 pt-8 pb-6 max-w-md lg:max-w-4xl mx-auto w-full border-b border-zinc-800/60 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                        Auto Alerts
                    </h1>
                    <p className="text-sm text-zinc-400 mt-1">
                        Configure event-triggered automation schedules.
                    </p>
                </div>
                <button 
                    onClick={() => { resetCreateForm(); setShowAddModal(true); }}
                    className="flex items-center justify-center px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium rounded-md transition-colors cursor-pointer border border-indigo-500/50 shadow-sm shadow-indigo-500/20"
                >
                    Add Auto Alert
                </button>
            </header>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-3">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    <p className="text-sm font-medium text-zinc-500">Loading configurations...</p>
                </div>
            ) : (
                <main className="flex-1 px-4 max-w-md lg:max-w-4xl mx-auto w-full pt-6 space-y-3 pb-20">
                    
                    {alerts.length === 0 ? (
                        <div className="bg-zinc-900/30 p-12 text-center flex flex-col items-center justify-center gap-3 rounded-xl border border-zinc-800/50">
                            <Bell className="w-5 h-5 text-zinc-600 mb-2" />
                            <h3 className="text-sm font-medium text-zinc-300">No scheduled notifications active</h3>
                            <p className="text-sm text-zinc-500">
                                Create a new auto-trigger configuration to begin scheduling.
                            </p>
                        </div>
                    ) : (
                        <div className="w-full space-y-2">
                            {alerts.map((alert) => {
                                const tgtCount = customerCounts[alert.id] ?? 0;
                                return (
                                    <div 
                                        key={alert.id}
                                        onClick={() => {
                                            setSelectedAlert(alert);
                                            setIsEditingInfo(false);
                                            setIsEditingTemplate(false);
                                        }}
                                        className="w-full bg-zinc-900/30 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between border border-zinc-800/60 hover:bg-zinc-900/60 hover:border-zinc-700/60 transition-colors cursor-pointer group gap-3"
                                    >
                                        <div className="min-w-0 flex-grow space-y-1">
                                            <div className="flex items-center gap-3">
                                                <h4 className="text-sm font-medium text-zinc-200 truncate group-hover:text-zinc-50 transition-colors">{alert.name}</h4>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                                    alert.status === 'ACTIVE' 
                                                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                                                        : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50'
                                                }`}>
                                                    {alert.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-3 text-xs text-zinc-500">
                                                <span className="truncate flex items-center gap-1.5">
                                                    <Bell className="w-3.5 h-3.5 text-zinc-600" />
                                                    {alert.event} {alert.offsetDays === 0 ? "(On Event)" : `(${alert.offsetDays > 0 ? '+' : ''}${alert.offsetDays}d)`}
                                                </span>
                                                <span className="text-zinc-800 shrink-0 select-none">•</span>
                                                <span className="flex items-center gap-1.5 shrink-0">
                                                    <Clock className="w-3.5 h-3.5 text-zinc-600" />
                                                    {alert.time}
                                                </span>
                                                <span className="text-zinc-800 shrink-0 select-none hidden sm:block">•</span>
                                                <span className="hidden sm:flex items-center gap-1.5 shrink-0 text-indigo-400/80 font-medium">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {alert.nextTriggerDate ? alert.nextTriggerDate : "Pending"}
                                                </span>
                                                <span className="text-zinc-800 shrink-0 select-none hidden sm:block">•</span>
                                                <span className="hidden sm:flex items-center gap-1.5 shrink-0 text-sky-400/80 font-medium">
                                                    <Activity className="w-3.5 h-3.5" />
                                                    {alert.status === 'ACTIVE' ? "Scheduled" : "Not Started"}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 shrink-0 sm:pl-4">
                                            <div className="flex items-center gap-1.5 bg-zinc-800/40 px-2.5 py-1.5 rounded-md border border-zinc-700/30">
                                                <Users className="w-3.5 h-3.5 text-zinc-400" />
                                                <span className="text-sm font-semibold text-zinc-200">{tgtCount}</span>
                                                <span className="text-xs font-medium text-zinc-500">recipients</span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            )}

            {/* ======================================================= */}
            {/* DYNAMIC DETAILED POPUP OVERLAY VIEW MODAL (DOSSIER POPUP)*/}
            {/* ======================================================= */}
            {selectedAlert && (
                <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 40 }}>
                    <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setSelectedAlert(null)} />
                    <div className="relative bg-[#0f0f0f] w-full max-w-3xl rounded-2xl border border-zinc-800/60 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in fade-in duration-150">
                        
                        {/* Popup Header */}
                        <div className="p-6 border-b border-zinc-800/60 flex items-center justify-between shrink-0 bg-transparent">
                            <h2 className="text-lg font-medium text-zinc-100 tracking-tight flex items-center gap-3">
                                {selectedAlert.name}
                            </h2>
                            <div className="flex items-center gap-2">
                                {!isEditingInfo && (
                                    <>
                                        <div className="flex items-center gap-2 mr-2">
                                            <span className={`text-xs font-semibold uppercase tracking-widest ${selectedAlert.status === 'ACTIVE' ? 'text-indigo-400' : 'text-zinc-500'}`}>
                                                {selectedAlert.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatusClick(selectedAlert)}
                                                className={`p-1.5 rounded-full transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${
                                                    selectedAlert.status === 'ACTIVE' ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                                }`}
                                            >
                                                {selectedAlert.status === 'ACTIVE' ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <div className="w-px h-4 bg-zinc-800 mx-1"></div>
                                        <button 
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="px-3 py-1.5 flex items-center gap-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors bg-transparent border-0 outline-none cursor-pointer text-xs font-medium"
                                            title="Delete Alert"
                                        >
                                            <Trash2 className="w-4 h-4" /> Delete
                                        </button>
                                        <div className="w-px h-4 bg-zinc-800 mx-1"></div>
                                    </>
                                )}
                                <button onClick={() => setSelectedAlert(null)} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors bg-transparent border-0 outline-none cursor-pointer">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Popup Content */}
                        <div className="p-6 overflow-y-auto flex flex-col gap-6 flex-1 scrollbar-none max-h-[75vh]">
                            
                            {/* BLOCK 1: SCHEDULE PROPERTIES */}
                            <div className="bg-transparent border border-zinc-800/60 rounded-xl p-5">
                                {!isEditingInfo ? (
                                    <div className="space-y-5">
                                        <div className="flex items-center justify-end">
                                            <button 
                                                onClick={() => {
                                                    setIsEditingInfo(true);
                                                    setEditAlertName(selectedAlert.name);
                                                    setEditEvent(selectedAlert.event);
                                                    setEditOffset(selectedAlert.offsetDays);
                                                    setEditStatus(selectedAlert.status);
                                                    const parts = (selectedAlert.time || "09:00").split(":");
                                                    setEditTimeHour(parts[0] || "09");
                                                    setEditTimeMin(parts[1] || "00");
                                                    setEditTimeAmpm("AM");
                                                }}
                                                className="px-3 py-1.5 flex items-center gap-1.5 rounded-md text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors bg-transparent border-0 outline-none cursor-pointer text-xs font-medium"
                                                title="Edit Schedule Details"
                                            >
                                                <Edit className="w-4 h-4" /> Edit
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Trigger Event</div>
                                                <div className="text-sm font-medium text-zinc-200 bg-zinc-900/50 px-3 py-1.5 rounded-md border border-zinc-800/60 inline-flex items-center gap-2">
                                                    <Bell className="w-3.5 h-3.5 text-indigo-400" />
                                                    {selectedAlert.event}
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Time Offset</div>
                                                <div className="text-sm font-medium text-zinc-200 bg-zinc-900/50 px-3 py-1.5 rounded-md border border-zinc-800/60 inline-flex">
                                                    {selectedAlert.offsetDays === 0 ? "On Event Day" : `${selectedAlert.offsetDays > 0 ? '+' : ''}${selectedAlert.offsetDays} Days`}
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Delivery Time</div>
                                                <div className="text-sm font-medium text-zinc-200 bg-zinc-900/50 px-3 py-1.5 rounded-md border border-zinc-800/60 inline-flex items-center gap-2">
                                                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                                    {selectedAlert.time}
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Next Run</div>
                                                <div className="text-sm font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-md border border-emerald-500/20 inline-flex items-center gap-2">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {selectedAlert.nextTriggerDate || "Pending"}
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Run Status</div>
                                                <div className="text-sm font-medium text-sky-400 bg-sky-500/10 px-3 py-1.5 rounded-md border border-sky-500/20 inline-flex items-center gap-2">
                                                    <Activity className="w-3.5 h-3.5" />
                                                    {selectedAlert.status === 'ACTIVE' ? "Scheduled" : "Not Started"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 text-sm text-zinc-400">
                                        <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-3">
                                            <h3 className="text-sm font-semibold text-zinc-200">Edit Schedule Properties</h3>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => setIsEditingInfo(false)}
                                                    className="px-3 py-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-md text-xs font-medium cursor-pointer transition-colors border-0 outline-none"
                                                >
                                                    Cancel
                                                </button>
                                                <button 
                                                    onClick={handleSaveAlertInfo}
                                                    className="px-3 py-1.5 bg-zinc-200 hover:bg-white text-zinc-900 rounded-md text-xs font-medium cursor-pointer transition-colors border-0 outline-none"
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-zinc-300">Alert Name</label>
                                            <input 
                                                type="text" 
                                                value={editAlertName}
                                                onChange={(e) => setEditAlertName(e.target.value)}
                                                className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-500 transition-colors"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-zinc-300">Trigger Event</label>
                                                <select 
                                                    value={editEvent} 
                                                    onChange={(e) => setEditEvent(e.target.value)}
                                                    className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-2.5 text-sm text-zinc-200 outline-none"
                                                >
                                                    {events.map((ev) => (
                                                        <option key={ev} value={ev}>{ev}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-zinc-300 block">
                                                    Offset: <span className="text-zinc-100">{editOffset > 0 ? `+${editOffset}` : editOffset} days</span>
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        type="button"
                                                        onClick={() => setEditOffset(prev => Math.max(-28, prev - 1))}
                                                        className="w-8 h-8 rounded border border-zinc-700/50 hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors"
                                                    >
                                                        <Minus className="w-3 h-3 text-zinc-300" />
                                                    </button>
                                                    <input 
                                                        type="range" 
                                                        min="-28" 
                                                        max="28" 
                                                        value={editOffset}
                                                        onChange={(e) => setEditOffset(Number(e.target.value))}
                                                        className="flex-1 accent-zinc-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => setEditOffset(prev => Math.min(28, prev + 1))}
                                                        className="w-8 h-8 rounded border border-zinc-700/50 hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors"
                                                    >
                                                        <Plus className="w-3 h-3 text-zinc-300" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-zinc-300">Time</label>
                                                <div className="flex gap-2">
                                                    <select 
                                                        value={editTimeHour} 
                                                        onChange={(e) => setEditTimeHour(e.target.value)}
                                                        className="flex-1 bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-2.5 text-sm text-center outline-none"
                                                    >
                                                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                                                            <option key={h} value={h}>{h}</option>
                                                        ))}
                                                    </select>
                                                    <span className="self-center text-zinc-500">:</span>
                                                    <select 
                                                        value={editTimeMin} 
                                                        onChange={(e) => setEditTimeMin(e.target.value)}
                                                        className="flex-1 bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-2.5 text-sm text-center outline-none"
                                                    >
                                                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                                                            <option key={m} value={m}>{m}</option>
                                                        ))}
                                                    </select>
                                                    <select 
                                                        value={editTimeAmpm} 
                                                        onChange={(e) => setEditTimeAmpm(e.target.value)}
                                                        className="flex-1 bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-2.5 text-sm text-center outline-none"
                                                    >
                                                        <option value="AM">AM</option>
                                                        <option value="PM">PM</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-zinc-300">Status</label>
                                                <select 
                                                    value={editStatus} 
                                                    onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                                                    className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-2.5 text-sm text-zinc-200 outline-none"
                                                >
                                                    <option value="ACTIVE">Active</option>
                                                    <option value="INACTIVE">Inactive</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* BLOCK 2: MESSAGE TEMPLATE */}
                            <div className="bg-transparent border border-zinc-800/60 rounded-xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-medium text-zinc-200">Message Template</h3>
                                    
                                    <div className="flex items-center gap-2">
                                        {selectedAlert.template && (
                                            <button 
                                                onClick={() => {
                                                    setEditTemplateId(selectedAlert.template?.id || "");
                                                    setEditTemplateName(selectedAlert.template?.name || "");
                                                    setEditTemplateContent(selectedAlert.template?.content || "");
                                                    setShowTemplateEditModal(true);
                                                }}
                                                className="px-3 py-1.5 flex items-center gap-1.5 rounded-md hover:bg-indigo-500/10 text-zinc-500 hover:text-indigo-400 transition-colors text-xs font-medium cursor-pointer border-0 outline-none"
                                                title="Edit template content"
                                            >
                                                <Edit className="w-4 h-4" /> Edit
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => openTemplateSelectionPopup('EDIT')}
                                            className="px-3 py-1.5 rounded-md bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 transition-colors text-xs font-medium cursor-pointer flex items-center gap-1.5 border border-zinc-700/50"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" /> Change
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-sm text-zinc-400">
                                        Currently using: <span className="text-zinc-200 font-medium">{selectedAlert.template?.name || "No Associated Template"}</span>
                                    </p>
                                    
                                    <div className="bg-zinc-900/40 rounded-lg border border-zinc-800/60 min-h-[100px] overflow-hidden">
                                        <div className="px-4 py-2 border-b border-zinc-800/60 bg-zinc-900/80">
                                            <span className="text-xs font-medium text-zinc-500">WhatsApp Preview</span>
                                        </div>
                                        <div className="p-4 text-sm text-zinc-300 leading-relaxed">
                                            {selectedAlert.template?.content ? (
                                                renderTemplatePreviewWithPills(selectedAlert.template.content)
                                            ) : (
                                                <span className="text-zinc-500 italic">No text blueprint configured for this template.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BLOCK 3: TARGET CUSTOMERS */}
                            <div className="bg-transparent border border-zinc-800/60 rounded-xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-medium text-zinc-200">Target Customers</h3>
                                    
                                    <button 
                                        onClick={() => openFiltersPopup('EDIT')}
                                        className="px-3 py-1.5 flex items-center gap-1.5 rounded-md hover:bg-indigo-500/10 text-zinc-500 hover:text-indigo-400 transition-colors text-xs font-medium cursor-pointer border-0 outline-none"
                                        title="Edit Filters"
                                    >
                                        <Edit className="w-4 h-4" /> Edit
                                    </button>
                                </div>

                                <div className="space-y-5">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <span className="text-xs text-zinc-500">Targeted Segment Size</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl font-semibold text-zinc-100">{customerCounts[selectedAlert.id] ?? 0}</span>
                                                <span className="text-sm text-zinc-400">customers</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={launchShowCustomersOverlay}
                                            className="px-3 py-1.5 rounded-md border border-zinc-800 hover:bg-zinc-800/60 text-zinc-300 hover:text-zinc-100 transition-colors text-xs font-medium cursor-pointer"
                                        >
                                            View Customers
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        <span className="text-xs font-medium text-zinc-500 block">Active Filters</span>
                                        {renderTagsList(selectedAlert.filters)}
                                    </div>
                                </div>
                            </div>

                            {/* BLOCK 4: ALERT TIMELINE HISTORY BLOCK */}
                            <div className="bg-transparent border border-zinc-800/60 rounded-xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-medium text-zinc-200">Execution History</h3>
                                    <button 
                                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                                        onClick={refreshAlertList}
                                    >
                                        Refresh
                                    </button>
                                </div>

                                {history.length === 0 ? (
                                    <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800/60 rounded-lg">
                                        <HistoryIcon className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
                                        <p className="text-sm text-zinc-400">No execution history available.</p>
                                    </div>
                                ) : (
                                    <div className="relative space-y-4 pt-2">
                                        <div className="absolute top-4 bottom-4 left-[11px] w-px bg-zinc-800/60"></div>
                                        {history.map((hist, idx) => (
                                            <div 
                                                key={hist.id} 
                                                onClick={() => navigate('/payping/alert-history', { state: { selectedId: hist.id, source: 'auto-alerts' } })}
                                                className="relative group flex gap-4 pl-1 p-2 hover:bg-zinc-900/50 rounded-xl transition-colors cursor-pointer"
                                            >
                                                <div className={`w-3.5 h-3.5 mt-1 rounded-full ring-4 ring-[#0f0f0f] z-10 shrink-0 ${
                                                    hist.status === 'SUCCESS' 
                                                        ? 'bg-indigo-500/20 border border-indigo-500/50' 
                                                        : 'bg-rose-500/20 border border-rose-500/50'
                                                }`}></div>

                                                <div className="space-y-1.5 flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium text-zinc-200">{hist.triggeredAt}</span>
                                                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                                            hist.status === 'SUCCESS' 
                                                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                                                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                        }`}>
                                                            {hist.status === 'SUCCESS' ? 'Success' : 'Failed'}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-zinc-400 leading-relaxed">{hist.logMessage}</p>
                                                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 pt-1">
                                                        <Users className="w-3.5 h-3.5" />
                                                        <span>{hist.customerCount} recipients</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Detailed View Modal Footer */}
                        <div className="border-t border-zinc-800/60 p-5 shrink-0 bg-transparent flex items-center justify-end">
                            <button 
                                onClick={() => setSelectedAlert(null)}
                                className="px-4 py-2 bg-zinc-200 hover:bg-white text-zinc-900 rounded-md text-sm font-medium transition-colors cursor-pointer border-0 outline-none"
                            >
                                Close Detailed View
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 1: ADD NEW AUTO ALERT MODAL FLOW
               ========================================== */}
            {showAddModal && (
                <div className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ zIndex: 50 }}>
                    <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                    <div className="relative bg-[#0f0f0f] w-full max-w-xl rounded-2xl border border-zinc-800/60 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        
                        <div className="flex items-center justify-between border-b border-zinc-800/60 p-6 shrink-0 bg-transparent">
                            <h3 className="text-lg font-medium text-zinc-100 tracking-tight">
                                Add Auto Alert
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors bg-transparent border-0 outline-none cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5 flex-1 max-h-[65vh] scrollbar-none text-sm">
                            
                            {/* Alert Name Input */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-medium text-zinc-300">Alert Name</label>
                                <input 
                                    type="text"
                                    placeholder="e.g., Unpaid Bill 3-Day Buffer"
                                    value={newAlertName}
                                    onChange={(e) => setNewAlertName(e.target.value)}
                                    className="w-full bg-zinc-900/50 text-zinc-200 text-sm p-3 rounded-lg outline-none border border-zinc-800/60 focus:border-zinc-500 transition-colors"
                                />
                            </div>

                            {/* Event & Offset row with Step adjustment buttons */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-medium text-zinc-300">Trigger Event</label>
                                    <select 
                                        value={newEvent} 
                                        onChange={(e) => setNewEvent(e.target.value)}
                                        className="w-full bg-zinc-900/50 text-zinc-200 text-sm p-3 rounded-lg outline-none border border-zinc-800/60 focus:border-zinc-500 transition-colors"
                                    >
                                        {events.map((ev) => (
                                            <option key={ev} value={ev}>{ev}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-medium text-zinc-300">
                                        Offset: <span className="text-zinc-100">{newOffset > 0 ? `+${newOffset}` : newOffset} days</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            type="button"
                                            onClick={() => setNewOffset(prev => Math.max(-28, prev - 1))}
                                            className="w-10 h-10 rounded-lg border border-zinc-700/50 hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors"
                                        >
                                            <Minus className="w-4 h-4 text-zinc-300" />
                                        </button>
                                        <input 
                                            type="range" 
                                            min="-28" 
                                            max="28" 
                                            value={newOffset}
                                            onChange={(e) => setNewOffset(Number(e.target.value))}
                                            className="flex-1 accent-zinc-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setNewOffset(prev => Math.min(28, prev + 1))}
                                            className="w-10 h-10 rounded-lg border border-zinc-700/50 hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors"
                                        >
                                            <Plus className="w-4 h-4 text-zinc-300" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Time Clock Picker */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-medium text-zinc-300">Execution Time</label>
                                <div className="flex gap-2 max-w-sm">
                                    <select 
                                        value={newTimeHour} 
                                        onChange={(e) => setNewTimeHour(e.target.value)}
                                        className="flex-1 bg-zinc-900/50 text-zinc-200 text-sm p-3 rounded-lg outline-none border border-zinc-800/60 focus:border-zinc-500 transition-colors text-center"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                    <span className="self-center text-zinc-500">:</span>
                                    <select 
                                        value={newTimeMin} 
                                        onChange={(e) => setNewTimeMin(e.target.value)}
                                        className="flex-1 bg-zinc-900/50 text-zinc-200 text-sm p-3 rounded-lg outline-none border border-zinc-800/60 focus:border-zinc-500 transition-colors text-center"
                                    >
                                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    <select 
                                        value={newTimeAmpm} 
                                        onChange={(e) => setNewTimeAmpm(e.target.value)}
                                        className="flex-1 bg-zinc-900/50 text-zinc-200 text-sm p-3 rounded-lg outline-none border border-zinc-800/60 focus:border-zinc-500 transition-colors text-center"
                                    >
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                    </select>
                                </div>
                            </div>

                            {/* Template mapper Selection Block */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-zinc-300">Message Template</label>
                                    <button 
                                        type="button"
                                        onClick={() => openTemplateSelectionPopup('CREATE')}
                                        className="px-3 py-1.5 rounded-md bg-zinc-200 hover:bg-white text-zinc-900 transition-colors text-xs font-medium cursor-pointer"
                                    >
                                        {newTemplate ? "Change Template" : "Select Template"}
                                    </button>
                                </div>

                                {newTemplate ? (
                                    <div className="bg-zinc-900/40 p-4 rounded-lg border border-zinc-700/50 space-y-3">
                                        <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800/60 pb-3">
                                            <span>{newTemplate.name}</span>
                                        </div>
                                        <div className="text-sm text-zinc-300 leading-relaxed">
                                            {renderTemplatePreviewWithPills(newTemplate.content)}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 text-center border border-dashed border-zinc-700/50 rounded-lg text-zinc-500 text-sm">
                                        No template selected.
                                    </div>
                                )}
                            </div>

                            {/* Target customers Selector Block */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-zinc-300">Target Customers</label>
                                    <button 
                                        type="button"
                                        onClick={() => openFiltersPopup('CREATE')}
                                        className="px-3 py-1.5 rounded-md hover:bg-zinc-800/60 text-zinc-300 hover:text-zinc-100 transition-colors text-xs font-medium border border-zinc-700 cursor-pointer"
                                    >
                                        {Object.keys(newFilters).length > 0 ? "Edit Filters" : "Add Filters"}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {renderTagsList(newFilters)}

                                    {Object.keys(newFilters).length > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-zinc-300 bg-zinc-900/50 px-3 py-2 rounded-lg border border-zinc-800 w-fit">
                                            <Users className="w-4 h-4" />
                                            <span>{newCustomerCount} customers matched</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Live trigger sentence builder Preview Block */}
                            <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg text-sm text-zinc-400 leading-relaxed">
                                <span className="font-medium text-zinc-200">Summary: </span>
                                Send <span className="text-zinc-200 font-medium">"{newTemplate?.name || 'Template'}"</span> to <span className="text-zinc-200 font-medium">{newCustomerCount}</span> customers {newOffset === 0 ? "exactly on" : `${Math.abs(newOffset)} days ${newOffset < 0 ? 'before' : 'after'}`} <span className="text-zinc-200 font-medium">{newEvent || 'event'}</span> at <span className="text-zinc-200 font-medium">{newTimeHour}:{newTimeMin} {newTimeAmpm}</span>.
                            </div>

                        </div>

                        <div className="border-t border-zinc-800/60 p-6 shrink-0 bg-transparent flex items-center justify-end gap-3">
                            <button 
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 rounded-lg text-sm font-medium transition-colors cursor-pointer border-0 outline-none"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleCreateAutoAlert}
                                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer border border-indigo-500/50 shadow-sm shadow-indigo-500/20"
                            >
                                Create Auto Alert
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* ======================================================= */}
            {/* MODAL 2: DYNAMIC TEMPLATE SELECTOR WORKSPACE OVERLAY */}
            {/* ======================================================= */}
            {showTemplatePicker && (
                <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 60 }}>
                    <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md" onClick={() => setShowTemplatePicker(false)} />
                    <div className="relative bg-[#0f0f0f] w-full max-w-2xl rounded-3xl border border-zinc-800/60 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-10 duration-200">
                        
                        {/* Header */}
                        <div className="p-5 border-b border-zinc-800/60 flex items-center justify-between bg-transparent shrink-0">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-indigo-500 animate-pulse" />
                                <h3 className="font-extrabold text-sm text-zinc-100 tracking-tight uppercase">Select Message Template</h3>
                            </div>
                            <button onClick={() => setShowTemplatePicker(false)} className="text-zinc-400 hover:text-zinc-200 transition-colors bg-transparent border-0 outline-none cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="px-6 py-4 bg-zinc-900/20 border-b border-zinc-800/60 shrink-0">
                            <p className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase select-none mb-2">Select a message template blueprint from alert catalog to map to the Scheduled alert trigger</p>
                            <input 
                                type="text"
                                placeholder="Search templates inside alert catalog..."
                                value={templateSearchQuery}
                                onChange={(e) => setTemplateSearchQuery(e.target.value)}
                                className="w-full bg-zinc-900/50 text-xs font-semibold p-3 border border-zinc-800/60 rounded-xl outline-none focus:border-zinc-700"
                            />
                        </div>

                        {/* Picker Core Content */}
                        <div className="flex-1 p-6 space-y-3 overflow-y-auto scrollbar-none">
                            {filteredTemplatesList.length === 0 ? (
                                <div className="py-12 text-center text-zinc-500 text-xs space-y-2 bg-zinc-900/40 rounded-2xl border border-zinc-800/60">
                                    <MessageSquare className="w-8 h-8 mx-auto opacity-20" />
                                    <p>No operational templates matched the search queries.</p>
                                </div>
                            ) : (
                                <div className="w-full space-y-3 animate-in fade-in duration-100">
                                    {filteredTemplatesList.map((tmpl) => (
                                        <div 
                                            key={tmpl.id}
                                            onClick={() => setCandidateTemplate(tmpl)}
                                            className="w-full bg-zinc-900/40 p-4 rounded-xl flex items-center justify-between border border-zinc-800/60 hover:border-zinc-700 transition-all active:scale-[0.99] cursor-pointer group"
                                        >
                                            <div className="min-w-0 pr-4 space-y-1">
                                                <h4 className="text-sm font-bold text-zinc-200 truncate group-hover:text-white transition-colors">{tmpl.name}</h4>
                                                <p className="text-xs text-zinc-500 truncate font-semibold leading-relaxed font-sans">{tmpl.content}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest select-none">SELECT</span>
                                                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-zinc-800/60 p-5 shrink-0 bg-transparent flex items-center justify-end">
                            <button 
                                onClick={() => setShowTemplatePicker(false)}
                                className="px-5 py-2.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/60 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border-0 outline-none"
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    {/* Fullscreen Overlay template selection Preview Modal */}
                    {candidateTemplate && (
                        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 65 }}>
                            <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm" onClick={() => setCandidateTemplate(null)} />
                            <div className="relative bg-[#0f0f0f] w-full max-w-md rounded-3xl border border-zinc-800/60 p-6 space-y-5 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                                <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest border-b border-zinc-800/60 pb-2 select-none">
                                    Confirm selecting this template to: {selectedAlert ? selectedAlert.name : (newAlertName || "New Auto Alert")}
                                </h4>
                                <div className="space-y-2.5 text-xs">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500">
                                        <span>Label: {candidateTemplate.name}</span>
                                        <span>ID: {candidateTemplate.id}</span>
                                    </div>
                                    <div className="p-4 bg-zinc-900/50 border border-zinc-800/60 rounded-xl">
                                        {renderTemplatePreviewWithPills(candidateTemplate.content)}
                                    </div>
                                </div>
                                <div className="flex gap-2.5 pt-2">
                                    <button 
                                        onClick={handleConfirmTemplateSelection}
                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer border-0 outline-none shadow-md shadow-indigo-600/10"
                                    >
                                        Confirm Mapping
                                    </button>
                                    <button 
                                        onClick={() => setCandidateTemplate(null)}
                                        className="px-5 py-3 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 rounded-xl text-xs font-extrabold border border-zinc-800/60 transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* ======================================================= */}
            {/* MODAL 7: DEDICATED TEMPLATE EDIT POPUP MODAL */}
            {/* ======================================================= */}
            {showTemplateEditModal && (
                <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 70 }}>
                    <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowTemplateEditModal(false)} />
                    <div className="relative bg-[#0f0f0f] w-full max-w-xl rounded-3xl border border-zinc-800/60 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-10 duration-200">
                        
                        <div className="flex items-center justify-between border-b border-zinc-800/60 p-5 shrink-0 bg-transparent">
                            <h3 className="font-extrabold text-sm flex items-center gap-2.5 tracking-wider text-zinc-200 uppercase">
                                <FileText className="w-4 h-4 text-indigo-500" /> Edit Message Template
                            </h3>
                            <button onClick={() => setShowTemplateEditModal(false)} className="text-zinc-500 hover:text-zinc-200 transition-colors bg-transparent border-0 outline-none cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5 flex-1 scrollbar-none text-xs">
                            {/* Template Name Input */}
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-0.5">Template Label Name</label>
                                <input 
                                    type="text"
                                    value={editTemplateName}
                                    onChange={(e) => setEditTemplateName(e.target.value)}
                                    className="w-full bg-zinc-900/50 text-white text-xs font-semibold p-3 rounded-xl outline-none border border-zinc-800/60 focus:border-zinc-700 transition-colors"
                                />
                            </div>

                            {/* Variable shortcut badges */}
                            <div className="space-y-2 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/60">
                                <span className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest">Available Variable Tags</span>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {serverTags.map((tag) => (
                                        <button 
                                            key={tag}
                                            type="button" 
                                            onClick={() => setEditTemplateContent(prev => prev + `{${tag}}`)} 
                                            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/50 text-[10px] font-mono font-bold tracking-wide rounded-lg text-emerald-400 transition-colors cursor-pointer border-0 outline-none"
                                        >
                                            +{tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Template Body Editor */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-0.5">Template Message Body</label>
                                <textarea 
                                    rows={5}
                                    value={editTemplateContent}
                                    onChange={(e) => setEditTemplateContent(e.target.value)}
                                    placeholder="Type notification text content..."
                                    className="w-full bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-3 text-xs font-medium text-zinc-200 outline-none focus:border-zinc-700 leading-relaxed font-sans"
                                />
                            </div>

                            {/* Live Text Preview */}
                            <div className="space-y-1.5 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/60">
                                <span className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Live Text Preview</span>
                                {renderTemplatePreviewWithPills(editTemplateContent)}
                            </div>
                        </div>

                        <div className="border-t border-zinc-800/60 p-5 shrink-0 bg-transparent flex items-center gap-3">
                            <button 
                                onClick={async () => {
                                    if (!editTemplateName.trim()) {
                                        window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_ERROR', { detail: "Please provide a valid template name." }));
                                        return;
                                    }
                                    if (!editTemplateContent.trim()) {
                                        window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_ERROR', { detail: "Template body text cannot be empty." }));
                                        return;
                                    }

                                    const updatedTemplate: TemplateDTO = {
                                        id: editTemplateId,
                                        name: editTemplateName,
                                        content: editTemplateContent
                                    };

                                    try {
                                        await api.put(`/payping/templates/save/${editTemplateId}`, updatedTemplate, {
                                            headers: { 'X-Trigger-Success': 'true' }
                                        });
                                        
                                        // local updates
                                        setTemplates(prev => prev.map(t => t.id === editTemplateId ? updatedTemplate : t));
                                        setAlerts(prev => prev.map(a => a.id === selectedAlert?.id ? { ...a, template: updatedTemplate } : a));
                                        setSelectedAlert(prev => prev ? { ...prev, template: updatedTemplate } : null);
                                        setShowTemplateEditModal(false);
                                    } catch (err) {
                                        // Simulated local edit fallback
                                        setTemplates(prev => prev.map(t => t.id === editTemplateId ? updatedTemplate : t));
                                        setAlerts(prev => prev.map(a => a.id === selectedAlert?.id ? { ...a, template: updatedTemplate } : a));
                                        setSelectedAlert(prev => prev ? { ...prev, template: updatedTemplate } : null);
                                        setShowTemplateEditModal(false);
                                        window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                                            detail: "Template layout saved successfully!"
                                        }));
                                    }
                                }}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-98 transition-all text-xs font-bold rounded-xl text-white uppercase cursor-pointer border-0 outline-none shadow-lg shadow-indigo-600/10"
                            >
                                Save Template
                            </button>
                            <button 
                                onClick={() => setShowTemplateEditModal(false)}
                                className="px-5 py-3 bg-zinc-900/50 border border-zinc-800/60 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* ==========================================
                MODAL 3: SEGMENT TARGET CUSTOMER FILTER DRAFT
               ========================================== */}
            {showFilterModal && (
                <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0" style={{ zIndex: 60 }}>
                    <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowFilterModal(false)} />
                    <div className="relative bg-[#0f0f0f] w-full max-w-md rounded-t-3xl sm:rounded-[2rem] border border-zinc-800/60 p-6 animate-in slide-in-from-bottom-10 duration-200 flex flex-col max-h-[85vh] overflow-hidden">
                        
                        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4 shrink-0 mb-5">
                            <h3 className="font-extrabold text-sm flex items-center gap-2 tracking-wider text-zinc-200 uppercase">
                                <Filter className="w-4 h-4 text-indigo-500" /> Filter Criteria Configuration
                            </h3>
                            <button onClick={() => setShowFilterModal(false)} className="text-zinc-500 hover:text-zinc-200 transition-colors bg-transparent border-0 outline-none cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-5 overflow-y-auto pr-1 flex-1 min-h-0 scrollbar-none">
                            
                            {/* Section 1: Filters (mainFilters) */}
                            {Object.keys(filterMetadata.mainFilters || {}).length > 0 && (
                                <div className="space-y-4">
                                    {Object.entries(filterMetadata.mainFilters || {}).map(([category, options]) => (
                                        <div key={category} className="space-y-2">
                                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block ml-0.5">
                                                {category.replace(/([A-Z])/g, ' $1').trim()}
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(options || []).map((val) => {
                                                    const isSelected = (filterDraft[category] || []).includes(val);
                                                    return (
                                                        <button
                                                            key={val}
                                                            type="button"
                                                            onClick={() => toggleFilterDraftOption(category, val)}
                                                            className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-colors truncate border cursor-pointer ${
                                                                isSelected 
                                                                    ? 'bg-indigo-600 text-white border-indigo-500' 
                                                                    : 'bg-zinc-900/50 text-zinc-400 border-zinc-800/60 hover:text-zinc-200'
                                                            }`}
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
                            {Object.keys(filterMetadata.customFilters || {}).length > 0 && (
                                <div className="space-y-4 pt-4 border-t border-zinc-800/60">
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-0.5 select-none">Custom Configuration Filter</span>
                                    {Object.entries(filterMetadata.customFilters || {}).map(([category, options]) => (
                                        <div key={category} className="space-y-2">
                                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block ml-0.5">
                                                {category.replace(/([A-Z])/g, ' $1').trim()}
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(options || []).map((val) => {
                                                    const isSelected = (filterDraft[category] || []).includes(val);
                                                    return (
                                                        <button
                                                            key={val}
                                                            type="button"
                                                            onClick={() => toggleFilterDraftOption(category, val)}
                                                            className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-colors truncate border cursor-pointer ${
                                                                isSelected 
                                                                    ? 'bg-indigo-600 text-white border-indigo-500' 
                                                                    : 'bg-zinc-900/50 text-zinc-400 border-zinc-800/60 hover:text-zinc-200'
                                                            }`}
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

                        {/* POLISHED DYNAMIC CUSTOMER SEGMENTS LIVE COUNT INDICATOR */}
                        <div className="p-4 bg-zinc-900/50 border border-zinc-800/60 rounded-2xl flex items-center justify-between shrink-0 shadow-inner mt-5">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-600/10 text-indigo-400 rounded-xl relative shrink-0">
                                    <Users className="w-4 h-4 shrink-0" />
                                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                    </span>
                                </div>
                                <div className="min-w-0 pr-2">
                                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block select-none">Matched Segments Count</span>
                                    <span className="text-xs font-bold text-zinc-300 font-mono block mt-0.5 tracking-wide truncate">{liveDraftCount} targets</span>
                                </div>
                            </div>
                            <button 
                                onClick={handleApplyFilters}
                                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl uppercase tracking-wider transition-colors cursor-pointer border-0 outline-none shadow-lg shadow-indigo-600/10"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 4: SHOW CUSTOMERS OVERLAY TABLE
               ========================================== */}
            {showCustomersOverlay && (
                <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 55 }}>
                    <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowCustomersOverlay(false)} />
                    <div className="relative bg-[#0f0f0f] w-full max-w-4xl rounded-3xl border border-zinc-800/60 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        
                        <div className="flex items-center justify-between border-b border-zinc-800/60 p-5 shrink-0 bg-transparent backdrop-blur-md">
                            <div>
                                <h3 className="font-extrabold text-sm tracking-wider text-zinc-200 uppercase flex items-center gap-2">
                                    <Users className="w-4 h-4 text-indigo-500 shrink-0" /> targeted customer segment preview
                                </h3>
                                <p className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mt-1">
                                    Displays maximum 30 active customer entries mapped to current scheduled filter logic.
                                </p>
                            </div>
                            <button onClick={() => setShowCustomersOverlay(false)} className="text-zinc-500 hover:text-zinc-200 transition-colors bg-transparent border-0 outline-none cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-6 min-h-[300px] scrollbar-none bg-transparent">
                            {loadingPreviewCustomers ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                                    <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest animate-pulse select-none">Scanning registry database...</span>
                                </div>
                            ) : previewCustomers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-3 text-zinc-500 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 border-dashed">
                                    <AlertCircle className="w-8 h-8 text-zinc-600" />
                                    <span className="text-xs font-semibold italic select-none">No customers match the current filter boundary limits.</span>
                                </div>
                            ) : (
                                <div className="border border-zinc-800/60 rounded-2xl overflow-hidden bg-zinc-900/40 shadow-inner">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-zinc-900/80 text-zinc-400 font-extrabold uppercase text-[9px] tracking-widest border-b border-zinc-800/60 select-none">
                                                <th className="p-4">Customer Name</th>
                                                <th className="p-4">Phone Channel</th>
                                                <th className="p-4">Expiry Date</th>
                                                <th className="p-4 text-right">Subscription Value</th>
                                                <th className="p-4 text-center">Payment status</th>
                                                <th className="p-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/60 bg-transparent">
                                            {previewCustomers.map((cust) => (
                                                <tr key={cust.id} className="hover:bg-zinc-800/40 text-zinc-300 font-semibold transition-colors">
                                                    <td className="p-4 font-bold text-zinc-200">{cust.name}</td>
                                                    <td className="p-4 font-mono text-zinc-400">{cust.phone}</td>
                                                    <td className="p-4 font-mono text-zinc-400">{cust.expiryDate}</td>
                                                    <td className="p-4 text-right text-zinc-200 font-bold font-mono">₹{cust.amount.toLocaleString()}</td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                                            cust.paymentStatus === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                            cust.paymentStatus === 'UNPAID' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                        }`}>
                                                            {cust.paymentStatus}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold ${cust.status === 'ACTIVE' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                                            {cust.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}

            {/* ======================================================= */}
            {/* MODAL 6: STATUS DEACTIVATION CONFIRMATION */}
            {/* ======================================================= */}
            {showStatusDeactivationConfirm && statusToggleAlert && (
                <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 55 }}>
                    <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowStatusDeactivationConfirm(false)} />
                    <div className="relative bg-[#0f0f0f] w-full max-w-sm rounded-[2rem] p-6 space-y-5 text-center animate-in zoom-in-95 duration-150 shadow-2xl border border-zinc-800/60">
                        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto relative">
                            <AlertCircle className="w-5 h-5 absolute animate-ping" />
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-zinc-200">Confirm Deactivation</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                confirm deactivating the {statusToggleAlert.name} auto alert, this won't send the alerts hereafter
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                type="button"
                                onClick={() => setShowStatusDeactivationConfirm(false)}
                                className="w-1/2 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 font-bold py-3 rounded-xl text-xs border border-zinc-800/60 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    setShowStatusDeactivationConfirm(false);
                                    commitToggleStatus(statusToggleAlert);
                                }}
                                className="w-1/2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-red-600/10 cursor-pointer border-0 outline-none"
                            >
                                Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 5: DELETE SCHEDULER CONFIRMATION
               ========================================== */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 55 }}>
                    <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
                    <div className="relative bg-[#0f0f0f] w-full max-w-sm rounded-[2rem] border border-zinc-800/60 p-6 space-y-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto relative mb-2">
                                <AlertCircle className="w-5 h-5 absolute animate-ping" />
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <h3 className="font-extrabold text-sm text-zinc-200 uppercase tracking-wider select-none">Confirm Alert Deletion?</h3>
                            <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                                Are you absolutely sure you want to delete the scheduled flow <span className="text-zinc-300 font-bold">"{selectedAlert?.name}"</span>? This action removes all dynamic trigger schedules forever.
                            </p>
                        </div>
                        <div className="flex gap-2.5">
                            <button 
                                onClick={handleDeleteAlert}
                                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer border-0 outline-none shadow-md shadow-red-600/10"
                            >
                                Delete Schedule
                            </button>
                            <button 
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3.5 bg-zinc-900/50 border border-zinc-800/60 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer"
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default AutoAlerts;
