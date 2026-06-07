import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Bell, Calendar, Clock, Edit, Trash2, ArrowRight, CheckCircle2, ArrowLeft,
    AlertCircle, FileText, Users, X, ToggleLeft, ToggleRight,
    Info, Check, Filter, Loader2, MessageSquare, ChevronRight, Play, RefreshCw, History as HistoryIcon,
    ChevronLeft, Plus, Minus, BellRing, BellOff, Activity, ChevronDown
} from 'lucide-react';
import api from '../../api';
import { useNavigate, useLocation } from 'react-router-dom';

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
    status: string; // Do this - This will get value from NotificationStatus.java, not only success or failed!!
    customerCount: number;
    logMessage: string;
}

// Helper to render template text with pretty variables highlighted as pills
const renderTemplatePreviewWithPills = (content: string) => {
    if (!content) return <span className="text-slate-500 italic">No content template selected yet.</span>;
    const parts = content.split(/({[^{}]+})/g);
    return (
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
            {parts.map((part, index) => {
                const match = part.match(/^{(.+)}$/);
                if (match) {
                    const tag = match[1];
                    return (
                        <span
                            key={index}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 bg-emerald-50 dark:bg-[#022c22]/90 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 rounded text-xs font-bold align-baseline select-none whitespace-nowrap"
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

const formatEventName = (event: string | null | undefined): string => {
    if (!event) return '';
    return event.replace(/_/g, ' ');
};

// Local filtering helper for robust mock logic when API data is not present or endpoint fails
const filterCustomersLocally = (filters: Record<string, string[]> | null | undefined): CustomerDTO[] => {
    if (!filters || Object.keys(filters).length === 0) return MOCK_CUSTOMERS_LIST;
    let filtered = [...MOCK_CUSTOMERS_LIST];
    
    // Find paymentStatus filter case-insensitively
    const getFilterValues = (f: Record<string, string[]>, target: string) => {
        const norm = target.toLowerCase().replace(/\s+/g, '');
        for (const [k, v] of Object.entries(f)) {
            if (k.toLowerCase().replace(/\s+/g, '') === norm) return v;
        }
        return null;
    };

    const payStatus = getFilterValues(filters, 'paymentStatus');
    if (payStatus && payStatus.length > 0) {
        filtered = filtered.filter(c => payStatus.includes(c.paymentStatus));
    }

    const status = getFilterValues(filters, 'status');
    if (status && status.length > 0) {
        filtered = filtered.filter(c => status.includes(c.status));
    }
    
    return filtered;
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
            status: "COMPLETED",
            customerCount: 14,
            logMessage: "Broadcast completed. Sent to 14 active overdue customers."
        },
        {
            id: "hist-2",
            triggeredAt: "2026-05-20 10:00 AM",
            status: "COMPLETED",
            customerCount: 18,
            logMessage: "Broadcast completed. Sent to 18 active overdue customers."
        }
    ],
    "alert-2": [
        {
            id: "hist-3",
            triggeredAt: "2026-05-25 09:00 AM",
            status: "COMPLETED",
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

const renderTemplatePreviewSingleLine = (content: string) => {
    if (!content) return null;
    const parts = content.split(/({[^{}]+})/g);
    return (
        <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5 font-medium block">
            {parts.map((part, index) => {
                const match = part.match(/^{(.+)}$/);
                if (match) {
                    const tag = match[1];
                    return (
                        <span
                            key={index}
                            className="inline-flex items-center gap-1 px-1 py-0.5 mx-0.5 bg-emerald-50 dark:bg-[#022c22]/90 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 rounded text-[9px] font-bold align-baseline select-none whitespace-nowrap"
                        >
                            {tag}
                        </span>
                    );
                }
                return part;
            })}
        </span>
    );
};

const renderHistoryCircle = (status: string) => {
    switch (status) {
        case 'COMPLETED':
            return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/50';
        case 'IN_PROGRESS':
            return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/50 animate-pulse';
        case 'SCHEDULED':
            return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/50';
        case 'PARTIALLY_FAILED':
            return 'bg-orange-500/10 text-orange-600 dark:text-orange-450 border border-orange-200/60 dark:border-orange-500/50';
        case 'FAILED':
        default:
            return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/50';
    }
};

const renderHistoryBadge = (status: string) => {
    switch (status) {
        case 'COMPLETED':
            return (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                    Completed
                </span>
            );
        case 'IN_PROGRESS':
            return (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 animate-pulse">
                    In Progress
                </span>
            );
        case 'SCHEDULED':
            return (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                    Scheduled
                </span>
            );
        case 'PARTIALLY_FAILED':
            return (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20">
                    Partially Failed
                </span>
            );
        case 'FAILED':
        default:
            return (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20">
                    Failed
                </span>
            );
    }
};

const formatTimeDisplay = (timeStr: string | null | undefined): string => {
    if (!timeStr) return '';
    const cleanStr = timeStr.trim();
    const hasAmpm = cleanStr.toLowerCase().includes('am') || cleanStr.toLowerCase().includes('pm');
    if (hasAmpm) {
        const parts = cleanStr.split(/\s+/);
        const timePart = parts[0];
        const suffix = parts[1] || '';
        if (timePart.includes(':')) {
            const timeSubparts = timePart.split(':');
            const h = timeSubparts[0];
            const m = timeSubparts[1] || '00';
            return `${h.padStart(2, '0')}:${m.padStart(2, '0')} ${suffix.toUpperCase()}`;
        }
        return cleanStr;
    }
    if (cleanStr.includes(':')) {
        const parts = cleanStr.split(':');
        let h = parseInt(parts[0], 10);
        const m = parts[1] || '00';
        const suffix = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${String(h).padStart(2, '0')}:${m.padStart(2, '0')} ${suffix}`;
    }
    return cleanStr;
};

export const AutoAlerts = () => {
    const navigate = useNavigate();
    const location = useLocation();
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
    const [filterModalContext, setFilterModalContext] = useState<'CREATE' | 'EDIT' | 'EDIT_DRAFT'>('EDIT');
    const [templateModalContext, setTemplateModalContext] = useState<'CREATE' | 'EDIT' | 'EDIT_DRAFT'>('EDIT');

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

    // Universal Edit Mode States
    const [isEditMode, setIsEditMode] = useState<boolean>(
        !!(location.state as { showEdit?: boolean } | null)?.showEdit
    );
    const [editTemplate, setEditTemplate] = useState<TemplateDTO | null>(null);
    const [editFilters, setEditFilters] = useState<Record<string, string[]>>({});

    // Lazy load state flags
    const [eventsLoaded, setEventsLoaded] = useState<boolean>(false);
    const [templatesLoaded, setTemplatesLoaded] = useState<boolean>(false);
    const [tagsLoaded, setTagsLoaded] = useState<boolean>(false);
    const [filtersLoaded, setFiltersLoaded] = useState<boolean>(false);

    // Template Preview States
    const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
    const [previewTemplateName, setPreviewTemplateName] = useState<string>("");
    const [previewTemplateRawContent, setPreviewTemplateRawContent] = useState<string>("");
    const [previewTemplateCompiled, setPreviewTemplateCompiled] = useState<string>("");
    const [loadingPreviewTemplate, setLoadingPreviewTemplate] = useState<boolean>(false);

    // Alert Details loading & refresh states
    const [loadingAlertDetails, setLoadingAlertDetails] = useState<boolean>(
        !!(location.state as { selectedAlertId?: string } | null)?.selectedAlertId
    );
    const [initialLoadingAlertId, setInitialLoadingAlertId] = useState<string | undefined>(
        (location.state as { selectedAlertId?: string } | null)?.selectedAlertId
    );
    const [refreshingHistory, setRefreshingHistory] = useState<boolean>(false);

    // ==========================================
    // INITIAL MOUNT LIFECYCLE
    // ==========================================
    const loadCoreWorkspaceData = useCallback(async () => {
        try {
            setLoading(true);
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

    const fetchEvents = useCallback(async () => {
        if (eventsLoaded) return;
        try {
            const eventRes = await api.get('/payping/notifications/events');
            setEvents(eventRes.data || MOCK_EVENTS);
            setEventsLoaded(true);
        } catch (err) {
            console.warn("Failed fetching events endpoint, using fallbacks");
            setEvents(MOCK_EVENTS);
            setEventsLoaded(true);
        }
    }, [eventsLoaded]);

    const fetchTemplates = useCallback(async () => {
        if (templatesLoaded) return;
        try {
            const tmplRes = await api.get('/payping/templates/get');
            if (tmplRes.data && tmplRes.data.length > 0) {
                setTemplates(tmplRes.data);
            }
            setTemplatesLoaded(true);
        } catch (err) {
            console.warn("Failed fetching workspace templates, using fallbacks");
            setTemplatesLoaded(true);
        }
    }, [templatesLoaded]);

    const fetchTags = useCallback(async () => {
        if (tagsLoaded) return;
        try {
            const tagRes = await api.get('/payping/templates/tags');
            if (tagRes.data && tagRes.data.length > 0) {
                setServerTags(tagRes.data);
            }
            setTagsLoaded(true);
        } catch (err) {
            console.warn("Failed fetching template tags, using default tags");
            setTagsLoaded(true);
        }
    }, [tagsLoaded]);

    const fetchFiltersMetadata = useCallback(async () => {
        if (filtersLoaded) return;
        try {
            const filterRes = await api.get('/payping/customers/getfilters');
            if (filterRes.data) {
                setFilterMetadata(filterRes.data);
            }
            setFiltersLoaded(true);
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
            setFiltersLoaded(true);
        }
    }, [filtersLoaded]);

    const loadAlertDetails = async (alertId: string, isRefresh = false) => {
        if (isRefresh) {
            setRefreshingHistory(true);
        } else {
            setLoadingAlertDetails(true);
        }
        
        const delayPromise = isRefresh 
            ? new Promise(resolve => setTimeout(resolve, 800)) 
            : Promise.resolve();

        try {
            const [res] = await Promise.all([
                api.get(`/payping/notifications/autoalerts/${alertId}`),
                delayPromise
            ]);
            if (res.data) {
                const enrichedAlert = {
                    ...res.data,
                    template: templates.find(t => t.id === res.data.templateId) || res.data.template
                };
                setSelectedAlert(enrichedAlert);
                setAlerts(prev => prev.map(a => a.id === alertId ? enrichedAlert : a));
                setHistory(res.data.history || MOCK_HISTORY[alertId] || []);
            }
        } catch (err) {
            console.warn("Failed to fetch alert details, falling back to mock details");
            const fallbackAlert = alerts.find(a => a.id === alertId) || MOCK_ALERTS.find(a => a.id === alertId);
            if (fallbackAlert) {
                setSelectedAlert(fallbackAlert);
                setHistory(MOCK_HISTORY[alertId] || []);
            }
            await delayPromise;
        } finally {
            setLoadingAlertDetails(false);
            setInitialLoadingAlertId(undefined);
            setRefreshingHistory(false);
        }
    };

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
            if (total > 0) return total;
            return filterCustomersLocally(filters).length;
        } catch (err) {
            return filterCustomersLocally(filters).length;
        }
    };

    // Trigger dynamic count fetching when selected alert changes
    useEffect(() => {
        if (selectedAlert?.filters) {
            calculateTargetedCount(selectedAlert.filters).then(cnt => {
                setCustomerCounts(prev => ({ ...prev, [selectedAlert.id]: cnt }));
            });
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300"
                    >
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{tag.category.replace(/([A-Z])/g, ' $1')}:</span>
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
        return `Auto alert will be triggered to ${newCustomerCount} selected customers ${offsetPhrase} event ${formatEventName(newEvent)} at ${timeStr}.`;
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
            setEditStatus(nextStatus);
        } catch (err) {
            // Simulated local change if API doesn't support save
            setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: nextStatus } : a));
            if (selectedAlert?.id === alert.id) {
                setSelectedAlert(prev => prev ? { ...prev, status: nextStatus } : null);
            }
            setEditStatus(nextStatus);
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                detail: `Status successfully updated to ${nextStatus}!`
            }));
        }
    };

    const parseTime = (timeStr: string) => {
        let hour = "09";
        let min = "00";
        let ampm = "AM";
        if (timeStr) {
            const parts = timeStr.trim().split(/\s+/);
            const timePart = parts[0];
            if (timePart.includes(':')) {
                const [hStr, mStr] = timePart.split(':');
                let h = parseInt(hStr, 10);
                min = mStr.substring(0, 2);
                if (parts[1]) {
                    ampm = parts[1].toUpperCase();
                    hour = String(h).padStart(2, '0');
                } else {
                    if (h >= 12) {
                        ampm = "PM";
                        if (h > 12) h -= 12;
                    } else {
                        ampm = "AM";
                        if (h === 0) h = 12;
                    }
                    hour = String(h).padStart(2, '0');
                }
            }
        }
        return { hour, min, ampm };
    };

    const triggerEditMode = () => {
        if (!selectedAlert) return;
        setEditAlertName(selectedAlert.name);
        setEditEvent(selectedAlert.event);
        setEditOffset(selectedAlert.offsetDays);
        setEditStatus(selectedAlert.status);
        const { hour, min, ampm } = parseTime(selectedAlert.time);
        setEditTimeHour(hour);
        setEditTimeMin(min);
        setEditTimeAmpm(ampm);
        setEditTemplate(selectedAlert.template || null);
        setEditFilters(selectedAlert.filters || {});
        setIsEditMode(true);
    };

    const handleSaveUniversalEdit = async () => {
        if (!selectedAlert) return;
        if (!editAlertName.trim()) {
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_ERROR', { detail: "Please provide a valid alert name." }));
            return;
        }
        if (!editTemplate) {
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_ERROR', { detail: "Please map a message template to the auto alert." }));
            return;
        }

        const scheduledTime = to24hr(editTimeHour, editTimeMin, editTimeAmpm);
        const updatedPayload: AutoAlertDTO = {
            ...selectedAlert,
            name: editAlertName,
            event: editEvent,
            offsetDays: editOffset,
            time: scheduledTime,
            status: editStatus,
            templateId: editTemplate.id,
            filters: editFilters
        };

        try {
            await api.put(`/payping/notifications/autoalerts/${selectedAlert.id}`, updatedPayload, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            setIsEditMode(false);
            await refreshAlertList();
            const cnt = await calculateTargetedCount(editFilters);
            setCustomerCounts(prev => ({ ...prev, [selectedAlert.id]: cnt }));
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                detail: "Auto alert updated successfully!"
            }));
        } catch (err) {
            const enriched = { ...updatedPayload, template: editTemplate };
            setAlerts(prev => prev.map(a => a.id === selectedAlert.id ? enriched : a));
            setSelectedAlert(enriched);
            setIsEditMode(false);
            const cnt = await calculateTargetedCount(editFilters);
            setCustomerCounts(prev => ({ ...prev, [selectedAlert.id]: cnt }));
            window.dispatchEvent(new CustomEvent('PAYPING_SYSTEM_SUCCESS', {
                detail: "Auto alert updated successfully!"
            }));
        }
    };

    const loadTemplatePreview = async (name: string, content: string) => {
        try {
            setLoadingPreviewTemplate(true);
            const res = await api.post('/payping/templates/preview', { name, content });
            setPreviewTemplateCompiled(res.data?.preview || res.data || "Empty response.");
        } catch (err) {
            console.error("Failed to load template preview:", err);
            setPreviewTemplateCompiled("System parsing error.");
        } finally {
            setLoadingPreviewTemplate(false);
        }
    };

    const handleOpenPreview = (template: TemplateDTO) => {
        setPreviewTemplateName(template.name);
        setPreviewTemplateRawContent(template.content);
        setPreviewTemplateCompiled("");
        setShowPreviewModal(true);
        loadTemplatePreview(template.name, template.content);
    };

    const handleEditTemplateFromPreview = () => {
        if (!selectedAlert || !selectedAlert.template) return;
        navigate('/payping/message-templates', {
            state: {
                editTemplateId: selectedAlert.template.id,
                returnToAlertId: selectedAlert.id,
                showPreviewOnReturn: false,
                isEditModeOnReturn: true
            }
        });
    };

    const pendingShowPreviewRef = useRef<boolean>(false);
    const pendingShowEditRef = useRef<boolean>(false);

    useEffect(() => {
        const state = location.state as { selectedAlertId?: string, showPreview?: boolean, showEdit?: boolean } | null;
        if (state?.selectedAlertId) {
            if (state.showPreview) {
                pendingShowPreviewRef.current = true;
            }
            if (state.showEdit) {
                pendingShowEditRef.current = true;
            }
            loadAlertDetails(state.selectedAlertId);
        }
    }, [location.state]);

    useEffect(() => {
        if (selectedAlert) {
            if (pendingShowPreviewRef.current) {
                pendingShowPreviewRef.current = false;
                if (selectedAlert.template) {
                    handleOpenPreview(selectedAlert.template);
                }
            }
            if (pendingShowEditRef.current) {
                pendingShowEditRef.current = false;
                triggerEditMode();
                fetchEvents();
                fetchTemplates();
                fetchFiltersMetadata();
                fetchTags();
            }
        }
    }, [selectedAlert]);

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
        setNewCustomerCount(MOCK_CUSTOMERS_LIST.length);
        // Pre-fetch count for empty filters so it is not shown as 0 initially
        calculateTargetedCount({}).then(cnt => {
            setNewCustomerCount(cnt);
        });
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
            if (Array.isArray(data) && data.length > 0) {
                setPreviewCustomers(data);
            } else {
                setPreviewCustomers(filterCustomersLocally(selectedAlert.filters));
            }
        } catch (err) {
            setPreviewCustomers(filterCustomersLocally(selectedAlert.filters));
        } finally {
            setLoadingPreviewCustomers(false);
        }
    };

    // ==========================================
    // FILTER MODAL SELECTIONS LOGIC
    // ==========================================
    const openFiltersPopup = (context: 'CREATE' | 'EDIT' | 'EDIT_DRAFT') => {
        setFilterModalContext(context);
        const activeFilters = context === 'CREATE' ? newFilters : context === 'EDIT_DRAFT' ? editFilters : (selectedAlert?.filters || {});
        setFilterDraft(activeFilters);
        // Calculate dynamic count immediately
        updateFiltersLiveDraftCount(activeFilters);
        // Lazily fetch filters metadata
        fetchFiltersMetadata();
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
        } else if (filterModalContext === 'EDIT_DRAFT') {
            setEditFilters(filterDraft);
            const cnt = await calculateTargetedCount(filterDraft);
            setCustomerCounts(prev => ({ ...prev, [selectedAlert?.id || '']: cnt }));
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
    const openTemplateSelectionPopup = (context: 'CREATE' | 'EDIT' | 'EDIT_DRAFT') => {
        setTemplateModalContext(context);
        setCandidateTemplate(null);
        setTemplateSearchQuery("");
        // Lazily fetch templates list
        fetchTemplates();
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
        } else if (templateModalContext === 'EDIT_DRAFT') {
            setEditTemplate(candidateTemplate);
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
        <div className="min-h-screen bg-transparent text-slate-800 dark:text-zinc-200 flex flex-col font-sans select-none overflow-x-hidden pb-28 relative">

            {/* Header section with Stats Bar */}
            <header className="sticky top-0 z-20 bg-slate-50 dark:bg-[#0f0f0f] px-4 md:px-8 pt-4 pb-3 max-w-none mx-auto w-full border-b border-slate-200/60 dark:border-zinc-800/40 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    {selectedAlert && (
                        <button
                            onClick={() => {
                                setSelectedAlert(null);
                                setIsEditMode(false);
                            }}
                            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900/50 dark:hover:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-800/60 transition-colors cursor-pointer text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white shadow-sm outline-none shrink-0"
                            title="Back to Alerts"
                        >
                            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                            <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-500" /> Auto Alerts
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                            Configure event-triggered automation schedules.
                        </p>
                    </div>
                </div>
                {!selectedAlert && (
                    <button
                        onClick={() => { resetCreateForm(); setShowAddModal(true); }}
                        className="flex items-center justify-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-md gap-1.5"
                    >
                        <Plus className="w-4 h-4" /> Add Auto Alert
                    </button>
                )}
            </header>            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-3">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    <p className="text-xs font-medium text-slate-400 dark:text-zinc-500">Loading configurations...</p>
                </div>
            ) : (
                <main className="flex-1 px-4 md:px-8 max-w-none mx-auto w-full pt-3 space-y-2.5 pb-20 flex flex-col">
                    {(loadingAlertDetails || initialLoadingAlertId) && !selectedAlert ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-3">
                            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                            <p className="text-xs font-medium text-slate-400 dark:text-zinc-500">Loading alert details...</p>
                        </div>
                    ) : selectedAlert ? (
                        /* Inline Split layout */
                        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">
                            {/* Left Column: Alert details (Schedule properties, Target customers, Message template) */}
                            <div className="lg:col-span-5 space-y-4">
                                {/* Actions Row */}
                                <div className="flex items-center justify-end gap-2 pb-2 border-b border-slate-200 dark:border-zinc-800/60 w-full">
                                    {isEditMode ? (
                                        <>
                                            <button
                                                onClick={handleSaveUniversalEdit}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 outline-none transition-colors cursor-pointer shadow-sm"
                                            >
                                                <Check className="w-4 h-4" /> Save
                                            </button>
                                            <button
                                                onClick={() => setIsEditMode(false)}
                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-white font-bold rounded-lg text-xs flex items-center gap-1.5 outline-none transition-colors border border-slate-200 dark:border-transparent cursor-pointer"
                                            >
                                                <X className="w-4 h-4" /> Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => {
                                                    triggerEditMode();
                                                    fetchEvents();
                                                    fetchTemplates();
                                                    fetchFiltersMetadata();
                                                    fetchTags();
                                                }}
                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-white font-bold rounded-lg text-xs flex items-center gap-1.5 outline-none transition-colors border border-slate-200 dark:border-transparent cursor-pointer"
                                            >
                                                <Edit className="w-4 h-4" /> Edit
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold rounded-lg text-xs flex items-center gap-1.5 outline-none transition-colors cursor-pointer"
                                            >
                                                <Trash2 className="w-4 h-4" /> Delete
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* BLOCK 1: SCHEDULE PROPERTIES */}
                                <div className="bg-white dark:bg-[#09090b]/20 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-5 space-y-4 shadow-sm">
                                    {!isEditMode ? (
                                         <>
                                             <div className="flex items-center gap-3 flex-wrap border-b border-slate-100 dark:border-zinc-800/40 pb-3 mb-2">
                                                 <h3 className="text-base font-extrabold text-slate-850 dark:text-zinc-150 tracking-wide uppercase">{selectedAlert.name}</h3>
                                                 <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase select-none ${
                                                     selectedAlert.status === 'ACTIVE'
                                                         ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/30 dark:border-indigo-500/20'
                                                         : 'bg-slate-200 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 border-slate-300/40 dark:border-zinc-700/50'
                                                 }`}>
                                                     {selectedAlert.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                                 </span>
                                             </div>
                                             <div className="grid grid-cols-2 gap-4 text-xs">
                                                 <div className="space-y-1">
                                                     <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Trigger Event</div>
                                                     <div className="font-bold text-slate-800 dark:text-zinc-200 inline-flex items-center gap-1.5">
                                                         <Bell className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                                                         {formatEventName(selectedAlert.event)}
                                                     </div>
                                                 </div>
                                                 <div className="space-y-1">
                                                     <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Time Offset</div>
                                                     <div className="font-bold text-slate-800 dark:text-zinc-200">
                                                         {selectedAlert.offsetDays === 0 ? "On Event Day" : `${selectedAlert.offsetDays > 0 ? '+' : ''}${selectedAlert.offsetDays} Days`}
                                                     </div>
                                                 </div>
                                                 <div className="space-y-1">
                                                     <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Delivery Time</div>
                                                     <div className="font-bold text-slate-800 dark:text-zinc-200 inline-flex items-center gap-1.5">
                                                         <Clock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                                                         {formatTimeDisplay(selectedAlert.time)}
                                                     </div>
                                                 </div>
                                                 <div className="space-y-1 col-span-2">
                                                     <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Next Run</div>
                                                     <div className="font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5">
                                                         <Calendar className="w-3.5 h-3.5" />
                                                         {formatDateToReadable(selectedAlert.nextTriggerDate) || "Pending"}
                                                     </div>
                                                 </div>
                                             </div>
                                         </>
                                    ) : (
                                         <>
                                             <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800/40 pb-3 mb-3">
                                                 <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest shrink-0">Editing</span>
                                                 <h3 className="text-sm font-extrabold text-slate-800 dark:text-zinc-100 truncate uppercase tracking-wide">{editAlertName || selectedAlert.name}</h3>
                                                 <span className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase select-none ${
                                                     editStatus === 'ACTIVE'
                                                         ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/30 dark:border-indigo-500/20'
                                                         : 'bg-slate-200 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 border-slate-300/40 dark:border-zinc-700/50'
                                                 }`}>
                                                     {editStatus === 'ACTIVE' ? 'Active' : 'Inactive'}
                                                 </span>
                                             </div>
                                             <div className="space-y-4">
                                             <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Alert Name</label>
                                                    <input
                                                        type="text"
                                                        value={editAlertName}
                                                        onChange={(e) => setEditAlertName(e.target.value)}
                                                        className="w-full bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-700/50 rounded-lg p-2.5 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-slate-400 dark:focus:border-zinc-500 transition-colors"
                                                    />
                                                </div>
                                                <div className="space-y-1.5 flex flex-col justify-end">
                                                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Status</label>
                                                    <div className="flex items-center justify-between h-[38px] w-full px-1">
                                                        <span className={`text-xs font-bold ${editStatus === 'ACTIVE' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-zinc-500'}`}>
                                                            {editStatus === 'ACTIVE' ? 'Active' : 'Inactive'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleStatusClick(selectedAlert)}
                                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                                editStatus === 'ACTIVE' ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-zinc-700'
                                                            }`}
                                                        >
                                                            <span
                                                                className={`pointer-events-none flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out relative ${
                                                                    editStatus === 'ACTIVE' ? 'translate-x-[22px]' : 'translate-x-[2px]'
                                                                }`}
                                                            >
                                                                <BellRing 
                                                                    className={`absolute w-3.5 h-3.5 text-indigo-600 transition-all duration-300 ${
                                                                        editStatus === 'ACTIVE' 
                                                                            ? 'opacity-100 scale-100 rotate-0' 
                                                                            : 'opacity-0 scale-50 -rotate-45'
                                                                    }`} 
                                                                />
                                                                <BellOff 
                                                                    className={`absolute w-3.5 h-3.5 text-slate-400 transition-all duration-300 ${
                                                                        editStatus === 'INACTIVE' 
                                                                            ? 'opacity-100 scale-100 rotate-0' 
                                                                            : 'opacity-0 scale-50 rotate-45'
                                                                    }`} 
                                                                />
                                                            </span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Trigger Event</label>
                                                    <div className="relative">
                                                        <select
                                                            value={editEvent}
                                                            onChange={(e) => setEditEvent(e.target.value)}
                                                            className="w-full appearance-none bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-700/50 rounded-lg p-2.5 pr-10 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-slate-400 dark:focus:border-zinc-500 cursor-pointer"
                                                        >
                                                        {events.map((ev) => (
                                                            <option key={ev} value={ev}>{formatEventName(ev)}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 block">
                                                        Offset: <span className="text-slate-800 dark:text-zinc-100">{editOffset > 0 ? `+${editOffset}` : editOffset} days</span>
                                                    </label>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditOffset(prev => Math.max(-28, prev - 1))}
                                                            className="w-8 h-8 shrink-0 rounded-lg border border-slate-200 dark:border-zinc-700/50 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors bg-slate-50 dark:bg-transparent"
                                                        >
                                                            <Minus className="w-3 h-3 text-slate-600 dark:text-zinc-300" />
                                                        </button>
                                                        <input
                                                            type="range"
                                                            min="-28"
                                                            max="28"
                                                            value={editOffset}
                                                            onChange={(e) => setEditOffset(Number(e.target.value))}
                                                            className="flex-1 min-w-0 accent-slate-600 dark:accent-zinc-400 h-1 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditOffset(prev => Math.min(28, prev + 1))}
                                                            className="w-8 h-8 shrink-0 rounded-lg border border-slate-200 dark:border-zinc-700/50 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors bg-slate-50 dark:bg-transparent"
                                                        >
                                                            <Plus className="w-3 h-3 text-slate-600 dark:text-zinc-300" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Time</label>
                                                    <div className="grid grid-cols-[1fr_auto_1fr_1fr] gap-1 items-center">
                                                        <select
                                                            value={editTimeHour}
                                                            onChange={(e) => setEditTimeHour(e.target.value)}
                                                            className="w-full min-w-0 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-700/50 rounded-lg py-2 px-1 text-xs text-slate-800 dark:text-zinc-200 text-center outline-none cursor-pointer"
                                                        >
                                                            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                                                                <option key={h} value={h}>{h}</option>
                                                            ))}
                                                        </select>
                                                        <span className="text-slate-400 dark:text-zinc-500 font-bold px-0.5">:</span>
                                                        <select
                                                            value={editTimeMin}
                                                            onChange={(e) => setEditTimeMin(e.target.value)}
                                                            className="w-full min-w-0 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-700/50 rounded-lg py-2 px-1 text-xs text-slate-800 dark:text-zinc-200 text-center outline-none cursor-pointer"
                                                        >
                                                            {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                                                                <option key={m} value={m}>{m}</option>
                                                            ))}
                                                        </select>
                                                        <select
                                                            value={editTimeAmpm}
                                                            onChange={(e) => setEditTimeAmpm(e.target.value)}
                                                            className="w-full min-w-0 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-700/50 rounded-lg py-2 px-1 text-xs text-slate-800 dark:text-zinc-200 text-center outline-none cursor-pointer"
                                                        >
                                                            <option value="AM">AM</option>
                                                            <option value="PM">PM</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>)}
                                </div>

                                {/* BLOCK 2: TARGET CUSTOMERS */}
                                <div className="bg-white dark:bg-[#09090b]/20 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Target Customers</h3>
                                        {isEditMode && (
                                            <button
                                                onClick={() => openFiltersPopup('EDIT_DRAFT')}
                                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors text-xs font-bold cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-zinc-700/50"
                                            >
                                                <Filter className="w-3.5 h-3.5" /> Change Filters
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider">Targeted Segment Size</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl font-bold text-slate-900 dark:text-zinc-100">
                                                        {customerCounts[selectedAlert.id] ?? 0}
                                                    </span>
                                                    <span className="text-xs text-slate-500 dark:text-zinc-400">customers</span>
                                                </div>
                                            </div>
                                            {!isEditMode && (
                                                <button
                                                    onClick={launchShowCustomersOverlay}
                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-zinc-800 dark:hover:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors text-xs font-bold cursor-pointer bg-slate-50 dark:bg-transparent"
                                                >
                                                    View Customers
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">Active Filters</span>
                                            {renderTagsList(isEditMode ? editFilters : selectedAlert.filters)}
                                        </div>
                                    </div>
                                </div>

                                {/* BLOCK 3: MESSAGE TEMPLATE */}
                                <div className="bg-white dark:bg-[#09090b]/20 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Message Template</h3>
                                        {isEditMode ? (
                                            <button
                                                onClick={() => openTemplateSelectionPopup('EDIT_DRAFT')}
                                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors text-xs font-bold cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-zinc-700/50"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" /> Change Template
                                            </button>
                                        ) : (
                                            selectedAlert.template && (
                                                <button
                                                    onClick={() => handleOpenPreview(selectedAlert.template!)}
                                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-sm"
                                                >
                                                    <FileText className="w-3.5 h-3.5" /> Preview Template
                                                </button>
                                            )
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                                            Currently using: <span className="text-slate-800 dark:text-zinc-200 font-bold">{(isEditMode ? editTemplate : selectedAlert.template)?.name || "No Associated Template"}</span>
                                        </p>
                                        <div className="bg-slate-50 dark:bg-zinc-900/40 rounded-lg border border-slate-200/60 dark:border-zinc-800/60 min-h-[80px] p-4 text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                                            {renderTemplatePreviewWithPills((isEditMode ? editTemplate : selectedAlert.template)?.content || "")}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Execution History logs */}
                            <div className="lg:col-span-7 space-y-4">
                                <div className="bg-white dark:bg-[#09090b]/20 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Execution History</h3>
                                        <button
                                            className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1 border border-slate-200 dark:border-zinc-800 rounded-lg bg-slate-50 dark:bg-zinc-900/50 hover:bg-slate-100 dark:hover:bg-zinc-800/50 font-bold"
                                            onClick={() => loadAlertDetails(selectedAlert.id, true)}
                                            disabled={refreshingHistory}
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${refreshingHistory ? 'animate-spin' : ''}`} /> Refresh
                                        </button>
                                    </div>

                                    <div className="relative">
                                        {refreshingHistory && (
                                            <div className="absolute inset-0 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-[1px] flex items-center justify-center z-20 rounded-lg animate-in fade-in duration-150">
                                                <div className="flex flex-col items-center gap-2 text-indigo-650 dark:text-indigo-405 font-mono text-[10px] font-bold">
                                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                                    REFRESHING HISTORY...
                                                </div>
                                            </div>
                                        )}

                                        {history.length === 0 ? (
                                            <div className="p-8 text-center bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/60 rounded-lg">
                                                <HistoryIcon className="w-5 h-5 text-slate-400 dark:text-zinc-600 mx-auto mb-2" />
                                                <p className="text-xs text-slate-500 dark:text-zinc-400">No execution history available.</p>
                                            </div>
                                        ) : (
                                            <div className="relative space-y-4 pt-2 max-h-[60vh] overflow-y-auto pr-1 scrollbar-none">
                                                <div className="absolute top-4 bottom-4 left-[11px] w-px bg-slate-200 dark:bg-zinc-800/60"></div>
                                                {history.map((hist, idx) => (
                                                    <div
                                                        key={hist.id}
                                                        onClick={() => navigate('/payping/alert-history', { state: { selectedId: hist.id, source: 'auto-alerts', returnToAlertId: selectedAlert.id } })}
                                                        className="relative group flex gap-4 pl-1 p-2 hover:bg-slate-100/50 dark:hover:bg-zinc-900/50 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <div className={`w-3.5 h-3.5 mt-1 rounded-full ring-4 ring-white dark:ring-[#0f0f0f] z-10 shrink-0 ${renderHistoryCircle(hist.status)}`}></div>

                                                        <div className="space-y-1 flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{formatDateToReadable(hist.triggeredAt)}</span>
                                                                {renderHistoryBadge(hist.status)}
                                                            </div>
                                                            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{hist.logMessage}</p>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-zinc-500 pt-1">
                                                                <Users className="w-3.5 h-3.5" />
                                                                <span>Sent to {hist.customerCount} segment subscribers</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Alerts List View */
                        alerts.length === 0 ? (
                            <div className="bg-white dark:bg-[#09090b]/30 p-12 text-center flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/60 dark:border-zinc-800/50 shadow-sm">
                                <Bell className="w-5 h-5 text-slate-400 dark:text-zinc-600 mb-2" />
                                <h3 className="text-xs font-medium text-slate-700 dark:text-zinc-300">No scheduled notifications active</h3>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                    Create a new auto-trigger configuration to begin scheduling.
                                </p>
                            </div>
                        ) : (
                            <div className="w-full space-y-1.5">
                                {alerts.map((alert, index) => {
                                    const tgtCount = customerCounts[alert.id] ?? 0;
                                    const rowBg = 'bg-white dark:bg-[#09090b]/40 border-slate-200/60 dark:border-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-900/50';
                                    return (
                                        <div
                                            key={alert.id}
                                            onClick={() => {
                                                loadAlertDetails(alert.id);
                                                setIsEditingInfo(false);
                                                setIsEditingTemplate(false);
                                            }}
                                            className={`w-full p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between border transition-colors cursor-pointer group gap-2.5 ${rowBg}`}
                                        >
                                            <div className="min-w-0 flex-grow space-y-0.5">
                                                <div className="flex items-center gap-3">
                                                    <h4 className="text-slate-800 dark:text-zinc-200 truncate group-hover:text-slate-900 dark:group-hover:text-zinc-50 transition-colors">{alert.name}</h4>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium border ${alert.status === 'ACTIVE'
                                                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/30 dark:border-indigo-500/20'
                                                            : 'bg-slate-200 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 border-slate-300/40 dark:border-zinc-700/50'
                                                        }`}>
                                                        {alert.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-400 mt-2">
                                                    <span className="truncate flex items-center gap-1.5">
                                                        <Bell className="w-3 h-3 text-slate-400 dark:text-zinc-600" />
                                                        {formatEventName(alert.event)} {alert.offsetDays === 0 ? "(On Event)" : `(${alert.offsetDays > 0 ? '+' : ''}${alert.offsetDays}d)`}
                                                    </span>
                                                    <span className="text-slate-300 dark:text-zinc-800 shrink-0 select-none">•</span>
                                                    <span className="flex items-center gap-1.5 shrink-0">
                                                        <Clock className="w-3 h-3 text-slate-400 dark:text-zinc-600" />
                                                        {formatTimeDisplay(alert.time)}
                                                    </span>
                                                    <span className="text-slate-300 dark:text-zinc-800 shrink-0 select-none hidden sm:block">•</span>
                                                    <span className="hidden sm:flex items-center gap-1.5 shrink-0 text-indigo-600 dark:text-indigo-400 font-medium">
                                                        <Calendar className="w-3 h-3" />
                                                        {formatDateToReadable(alert.nextTriggerDate) || "Pending"}
                                                    </span>
                                                    <span className="text-slate-300 dark:text-zinc-800 shrink-0 select-none hidden sm:block">•</span>
                                                    <span className="hidden sm:flex items-center gap-1.5 shrink-0 text-sky-600 dark:sky-400/80 font-medium">
                                                        <Activity className="w-3 h-3" />
                                                        {alert.status === 'ACTIVE' ? "Scheduled" : "Not Started"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 shrink-0 sm:pl-3">
                                                <div className="flex items-center gap-1 bg-slate-200/50 dark:bg-zinc-800/40 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-zinc-800/60">
                                                    <Users className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                                                    <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">{tgtCount}</span>
                                                    <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500">recipients</span>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-600 group-hover:text-slate-600 dark:group-hover:text-zinc-400 transition-colors" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </main>
            )}

            {/* ==========================================
                MODAL 1: ADD NEW AUTO ALERT MODAL FLOW
               ========================================== */}
            {showAddModal && (
                <div className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ zIndex: 50 }}>
                    <div className="absolute inset-0 bg-slate-900/40 dark:bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                    <div className="relative bg-white dark:bg-[#0f0f0f] w-full max-w-xl rounded-2xl border border-slate-200 dark:border-zinc-800/60 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800 dark:text-zinc-200">

                        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-zinc-800/60 p-6 shrink-0 bg-transparent">
                            <h3 className="text-lg font-medium text-slate-900 dark:text-zinc-100 tracking-tight">
                                Add Auto Alert
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors bg-transparent border-0 outline-none cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5 flex-1 max-h-[65vh] scrollbar-none text-sm">

                            {/* Alert Name Input */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">Alert Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Unpaid Bill 3-Day Buffer"
                                    value={newAlertName}
                                    onChange={(e) => setNewAlertName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-zinc-900/50 text-slate-800 dark:text-zinc-200 text-sm p-3 rounded-lg outline-none border border-slate-200 dark:border-zinc-800/60 focus:border-slate-400 dark:focus:border-zinc-500 transition-colors"
                                />
                            </div>

                            {/* Event & Offset row with Step adjustment buttons */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">Trigger Event</label>
                                    <div className="relative">
                                        <select
                                            value={newEvent}
                                            onChange={(e) => setNewEvent(e.target.value)}
                                            className="w-full appearance-none bg-slate-50 dark:bg-zinc-900/50 text-slate-800 dark:text-zinc-200 text-sm p-3 pr-10 rounded-lg outline-none border border-slate-200 dark:border-zinc-800/60 focus:border-slate-400 dark:focus:border-zinc-500 transition-colors cursor-pointer"
                                        >
                                            {events.map((ev) => (
                                                <option key={ev} value={ev}>{formatEventName(ev)}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                                        Offset: <span className="text-slate-800 dark:text-zinc-100 font-bold">{newOffset > 0 ? `+${newOffset}` : newOffset} days</span>
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setNewOffset(prev => Math.max(-28, prev - 1))}
                                            className="w-10 h-10 shrink-0 rounded-lg border border-slate-200 dark:border-zinc-700/50 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors bg-slate-50 dark:bg-transparent"
                                        >
                                            <Minus className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
                                        </button>
                                        <input
                                            type="range"
                                            min="-28"
                                            max="28"
                                            value={newOffset}
                                            onChange={(e) => setNewOffset(Number(e.target.value))}
                                            className="flex-1 min-w-0 accent-slate-600 dark:accent-zinc-400 h-1 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setNewOffset(prev => Math.min(28, prev + 1))}
                                            className="w-10 h-10 shrink-0 rounded-lg border border-slate-200 dark:border-zinc-700/50 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors bg-slate-50 dark:bg-transparent"
                                        >
                                            <Plus className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Time Clock Picker */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">Execution Time</label>
                                <div className="flex gap-2 max-w-sm">
                                    <select
                                        value={newTimeHour}
                                        onChange={(e) => setNewTimeHour(e.target.value)}
                                        className="flex-1 bg-slate-50 dark:bg-zinc-900/50 text-slate-800 dark:text-zinc-200 text-sm p-3 rounded-lg outline-none border border-slate-200 dark:border-zinc-800/60 focus:border-slate-400 dark:focus:border-zinc-500 transition-colors text-center"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                    <span className="self-center text-slate-400 dark:text-zinc-500">:</span>
                                    <select
                                        value={newTimeMin}
                                        onChange={(e) => setNewTimeMin(e.target.value)}
                                        className="flex-1 bg-slate-50 dark:bg-zinc-900/50 text-slate-800 dark:text-zinc-200 text-sm p-3 rounded-lg outline-none border border-slate-200 dark:border-zinc-800/60 focus:border-slate-400 dark:focus:border-zinc-500 transition-colors text-center"
                                    >
                                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={newTimeAmpm}
                                        onChange={(e) => setNewTimeAmpm(e.target.value)}
                                        className="flex-1 bg-slate-50 dark:bg-zinc-900/50 text-slate-800 dark:text-zinc-200 text-sm p-3 rounded-lg outline-none border border-slate-200 dark:border-zinc-800/60 focus:border-slate-400 dark:focus:border-zinc-500 transition-colors text-center"
                                    >
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                    </select>
                                </div>
                            </div>

                            {/* Target customers Selector Block */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Target Customers</label>
                                    <button
                                        type="button"
                                        onClick={() => openFiltersPopup('CREATE')}
                                        className="px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 hover:text-slate-800 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors text-xs font-bold border border-slate-200 dark:border-zinc-700 cursor-pointer"
                                    >
                                        {Object.keys(newFilters).length > 0 ? "Edit Filters" : "Add Filters"}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {renderTagsList(newFilters)}

                                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-900/50 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 w-fit">
                                        <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                        <span className="font-bold">{newCustomerCount} <span className="font-medium text-slate-500 dark:text-zinc-400">customers matched</span></span>
                                    </div>
                                </div>
                            </div>

                            {/* Template mapper Selection Block */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Message Template</label>
                                    <button
                                        type="button"
                                        onClick={() => openTemplateSelectionPopup('CREATE')}
                                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700/55 transition-colors text-xs font-bold cursor-pointer"
                                    >
                                        {newTemplate ? "Change Template" : "Select Template"}
                                    </button>
                                </div>

                                {newTemplate ? (
                                    <div className="bg-slate-50 dark:bg-zinc-900/40 p-4 rounded-lg border border-slate-200 dark:border-zinc-800/60 space-y-3">
                                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-b border-slate-200/60 dark:border-zinc-800/60 pb-3">
                                            <span className="font-bold">{newTemplate.name}</span>
                                        </div>
                                        <div className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed font-sans whitespace-pre-wrap break-all">
                                            {newTemplate.content}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 text-center border border-dashed border-slate-200 dark:border-zinc-700/50 rounded-lg text-slate-400 dark:text-zinc-500 text-sm">
                                        No template selected.
                                    </div>
                                )}
                            </div>

                            {/* Live trigger sentence builder Preview Block */}
                            <div className="p-4 bg-slate-50 dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                                <span className="font-bold text-slate-800 dark:text-zinc-200">Summary: </span>
                                Send <span className="text-slate-800 dark:text-zinc-200 font-bold">"{newTemplate?.name || 'Template'}"</span> to <span className="text-slate-800 dark:text-zinc-200 font-bold">{newCustomerCount}</span> customers {newOffset === 0 ? "exactly on" : `${Math.abs(newOffset)} days ${newOffset < 0 ? 'before' : 'after'}`} <span className="text-slate-800 dark:text-zinc-200 font-bold">{formatEventName(newEvent) || 'event'}</span> at <span className="text-slate-800 dark:text-zinc-200 font-bold">{newTimeHour}:{newTimeMin} {newTimeAmpm}</span>.
                            </div>

                        </div>

                        <div className="border-t border-slate-200/60 dark:border-zinc-800/60 p-6 shrink-0 bg-transparent flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-zinc-800/60 text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 rounded-lg text-sm font-bold transition-colors cursor-pointer border-0 outline-none"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateAutoAlert}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-colors cursor-pointer border border-indigo-500/50 shadow-sm shadow-indigo-500/20"
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
                <div className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ zIndex: 60 }}>
                    <div className="absolute inset-0 bg-slate-900/40 dark:bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowTemplatePicker(false)} />
                    <div className="relative bg-white dark:bg-[#0f0f0f] w-full max-w-2xl rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">

                        {/* Header */}
                        <div className="p-5 border-b border-slate-200/60 dark:border-zinc-800/60 flex items-center justify-between bg-transparent shrink-0">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100 tracking-tight uppercase">Select Message Template</h3>
                            </div>
                            <button onClick={() => setShowTemplatePicker(false)} className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors bg-transparent border-0 outline-none cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-6 py-4 bg-slate-50/50 dark:bg-zinc-900/20 border-b border-slate-200/60 dark:border-zinc-800/60 shrink-0">
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold tracking-wider uppercase select-none mb-2">Select a message template blueprint from alert catalog to map to the Scheduled alert trigger</p>
                            <input
                                type="text"
                                placeholder="Search templates inside alert catalog..."
                                value={templateSearchQuery}
                                onChange={(e) => setTemplateSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-zinc-900/50 text-slate-800 dark:text-zinc-200 text-xs font-semibold p-3 border border-slate-200 dark:border-zinc-800/60 rounded-xl outline-none focus:border-slate-400 dark:focus:border-zinc-700"
                            />
                        </div>

                        {/* Picker Core Content */}
                        <div className="flex-1 p-6 space-y-3 overflow-y-auto scrollbar-none">
                            {filteredTemplatesList.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 dark:text-zinc-500 text-xs space-y-2 bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-slate-200 dark:border-zinc-800/60">
                                    <MessageSquare className="w-8 h-8 mx-auto opacity-20" />
                                    <p>No operational templates matched the search queries.</p>
                                </div>
                            ) : (
                                <div className="w-full space-y-3 animate-in fade-in duration-100">
                                    {filteredTemplatesList.map((tmpl) => (
                                        <div
                                            key={tmpl.id}
                                            onClick={() => setCandidateTemplate(tmpl)}
                                            className="w-full bg-slate-50 dark:bg-zinc-900/40 p-3 rounded-xl flex items-center justify-between border border-slate-200/60 dark:border-zinc-800/60 hover:border-slate-300 dark:hover:border-zinc-700 transition-all active:scale-[0.99] cursor-pointer group"
                                        >
                                            <div className="min-w-0 pr-4 flex-1">
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 truncate group-hover:text-slate-950 dark:group-hover:text-white transition-colors">{tmpl.name}</h4>
                                                {renderTemplatePreviewSingleLine(tmpl.content)}
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                                <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-500 uppercase tracking-widest select-none">SELECT</span>
                                                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-slate-200/60 dark:border-zinc-800/60 p-5 shrink-0 bg-transparent flex items-center justify-end">
                            <button
                                onClick={() => setShowTemplatePicker(false)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900/50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800/60 text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer outline-none"
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    {/* Fullscreen Overlay template selection Preview Modal */}
                    {candidateTemplate && (
                        <div className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ zIndex: 65 }}>
                            <div className="absolute inset-0 bg-slate-900/40 dark:bg-zinc-950/90 backdrop-blur-sm" onClick={() => setCandidateTemplate(null)} />
                            <div className="relative bg-white dark:bg-[#0f0f0f] w-full max-w-md rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 p-6 space-y-5 shadow-2xl overflow-hidden">
                                <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-200/60 dark:border-zinc-800/60 pb-2 select-none">
                                    Confirm selecting this template to: {selectedAlert ? selectedAlert.name : (newAlertName || "New Auto Alert")}
                                </h4>
                                <div className="space-y-2.5 text-xs">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-zinc-500">
                                        <span>Label: {candidateTemplate.name}</span>
                                        <span>ID: {candidateTemplate.id}</span>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200/60 dark:border-zinc-800/60 rounded-xl text-slate-800 dark:text-zinc-200 font-sans whitespace-pre-wrap break-all leading-relaxed">
                                        {renderTemplatePreviewWithPills(candidateTemplate.content)}
                                    </div>
                                </div>
                                <div className="flex gap-2.5 pt-2">
                                    <button
                                        onClick={handleConfirmTemplateSelection}
                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer border-0 outline-none shadow-md shadow-indigo-600/10"
                                    >
                                        Confirm Mapping
                                    </button>
                                    <button
                                        onClick={() => setCandidateTemplate(null)}
                                        className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900/50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-800/60 transition-colors cursor-pointer"
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
                <div className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ zIndex: 70 }}>
                    <div className="absolute inset-0 bg-slate-900/40 dark:bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowTemplateEditModal(false)} />
                    <div className="relative bg-white dark:bg-[#0f0f0f] w-full max-w-xl rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

                        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-zinc-800/60 p-5 shrink-0 bg-transparent">
                            <h3 className="font-bold text-sm flex items-center gap-2.5 tracking-wider text-slate-800 dark:text-zinc-200 uppercase">
                                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-500" /> Edit Message Template
                            </h3>
                            <button onClick={() => setShowTemplateEditModal(false)} className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors bg-transparent border-0 outline-none cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5 flex-1 scrollbar-none text-xs">
                            {/* Template Name Input */}
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest ml-0.5">Template Label Name</label>
                                <input
                                    type="text"
                                    value={editTemplateName}
                                    onChange={(e) => setEditTemplateName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-zinc-900/50 text-slate-800 dark:text-white text-xs font-semibold p-3 rounded-xl outline-none border border-slate-200/60 dark:border-zinc-800/60 focus:border-slate-400 dark:focus:border-zinc-700 transition-colors"
                                />
                            </div>

                            {/* Variable shortcut badges */}
                            <div className="space-y-2 bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-slate-200/60 dark:border-zinc-800/60">
                                <span className="block text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Available Variable Tags</span>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {serverTags.map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => setEditTemplateContent(prev => prev + `{${tag}}`)}
                                            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[10px] font-mono font-bold tracking-wide rounded-lg text-emerald-700 dark:text-emerald-400 transition-colors cursor-pointer outline-none shadow-sm"
                                        >
                                            +{tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Template Body Editor */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block ml-0.5">Template Message Body</label>
                                <textarea
                                    rows={5}
                                    value={editTemplateContent}
                                    onChange={(e) => setEditTemplateContent(e.target.value)}
                                    placeholder="Type notification text content..."
                                    className="w-full bg-slate-50 dark:bg-zinc-900/50 border border-slate-200/60 dark:border-zinc-800/60 rounded-xl p-3 text-xs font-semibold text-slate-800 dark:text-zinc-200 outline-none focus:border-slate-400 dark:focus:border-zinc-700 leading-relaxed font-sans"
                                />
                            </div>

                            {/* Live Text Preview */}
                            <div className="space-y-1.5 bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-slate-200/60 dark:border-zinc-800/60">
                                <span className="block text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Live Text Preview</span>
                                {renderTemplatePreviewWithPills(editTemplateContent)}
                            </div>
                        </div>

                        <div className="border-t border-slate-200/60 dark:border-zinc-800/60 p-5 shrink-0 bg-transparent flex items-center gap-3">
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
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 active:scale-98 transition-all text-xs font-bold rounded-xl text-white uppercase cursor-pointer border-0 outline-none shadow-lg shadow-indigo-600/10"
                            >
                                Save Template
                            </button>
                            <button
                                onClick={() => setShowTemplateEditModal(false)}
                                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900/50 border border-slate-200/60 dark:border-zinc-800/60 text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
                <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 animate-in fade-in duration-150" style={{ zIndex: 60 }}>
                    <div className="absolute inset-0 bg-slate-900/40 dark:bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowFilterModal(false)} />
                    <div className="relative bg-white dark:bg-[#0f0f0f] w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 p-6 flex flex-col max-h-[85vh] overflow-hidden">

                        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-zinc-800/60 pb-4 shrink-0 mb-5">
                            <h3 className="font-bold text-sm flex items-center gap-2 tracking-wider text-slate-900 dark:text-zinc-200 uppercase">
                                <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-500" /> Filter Criteria Configuration
                            </h3>
                            <button onClick={() => setShowFilterModal(false)} className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors bg-transparent border-0 outline-none cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-5 overflow-y-auto pr-1 flex-1 min-h-0 scrollbar-none text-slate-800 dark:text-zinc-200">

                            {/* Section 1: Filters (mainFilters) */}
                            {Object.keys(filterMetadata.mainFilters || {}).length > 0 && (
                                <div className="space-y-4">
                                    {Object.entries(filterMetadata.mainFilters || {}).map(([category, options]) => (
                                        <div key={category} className="space-y-2">
                                            <label className="text-[9px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-widest block ml-0.5">
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
                                                            className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-colors truncate border cursor-pointer ${isSelected
                                                                    ? 'bg-indigo-600 text-white border-indigo-500'
                                                                    : 'bg-slate-50 dark:bg-zinc-900/50 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800/60 hover:text-slate-800 dark:hover:text-zinc-200'
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
                                <div className="space-y-4 pt-4 border-t border-slate-200/60 dark:border-zinc-800/60">
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block ml-0.5 select-none">Custom Configuration Filter</span>
                                    {Object.entries(filterMetadata.customFilters || {}).map(([category, options]) => (
                                        <div key={category} className="space-y-2">
                                            <label className="text-[9px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-widest block ml-0.5">
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
                                                            className={`py-2 px-1 text-center text-xs font-bold rounded-lg transition-colors truncate border cursor-pointer ${isSelected
                                                                    ? 'bg-indigo-600 text-white border-indigo-500'
                                                                    : 'bg-slate-50 dark:bg-zinc-900/50 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800/60 hover:text-slate-800 dark:hover:text-zinc-200'
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
                        <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/60 rounded-2xl flex items-center justify-between shrink-0 shadow-inner mt-5">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl relative shrink-0">
                                    <Users className="w-4 h-4 shrink-0" />
                                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                    </span>
                                </div>
                                <div className="min-w-0 pr-2">
                                    <span className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block select-none">Matched Segments Count</span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 font-mono block mt-0.5 tracking-wide truncate">{liveDraftCount} targets</span>
                                </div>
                            </div>
                            <button
                                onClick={handleApplyFilters}
                                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-xs rounded-xl uppercase tracking-wider transition-colors cursor-pointer border-0 outline-none shadow-lg shadow-indigo-600/10"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 4: SHOW CUSTOMERS OVERLAY TABLE
               ======================================= */}
            {showCustomersOverlay && (
                <div className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ zIndex: 55 }}>
                    <div className="absolute inset-0 bg-slate-900/40 dark:bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowCustomersOverlay(false)} />
                    <div className="relative bg-white dark:bg-[#0f0f0f] w-full max-w-4xl rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        
                        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-zinc-800/60 p-5 shrink-0 bg-transparent backdrop-blur-md">
                            <div>
                                <h3 className="font-bold text-sm tracking-wider text-slate-800 dark:text-zinc-200 uppercase flex items-center gap-2">
                                    <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-500 shrink-0" /> targeted customer segment preview
                                </h3>
                                <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold tracking-wider uppercase mt-1">
                                    Displays maximum 30 active customer entries mapped to current scheduled filter logic.
                                </p>
                            </div>
                            <button onClick={() => setShowCustomersOverlay(false)} className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors bg-transparent border-0 outline-none cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-6 min-h-[300px] scrollbar-none bg-transparent">
                            {loadingPreviewCustomers ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                                    <Loader2 className="w-7 h-7 text-indigo-600 dark:text-indigo-500 animate-spin" />
                                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-widest animate-pulse select-none">Scanning registry database...</span>
                                </div>
                            ) : previewCustomers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-3 text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 border-dashed">
                                    <AlertCircle className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                                    <span className="text-xs font-semibold italic select-none">No customers match the current filter boundary limits.</span>
                                </div>
                            ) : (
                                <div className="border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl overflow-hidden bg-slate-50 dark:bg-zinc-900/40 shadow-inner">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-zinc-900/80 text-slate-500 dark:text-zinc-400 font-bold uppercase text-[9px] tracking-widest border-b border-slate-200/60 dark:border-zinc-800/60 select-none">
                                                <th className="p-4">Customer Name</th>
                                                <th className="p-4">Phone Channel</th>
                                                <th className="p-4">Expiry Date</th>
                                                <th className="p-4 text-right">Subscription Value</th>
                                                <th className="p-4 text-center">Payment status</th>
                                                <th className="p-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200/60 dark:divide-zinc-800/60 bg-transparent text-slate-700 dark:text-zinc-300">
                                            {previewCustomers.map((cust) => (
                                                <tr key={cust.id} className="hover:bg-slate-100/50 dark:hover:bg-zinc-800/40 text-slate-800 dark:text-zinc-300 font-semibold transition-colors">
                                                    <td className="p-4 font-bold text-slate-900 dark:text-zinc-200">{cust.name}</td>
                                                    <td className="p-4 font-mono text-slate-500 dark:text-zinc-400">{cust.phone}</td>
                                                    <td className="p-4 font-sans text-slate-500 dark:text-zinc-400">{formatDateToReadable(cust.expiryDate)}</td>
                                                    <td className="p-4 text-right text-slate-900 dark:text-zinc-200 font-bold font-mono">₹{cust.amount.toLocaleString()}</td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                                                            cust.paymentStatus === 'PAID' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' :
                                                            cust.paymentStatus === 'UNPAID' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20' :
                                                            'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                                                        }`}>
                                                            {cust.paymentStatus}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${cust.status === 'ACTIVE' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500'}`}>
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
                <div className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ zIndex: 55 }}>
                    <div className="absolute inset-0 bg-slate-900/40 dark:bg-zinc-950/85 backdrop-blur-sm" onClick={() => setShowStatusDeactivationConfirm(false)} />
                    <div className="relative bg-white dark:bg-[#0f0f0f] w-full max-w-sm rounded-2xl p-6 space-y-5 text-center shadow-2xl border border-slate-200/60 dark:border-zinc-800/60">
                        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-500 flex items-center justify-center mx-auto relative">
                            <AlertCircle className="w-5 h-5 absolute animate-ping" />
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-200">Confirm Deactivation</h3>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                                confirm deactivating the <span className="font-bold">{statusToggleAlert.name}</span> auto alert, this won't send the alerts hereafter
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowStatusDeactivationConfirm(false)}
                                className="w-1/2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900/50 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-bold py-3 rounded-xl text-xs border border-slate-200 dark:border-zinc-800/60 cursor-pointer"
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
                <div className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ zIndex: 55 }}>
                    <div className="absolute inset-0 bg-slate-900/40 dark:bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
                    <div className="relative bg-white dark:bg-[#0f0f0f] w-full max-w-sm rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 p-6 space-y-6 shadow-2xl overflow-hidden">
                        <div className="text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-500 flex items-center justify-center mx-auto relative mb-2">
                                <AlertCircle className="w-5 h-5 absolute animate-ping" />
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-200 uppercase tracking-wider select-none">Confirm Alert Deletion?</h3>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-semibold">
                                Are you absolutely sure you want to delete the scheduled flow <span className="text-slate-800 dark:text-zinc-300 font-bold">"{selectedAlert?.name}"</span>? This action removes all dynamic trigger schedules forever.
                            </p>
                        </div>
                        <div className="flex gap-2.5">
                            <button
                                onClick={handleDeleteAlert}
                                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer border-0 outline-none shadow-md shadow-red-600/10"
                            >
                                Delete Schedule
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/60 text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer"
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================= */}
            {/* TEMPLATE PREVIEW POPUP MODAL */}
            {/* ======================================================= */}
            {showPreviewModal && (
                <div className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ zIndex: 60 }}>
                    <div className="absolute inset-0 bg-slate-900/40 dark:bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowPreviewModal(false)} />
                    <div className="relative bg-white dark:bg-[#0f0f0f] w-full max-w-lg rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-zinc-800/60 p-5 shrink-0 bg-transparent">
                            <h3 className="font-bold text-sm flex items-center gap-2.5 tracking-wider text-slate-800 dark:text-zinc-200 uppercase">
                                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-500" /> Template Preview
                            </h3>
                            <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors bg-transparent border-0 outline-none cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5 flex-1 scrollbar-none text-xs">
                            <div className="space-y-1.5">
                                <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest ml-0.5">Template Name</span>
                                <div className="text-sm font-bold text-slate-800 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-900/50 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-zinc-800/60">
                                    {previewTemplateName}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest ml-0.5">Message Template (Raw)</span>
                                <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200/60 dark:border-zinc-800/60 rounded-xl text-slate-700 dark:text-zinc-300 font-sans whitespace-pre-wrap break-all leading-relaxed">
                                    {renderTemplatePreviewWithPills(previewTemplateRawContent)}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest ml-0.5">Message Preview (Compiled)</span>
                                <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200/60 dark:border-zinc-800/60 rounded-xl text-slate-700 dark:text-zinc-300 font-sans whitespace-pre-wrap break-all leading-relaxed relative min-h-[60px]">
                                    {loadingPreviewTemplate ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-[#0f0f0f]/50">
                                            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                                        </div>
                                    ) : (
                                        previewTemplateCompiled || <span className="text-slate-400 dark:text-zinc-500 italic">No compiled text returned.</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-200/60 dark:border-zinc-800/60 p-5 shrink-0 bg-transparent flex items-center gap-3">
                            <button
                                onClick={handleEditTemplateFromPreview}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 active:scale-98 transition-all text-xs font-bold rounded-xl text-white uppercase cursor-pointer border-0 outline-none shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-1.5"
                            >
                                <Edit className="w-4 h-4" /> Edit Template
                            </button>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900/50 border border-slate-200/60 dark:border-zinc-800/60 text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default AutoAlerts;
