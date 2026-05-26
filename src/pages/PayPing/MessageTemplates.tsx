import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    MessageSquare, Plus, X, Pencil, Trash2, ChevronLeft, 
    RefreshCw, LayoutDashboard, FileText, CheckCircle2, AlertCircle,
    CheckSquare, Square, Users, ArrowUpDown, Filter, Search, Phone
} from 'lucide-react';
import api from '../../api';

interface TemplateDTO {
    id: string;
    name: string;
    content: string;
}

interface CustomerDTO {
    id: string;
    name: string;
    phone: string;
    amount: number;
    expiryDate: string;
    paymentStatus: 'PAID' | 'UNPAID' | 'OVERDUE';
    status: 'ACTIVE' | 'INACTIVE';
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



const MessageTemplates = () => {
    const navigate = useNavigate();

    // ==========================================
    // 1. CORE DATA & LEDGER STATES
    // ==========================================
    const [templates, setTemplates] = useState<TemplateDTO[]>([]);
    const [serverTags, setServerTags] = useState<string[]>([]);
    const [loadingLedger, setLoadingLedger] = useState<boolean>(true);

    // ==========================================
    // 2. TEMPLATE SELECTION (LONG-PRESS) STATES
    // ==========================================
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
    const [isTemplateSelectionMode, setIsTemplateSelectionMode] = useState<boolean>(false);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ==========================================
    // 3. INLINE CUSTOMER VIEW ARCHITECTURE STATES
    // ==========================================
    const [showCustomerPicker, setShowCustomerPicker] = useState<boolean>(false);
    const [customers, setCustomers] = useState<CustomerDTO[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState<boolean>(false);
    const [customerTotalPages, setCustomerTotalPages] = useState<number>(1);
    
    // Customer Query State
    const [customerQuery, setCustomerQuery] = useState({
        status: 'ACTIVE',
        search: '',
        sort: 'name_asc',
        filters: { paymentStatus: [] as string[] },
        page: 0,
        size: 30
    });
    
    // Confirmed vs. Active Picker selections
    const [pickerSelectedCustomerIds, setPickerSelectedCustomerIds] = useState<Set<string>>(new Set());
    const [confirmedCustomerIds, setConfirmedCustomerIds] = useState<string[]>([]);
    const [isCustomerGlobalSelectAll, setIsCustomerGlobalSelectAll] = useState<boolean>(false);

    // Picker UI Toggles
    const [isCustSearchExpanded, setIsCustSearchExpanded] = useState<boolean>(false);
    const [showCustStatusDropdown, setShowCustStatusDropdown] = useState<boolean>(false);
    const [showCustSortDropdown, setShowCustSortDropdown] = useState<boolean>(false);
    const [showCustFilterModal, setShowCustFilterModal] = useState<boolean>(false);
    const [custFilterDraft, setCustFilterDraft] = useState<string[]>([]);
    const custSearchInputRef = useRef<HTMLInputElement>(null);
    const custDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ==========================================
    // 4. MODALS & MUTATION STATES
    // ==========================================
    const [showUpsertModal, setShowUpsertModal] = useState<boolean>(false);
    const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);
    const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
    const [deleteModalHeader, setDeleteModalHeader] = useState<string>('');

    const [selectedTemplate, setSelectedTemplate] = useState<TemplateDTO | null>(null);
    const [isEditMode, setIsEditMode] = useState<boolean>(false);

    // Upsert Form Fields
    const [templateName, setTemplateName] = useState<string>('');
    const [templateContent, setTemplateContent] = useState<string>('');
    
    // Live Server Preview Fields
    const [previewText, setPreviewText] = useState<string>('');
    const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
    const [isPreviewed, setIsPreviewed] = useState<boolean>(false);
    const [isContentDull, setIsContentDull] = useState<boolean>(false);

    // Detailed View Server Preview Fields
    const [detailPreviewText, setDetailPreviewText] = useState<string>('');
    const [loadingDetailPreview, setLoadingDetailPreview] = useState<boolean>(false);

    const contentEditableRef = useRef<HTMLDivElement>(null);
    const lastContentRef = useRef<string>('');

    // ==========================================
    // 5. DATA PIPELINES & SYNCHRONIZATION
    // ==========================================
    const fetchTemplatesAndTags = useCallback(async () => {
        try {
            setLoadingLedger(true);
            const [templatesRes, tagsRes] = await Promise.all([
                api.get('/payping/templates/get'),
                api.get('/payping/templates/tags')
            ]);
            setTemplates(templatesRes.data || []);
            setServerTags(tagsRes.data || []);
        } catch (err) {
            console.error("Failed to sync template directory:", err);
        } finally {
            setLoadingLedger(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplatesAndTags();
    }, [fetchTemplatesAndTags]);

    useEffect(() => {
        const fetchDetailPreview = async () => {
            if (!selectedTemplate) {
                setDetailPreviewText('');
                return;
            }
            try {
                setLoadingDetailPreview(true);
                const res = await api.post('/payping/templates/preview', {
                    name: selectedTemplate.name,
                    content: selectedTemplate.content
                });
                setDetailPreviewText(res.data.preview || res.data || "Empty response.");
            } catch (err) {
                console.error("Detail preview fetch error:", err);
                setDetailPreviewText("System parsing error.");
            } finally {
                setLoadingDetailPreview(false);
            }
        };

        fetchDetailPreview();
    }, [selectedTemplate]);

    // Fetch Picker Customers whenever query properties shift
    const fetchPickerCustomers = useCallback(async () => {
        if (!showCustomerPicker) return;
        try {
            setLoadingCustomers(true);
            const res = await api.post('/payping/customers/get', customerQuery);
            const dataContent = res.data || res.data.content || [];
            setCustomers(dataContent);
            setCustomerTotalPages(res.data.totalPages || 1);
        } catch (err) {
            console.error("Failed to load picker customers:", err);
        } finally {
            setLoadingCustomers(false);
        }
    }, [customerQuery, showCustomerPicker]);

    useEffect(() => {
        fetchPickerCustomers();
    }, [fetchPickerCustomers]);

    // Handle Global Select All across paginated sets inside Picker
    useEffect(() => {
        if (isCustomerGlobalSelectAll && customers.length > 0) {
            setPickerSelectedCustomerIds(prev => {
                const updated = new Set(prev);
                customers.forEach(c => updated.add(c.id));
                return updated;
            });
        }
    }, [customers, isCustomerGlobalSelectAll]);

    // ==========================================
    // 6. TEMPLATE SELECTION MECHANICS (LONG-PRESS)
    // ==========================================
    const handleTemplateTouchStart = (id: string) => {
        longPressTimerRef.current = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(50);
            setIsTemplateSelectionMode(true);
            handleTemplateCheckboxToggle(id);
        }, 800);
    };

    const handleTemplateTouchEnd = () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };

