import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    MessageSquare, Plus, X, Pencil, Trash2, ChevronLeft, 
    RefreshCw, LayoutDashboard, FileText, CheckCircle2, AlertCircle,
    CheckSquare, Square, Users, ArrowUpDown, Filter, Search, Phone, MessageCircle
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
    const location = useLocation();

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
    // 3. WHATSAPP SEND FLOW STATES
    // ==========================================
    const [preSelectedCustomerIds, setPreSelectedCustomerIds] = useState<string[]>([]);
    const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);
    const [alertName, setAlertName] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);
    
    useEffect(() => {
        const state = location.state as { preSelectedCustomerIds?: string[] } | null;
        if (state?.preSelectedCustomerIds) {
            setPreSelectedCustomerIds(state.preSelectedCustomerIds);
        }
    }, [location.state]);

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
                    const suffix = childText.endsWith('\n') ? '' : '\n';
                    return childText + suffix;
                }
                return childText;
            }
            return '';
        };

        let text = extractText(tempDiv);
        text = text.replace(/\u00a0/g, ' '); // Replace NBSP with normal space
        text = text.replace(/\u200B/g, '');  // Remove zero-width spaces used for cursor placement!
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

    const handleContentEditableKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            // Insert a BR element at cursor
            const brNode = document.createElement('br');
            range.insertNode(brNode);
            
            // Insert a zero-width space node right after the BR to enable typing on next line reliably
            const zeroWidthSpace = document.createTextNode('\u200B');
            brNode.after(zeroWidthSpace);
            
            // Move caret directly after the zero-width space
            const newRange = document.createRange();
            newRange.setStartAfter(zeroWidthSpace);
            newRange.collapse(true);
            
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            // Trigger input sync
            handleContentEditableInput();
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


    return (
        <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col font-sans select-none overflow-x-hidden pb-28 relative">
            
            {/* ======================================================= */}
            {/* MAIN HEADER WINDOW PORT (ZONES 1 & 2 CONTROL ARRAYS)     */}
            {/* ======================================================= */}
            <header className="sticky top-0 z-20 bg-[#0f0f0f] px-4 pt-5 pb-4 max-w-md lg:max-w-6xl mx-auto w-full border-b border-zinc-900/50">
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
                            className="text-xs font-bold text-zinc-400 hover:text-white"
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
                    <div className="py-24 text-center flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs font-mono">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" /> SYNCHRONIZING TEMPLATE REGISTRY...
                    </div>
                ) : templates.length === 0 ? (
                    <div className="py-20 text-center text-zinc-655 text-xs space-y-2">
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
                                    className={`w-full bg-transparent p-4 rounded-xl flex items-center justify-between border transition-all active:scale-[0.99] cursor-pointer ${isChecked ? 'border-red-500 bg-zinc-900/60' : 'border-zinc-800/60 hover:bg-zinc-900/40'}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0 pr-2">
                                        {isTemplateSelectionMode && (
                                            <div className="shrink-0">
                                                {isChecked ? <CheckSquare className="w-4 h-4 text-red-500" /> : <Square className="w-4 h-4 text-zinc-600" />}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-bold text-zinc-200 truncate">{tmpl.name}</h4>
                                            <p className="text-xs text-zinc-500 truncate mt-1 font-medium">{renderTemplateWithPills(tmpl.content, false)}</p>
                                        </div>
                                    </div>
                                    <ChevronLeft className="w-4 h-4 text-zinc-600 rotate-180 shrink-0" />
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* BOTTOM NAV BAR INTERACTION ACTION REGISTRY */}
            <div className="fixed bottom-5 left-0 lg:left-64 right-0 z-10 pointer-events-none flex justify-center animate-in fade-in duration-200">
                <div className="w-full px-4 max-w-md pointer-events-auto">
                    {preSelectedCustomerIds.length > 0 ? (
                        <button 
                            onClick={() => navigate('/payping/customers')}
                            className="w-full bg-zinc-900/80 hover:bg-zinc-900 backdrop-blur-md border border-zinc-800 text-zinc-300 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-xl shadow-black"
                        >
                            <X className="w-4 h-4 text-zinc-400" /> Cancel Template Selection
                        </button>
                    ) : (
                        <button 
                            onClick={() => navigate('/payping/dashboard')}
                            className="w-full bg-zinc-900/80 hover:bg-zinc-900 backdrop-blur-md border border-zinc-800 text-zinc-300 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-xl shadow-black"
                        >
                            <LayoutDashboard className="w-4 h-4" /> Return to Dashboard
                        </button>
                    )}
                </div>
            </div>

            {/* ======================================================= */}
            {/* REVERSIBLE/CRITICAL DELETION DUAL-CONFIRM OVERLAY DIALOG */}
            {/* ======================================================= */}
            {showDeleteConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f0f0f]/90 backdrop-blur-sm" onClick={() => setShowDeleteConfirmation(false)} />
                    <div className="relative bg-[#0f0f0f] border border-zinc-800/60 w-full max-w-sm rounded-2xl p-6 space-y-5 text-center animate-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                            <Trash2 className="w-5 h-5" />
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="text-sm font-bold text-zinc-200 first-letter:uppercase">{deleteModalHeader}</h3>
                            <p className="text-xs text-zinc-500">Action is not reversible. Data will be dropped completely.</p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setShowDeleteConfirmation(false)}
                                className="w-1/2 bg-[#0f0f0f] text-zinc-400 font-bold py-3 rounded-xl text-xs border-0 outline-none"
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
                    <div className="absolute inset-0 bg-[#0f0f0f]/80 backdrop-blur-md" onClick={() => { setShowUpsertModal(false); clearFormState(); }} />
                    <div className="relative bg-[#0f0f0f] border border-zinc-800/60 w-full max-w-2xl rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] text-sm overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
                        
                        <div className="p-5 border-b border-zinc-850 flex items-center justify-between bg-[#0f0f0f]/30 shrink-0">
                            <h3 className="font-extrabold text-sm text-zinc-200 tracking-tight">
                                {isEditMode ? "Modify Message Template" : "Add New Message Template"}
                            </h3>
                            <button onClick={() => { setShowUpsertModal(false); clearFormState(); }} className="text-zinc-500 hover:text-zinc-300 border-0 outline-none bg-transparent"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1 space-y-5 pb-8">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Template Label Identity Name</label>
                                <input 
                                    type="text"
                                    placeholder="e.g., Late Fee Penalty Reminder"
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    className="w-full bg-[#050505] text-white text-sm font-semibold p-3.5 rounded-xl outline-none border border-zinc-800 focus:border-indigo-500 transition-colors"
                                />
                            </div>

                            {/* BLOCK 1: DYNAMIC TOKEN INJECTION PILLS */}
                            <div className="space-y-2 bg-[#0f0f0f]/40 p-4 rounded-2xl border border-zinc-850/30">
                                <span className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Inline Tags</span>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {serverTags.map((tag) => {
                                        const textContainsPill = templateContent.includes(`{${tag}}`);
                                        return (
                                            <div 
                                                key={tag} 
                                                className={`inline-flex items-center text-[10px] font-mono font-bold tracking-wide rounded-lg overflow-hidden transition-all duration-150 ${textContainsPill ? 'bg-indigo-600/10 text-indigo-400' : 'bg-[#0f0f0f] text-zinc-400'}`}
                                            >
                                                <button type="button" onClick={() => injectTagPillShortcut(tag)} className="px-2.5 py-1.5 font-bold border-0 bg-transparent text-inherit outline-none">
                                                    {tag}
                                                </button>
                                                {textContainsPill && (
                                                    <button type="button" onClick={() => ejectTagPillFromText(tag)} className="px-1.5 py-1.5 border-l border-indigo-500/10 hover:bg-red-500/20 hover:text-red-400 transition-colors bg-transparent outline-none">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] leading-relaxed text-zinc-500 font-medium pt-1.5 border-t border-zinc-950/60">
                                    Tap dynamic parameter badges to safely append vectors straight into text cursor ranges. You can safely clear links using individual cancel crosses.
                                </p>
                            </div>

                              {/* BLOCK 2: BLUEPRINT INPUT BOX FRAME */}
                              <div className="space-y-1.5">
                                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Message Template Editor</label>
                                  <div 
                                      ref={contentEditableRef}
                                      contentEditable
                                      onInput={handleContentEditableInput}
                                      onKeyDown={handleContentEditableKeyDown}
                                      onClick={handleContentEditableClick}
                                      data-placeholder="Type data string contents here..."
                                      className="w-full h-32 bg-[#050505] text-white text-sm font-medium p-3.5 rounded-xl outline-none border border-zinc-800 focus:border-indigo-500 overflow-y-auto leading-relaxed whitespace-pre-wrap break-words select-text focus:outline-none empty:before:content-[attr(placeholder)] empty:before:text-zinc-500 empty:before:font-medium empty:before:pointer-events-none transition-colors"
                                      style={{
                                          boxSizing: 'border-box'
                                      }}
                                  />
                              </div>

 
                             {/* BLOCK 3: RENDERING LOG OVERVIEW PREVIEW BOX */}
                             {isPreviewed && (
                                 <div className="space-y-2 animate-in fade-in slide-in-from-top-3 duration-200">
                                     <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                         <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Message Preview
                                     </label>
                                     <div className={`w-full p-4 rounded-xl font-medium text-xs leading-relaxed whitespace-pre-wrap transition-all duration-150 border border-zinc-800 ${loadingPreview ? 'bg-[#050505]/40 text-zinc-600 select-none animate-pulse' : isContentDull ? 'bg-[#050505]/70 text-zinc-500 line-clamp-none' : 'bg-[#050505] text-zinc-300'}`}>
                                         {loadingPreview ? (
                                             <span className="flex items-center gap-1.5 font-mono text-[10px]">
                                                 <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" /> Connecting rendering pipeline over remote structures...
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

                        <div className="p-5 border-t border-zinc-850 bg-[#0f0f0f]/60 shrink-0">
                            {(!isPreviewed || isContentDull) ? (
                                <button 
                                    type="button"
                                    onClick={requestServerPreview}
                                    disabled={!templateName.trim() || !templateContent.trim() || loadingPreview}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 text-white font-bold py-3.5 rounded-xl text-xs tracking-wider uppercase border-0 outline-none shadow-lg shadow-indigo-600/10"
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
                    <div className="absolute inset-0 bg-[#0f0f0f]/80 backdrop-blur-md" onClick={() => { setShowDetailModal(false); setSelectedTemplate(null); }} />
                    <div className="relative bg-[#0f0f0f] border border-zinc-800/60 w-full max-w-2xl rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl flex flex-col max-h-[88vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 overflow-hidden">
                        
                        <div className="p-5 border-b border-zinc-850 flex items-center justify-between bg-[#0f0f0f]/30">
                            <div className="min-w-0 pr-4">
                                <h3 className="font-black text-base text-zinc-100 truncate tracking-tight">{selectedTemplate.name}</h3>
                            </div>
                            
                            <div className="flex items-center gap-5 shrink-0 text-zinc-400">
                                <button onClick={triggerEditWorkflow} className="p-0 bg-transparent border-0 text-indigo-400 hover:text-indigo-300 outline-none"><Pencil className="w-4 h-4" /></button>
                                <button onClick={() => initSingleDeleteWorkflow(selectedTemplate)} className="p-0 bg-transparent border-0 text-red-400 hover:text-red-300 outline-none"><Trash2 className="w-4 h-4" /></button>
                                <button onClick={() => { setShowDetailModal(false); setSelectedTemplate(null); }} className="p-0 bg-transparent border-0 text-zinc-500 hover:text-zinc-300 outline-none"><X className="w-5 h-5" /></button>
                            </div>
                        </div>

                         <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
                            <div className="space-y-1.5">
                                <span className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Message Template</span>
                                <div className="w-full bg-[#0f0f0f] p-4 rounded-xl text-zinc-400 font-medium leading-relaxed whitespace-pre-wrap">
                                    {renderTemplateWithPills(selectedTemplate.content, false)}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <span className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Message Preview</span>
                                <div className={`w-full p-4 rounded-xl leading-relaxed font-mono text-[11px] whitespace-pre-wrap transition-all duration-150 ${loadingDetailPreview ? 'bg-[#0f0f0f]/40 text-zinc-600 select-none animate-pulse' : 'bg-[#0f0f0f]/50 text-zinc-300'}`}>
                                    {loadingDetailPreview ? (
                                        <span className="flex items-center gap-1.5 font-mono text-[10px]">
                                            <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" /> Connecting rendering pipeline over remote structures...
                                        </span>
                                    ) : detailPreviewText || "Empty response."}
                                </div>
                            </div>
                        </div>

                        {/* INTERACTION DISPATCH SELECTION ACTIONS FOOTER CORE COMPONENT */}
                        <div className="p-5 border-t border-zinc-850 bg-[#0f0f0f]/50">
                            {preSelectedCustomerIds.length === 0 ? (
                                <button
                                    onClick={() => navigate('/payping/customers', { state: { preSelectedTemplate: selectedTemplate } })}
                                    className="w-full bg-[#128C7E] hover:bg-[#0e7569] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs border-0 outline-none shadow-lg shadow-[#128C7E]/10"
                                >
                                    <Users className="w-4 h-4" /> Select Message Recipients
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        setShowConfirmationModal(true);
                                    }}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs border-0 outline-none shadow-lg shadow-emerald-600/10"
                                >
                                    <MessageSquare className="w-4 h-4" /> Send Message to {preSelectedCustomerIds.length} Customers
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* FINAL CONFIRMATION MODAL */}
            {showConfirmationModal && selectedTemplate && (
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
                                    <p className="text-sm text-zinc-200 font-medium truncate">{selectedTemplate.name}</p>
                                </div>
                                <button 
                                    onClick={() => setShowConfirmationModal(false)}
                                    className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 font-bold px-3 py-1.5 bg-indigo-500/10 rounded-lg transition-colors"
                                >
                                    Modify
                                </button>
                            </div>

                            {/* Selected Customers Info */}
                            <div className="bg-[#050505] border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                                <div className="min-w-0 pr-4">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Customers</p>
                                    <p className="text-sm text-zinc-200 font-medium">{preSelectedCustomerIds.length} recipient(s) selected</p>
                                </div>
                                <button 
                                    onClick={() => navigate('/payping/customers', { state: { preSelectedTemplate: selectedTemplate } })}
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
                                            templateId: selectedTemplate.id,
                                            customerIds: preSelectedCustomerIds
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
        </div>
    );
};

export default MessageTemplates;