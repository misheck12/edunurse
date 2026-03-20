import React, { useEffect, useState } from 'react';
import { ArrowLeft, Share2, Upload, Sparkles, Search, PlusCircle, CheckCircle, X, FileDown, FileText, BrainCircuit, AlertTriangle, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDocument } from '../src/context/DocumentContext';
import { RichTextBlock, ListBlock, ScriptBlock, RubricBlock, TableBlock } from '../src/components/editor/blocks';
import ExportModal from '../src/components/editor/ExportModal';
import SEO from '../src/components/SEO';

const Editor: React.FC = () => {
    const navigate = useNavigate();
    const { documentId: routeDocumentId } = useParams<{ documentId?: string }>();
    const {
        currentDocument,
        updateSection,
        isLoading,
        loadDocumentById,
        regenerateSection,
        saveCurrentDocument,
        lastGenerationRun,
        isSaving,
        lastSavedAt,
        error,
        clearError,
    } = useDocument();
    const [showExportModal, setShowExportModal] = useState(false);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null);

    const [routeLoadError, setRouteLoadError] = useState<string | null>(null);
    const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);
    const [regenerateModal, setRegenerateModal] = useState<{ sectionId: string; sectionTitle: string } | null>(null);
    const [regenerateInstructions, setRegenerateInstructions] = useState('');

    useEffect(() => {
        if (!routeDocumentId) return;
        if (currentDocument?.metadata.id === routeDocumentId) return;

        let active = true;
        setRouteLoadError(null);

        const load = async () => {
            try {
                await loadDocumentById(routeDocumentId);
            } catch (err) {
                if (!active) return;
                setRouteLoadError(err instanceof Error ? err.message : 'Failed to load document from URL.');
            }
        };

        void load();
        return () => {
            active = false;
        };
    }, [routeDocumentId, currentDocument?.metadata.id]);

    useEffect(() => {
        if (!currentDocument) return;
        if (currentDocument.sections.length === 0) return;
        if (!activeSectionId || !currentDocument.sections.some((section) => section.id === activeSectionId)) {
            setActiveSectionId(currentDocument.sections[0].id);
        }
    }, [currentDocument, activeSectionId]);





    const handleRegenerateSection = (sectionId: string, sectionTitle: string) => {
        setRegenerateInstructions('');
        setRegenerateModal({ sectionId, sectionTitle });
    };

    const handleConfirmRegenerate = async () => {
        if (!regenerateModal) return;
        const { sectionId } = regenerateModal;
        setRegeneratingSectionId(sectionId);
        setRegenerateModal(null);
        clearError();

        try {
            await regenerateSection(sectionId, regenerateInstructions.trim() || undefined);
            setActiveSectionId(sectionId);
        } catch {
            // Error surfaced by context.
        } finally {
            setRegeneratingSectionId(null);
            setRegenerateInstructions('');
        }
    };

    const handleSaveDocument = async () => {
        setSaveStatusMessage(null);
        clearError();

        try {
            await saveCurrentDocument();
            setSaveStatusMessage('Lesson plan saved to workspace.');
        } catch {
            setSaveStatusMessage('Unable to save lesson plan.');
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="mb-4 inline-block animate-spin rounded-full border-4 border-blue-600 border-t-transparent h-12 w-12" />
                    <p className="text-slate-500 font-medium">Generating Document Structure...</p>
                </div>
            </div>
        );
    }

    if (!currentDocument) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">No Active Document</h2>
                    <p className="text-slate-500 mb-6">
                        {routeLoadError ?? 'Please start from the wizard to generate a new document.'}
                    </p>
                    <button onClick={() => navigate('/create')} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700">
                        Go to Wizard
                    </button>
                </div>
            </div>
        );
    }

    const activeSection = currentDocument.sections.find(
        (section) => section.id === activeSectionId,
    );
    const activeSectionCitations = Array.isArray((activeSection as any)?.citations)
        ? ((activeSection as any).citations as Array<{
            sourceId: string;
            sourceName?: string;
            page?: number | null;
            chunkId: string;
            quoteSnippet: string;
        }>)
        : [];

    const renderSectionContent = (section: any) => {
        switch (section.type) {
            case 'text':
                return <RichTextBlock content={section.content} onChange={(val) => updateSection(section.id, val)} />;
            case 'list':
                return <ListBlock content={section.content} onChange={(val) => updateSection(section.id, val)} />;
            case 'script':
                return <ScriptBlock content={section.content} onChange={(val) => updateSection(section.id, val)} />;
            case 'rubric':
                return <RubricBlock content={section.content} onChange={(val) => updateSection(section.id, val)} />;
            case 'table':
                return <TableBlock 
                    content={section.content} 
                    onChange={(val) => updateSection(section.id, val)}
                    documentContext={{
                        topic: currentDocument.metadata.curriculumContext.topic,
                        programme: currentDocument.metadata.curriculumContext.programme,
                        course: currentDocument.metadata.curriculumContext.course ?? undefined,
                    }}
                />;
            case 'duration_list':
                // Reuse list block for now, or create a specific one later
                return (
                    <div className="space-y-2">
                        {(section.content as any[]).map((item: any, i: number) => (
                            <div key={i} className="flex gap-2 p-2 bg-slate-50 rounded border border-slate-200">
                                <span className="font-bold text-blue-600 w-16 shrink-0">{item.time}</span>
                                <div className="flex-1">
                                    <p className="font-medium text-slate-900">{item.activity}</p>
                                    <p className="text-xs text-slate-500">Method: {item.method} | Resources: {item.resources}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            default:
                return <div className="p-4 bg-red-50 text-red-500 text-xs">Unknown Section Type: {section.type}</div>;
        }
    };

    const institutionalSectionIds = [
        'lesson_metadata',
        'introduction',
        'general_objective',
        'specific_objectives',
        'lesson_presentation',
        'summary',
        'evaluation',
        'assignment',
        'references',
    ];

    const isInstitutionalLessonPlan =
        (currentDocument.metadata.type || '').toLowerCase().includes('lesson') &&
        institutionalSectionIds.every((id) =>
            currentDocument.sections.some((section) => section.id === id),
        );

    const orderedInstitutionalSections = institutionalSectionIds
        .map((id) => currentDocument.sections.find((section) => section.id === id))
        .filter(Boolean) as Array<any>;

    const lessonMetadataSection = currentDocument.sections.find(
        (section) => section.id === 'lesson_metadata',
    ) as any | undefined;

    const metadataFieldOrder = [
        'NAME OF STUDENT',
        'STUDENT NUMBER',
        'COURSE NAME',
        'PROGRAMME',
        'NAME OF TOPIC',
        'VENUE',
        'INTAKE',
        'SIZE OF CLASS',
        'DATE',
        'TIME',
        'DURATION',
        'METHOD OF TEACHING',
        'MEDIA OF TEACHING',
        'NAME OF SUPERVISOR',
    ];

    const lessonMetadataMap = (() => {
        const map = new Map<string, string>();
        const rows = Array.isArray(lessonMetadataSection?.content)
            ? lessonMetadataSection.content
            : [];
        rows.forEach((row: unknown) => {
            if (!row || typeof row !== 'object' || Array.isArray(row)) return;
            const record = row as Record<string, unknown>;
            const field = typeof record.field === 'string' ? record.field.trim() : '';
            if (!field) return;
            const value =
                typeof record.value === 'string'
                    ? record.value
                    : String(record.value ?? '');
            map.set(field, value);
        });
        return map;
    })();

    const updateLessonMetadataField = (field: string, value: string) => {
        if (!lessonMetadataSection) return;
        const nextRows = metadataFieldOrder.map((key) => ({
            field: key,
            value: key === field ? value : lessonMetadataMap.get(key) ?? '',
        }));
        void updateSection(lessonMetadataSection.id, nextRows);
    };

    const renderSimpleTextArea = (section: any, rows = 5) => (
        <textarea
            className="w-full resize-y border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={typeof section.content === 'string' ? section.content : String(section.content ?? '')}
            onChange={(event) => void updateSection(section.id, event.target.value)}
            rows={rows}
        />
    );

    const renderSimpleList = (section: any) => {
        const items = Array.isArray(section.content)
            ? section.content.map((item: unknown) => String(item ?? ''))
            : [];

        const updateListItem = (index: number, value: string) => {
            const next = [...items];
            next[index] = value;
            void updateSection(section.id, next);
        };

        const addListItem = () => {
            void updateSection(section.id, [...items, '']);
        };

        const removeListItem = (index: number) => {
            void updateSection(
                section.id,
                items.filter((_: string, idx: number) => idx !== index),
            );
        };

        return (
            <div className="space-y-2">
                {items.map((item: string, index: number) => (
                    <div key={`${section.id}-${index}`} className="flex items-start gap-2">
                        <span className="pt-2 text-xs font-semibold text-slate-500">{index + 1}.</span>
                        <textarea
                            className="w-full resize-y border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            value={item}
                            onChange={(event) => updateListItem(index, event.target.value)}
                            rows={2}
                        />
                        <button
                            type="button"
                            onClick={() => removeListItem(index)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                            Remove
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={addListItem}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                    Add Item
                </button>
            </div>
        );
    };

    const renderInstitutionalPresentationTable = (section: any) => {
        const rows = Array.isArray(section.content)
            ? (section.content as Array<Record<string, unknown>>)
            : [];
        const columns: Array<{ key: string; label: string }> = [
            { key: 'time', label: 'TIME' },
            { key: 'specificObjective', label: 'SPECIFIC OBJECTIVE' },
            { key: 'content', label: 'CONTENT' },
            { key: 'materials', label: 'AUDIO VISUAL AID' },
            { key: 'educatorActivities', label: "TEACHER'S ACTIVITY" },
            { key: 'learnerActivities', label: "LEANER'S ACTIVITY" },
            { key: 'assessment', label: 'EVALUATION' },
        ];

        const updateTableCell = (rowIndex: number, key: string, value: string) => {
            const nextRows = rows.map((row, index) =>
                index === rowIndex ? { ...row, [key]: value } : row,
            );
            void updateSection(section.id, nextRows);
        };

        const addTableRow = () => {
            const nextRows = [
                ...rows,
                {
                    phase: '',
                    time: '',
                    specificObjective: '',
                    content: '',
                    materials: '',
                    educatorActivities: '',
                    learnerActivities: '',
                    assessment: '',
                },
            ];
            void updateSection(section.id, nextRows);
        };

        return (
            <div className="overflow-x-auto border border-slate-300">
                <table className="w-full min-w-[1100px] border-collapse text-xs">
                    <thead>
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className="border border-slate-300 bg-slate-100 px-2 py-2 text-left font-bold text-slate-700"
                                >
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr key={`${section.id}-row-${rowIndex}`}>
                                {columns.map((column) => (
                                    <td key={`${section.id}-${rowIndex}-${column.key}`} className="border border-slate-300 align-top">
                                        <textarea
                                            className="w-full min-h-[90px] resize-y border-0 px-2 py-2 text-xs leading-relaxed outline-none focus:bg-blue-50"
                                            value={String(row?.[column.key] ?? '')}
                                            onChange={(event) =>
                                                updateTableCell(rowIndex, column.key, event.target.value)
                                            }
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="border-t border-slate-300 bg-white p-2">
                    <button
                        type="button"
                        onClick={addTableRow}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Add Row
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#f6f7f8]">
            <SEO
              title={currentDocument.metadata.title || "Document Editor"}
              description="Edit and refine your AI-generated nursing education document."
              noIndex
            />
            {/* Top Bar */}
            <header className="z-20 shrink-0 border-b border-slate-200 bg-white px-3 py-2 sm:px-6 sm:py-0">
                <div className="flex min-h-16 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3 sm:w-1/3 sm:gap-4">
                    <button onClick={() => navigate('/create')} className="text-slate-400 hover:text-blue-600 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col">
                        <input
                            className="w-full truncate rounded bg-transparent px-1 text-base font-semibold text-slate-900 outline-none transition-colors hover:bg-slate-50 focus:ring-0 sm:-ml-1 sm:text-lg"
                            type="text"
                            value={currentDocument.metadata.title}
                            readOnly
                        />
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                            <CheckCircle size={12} />
                            {isSaving
                                ? 'Saving...'
                                : lastSavedAt
                                    ? `Saved ${new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(lastSavedAt)}`
                                    : 'Not saved yet'}
                        </span>
                    </div>
                </div>

                <div className="hidden items-center justify-center gap-6 sm:w-1/3 lg:flex">
                    <div className="hidden items-center gap-4 text-sm text-slate-500 xl:flex">
                        <span className="flex items-center gap-1">{currentDocument.metadata.curriculumContext.programme}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className="flex items-center gap-1">{currentDocument.metadata.curriculumContext.year}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className="flex items-center gap-1 font-medium text-blue-600">NMCZ Standard</span>
                    </div>
                </div>

                <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-1/3 sm:justify-end sm:gap-3">
                    <button
                        onClick={() => void handleSaveDocument()}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60"
                    >
                        <Save size={16} /> {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <Share2 size={16} /> <span className="hidden xs:inline">Share</span>
                    </button>
                    <button
                        onClick={async () => {
                            // Auto-save before export so the backend exports the latest content
                            try { await saveCurrentDocument(); } catch { /* proceed anyway */ }
                            setShowExportModal(true);
                        }}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 disabled:opacity-60"
                    >
                        <Upload size={16} /> Export
                    </button>
                </div>
                </div>
            </header>

            {/* Editor Body */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Left Sidebar: Schema Structure */}
                <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 hidden md:flex">
                    <div className="p-4 border-b border-slate-100">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Document Structure</h3>
                        <div className="relative">
                            <Search className="absolute left-2 top-1.5 text-slate-400" size={14} />
                            <input className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="Filter sections..." />
                        </div>
                    </div>
                    <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                        {currentDocument.sections.map((section, idx) => (
                            <button
                                key={section.id}
                                onClick={() => {
                                    setActiveSectionId(section.id);
                                    document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg group transition-colors text-left ${activeSectionId === section.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <span className={`text-xs font-mono ${activeSectionId === section.id ? 'text-blue-500' : 'text-slate-400'}`}>0{idx + 1}</span>
                                <span className="truncate">{section.title}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="p-4 mt-auto border-t border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            Curriculum Sync Active
                        </div>
                    </div>
                </aside>

                {/* Center Canvas: Structured Blocks */}
                <main className="relative flex flex-1 justify-center overflow-y-auto bg-[#eef4fb] p-2 sm:p-4 md:p-8">
                    <div className="relative group w-full max-w-[850px] min-h-[1000px] rounded-lg bg-white p-4 shadow-sm sm:p-6 md:p-12">
                        {error && (
                            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}
                        {saveStatusMessage && !error && (
                            <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                {saveStatusMessage}
                            </div>
                        )}

                        {!isInstitutionalLessonPlan && (
                            <>
                                {currentDocument.sections.map((section) => (
                                    <div
                                        key={section.id}
                                        id={`section-${section.id}`}
                                        className={`relative group/block mb-6 rounded-lg border p-4 transition-colors sm:p-6 ${activeSectionId === section.id ? 'border-blue-300 ring-4 ring-blue-500/10' : 'border-slate-100 hover:border-slate-200'}`}
                                        onClick={() => setActiveSectionId(section.id)}
                                    >
                                        <div className="absolute right-4 top-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover/block:opacity-100">
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void handleRegenerateSection(section.id, section.title);
                                                }}
                                                disabled={Boolean(regeneratingSectionId) || isLoading}
                                                className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-60"
                                            >
                                                <Sparkles size={12} />
                                                {regeneratingSectionId === section.id ? 'Regenerating...' : 'Regenerate'}
                                            </button>
                                        </div>
                                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            {section.type === 'script' && <Sparkles size={14} className="text-blue-500" />}
                                            {section.title}
                                        </h2>

                                        {renderSectionContent(section)}
                                    </div>
                                ))}

                                {/* Add Block Placeholder */}
                                <div className="pt-4 flex justify-center">
                                    <button className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors px-4 py-2 rounded-full hover:bg-white border border-transparent hover:border-slate-200">
                                        <PlusCircle size={18} /> Add Section
                                    </button>
                                </div>
                            </>
                        )}

                        {isInstitutionalLessonPlan && (
                            <div className="space-y-8">
                                <div className="text-center">
                                    <h1 className="text-xl font-bold tracking-wide text-slate-900 sm:text-2xl">LUSAKA OPEN BUSINESS COLLEGE</h1>
                                    <h2 className="mt-1 text-lg font-bold uppercase underline sm:text-xl">CLASSROOM LESSON PLAN</h2>
                                </div>

                                {lessonMetadataSection && (
                                    <section id={`section-${lessonMetadataSection.id}`} onClick={() => setActiveSectionId(lessonMetadataSection.id)}>
                                        <div className="overflow-x-auto border border-slate-300">
                                            <table className="w-full min-w-[760px] border-collapse text-xs sm:text-sm">
                                                <tbody>
                                                    {Array.from({ length: Math.ceil(metadataFieldOrder.length / 2) }).map((_, rowIndex) => {
                                                        const leftField = metadataFieldOrder[rowIndex * 2];
                                                        const rightField = metadataFieldOrder[rowIndex * 2 + 1];
                                                        return (
                                                            <tr key={`meta-row-${rowIndex}`}>
                                                                <td className="w-[22%] border border-slate-300 bg-slate-100 px-2 py-2 font-semibold">{leftField}:</td>
                                                                <td className="w-[28%] border border-slate-300 px-2 py-1">
                                                                    <input
                                                                        className="w-full border-0 bg-transparent text-sm outline-none"
                                                                        value={lessonMetadataMap.get(leftField) ?? ''}
                                                                        onChange={(event) => updateLessonMetadataField(leftField, event.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="w-[22%] border border-slate-300 bg-slate-100 px-2 py-2 font-semibold">
                                                                    {rightField ? `${rightField}:` : ''}
                                                                </td>
                                                                <td className="w-[28%] border border-slate-300 px-2 py-1">
                                                                    {rightField ? (
                                                                        <input
                                                                            className="w-full border-0 bg-transparent text-sm outline-none"
                                                                            value={lessonMetadataMap.get(rightField) ?? ''}
                                                                            onChange={(event) => updateLessonMetadataField(rightField, event.target.value)}
                                                                        />
                                                                    ) : null}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                )}

                                {orderedInstitutionalSections
                                    .filter((section) => section.id !== 'lesson_metadata')
                                    .map((section) => (
                                        <section key={section.id} id={`section-${section.id}`} onClick={() => setActiveSectionId(section.id)}>
                                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                <h3 className="text-base font-bold uppercase text-slate-900 sm:text-lg">{section.title}</h3>
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void handleRegenerateSection(section.id, section.title);
                                                    }}
                                                    disabled={Boolean(regeneratingSectionId) || isLoading}
                                                    className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-60"
                                                >
                                                    <Sparkles size={12} />
                                                    {regeneratingSectionId === section.id ? 'Regenerating...' : 'Regenerate'}
                                                </button>
                                            </div>

                                            {section.id === 'lesson_presentation' && renderInstitutionalPresentationTable(section)}
                                            {section.type === 'text' && section.id !== 'lesson_presentation' && renderSimpleTextArea(section, 6)}
                                            {section.type === 'list' && section.id !== 'lesson_presentation' && renderSimpleList(section)}
                                            {!['text', 'list'].includes(section.type) && section.id !== 'lesson_presentation' && renderSectionContent(section)}
                                        </section>
                                    ))}
                            </div>
                        )}
                    </div>
                </main>

                {/* Right Sidebar: Intelligence */}
                <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 z-10 shadow-xl lg:shadow-none hidden xl:flex">
                    <div className="p-4 border-b border-slate-100 flex items-center gap-2 text-slate-800 font-semibold bg-slate-50/50">
                        <BrainCircuit size={18} className="text-purple-600" />
                        <span>Curriculum Intelligence</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        <div>
                            <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Run Details</div>
                            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500">Status</span>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${lastGenerationRun?.status === 'succeeded'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : lastGenerationRun?.status === 'failed' || lastGenerationRun?.status === 'blocked'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-amber-100 text-amber-700'
                                        }`}>
                                        {lastGenerationRun?.status ?? 'n/a'}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-600">
                                    Provider: <span className="font-medium text-slate-800">{lastGenerationRun?.modelProvider ?? 'n/a'}</span>
                                </div>
                                <div className="text-xs text-slate-600">
                                    Model: <span className="font-medium text-slate-800">{lastGenerationRun?.modelName ?? 'n/a'}</span>
                                </div>
                                <div className="text-xs text-slate-600">
                                    Retrieval chunks: <span className="font-medium text-slate-800">{lastGenerationRun?.retrievals?.length ?? 0}</span>
                                </div>
                                {lastGenerationRun?.id && (
                                    <div className="text-[11px] text-slate-500 break-all">
                                        Run ID: {lastGenerationRun.id}
                                    </div>
                                )}
                            </div>
                        </div>

                        {lastGenerationRun?.flags && lastGenerationRun.flags.length > 0 && (
                            <div>
                                <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Guardrails</div>
                                <div className="space-y-2">
                                    {lastGenerationRun.flags.map((flag) => (
                                        <div
                                            key={flag.id}
                                            className={`rounded-lg border px-3 py-2 text-xs ${flag.severity === 'blocking'
                                                ? 'border-red-200 bg-red-50 text-red-700'
                                                : flag.severity === 'warning'
                                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                    : 'border-blue-200 bg-blue-50 text-blue-700'
                                                }`}
                                        >
                                            <div className="font-semibold flex items-center gap-1">
                                                <AlertTriangle size={12} />
                                                {flag.flagType}
                                            </div>
                                            <div className="mt-1">
                                                Severity: {flag.severity}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
                                Section Citations
                            </div>
                            {!activeSection && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                    Select a section to inspect citations.
                                </div>
                            )}
                            {activeSection && activeSectionCitations.length === 0 && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                    No citations attached to this section yet.
                                </div>
                            )}
                            {activeSectionCitations.length > 0 && (
                                <div className="space-y-2">
                                    {activeSectionCitations.map((citation, index) => (
                                        <div
                                            key={`${citation.chunkId}-${index}`}
                                            className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                    {citation.sourceName ?? 'Curriculum Source'}
                                                </span>
                                                <span className="text-[10px] text-slate-500">
                                                    {citation.page ? `Page ${citation.page}` : 'Page n/a'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                "{citation.quoteSnippet}"
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1 break-all">
                                                chunk: {citation.chunkId}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div>

            {/* Export Modal */}
            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                documentId={currentDocument.metadata.id}
                documentTitle={currentDocument.metadata.title}
            />

            {/* Regenerate Section Modal */}
            {regenerateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-base font-bold text-slate-900 mb-1">Regenerate Section</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Optional guidance for{' '}
                            <span className="font-medium text-slate-700">"{regenerateModal.sectionTitle}"</span>.
                            Leave blank to use default regeneration.
                        </p>
                        <textarea
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows={3}
                            placeholder="e.g. Focus more on clinical assessment steps..."
                            value={regenerateInstructions}
                            onChange={(e) => setRegenerateInstructions(e.target.value)}
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => { setRegenerateModal(null); setRegenerateInstructions(''); }}
                                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => void handleConfirmRegenerate()}
                                disabled={Boolean(regeneratingSectionId)}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
                            >
                                <Sparkles size={14} />
                                {regeneratingSectionId ? 'Regenerating...' : 'Regenerate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Editor;