    const handleTemplateCheckboxToggle = (id: string) => {
        setSelectedTemplateIds(prev => {
            const updated = new Set(prev);
            if (updated.has(id)) {
                updated.delete(id);
                if (updated.size === 0) setIsTemplateSelectionMode(false);
            } else {
                updated.add(id);
            }
            return updated;
        });
    };

    const handleTemplateClick = (tmpl: TemplateDTO) => {
        if (isTemplateSelectionMode) {
            handleTemplateCheckboxToggle(tmpl.id);
        } else {
            setSelectedTemplate(tmpl);
            setConfirmedCustomerIds([]); // Flush stale audience tracks on entering new profile context
            setShowDetailModal(true);
        }
    };

    // ==========================================
    // 7. DELETION PIPELINE (SINGLE & BULK MAPS)
    // ==========================================
    const initBulkDeleteWorkflow = () => {
        const targetIds = Array.from(selectedTemplateIds);
        setDeleteTargetIds(targetIds);
        setDeleteModalHeader(`confirm deleting ${targetIds.length} templates?`);
        setShowDeleteConfirmation(true);
    };

    const initSingleDeleteWorkflow = (tmpl: TemplateDTO) => {
        setDeleteTargetIds([tmpl.id]);
        setDeleteModalHeader(`confirm deleting ${tmpl.name}?`);
        setShowDeleteConfirmation(true);
    };

    const commitTemplateDeletion = async () => {
        try {
            // Fires API payload with list of template ids
            await api.post('/payping/templates/delete-batch', { ids: deleteTargetIds }, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            
            setShowDeleteConfirmation(false);
            setShowDetailModal(false);
            setSelectedTemplate(null);
            setSelectedTemplateIds(new Set());
            setIsTemplateSelectionMode(false);
            fetchTemplatesAndTags();
        } catch (err) {
            console.error("Batch deletion exception execution error:", err);
        }
    };

    // ==========================================
    // 8. COGNITIVE TAG SHORTCUT INTERFACES
    // ==========================================
    // ==========================================
    // 8. COGNITIVE TAG SHORTCUT INTERFACES
    // ==========================================
    const parseBracketsToHTML = (content: string) => {
        if (!content) return '';
        // Escape HTML to preserve text exactly
        const escaped = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Replace {tag} with non-editable visual span pill
        return escaped.replace(/({[^{}]+})/g, (match) => {
            const tag = match.slice(1, -1);
            return `<span contenteditable="false" data-tag="${tag}" class="inline-flex items-center gap-1.5 px-1.5 py-0.5 mx-0.5 bg-[#022c22]/90 text-emerald-400 border border-emerald-800/60 rounded text-[1em] font-semibold align-baseline select-none whitespace-nowrap">` +
                `${tag}` +
                `<button type="button" data-action="remove-tag" data-tag="${tag}" class="text-emerald-400 hover:text-red-400 transition-colors p-0 border-0 bg-transparent outline-none flex items-center justify-center rounded hover:bg-red-500/20 cursor-pointer pointer-events-auto" style="width: 14px; height: 14px;">` +
                    `<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>` +
                `</button>` +
            `</span>`;
        });
    };

    const parseHTMLToBrackets = (html: string) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Find all tag spans and replace with bracketed text
        const spans = tempDiv.querySelectorAll('span[data-tag]');
        spans.forEach((span) => {
            const tag = span.getAttribute('data-tag');
            span.replaceWith(document.createTextNode(`{${tag}}`));
        });

        // Traverse the DOM to extract clean text preserving newlines
        const extractText = (node: Node): string => {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.nodeValue || '';
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (el.tagName === 'BR') {
                    return '\n';
                }
                let childText = '';
                el.childNodes.forEach((child) => {
                    childText += extractText(child);
                });
                if (el.tagName === 'DIV' || el.tagName === 'P') {
                    return childText + '\n';
                }
                return childText;
            }
            return '';
        };

