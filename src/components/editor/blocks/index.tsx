import React, { useState } from 'react';
import { Sparkles, Trash2, Mic, Loader2 } from 'lucide-react';
import { getAuthToken, getCurrentDevUserId } from '../../../services/backendApi';

// --- Types ---
interface BlockProps {
    content: any;
    onChange: (newContent: any) => void;
    readOnly?: boolean;
    documentContext?: {
        topic?: string;
        programme?: string;
        course?: string;
    };
}

// 1. Rich Text Block (Simplified as Textarea for now)
export const RichTextBlock: React.FC<BlockProps> = ({ content, onChange, readOnly }) => {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Content</span>
                {!readOnly && (
                    <button className="text-xs flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">
                        <Sparkles size={12} /> AI Refine
                    </button>
                )}
            </div>
            <textarea
                className="w-full min-h-[120px] p-3 border border-slate-200 rounded-lg text-slate-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none leading-relaxed resize-y"
                value={content as string}
                onChange={(e) => onChange(e.target.value)}
                readOnly={readOnly}
            />
        </div>
    );
};

// 2. List Block
export const ListBlock: React.FC<BlockProps> = ({ content, onChange, readOnly }) => {
    const items = content as string[];

    const updateItem = (idx: number, val: string) => {
        const newItems = [...items];
        newItems[idx] = val;
        onChange(newItems);
    };

    const addItem = () => onChange([...items, ""]);
    const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));

    return (
        <div className="space-y-2">
            <ul className="space-y-2">
                {items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 group">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                        <input
                            className="flex-1 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 outline-none text-slate-700 text-sm py-1 transition-colors"
                            value={item}
                            onChange={(e) => updateItem(idx, e.target.value)}
                            readOnly={readOnly}
                            placeholder="List item..."
                        />
                        {!readOnly && (
                            <button onClick={() => removeItem(idx)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1">
                                <Trash2 size={14} />
                            </button>
                        )}
                    </li>
                ))}
            </ul>
            {!readOnly && (
                <button onClick={addItem} className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-2 px-2 py-1 rounded hover:bg-blue-50">
                    + Add Item
                </button>
            )}
        </div>
    );
};

// 3. Script Block
export const ScriptBlock: React.FC<BlockProps> = ({ content, onChange, readOnly }) => {
    const lines = content as { speaker: string, text: string, note?: string }[];

    const updateLine = (idx: number, field: string, val: string) => {
        const newLines = [...lines];
        newLines[idx] = { ...newLines[idx], [field]: val };
        onChange(newLines);
    };

    return (
        <div className="space-y-4">
            {lines.map((line, idx) => (
                <div key={idx} className="flex gap-3 items-start group">
                    <div className="w-24 shrink-0">
                        <input
                            className="w-full text-xs font-bold text-slate-500 text-right bg-transparent border-none focus:ring-0 p-0 outline-none"
                            value={line.speaker}
                            onChange={(e) => updateLine(idx, 'speaker', e.target.value)}
                        />
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-lg p-3 relative group-focus-within:bg-white group-focus-within:ring-1 group-focus-within:ring-blue-200 transition-all border border-transparent group-focus-within:border-blue-100">
                        <div className="flex justify-between">
                            <input
                                className="w-full bg-transparent border-none p-0 text-sm text-slate-800 focus:ring-0 outline-none font-medium"
                                value={line.text}
                                onChange={(e) => updateLine(idx, 'text', e.target.value)}
                            />
                        </div>
                        {line.note && (
                            <p className="text-xs text-slate-400 mt-1 italic flex items-center gap-1">
                                (Action: <input
                                    className="bg-transparent border-none p-0 text-xs italic text-slate-400 focus:text-blue-600 focus:ring-0 outline-none"
                                    value={line.note}
                                    onChange={(e) => updateLine(idx, 'note', e.target.value)}
                                />)
                            </p>
                        )}
                    </div>
                </div>
            ))}
            {!readOnly && (
                <button onClick={() => onChange([...lines, { speaker: 'New', text: '' }])} className="ml-24 text-xs font-medium text-blue-600 hover:text-blue-700 mt-2">
                    + Add Dialogue
                </button>
            )}
        </div>
    );
};

