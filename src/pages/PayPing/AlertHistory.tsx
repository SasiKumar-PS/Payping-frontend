import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    History as HistoryIcon, Filter, ChevronLeft, ChevronRight,
    CheckCircle2, AlertCircle, Clock, Users, X, Eye, ChevronDown,
    Activity, LayoutDashboard, ArrowLeft, Loader2, RefreshCw, Calendar
} from 'lucide-react';
import api from '../../api';

// ==========================================
// DTOs & MOCKS
// ==========================================
export interface NotificationLogDTO {
    id: string;
    serialNo: number;
    customerId?: string;
    customerName: string;
    status: string;
    retryCount?: number;
    sentAt: string;
    message: string;
}

export interface NotificationHistoryDTO {
    id: string;
    name: string;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'PARTIALLY_FAILED' | 'FAILED';
    type: 'MANUAL' | 'AUTO';
    template: { id?: string; name: string; content?: string };
    triggeredAt: string;
    completedAt: string | null;
    recipientsCount: number;
    logs?: NotificationLogDTO[];
}

const MOCK_HISTORIES: NotificationHistoryDTO[] = [
    { id: 'hist-1', name: 'May Subscriptions Reminder', status: 'COMPLETED', type: 'AUTO', template: { name: 'Monthly Reminder V1' }, triggeredAt: '2026-05-01 10:00 AM', completedAt: '2026-05-01 10:05 AM', recipientsCount: 42 },
    { id: 'hist-2', name: 'Urgent Server Maintenance', status: 'COMPLETED', type: 'MANUAL', template: { name: 'Emergency Broadcast' }, triggeredAt: '2026-05-15 14:00 PM', completedAt: '2026-05-15 14:02 PM', recipientsCount: 120 },
    { id: 'hist-3', name: 'June Discount Promo', status: 'IN_PROGRESS', type: 'AUTO', template: { name: 'Summer Sale' }, triggeredAt: '2026-05-29 09:00 AM', completedAt: null, recipientsCount: 15 },
    { id: 'hist-4', name: 'Invalid Payment Notice', status: 'FAILED', type: 'MANUAL', template: { name: 'Payment Failed' }, triggeredAt: '2026-05-28 11:00 AM', completedAt: '2026-05-28 11:01 AM', recipientsCount: 5 }
];