        let text = extractText(tempDiv);
        text = text.replace(/\u00a0/g, ' '); // Replace NBSP with normal space
        return text.replace(/\n$/, ''); // Remove trailing newline inserted by browsers
    };

    // Synchronize React state templateContent -> contentEditable DOM innerHTML
    useEffect(() => {
        if (contentEditableRef.current && templateContent !== lastContentRef.current) {
            contentEditableRef.current.innerHTML = parseBracketsToHTML(templateContent);
            lastContentRef.current = templateContent;
        }
    }, [templateContent]);

    const handleContentEditableInput = () => {
        if (contentEditableRef.current) {
            const html = contentEditableRef.current.innerHTML;
            const updatedText = parseHTMLToBrackets(html);
            lastContentRef.current = updatedText;
            handleTextModification(updatedText);
        }
    };

    const handleContentEditableClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button[data-action="remove-tag"]');
        if (button) {
            e.stopPropagation();
            e.preventDefault();
            const tag = button.getAttribute('data-tag');
            if (tag) {
                handleRemoveTagFromEditor(tag);
            }
        }
    };

    const injectTagPillShortcut = (tagName: string) => {
        const tagToInsert = `{${tagName}}`;
        const editorElement = contentEditableRef.current;
        if (!editorElement) {
            setTemplateContent(prev => prev + tagToInsert);
            handleTextModification(templateContent + tagToInsert);
            return;
        }

        editorElement.focus();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && editorElement.contains(selection.anchorNode)) {
            const range = selection.getRangeAt(0);
            range.deleteContents();

            // Create visual tag element node
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = parseBracketsToHTML(tagToInsert);
            const tagNode = tempDiv.firstElementChild;
            
            if (tagNode) {
                range.insertNode(tagNode);
                
                // Append space after tag for typing comfort
                const spaceNode = document.createTextNode('\u00a0');
                tagNode.after(spaceNode);
                
                // Move caret to focus right after space node
                range.setStartAfter(spaceNode);
                range.setEndAfter(spaceNode);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            const html = editorElement.innerHTML;
            const updatedText = parseHTMLToBrackets(html);
            lastContentRef.current = updatedText;
            handleTextModification(updatedText);
        } else {
            const updatedText = templateContent + tagToInsert;
            setTemplateContent(updatedText);
            handleTextModification(updatedText);
            
            // Move cursor to the end
            setTimeout(() => {
                editorElement.focus();
                const range = document.createRange();
                range.selectNodeContents(editorElement);
                range.collapse(false);
                const sel = window.getSelection();
                if (sel) {
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }, 50);
        }
    };

    const ejectTagPillFromText = (tagName: string) => {
        const updatedText = templateContent.split(`{${tagName}}`).join('');
        setTemplateContent(updatedText);
        handleTextModification(updatedText);
    };

    const handleRemoveTagFromList = async (tmpl: TemplateDTO, tag: string) => {
        const updatedContent = tmpl.content.split(`{${tag}}`).join('');
        try {
            await api.put(`/payping/templates/save/${tmpl.id}`, {
                name: tmpl.name,
                content: updatedContent
            }, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            fetchTemplatesAndTags();
        } catch (err) {
            console.error("Failed to remove tag from list template:", err);
        }
    };

    const handleRemoveTagFromDetail = async (tag: string) => {
        if (!selectedTemplate) return;
        const updatedContent = selectedTemplate.content.split(`{${tag}}`).join('');
        try {
            await api.put(`/payping/templates/save/${selectedTemplate.id}`, {
                name: selectedTemplate.name,
                content: updatedContent
            }, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            setSelectedTemplate({
                ...selectedTemplate,
                content: updatedContent
            });
            fetchTemplatesAndTags();
        } catch (err) {
            console.error("Failed to remove tag in detail modal:", err);
        }
    };

    const handleRemoveTagFromEditor = (tag: string) => {
        ejectTagPillFromText(tag);
    };

    const handleTextModification = (newVal: string) => {
        setTemplateContent(newVal);
        if (isPreviewed) setIsContentDull(true);
    };

    const requestServerPreview = async () => {
        if (!templateContent.trim() || !templateName.trim()) return;
        try {
            setLoadingPreview(true);
            setIsPreviewed(true);
            setIsContentDull(false);
            const res = await api.post('/payping/templates/preview', { name: templateName, content: templateContent });
            setPreviewText(res.data.preview || res.data || "Empty response.");
        } catch (err) {
            console.error("Preview compiler failure:", err);
            setPreviewText("System parsing error.");
        } finally {
            setLoadingPreview(false);
        }
    };

    const commitTemplateUpsert = async () => {
        if (!templateName.trim() || !templateContent.trim()) return;
        try {
            const payload = { name: templateName, content: templateContent };
            if (isEditMode && selectedTemplate) {
                await api.put(`/payping/templates/save/${selectedTemplate.id}`, payload, {
                    headers: { 'X-Trigger-Success': 'true' }
                });
            } else {
                await api.post('/payping/templates/save', payload, {
                    headers: { 'X-Trigger-Success': 'true' }
                });
            }
            setShowUpsertModal(false);
            clearFormState();
            fetchTemplatesAndTags();
        } catch (err) {
            console.error("Save template error:", err);
        }
    };

    const triggerEditWorkflow = () => {
        if (!selectedTemplate) return;
        setTemplateName(selectedTemplate.name);
        setTemplateContent(selectedTemplate.content);
        setIsEditMode(true);
        setShowDetailModal(false);
        setIsPreviewed(false);
        setIsContentDull(false);
        setPreviewText('');
        setShowUpsertModal(true);
    };

    const clearFormState = () => {
        setTemplateName('');
        setTemplateContent('');
        setPreviewText('');
        setIsPreviewed(false);
        setIsContentDull(false);
        setIsEditMode(false);
        setSelectedTemplate(null);
    };

    // ==========================================
    // 9. CLIENT TARGET AUDIENCE DISPATCH COUPLER
    // ==========================================
    const executeTemplateBroadcastDispatch = async () => {
        if (!selectedTemplate || confirmedCustomerIds.length === 0) return;
        try {
            await api.post('/payping/whatsapp/send', {
                templateId: selectedTemplate.id,
                customerIds: confirmedCustomerIds
            }, {
                headers: { 'X-Trigger-Success': 'true' }
            });
            setShowDetailModal(false);
            setConfirmedCustomerIds([]);
            console.log("Broadcast triggered successfully!");
        } catch (err) {
            console.error("Bulk template distribution error:", err);
        }
    };

    // Picker Action Controls
    const handleCustSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (custDebounceTimerRef.current) clearTimeout(custDebounceTimerRef.current);
        custDebounceTimerRef.current = setTimeout(() => {
            setCustomerQuery(prev => ({ ...prev, search: value, page: 0 }));
        }, 500);
    };

    const toggleCustPickerGlobalSelect = () => {
        if (isCustomerGlobalSelectAll) {
            setPickerSelectedCustomerIds(new Set());
            setIsCustomerGlobalSelectAll(false);
        } else {
            const allIds = customers.map(c => c.id);
            setPickerSelectedCustomerIds(new Set(allIds));
            setIsCustomerGlobalSelectAll(true);
        }
    };

    const handlePickerRowToggle = (id: string) => {
        setPickerSelectedCustomerIds(prev => {
            const updated = new Set(prev);
            if (updated.has(id)) updated.delete(id);
            else updated.add(id);
            return updated;
        });
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none overflow-x-hidden pb-28 relative">
            
            {/* ======================================================= */}
            {/* MAIN HEADER WINDOW PORT (ZONES 1 & 2 CONTROL ARRAYS)     */}
            {/* ======================================================= */}
            <header className="sticky top-0 z-20 bg-slate-950 px-4 pt-5 pb-4 max-w-md lg:max-w-6xl mx-auto w-full border-b border-slate-900/50">
                <div className="flex items-center justify-between h-10">
                    <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-emerald-500" /> Templates
                    </h2>
                    
                    {!isTemplateSelectionMode ? (
                        <button 
                            onClick={() => { clearFormState(); setShowUpsertModal(true); }}
                            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-emerald-600/10 border-0 outline-none"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    ) : (
                        <button 
                            onClick={() => setSelectedTemplateIds(new Set())}
                            className="text-xs font-bold text-slate-400 hover:text-white"
                        >
                            Cancel Selection
                        </button>
                    )}
                </div>

                {/* DYNAMIC TOP BUTTON ACTION IF REGISTRY BATCHING TURNS ALIVE */}
                {isTemplateSelectionMode && selectedTemplateIds.size > 0 && (
                    <div className="mt-4 animate-in fade-in zoom-in-95 duration-150">
                        <button
                            onClick={initBulkDeleteWorkflow}
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs border-0 outline-none shadow-lg shadow-red-600/10"
                        >
                            <Trash2 className="w-4 h-4" /> Delete Selected Templates ({selectedTemplateIds.size})
                        </button>
                    </div>
                )}
            </header>

            {/* MAIN SYSTEM CATALOGUE DIRECTORY WORKSPACE */}
            <main className="flex-1 px-4 max-w-md lg:max-w-6xl mx-auto w-full pt-4 space-y-3 animate-in fade-in duration-300">
                {loadingLedger ? (
                    <div className="py-24 text-center flex flex-col items-center justify-center gap-2 text-slate-500 text-xs font-mono">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" /> SYNCHRONIZING TEMPLATE REGISTRY...
                    </div>
                ) : templates.length === 0 ? (
                    <div className="py-20 text-center text-slate-655 text-xs space-y-2">
                        <FileText className="w-8 h-8 mx-auto opacity-10" />
                        <p>No operational templates cataloged in workspace.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {templates.map((tmpl) => {
                            const isChecked = selectedTemplateIds.has(tmpl.id);
                            return (
                                <div 
                                    key={tmpl.id}
                                    onTouchStart={() => handleTemplateTouchStart(tmpl.id)}
                                    onTouchEnd={handleTemplateTouchEnd}
                                    onMouseDown={() => handleTemplateTouchStart(tmpl.id)}
                                    onMouseUp={handleTemplateTouchEnd}
                                    onClick={() => handleTemplateClick(tmpl)}
                                    className={`w-full bg-slate-900 p-4 rounded-xl flex items-center justify-between border transition-all active:scale-[0.99] cursor-pointer ${isChecked ? 'border-red-500 bg-slate-900' : 'border-transparent hover:bg-slate-800/40'}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0 pr-2">
                                        {isTemplateSelectionMode && (
                                            <div className="shrink-0">
                                                {isChecked ? <CheckSquare className="w-4 h-4 text-red-500" /> : <Square className="w-4 h-4 text-slate-600" />}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-bold text-slate-200 truncate">{tmpl.name}</h4>
                                            <p className="text-xs text-slate-500 truncate mt-1 font-medium">{renderTemplateWithPills(tmpl.content, false)}</p>
                                        </div>
                                    </div>
                                    <ChevronLeft className="w-4 h-4 text-slate-600 rotate-180 shrink-0" />
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* BOTTOM NAV BAR INTERACTION ACTION REGISTRY */}
            <div className="fixed bottom-5 left-4 right-4 max-w-md mx-auto z-10">
                <button 
                    onClick={() => navigate('/payping/dashboard')}
                    className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors"
                >
                    <LayoutDashboard className="w-4 h-4" /> Return to Dashboard
                </button>
            </div>

            {/* ======================================================= */}
            {/* REVERSIBLE/CRITICAL DELETION DUAL-CONFIRM OVERLAY DIALOG */}
            {/* ======================================================= */}
            {showDeleteConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setShowDeleteConfirmation(false)} />
                    <div className="relative bg-slate-900 w-full max-w-sm rounded-2xl p-6 space-y-5 text-center animate-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                            <Trash2 className="w-5 h-5" />
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="text-sm font-bold text-slate-200 first-letter:uppercase">{deleteModalHeader}</h3>
                            <p className="text-xs text-slate-500">Action is not reversible. Data will be dropped completely.</p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setShowDeleteConfirmation(false)}
                                className="w-1/2 bg-slate-950 text-slate-400 font-bold py-3 rounded-xl text-xs border-0 outline-none"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={commitTemplateDeletion}
                                className="w-1/2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-xs border-0 outline-none shadow-lg shadow-red-600/10"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================= */}
            {/* UPSERT OVERLAY WINDOW SYSTEM (ADD / EDIT ARCHITECTURE)  */}
            {/* ======================================================= */}
            {showUpsertModal && (
                <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => { setShowUpsertModal(false); clearFormState(); }} />
                    <div className="relative bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] border-0 text-sm overflow-hidden animate-in slide-in-from-bottom-10 duration-200">
                        
                        <div className="p-5 border-b border-slate-850 flex items-center justify-between bg-slate-950/30 shrink-0">
                            <h3 className="font-extrabold text-sm text-slate-200 tracking-tight">
                                {isEditMode ? "Modify Message Template" : "Add New Message Template"}
                            </h3>
                            <button onClick={() => { setShowUpsertModal(false); clearFormState(); }} className="text-slate-500 hover:text-slate-300 border-0 outline-none bg-transparent"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1 space-y-5 pb-8">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Template Label Identity Name</label>
                                <input 
                                    type="text"
                                    placeholder="e.g., Late Fee Penalty Reminder"
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    className="w-full bg-slate-950 text-white text-sm font-semibold p-3.5 rounded-xl outline-none border border-transparent focus:border-slate-850 transition-colors"
                                />
                            </div>

                            {/* BLOCK 1: DYNAMIC TOKEN INJECTION PILLS */}
                            <div className="space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-slate-850/30">
                                <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Inline Tags</span>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {serverTags.map((tag) => {
                                        const textContainsPill = templateContent.includes(`{${tag}}`);
                                        return (
                                            <div 
                                                key={tag} 
                                                className={`inline-flex items-center text-[10px] font-mono font-bold tracking-wide rounded-lg overflow-hidden transition-all duration-150 ${textContainsPill ? 'bg-blue-600/10 text-blue-400' : 'bg-slate-950 text-slate-400'}`}
                                            >
                                                <button type="button" onClick={() => injectTagPillShortcut(tag)} className="px-2.5 py-1.5 font-bold border-0 bg-transparent text-inherit outline-none">
                                                    {tag}
                                                </button>
                                                {textContainsPill && (
                                                    <button type="button" onClick={() => ejectTagPillFromText(tag)} className="px-1.5 py-1.5 border-l border-blue-500/10 hover:bg-red-500/20 hover:text-red-400 transition-colors bg-transparent outline-none">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] leading-relaxed text-slate-500 font-medium pt-1.5 border-t border-slate-950/60">
                                    Tap dynamic parameter badges to safely append vectors straight into text cursor ranges. You can safely clear links using individual cancel crosses.
                                </p>
                            </div>

                              {/* BLOCK 2: BLUEPRINT INPUT BOX FRAME */}
                              <div className="space-y-1.5">
                                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Message Template Editor</label>
                                  <div 
                                      ref={contentEditableRef}
                                      contentEditable
                                      onInput={handleContentEditableInput}
                                      onClick={handleContentEditableClick}
                                      placeholder="Type data string contents here..."
                                      className="w-full h-32 bg-slate-950 text-white text-sm font-medium p-3.5 rounded-xl outline-none border border-transparent focus:border-slate-850 overflow-y-auto leading-relaxed whitespace-pre-wrap break-words select-text focus:outline-none empty:before:content-[attr(placeholder)] empty:before:text-slate-500 empty:before:font-medium empty:before:pointer-events-none"
                                      style={{
                                          boxSizing: 'border-box'
                                      }}
                                  />
                              </div>

 
                             {/* BLOCK 3: RENDERING LOG OVERVIEW PREVIEW BOX */}
                             {isPreviewed && (
                                 <div className="space-y-2 animate-in fade-in slide-in-from-top-3 duration-200">
                                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                         <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Message Preview
                                     </label>
                                     <div className={`w-full p-4 rounded-xl font-medium text-xs leading-relaxed whitespace-pre-wrap transition-all duration-150 ${loadingPreview ? 'bg-slate-950/40 text-slate-600 select-none animate-pulse' : isContentDull ? 'bg-slate-950/70 text-slate-500 line-clamp-none' : 'bg-slate-950 text-slate-300'}`}>
                                         {loadingPreview ? (
                                             <span className="flex items-center gap-1.5 font-mono text-[10px]">
                                                 <RefreshCw className="w-3 h-3 animate-spin text-blue-500" /> Connecting rendering pipeline over remote structures...
                                             </span>
                                         ) : previewText}
                                     </div>
                                    {isContentDull && !loadingPreview && (
                                        <span className="text-[10px] font-medium text-amber-500 flex items-center gap-1 ml-1">
                                            <AlertCircle className="w-3 h-3" /> New changes added. Generate Preview to see updated Message.
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-5 border-t border-slate-850 bg-slate-950/60 shrink-0">
                            {(!isPreviewed || isContentDull) ? (
                                <button 
                                    type="button"
                                    onClick={requestServerPreview}
                                    disabled={!templateName.trim() || !templateContent.trim() || loadingPreview}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-20 text-white font-bold py-3.5 rounded-xl text-xs tracking-wider uppercase border-0 outline-none shadow-lg shadow-blue-600/10"
                                >
                                    Generate Preview
                                </button>
                            ) : (
                                <button 
                                    type="button"
                                    onClick={commitTemplateUpsert}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl text-xs tracking-wider uppercase border-0 outline-none shadow-lg shadow-emerald-600/10"
                                >
                                    {isEditMode ? "Modify Message Template" : "Add Message Template"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================= */}
            {/* COMPREHENSIVE DOSSIER DETAILED TEMPLATE POPUP VIEW      */}
            {/* ======================================================= */}
            {showDetailModal && selectedTemplate && (
                <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center p-0">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => { setShowDetailModal(false); setSelectedTemplate(null); }} />
                    <div className="relative bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh] border-0 animate-in slide-in-from-bottom-10 duration-200 overflow-hidden">
                        
                        <div className="p-5 border-b border-slate-850 flex items-center justify-between bg-slate-950/30">
                            <div className="min-w-0 pr-4">
                                <h3 className="font-black text-base text-slate-100 truncate tracking-tight">{selectedTemplate.name}</h3>
                            </div>
                            
                            <div className="flex items-center gap-5 shrink-0 text-slate-400">
                                <button onClick={triggerEditWorkflow} className="p-0 bg-transparent border-0 text-blue-400 hover:text-blue-300 outline-none"><Pencil className="w-4 h-4" /></button>
                                <button onClick={() => initSingleDeleteWorkflow(selectedTemplate)} className="p-0 bg-transparent border-0 text-red-400 hover:text-red-300 outline-none"><Trash2 className="w-4 h-4" /></button>
                                <button onClick={() => { setShowDetailModal(false); setSelectedTemplate(null); }} className="p-0 bg-transparent border-0 text-slate-500 hover:text-slate-300 outline-none"><X className="w-5 h-5" /></button>
                            </div>
                        </div>

                         <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
                            <div className="space-y-1.5">
                                <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Message Template</span>
                                <div className="w-full bg-slate-950 p-4 rounded-xl text-slate-400 font-medium leading-relaxed whitespace-pre-wrap">
                                    {renderTemplateWithPills(selectedTemplate.content, false)}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Message Preview</span>
                                <div className={`w-full p-4 rounded-xl leading-relaxed font-mono text-[11px] whitespace-pre-wrap transition-all duration-150 ${loadingDetailPreview ? 'bg-slate-950/40 text-slate-600 select-none animate-pulse' : 'bg-slate-950/50 text-slate-300'}`}>
                                    {loadingDetailPreview ? (
                                        <span className="flex items-center gap-1.5 font-mono text-[10px]">
                                            <RefreshCw className="w-3 h-3 animate-spin text-blue-500" /> Connecting rendering pipeline over remote structures...
                                        </span>
                                    ) : detailPreviewText || "Empty response."}
                                </div>
                            </div>
                        </div>

                        {/* INTERACTION DISPATCH SELECTION ACTIONS FOOTER CORE COMPONENT */}
                        <div className="p-5 border-t border-slate-850 bg-slate-950/50">
                            {confirmedCustomerIds.length === 0 ? (
                                <button
                                    onClick={() => {
                                        setPickerSelectedCustomerIds(new Set());
                                        setIsCustomerGlobalSelectAll(false);
                                        setShowCustomerPicker(true);
                                    }}
                                    className="w-full bg-[#128C7E] hover:bg-[#0e7569] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs border-0 outline-none shadow-lg shadow-[#128C7E]/10"
                                >
                                    <Users className="w-4 h-4" /> Select Message Recipients
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <button
                                        onClick={executeTemplateBroadcastDispatch}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs border-0 outline-none shadow-lg shadow-emerald-600/10"
                                    >
                                        <MessageSquare className="w-4 h-4" /> Send Message to {confirmedCustomerIds.length} Customers
                                    </button>
                                    <button 
                                        onClick={() => setShowCustomerPicker(true)}
                                        className="w-full text-center text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wider"
                                    >
                                        Adjust Target Selection List
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================= */}
            {/* FULL INLINE CUSTOMER VIEW MODAL INJECTED RECIPIENT PICKER */}
            {/* ======================================================= */}
            {showCustomerPicker && (
                <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col font-sans select-none overflow-x-hidden animate-in slide-in-from-bottom-10 duration-200">
                    
                    {/* Picker Header Layer (Zones 1 & 2 structural matching rows) */}
                    <header className="sticky top-0 z-30 bg-slate-950 px-4 pt-5 pb-3 max-w-md mx-auto w-full">
                        <div className="flex items-center justify-between pb-5">
                            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-500" /> Select Targets
                            </h2>
                            <button onClick={() => setShowCustomerPicker(false)} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="h-8 relative">
                            {!isCustSearchExpanded ? (
                                <div className="flex items-center justify-between h-full">
                                    <div className="relative">
                                        <button onClick={() => setShowCustStatusDropdown(true)} className="flex items-center gap-1.5 text-xs font-bold text-slate-300 tracking-wider uppercase">
                                            {customerQuery.status} REGISTRY <ChevronLeft className="w-4 h-4 text-slate-500 -rotate-90" />
                                        </button>
                                        {showCustStatusDropdown && (
                                            <>
                                                <div onClick={() => setShowCustStatusDropdown(false)} className="fixed inset-0 z-40" />
                                                <div className="absolute left-0 mt-3 w-40 bg-slate-900 rounded-xl p-1.5 shadow-2xl z-50">
                                                    {['ACTIVE', 'INACTIVE', 'ALL'].map((opt) => (
                                                        <button 
                                                            key={opt}
                                                            onClick={() => { setCustomerQuery(prev => ({ ...prev, status: opt, page: 0 })); setShowCustStatusDropdown(false); }}
                                                            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-800 font-semibold text-xs text-slate-300"
                                                        >
                                                            {opt} DIRECTORY
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-5 text-slate-400">
                                        <div className="relative">
                                            <button onClick={() => setShowCustSortDropdown(true)} className="hover:text-white"><ArrowUpDown className="w-4 h-4" /></button>
                                            {showCustSortDropdown && (
                                                <>
                                                    <div onClick={() => setShowCustSortDropdown(false)} className="fixed inset-0 z-40" />
                                                    <div className="absolute right-0 mt-3 w-48 bg-slate-900 rounded-xl p-1.5 shadow-2xl z-50">
                                                        {[
                                                            { key: 'name_asc', label: 'Name (A-Z)' },
                                                            { key: 'name_desc', label: 'Name (Z-A)' },
                                                            { key: 'amount_desc', label: 'Amount (High-Low)' },
                                                            { key: 'amount_asc', label: 'Amount (Low-High)' }
                                                        ].map((opt) => (
                                                            <button
                                                                key={opt.key}
                                                                onClick={() => { setCustomerQuery(prev => ({ ...prev, sort: opt.key, page: 0 })); setShowCustSortDropdown(false); }}
                                                                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold ${customerQuery.sort === opt.key ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300 hover:bg-slate-800'}`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <button onClick={() => { setShowCustFilterModal(true); setCustFilterDraft(customerQuery.filters.paymentStatus); }} className="relative hover:text-white">
                                            <Filter className="w-4 h-4" />
                                            {customerQuery.filters.paymentStatus.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />}
                                        </button>
                                        <button onClick={() => { setIsCustSearchExpanded(true); setTimeout(() => custSearchInputRef.current?.focus(), 50); }} className="hover:text-white"><Search className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 h-full">
                                    <div className="flex-1 bg-slate-900 rounded-lg px-3 h-full flex items-center gap-2">
                                        <Search className="w-4 h-4 text-slate-500" />
                                        <input 
                                            ref={custSearchInputRef}
                                            type="text"
                                            placeholder="Search parameters..."
                                            defaultValue={customerQuery.search}
                                            onChange={handleCustSearchChange}
                                            className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                                        />
                                    </div>
                                    <button onClick={() => { setIsCustSearchExpanded(false); if(customerQuery.search) setCustomerQuery(prev => ({...prev, search: '', page:0})); }} className="text-xs font-bold text-slate-400">Cancel</button>
                                </div>
                            )}
                        </div>
                    </header>

                    {/* Picker Core Main Flow Content */}
                    <main className="flex-1 px-4 max-w-md mx-auto w-full space-y-4 pt-3 overflow-y-auto pb-32">
                        <div className="flex items-center justify-between">
                            <button onClick={toggleCustPickerGlobalSelect} className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                {isCustomerGlobalSelectAll ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4 text-slate-500" />}
                                SELECT LEDGER TOTAL
                            </button>
                            {pickerSelectedCustomerIds.size > 0 && <span className="text-xs font-mono text-slate-400">SELECTED: {pickerSelectedCustomerIds.size}</span>}
                        </div>

                        {/* Filter Pill Badges */}
                        {customerQuery.filters.paymentStatus.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {customerQuery.filters.paymentStatus.map(pill => (
                                    <div key={pill} className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 rounded-full text-xs font-mono text-slate-300">
                                        {pill}
                                        <button onClick={() => setCustomerQuery(prev => ({ ...prev, page: 0, filters: { paymentStatus: prev.filters.paymentStatus.filter(f => f !== pill) } }))}><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Customer Dynamic Content Matrix Grid */}
                        <section className="space-y-3">
                            {loadingCustomers && customers.length === 0 ? (
                                <div className="py-20 text-center flex flex-col items-center gap-2 text-slate-500 text-xs font-mono">
                                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" /> LOADING SELECTION ROW TILES...
                                </div>
                            ) : customers.length === 0 ? (
                                <div className="py-16 text-center text-slate-500 text-xs">No records matching profile filter criteria found.</div>
                            ) : (
                                customers.map((customer) => {
                                    const isChecked = pickerSelectedCustomerIds.has(customer.id);
                                    let badgeStyle = customer.paymentStatus === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' : customer.paymentStatus === 'UNPAID' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-400';
                                    return (
                                        <div 
                                            key={customer.id}
                                            onClick={() => handlePickerRowToggle(customer.id)}
                                            className={`w-full bg-slate-900 p-4 rounded-xl flex items-center justify-between gap-3 transition-colors ${isChecked ? 'ring-1 ring-blue-500 bg-slate-800' : ''}`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="shrink-0">{isChecked ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4 text-slate-600" />}</div>
                                                <div className="w-10 h-10 rounded-lg bg-slate-950 font-bold text-xs text-slate-400 flex items-center justify-center uppercase shrink-0">{customer.name.substring(0, 2)}</div>
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-bold text-slate-200 truncate">{customer.name}</h4>
                                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{customer.phone}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 space-y-1">
                                                <div className="text-sm font-bold text-slate-100">₹{customer.amount}</div>
                                                <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded ${badgeStyle}`}>{customer.paymentStatus}</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </section>

                        {/* Picker Pagination Footer */}
                        {customerTotalPages > 1 && (
                            <div className="flex items-center justify-between pt-2 pb-6 text-xs text-slate-500 font-bold tracking-wider">
                                <button disabled={customerQuery.page === 0 || loadingCustomers} onClick={() => setCustomerQuery(prev => ({ ...prev, page: prev.page - 1 }))} className="px-4 py-2 bg-slate-900 rounded-lg disabled:opacity-30">PREV</button>
                                <span>PAGE {customerQuery.page + 1} OF {customerTotalPages}</span>
                                <button disabled={customerQuery.page + 1 >= customerTotalPages || loadingCustomers} onClick={() => setCustomerQuery(prev => ({ ...prev, page: prev.page + 1 }))} className="px-4 py-2 bg-slate-900 rounded-lg disabled:opacity-30">NEXT</button>
                            </div>
                        )}
                    </main>

                    {/* CONFIRM RECIPIENT CAPTURE FOOTER HUB BAR */}
                    <div className="fixed bottom-5 left-4 right-4 max-w-md mx-auto z-40 bg-slate-950 pt-2">
                        <button
                            onClick={() => {
                                setConfirmedCustomerIds(Array.from(pickerSelectedCustomerIds));
                                setShowCustomerPicker(false);
                            }}
                            disabled={pickerSelectedCustomerIds.size === 0}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-20 text-white font-bold py-4 rounded-xl text-xs uppercase tracking-wider border-0 outline-none shadow-xl shadow-blue-600/10"
                        >
                            Confirm Selection ({pickerSelectedCustomerIds.size} Customers Chosen)
                        </button>
                    </div>

                    {/* INNER FILTERS MODAL FOR PICKER ARCHITECTURE VIEWPORT */}
                    {showCustFilterModal && (
                        <div className="fixed inset-0 z-50 flex items-end justify-center p-0">
                            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowCustFilterModal(false)} />
                            <div className="relative bg-slate-900 w-full max-w-md rounded-t-3xl p-6 space-y-6 animate-in slide-in-from-bottom-10 duration-200">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                    <h3 className="font-bold text-base flex items-center gap-2"><Filter className="w-4 h-4 text-blue-500" /> Filters</h3>
                                    <button onClick={() => setShowCustFilterModal(false)} className="text-slate-500"><X className="w-5 h-5" /></button>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Status</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['PAID', 'UNPAID', 'OVERDUE'].map(val => {
                                            const isSel = custFilterDraft.includes(val);
                                            return (
                                                <button
                                                    key={val}
                                                    onClick={() => setCustFilterDraft(prev => isSel ? prev.filter(i => i !== val) : [...prev, val])}
                                                    className={`py-2 text-center text-xs font-bold rounded-lg ${isSel ? 'bg-blue-500 text-white' : 'bg-slate-950 text-slate-400'}`}
                                                >
                                                    {val}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setCustomerQuery(prev => ({ ...prev, page: 0, filters: { paymentStatus: custFilterDraft } })); setShowCustFilterModal(false); }}
                                    className="w-full bg-white text-black font-bold py-3.5 rounded-xl text-sm"
                                >
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MessageTemplates;