// 4. Rubric Block
export const RubricBlock: React.FC<BlockProps> = ({ content, onChange, readOnly }) => {
    const items = content as { item: string, marks: number, critical: boolean }[];

    return (
        <div className="overflow-hidden border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-500 text-xs uppercase">Action / Criteria</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500 text-xs uppercase w-16">Marks</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500 text-xs uppercase w-20">Critical?</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((row, idx) => (
                        <tr key={idx}>
                            <td className="px-3 py-2">
                                <input
                                    className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 outline-none text-slate-700"
                                    value={row.item}
                                    readOnly={readOnly}
                                />
                            </td>
                            <td className="px-3 py-2">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold text-slate-600">{row.marks}</span>
                            </td>
                            <td className="px-3 py-2">
                                {row.critical ? (
                                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">CRITICAL</span>
                                ) : (
                                    <span className="text-[10px] text-slate-400">No</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// 5. Generic Table Block with AI Content Expansion
export const TableBlock: React.FC<BlockProps> = ({ content, onChange, readOnly, documentContext }) => {
    const [expandingCell, setExpandingCell] = useState<string | null>(null);
    const [expandError, setExpandError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false); // New state for table expansion
    const [isExpandingAll, setIsExpandingAll] = useState(false);
    const [expandAllProgress, setExpandAllProgress] = useState<{
        total: number;
        completed: number;
        failed: number;
    } | null>(null);
    const [expansionMetaByCell, setExpansionMetaByCell] = useState<Record<string, {
        provider?: string;
        model?: string;
        chunksUsed?: number;
        cacheHit?: boolean;
        confidence?: number;
        coverage?: number;
    }>>({});

    const rows = Array.isArray(content)
        ? content.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) as Array<Record<string, unknown>>
        : [];

    const columns = Array.from(
        rows.reduce((set, row) => {
            Object.keys(row).forEach((key) => set.add(key));
            return set;
        }, new Set<string>()),
    );
    const contentColumn = columns.find((column) => column.toLowerCase() === 'content');

    if (columns.length === 0) {
        return (
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-500">
                No table rows available.
            </div>
        );
    }

    const updateCell = (rowIndex: number, column: string, value: string) => {
        if (readOnly) return;
        const nextRows = rows.map((row, idx) =>
            idx === rowIndex ? { ...row, [column]: value } : row,
        );
        onChange(nextRows);
    };

    const requestExpandedContent = async (row: Record<string, unknown>, column: string) => {
        const token = getAuthToken();
        const apiBaseUrl =
            import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';
        
        const topic = documentContext?.topic ?? String(row['specificObjective'] ?? row['content'] ?? 'Lesson content');
        const specificObjective = String(row['specificObjective'] ?? '');
        const programme = documentContext?.programme ?? 'Diploma in Nursing';
        const course = documentContext?.course ?? 'Nursing Course';

        const response = await fetch(`${apiBaseUrl}/generation/expand-content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token
                    ? { Authorization: `Bearer ${token}` }
                    : { 'x-user-id': getCurrentDevUserId() }),
            },
            body: JSON.stringify({
                topic,
                contentBrief: String(row[column] ?? ''),
                specificObjective,
                programme,
                course,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({} as Record<string, string>));
            throw new Error(
                errorData.message ||
                    errorData.errorMessage ||
                    `Failed to expand content: ${response.statusText || response.status}`,
            );
        }

        return response.json();
    };

    const applyExpansionResult = (rowIndex: number, column: string, result: any) => {
        const cellKey = `${rowIndex}-${column}`;
        updateCell(rowIndex, column, result.expandedContent);
        setExpansionMetaByCell((prev) => ({
            ...prev,
            [cellKey]: {
                provider: typeof result.provider === 'string' ? result.provider : undefined,
                model: typeof result.model === 'string' ? result.model : undefined,
                chunksUsed: typeof result.chunksUsed === 'number' ? result.chunksUsed : undefined,
                cacheHit: Boolean(result.cacheHit),
                confidence:
                    typeof result.quality?.confidence === 'number'
                        ? result.quality.confidence
                        : undefined,
                coverage:
                    typeof result.quality?.coverage === 'number'
                        ? result.quality.coverage
                        : undefined,
            },
        }));
    };

    const expandContent = async (
        rowIndex: number,
        column: string,
        options?: { skipLengthConfirm?: boolean },
    ) => {
        if (readOnly) return false;
        
        const row = rows[rowIndex];
        const contentBrief = String(row[column] ?? '');
        
        // Don't expand if content is already long
        if (!options?.skipLengthConfirm && contentBrief.length > 200) {
            const confirm = window.confirm(
                'This content appears to already be expanded. Expand again?'
            );
            if (!confirm) return false;
        }

        const cellKey = `${rowIndex}-${column}`;
        setExpandingCell(cellKey);
        setExpandError(null);

        try {
            const result = await requestExpandedContent(row, column);
            applyExpansionResult(rowIndex, column, result);
            console.log(`Content expanded using ${result.provider} (${result.model})`);
            return true;
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            setExpandError(message);
            console.error('Failed to expand content:', error);
            
            // Auto-clear error after 5 seconds
            setTimeout(() => setExpandError(null), 5000);
            return false;
        } finally {
            setExpandingCell(null);
        }
    };

    const expandAllContentRows = async () => {
        if (readOnly || !isLessonPresentationTable || !contentColumn || isExpandingAll) {
            return;
        }

        const targets = rows
            .map((row, rowIndex) => ({
                rowIndex,
                content: String(row[contentColumn] ?? '').trim(),
            }))
            .filter((entry) => entry.content.length > 0);

        if (targets.length === 0) {
            setExpandError('No content rows available to expand.');
            setTimeout(() => setExpandError(null), 5000);
            return;
        }

        const longRows = targets.filter((entry) => entry.content.length > 200).length;
        if (longRows > 0) {
            const confirm = window.confirm(
                `${longRows} row(s) already look expanded. Continue batch expansion anyway?`,
            );
            if (!confirm) return;
        }

        setIsExpandingAll(true);
        setExpandError(null);
        setExpandAllProgress({
            total: targets.length,
            completed: 0,
            failed: 0,
        });

        let completed = 0;
        let failed = 0;

        for (const target of targets) {
            const succeeded = await expandContent(target.rowIndex, contentColumn, {
                skipLengthConfirm: true,
            });
            if (succeeded) {
                completed += 1;
            } else {
                failed += 1;
            }
            setExpandAllProgress({
                total: targets.length,
                completed,
                failed,
            });
        }

        setIsExpandingAll(false);
    };

    // Check if this is a lesson presentation table (has specific columns)
    const isLessonPresentationTable = columns.includes('content') || 
                                      columns.includes('specificObjective') ||
                                      columns.includes('time');

    // Compact view (collapsed)
    if (!isExpanded) {
        return (
            <div className="space-y-2">
                {expandError && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center justify-between">
                        <span>{expandError}</span>
                        <button 
                            onClick={() => setExpandError(null)}
                            className="text-red-500 hover:text-red-700"
                        >
                            ×
                        </button>
                    </div>
                )}
                
                {/* Compact Preview */}
                <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-600">
                                Lesson Presentation Table ({rows.length} rows)
                            </span>
                        </div>
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors"
                        >
                            <Sparkles size={12} />
                            Open for Editing
                        </button>
                    </div>
                    
                    {/* Compact table preview */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    {columns.slice(0, 4).map((column) => (
                                        <th key={column} className="px-3 py-2 text-left font-medium text-slate-500 text-[10px] uppercase">
                                            {column}
                                        </th>
                                    ))}
                                    {columns.length > 4 && (
                                        <th className="px-3 py-2 text-left font-medium text-slate-400 text-[10px]">
                                            +{columns.length - 4} more
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.slice(0, 3).map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        {columns.slice(0, 4).map((column) => (
                                            <td key={column} className="px-3 py-2 text-slate-600 max-w-[150px] truncate">
                                                {String(row[column] ?? '')}
                                            </td>
                                        ))}
                                        {columns.length > 4 && <td className="px-3 py-2 text-slate-400">...</td>}
                                    </tr>
                                ))}
                                {rows.length > 3 && (
                                    <tr>
                                        <td colSpan={Math.min(columns.length, 5)} className="px-3 py-2 text-center text-slate-400 text-xs">
                                            +{rows.length - 3} more rows
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // Full editing view (expanded)
    return (
        <div className="space-y-2">
            {expandError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center justify-between">
                    <span>{expandError}</span>
                    <button 
                        onClick={() => setExpandError(null)}
                        className="text-red-500 hover:text-red-700"
                    >
                        ×
                    </button>
                </div>
            )}
            
            {/* Header with collapse button */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-600">
                        Editing Lesson Presentation Table
                    </span>
                    {expandAllProgress && (
                        <span className="text-xs text-slate-500">
                            {expandAllProgress.completed}/{expandAllProgress.total} complete
                            {expandAllProgress.failed > 0 ? `, ${expandAllProgress.failed} failed` : ''}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {!readOnly && isLessonPresentationTable && contentColumn && (
                        <button
                            onClick={expandAllContentRows}
                            disabled={isExpandingAll || Boolean(expandingCell)}
                            className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            {isExpandingAll ? (
                                <>
                                    <Loader2 size={12} className="animate-spin" />
                                    Expanding All...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={12} />
                                    Expand All Content
                                </>
                            )}
                        </button>
                    )}
                    <button
                        onClick={() => setIsExpanded(false)}
                        disabled={isExpandingAll}
                        className="text-xs font-medium text-slate-600 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        Collapse Table
                    </button>
                </div>
            </div>
            
            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column}
                                    className="px-3 py-2 text-left font-medium text-slate-500 text-xs uppercase whitespace-nowrap"
                                >
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="group hover:bg-slate-50/50">
                                {columns.map((column) => {
                                    const cellKey = `${rowIndex}-${column}`;
                                    const isExpanding = expandingCell === cellKey;
                                    const isContentColumn = column.toLowerCase() === 'content';
                                    const expansionMeta = expansionMetaByCell[cellKey];
                                    
                                    return (
                                        <td key={cellKey} className="px-2 py-1 align-top relative">
                                            <div className="relative">
                                                <textarea
                                                    className="w-full min-w-[150px] resize-y bg-transparent border border-slate-200 hover:border-slate-300 focus:border-blue-400 rounded p-2 text-xs text-slate-700 focus:ring-2 focus:ring-blue-200 outline-none disabled:opacity-60 transition-colors"
                                                    value={String(row[column] ?? '')}
                                                    onChange={(e) => updateCell(rowIndex, column, e.target.value)}
                                                    readOnly={readOnly}
                                                    disabled={isExpanding || isExpandingAll}
                                                    rows={isContentColumn ? 10 : 3}
                                                    placeholder={`Enter ${column}...`}
                                                />
                                                {expansionMeta && isContentColumn && (
                                                    <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-1 max-w-[70%]">
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                                            {expansionMeta.provider ?? 'ai'}
                                                        </span>
                                                        {typeof expansionMeta.confidence === 'number' && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                conf {expansionMeta.confidence}%
                                                            </span>
                                                        )}
                                                        {typeof expansionMeta.coverage === 'number' && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                                                ctx {expansionMeta.coverage}%
                                                            </span>
                                                        )}
                                                        {expansionMeta.cacheHit && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                                                                cached
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {!readOnly && isContentColumn && isLessonPresentationTable && (
                                                    <button
                                                        onClick={() => expandContent(rowIndex, column)}
                                                        disabled={isExpanding || isExpandingAll}
                                                        className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-medium text-white bg-blue-600 hover:bg-blue-700 px-2 py-1.5 rounded disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-colors"
                                                        title="Expand content with AI-generated detailed notes"
                                                    >
                                                        {isExpanding ? (
                                                            <>
                                                                <Loader2 size={10} className="animate-spin" />
                                                                Expanding...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles size={10} />
                                                                Expand with AI
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