const MOCK_LOGS: Record<string, NotificationLogDTO[]> = {
    'hist-1': [
        { id: 'log-1', serialNo: 1, customerId: 'cust-1', customerName: 'Sarah Connor', status: 'SENT', sentAt: '2026-05-01 10:00 AM', message: 'Hi Sarah...' },
        { id: 'log-2', serialNo: 2, customerId: 'cust-2', customerName: 'John Miller', status: 'FAILED', sentAt: '2026-05-01 10:01 AM', message: 'Hi John...' },
        { id: 'log-3', serialNo: 3, customerId: 'cust-3', customerName: 'David Vance', status: 'RETRYING', retryCount: 2, sentAt: '2026-05-01 10:02 AM', message: 'Hi David...' },
    ],
    'hist-2': [
        { id: 'log-4', serialNo: 1, customerId: 'cust-4', customerName: 'All Customers', status: 'SENT', sentAt: '2026-05-15 14:01 PM', message: 'Emergency...' },
    ],
    'hist-3': [
        { id: 'log-5', serialNo: 1, customerId: 'cust-5', customerName: 'Elena Rostova', status: 'PENDING', sentAt: 'N/A', message: 'Get 20% off...' }
    ]
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

export const AlertHistory = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Check if we came from auto-alerts with a pre-selected history
    const stateParams = location.state as { selectedId?: string, source?: string, returnToAlertId?: string } | null;

    // ==========================================
    // STATE
    // ==========================================
    const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL'>('LIST');

    const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth()); // 0-11
    const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
    const [filterType, setFilterType] = useState<'ALL' | 'AUTO' | 'MANUAL'>('ALL');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);

    const [histories, setHistories] = useState<NotificationHistoryDTO[]>([]);
    const [loadingHistories, setLoadingHistories] = useState(true);

    const [selectedHistory, setSelectedHistory] = useState<NotificationHistoryDTO | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Modal state for message preview
    const [previewLog, setPreviewLog] = useState<NotificationLogDTO | null>(null);

    // Track if deep linking has been handled
    const [deepLinkHandled, setDeepLinkHandled] = useState(false);

    // ==========================================
    // DATA FETCHING
    // ==========================================
    const fetchHistoriesList = useCallback(async () => {
        setLoadingHistories(true);
        try {
            const params: any = { month: currentMonth + 1, year: currentYear };
            if (filterType !== 'ALL') {
                params.type = filterType;
            }
            const response = await api.get('/payping/notifications/history', { params });
            setHistories(response.data);

        } catch (err) {
            console.error("Failed to fetch histories", err);
            // Fallback to mock data if API fails
            let filtered = MOCK_HISTORIES;
            if (filterType !== 'ALL') {
                filtered = filtered.filter(h => h.type === filterType);
            }
            setHistories(filtered);
        } finally {
            setLoadingHistories(false);
        }
    }, [currentMonth, currentYear, filterType]);

    // Initial Fetch for the Master List
    useEffect(() => {
        fetchHistoriesList();
    }, [fetchHistoriesList]);

    // Handle deep linking from Auto Alerts after initial mount
    useEffect(() => {
        if (stateParams?.selectedId && !deepLinkHandled) {
            setDeepLinkHandled(true);
            handleHistorySelect(stateParams.selectedId);
        }
    }, [stateParams, deepLinkHandled]);

    const handleHistorySelect = async (historyId: string) => {
        setViewMode('DETAIL');
        setLoadingDetails(true);
        try {
            const response = await api.get(`/payping/notifications/history/${historyId}`);
            setSelectedHistory(response.data);
        } catch (err) {
            console.error("Failed to fetch detailed history", err);
            // Fallback to mock data if API fails
            const targetInfo = MOCK_HISTORIES.find(h => h.id === historyId);
            if (targetInfo) {
                const completeDetails: NotificationHistoryDTO = {
                    ...targetInfo,
                    logs: MOCK_LOGS[historyId] || []
                };
                setSelectedHistory(completeDetails);
            }
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleLogClick = (log: NotificationLogDTO) => {
        setPreviewLog(log);
    };

    // ==========================================
    // HANDLERS
    // ==========================================
    const handlePrevMonth = () => {
        setCurrentMonth(prev => {
            if (prev === 0) {
                setCurrentYear(y => y - 1);
                return 11;
            }
            return prev - 1;
        });
    };

    const handleNextMonth = () => {
        setCurrentMonth(prev => {
            if (prev === 11) {
                setCurrentYear(y => y + 1);
                return 0;
            }
            return prev + 1;
        });
    };

    const handleBackClick = () => {
        if (stateParams?.source === 'auto-alerts') {
            navigate('/payping/auto-alerts', {
                state: {
                    selectedAlertId: stateParams.returnToAlertId
                },
                replace: true
            });
        } else {
            setViewMode('LIST');
            setSelectedHistory(null);
        }
    };

    // ==========================================
    // RENDER HELPERS
    // ==========================================
    const renderStatusBadge = (status: NotificationHistoryDTO['status']) => {
        switch (status) {
            case 'COMPLETED': return <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">Completed</span>;
            case 'IN_PROGRESS': return <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 animate-pulse">In Progress</span>;
            case 'SCHEDULED': return <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">Scheduled</span>;
            case 'PARTIALLY_FAILED': return <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-wider uppercase bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20">Partially Failed</span>;
            case 'FAILED': return <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">Failed</span>;
        }
    };

    const renderLogStatus = (status: NotificationLogDTO['status'], retryCount?: number) => {
        switch (status.toUpperCase()) {
            case 'SENT': return <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[10px] font-bold"><CheckCircle2 className="w-3 h-3" /> SENT</span>;
            case 'FAILED': return <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 text-[10px] font-bold"><AlertCircle className="w-3 h-3" /> FAILED</span>;
            case 'PENDING': return <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 text-[10px] font-bold"><Clock className="w-3 h-3 animate-pulse" /> PENDING</span>;
            case 'RETRYING': return <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 text-[10px] font-bold"><RefreshCw className="w-3 h-3 animate-spin" /> RETRYING ({retryCount || 0})</span>;
            default: return <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1 text-[10px] font-bold uppercase">{status}</span>;
        }
    };

    // ==========================================
    // VIEW RENDERS
    // ==========================================
    const renderListView = () => (
        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
            {loadingHistories ? (
                <div className="py-32 text-center flex flex-col items-center gap-3 text-slate-400 dark:text-zinc-500 text-sm font-sans">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span>FETCHING NOTIFICATION REGISTRY...</span>
                </div>
            ) : histories.length === 0 ? (
                <div className="py-32 text-center text-slate-400 dark:text-zinc-500 text-sm border border-dashed border-slate-200 dark:border-zinc-800/60 rounded-2xl">
                    No history records found for this period.
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {histories.map((hist, index) => {
                        const rowBg = 'bg-white dark:bg-[#09090b]/40 border-slate-200/60 dark:border-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-900/50';
                        return (
                            <div
                                key={hist.id}
                                onClick={() => handleHistorySelect(hist.id)}
                                className={`p-2.5 rounded-lg border flex flex-row items-center gap-3 transition-all cursor-pointer group justify-between ${rowBg}`}
                            >
                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 leading-tight group-hover:text-slate-950 dark:group-hover:text-white transition-colors truncate">{hist.name}</h4>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] sm:text-xs">
                                        <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 shrink-0 font-medium">
                                            {hist.type === 'AUTO' ? <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" /> : <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-500" />}
                                            {hist.type}
                                        </span>
                                        <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 shrink-0 font-medium">
                                            <Users className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" /> {hist.recipientsCount}
                                        </span>
                                        <span className="text-slate-500 dark:text-zinc-500 font-sans flex items-center gap-1.5 shrink-0"><Clock className="w-3.5 h-3.5" />{formatDateToReadable(hist.triggeredAt)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-auto pl-2">
                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                        {renderStatusBadge(hist.status)}
                                        {hist.completedAt && <span className="text-slate-500 dark:text-zinc-500 font-sans text-[9px] sm:text-[10px] flex items-center gap-1 whitespace-nowrap"><CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />{formatDateToReadable(hist.completedAt)}</span>}
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-400 dark:text-zinc-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderDetailView = () => {
        if (loadingDetails) {
            return (
                <div className="py-32 text-center flex flex-col items-center gap-3 text-slate-400 dark:text-zinc-500 text-sm font-sans animate-in fade-in">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span>LOADING HISTORY DETAILS...</span>
                </div>
            );
        }

        if (!selectedHistory) return null;

        const logs = selectedHistory.logs || [];

        return (
            <div className="flex flex-col gap-3 animate-in slide-in-from-right-4 duration-300 pb-20">
                {/* Detailed Header Block */}
                <div className="p-3.5 bg-slate-50 dark:bg-zinc-900/20 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-slate-400 dark:text-white">
                        <HistoryIcon className="w-32 h-32 sm:w-48 sm:h-48" />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 relative z-10">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">{selectedHistory.name}</h3>
                        <div className="shrink-0">{renderStatusBadge(selectedHistory.status)}</div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 relative z-10">
                        <div className="space-y-1 sm:space-y-1.5 flex flex-col items-start">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Alert Type</span>
                            <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 sm:gap-2">
                                {selectedHistory.type === 'AUTO' ? <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-500" /> : <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 dark:text-indigo-500" />}
                                {selectedHistory.type}
                            </p>
                        </div>
                        <div className="space-y-1 sm:space-y-1.5 flex flex-col items-start min-w-0">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Template Used</span>
                            <p className="text-xs sm:text-sm font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg truncate max-w-full border border-indigo-200/60 dark:border-indigo-500/20">{selectedHistory.template?.name || 'Unknown'}</p>
                        </div>
                        <div className="space-y-1 sm:space-y-1.5 flex flex-col items-start">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Started At</span>
                            <p className="text-[10px] sm:text-sm font-sans font-bold text-slate-700 dark:text-zinc-300">{formatDateToReadable(selectedHistory.triggeredAt)}</p>
                        </div>
                        <div className="space-y-1 sm:space-y-1.5 flex flex-col items-start">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Completed At</span>
                            <p className="text-[10px] sm:text-sm font-sans font-bold text-slate-700 dark:text-zinc-300">{formatDateToReadable(selectedHistory.completedAt) || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                {/* Customer Logs Table Area */}
                <div className="flex flex-col bg-white dark:bg-[#0f0f0f]/80 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-3 border-b border-slate-200/60 dark:border-zinc-800/60 flex items-center justify-between bg-slate-50 dark:bg-zinc-900/30">
                        <h3 className="font-bold text-xs text-slate-900 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-500" /> Delivery Telemetry
                        </h3>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 font-mono bg-slate-100 dark:bg-zinc-950 px-2 py-0.5 rounded-full border border-slate-200 dark:border-zinc-800">
                            TOTAL: {selectedHistory.recipientsCount}
                        </span>
                    </div>

                    <div className="p-2 space-y-1.5">
                        {logs.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 dark:text-zinc-500 text-xs font-medium">No delivery logs registered for this execution.</div>
                        ) : (
                            <div className="space-y-1.5">
                                {logs.map((log, index) => {
                                    const rowBg = 'bg-white dark:bg-[#09090b]/40 border-slate-200/60 dark:border-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-900/50';
                                    return (
                                        <div
                                            key={log.id}
                                            onClick={() => handleLogClick(log)}
                                            className={`w-full flex flex-col sm:flex-row sm:items-center border p-2 rounded-lg cursor-pointer transition-all gap-2 sm:gap-4 ${rowBg}`}
                                        >
                                            {/* Top/Left Section: Serial & Name */}
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div className="text-[10px] font-mono font-bold text-slate-400 dark:text-zinc-500 shrink-0 w-8">{index + 1}</div>
                                                <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">{log.customerName}</p>
                                            </div>

                                            {/* Bottom/Right Section: Status, Time, Icon */}
                                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-10 sm:pl-0">
                                                <div className="w-auto sm:w-28 shrink-0">
                                                    {renderLogStatus(log.status, log.retryCount)}
                                                </div>
                                                <div className="w-auto sm:w-32 text-left sm:text-right shrink-0">
                                                    <span className="text-[9px] font-sans text-slate-500 dark:text-zinc-400">{formatDateToReadable(log.sentAt)}</span>
                                                </div>
                                                <div className="w-6 sm:w-8 flex justify-end shrink-0">
                                                    <div className="p-1 rounded-lg bg-slate-100 dark:bg-zinc-800/55 hover:bg-indigo-500/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                                        <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-transparent text-slate-800 dark:text-zinc-200 flex flex-col font-sans select-none overflow-x-hidden pb-20 relative">

            {/* HEADER */}
            <header className="sticky top-0 z-30 bg-slate-50/80 dark:bg-[#0f0f0f]/80 backdrop-blur-md px-4 md:px-8 pt-4 pb-3 border-b border-slate-200/60 dark:border-zinc-800/60">
                <div className="max-w-none mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                    <div className="flex items-center gap-3">
                        {/* Dynamic Back Button based on View State */}
                        {(viewMode === 'DETAIL' || stateParams?.source === 'auto-alerts') && (
                            <button onClick={handleBackClick} className="p-2 bg-white dark:bg-zinc-900/50 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-800/60 transition-colors cursor-pointer text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white shadow-sm">
                                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        )}
                        <h2 className="text-2xl font-extrabold uppercase tracking-wider flex items-center gap-2 text-slate-900 dark:text-white">
                            <HistoryIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-500" /> Alert History
                        </h2>
                    </div>

                    {viewMode === 'LIST' && (
                        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                            {/* Type Filter Tabs Selector */}
                            <div className="flex gap-0.5 p-0.5 bg-bg-sidebar/55 border border-border/60 rounded-lg animate-in fade-in duration-200 shrink-0">
                                {[
                                    { value: 'ALL', label: 'All' },
                                    { value: 'AUTO', label: 'Auto' },
                                    { value: 'MANUAL', label: 'Manual' }
                                ].map((opt) => {
                                    const isActive = filterType === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            onClick={() => setFilterType(opt.value)}
                                            className={`px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-md text-[9px] sm:text-[10px] font-semibold tracking-wide transition-all cursor-pointer border-0 outline-none ${
                                                isActive 
                                                    ? 'bg-white dark:bg-zinc-800 text-accent font-bold shadow-sm' 
                                                    : 'text-text-muted hover:text-text-primary'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Month Selector */}
                            <div className="flex items-center bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/60 rounded-lg p-1 shrink-0">
                                <button onClick={handlePrevMonth} className="p-1 sm:p-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60 rounded-lg text-slate-400 dark:text-zinc-400 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <div className="px-2 sm:px-4 text-[10px] sm:text-xs font-bold text-slate-700 dark:text-zinc-200 tracking-wider w-24 sm:w-32 text-center uppercase flex items-center justify-center gap-1 sm:gap-1.5">
                                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 dark:text-zinc-500 hidden sm:block" />
                                    {MONTH_NAMES[currentMonth].substring(0, 3)} {currentYear}
                                </div>
                                <button onClick={handleNextMonth} className="p-1 sm:p-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60 rounded-lg text-slate-400 dark:text-zinc-400 transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* MAIN WORKSPACE */}
            <main className="flex-1 w-full max-w-none mx-auto px-4 md:px-8 py-3">
                {viewMode === 'LIST' ? renderListView() : renderDetailView()}
            </main>

            {/* ==========================================
                PREVIEW MODAL
               ========================================== */}
            {previewLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm" onClick={() => setPreviewLog(null)} />
                    <div className="relative bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-zinc-800/60 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-slate-200/60 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-900/30 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Log Inspector
                            </h3>
                            <button onClick={() => setPreviewLog(null)} className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-white transition-colors bg-transparent border-0 cursor-pointer outline-none"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-zinc-800/40">
                                <div>
                                    <span className="block text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Customer</span>
                                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">{previewLog.customerName}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Status</span>
                                    {renderLogStatus(previewLog.status, previewLog.retryCount)}
                                </div>
                                <div>
                                    <span className="block text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Serial</span>
                                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-zinc-400">#{(selectedHistory?.logs?.findIndex(l => l.id === previewLog.id) ?? 0) + 1}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Sent At</span>
                                    <span className="text-xs font-sans font-bold text-slate-500 dark:text-zinc-400">{formatDateToReadable(previewLog.sentAt)}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1">Message Preview Render</span>
                                <div className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-zinc-800/60 p-4 rounded-xl text-slate-700 dark:text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                    {previewLog.message || 'No message content available.'}
                                </div>
                            </div>
                        </div>
                        <div className="p-5 border-t border-slate-200/60 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-900/30">
                            <button onClick={() => setPreviewLog(null)} className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-wider transition-colors shadow-lg shadow-indigo-600/10 border-0 cursor-pointer outline-none">
                                Close Inspector
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlertHistory;
