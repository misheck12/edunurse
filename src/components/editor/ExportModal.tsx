import React, { useEffect, useState } from 'react';
import { FileText, FileDown, CheckCircle, X, Loader2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createExportJob, getExportJob, downloadExportFile } from '../../services/backendApi';
import { PaymentModal } from '../PaymentModal';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentId: string;
    documentTitle: string;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, documentId, documentTitle }) => {
    const [exportFormat, setExportFormat] = useState<'docx' | 'pdf' | 'pptx'>('docx');
    const [isExporting, setIsExporting] = useState(false);
    const [exportJobId, setExportJobId] = useState<string | null>(null);
    const [exportJobFormat, setExportJobFormat] = useState<'docx' | 'pdf' | 'pptx'>('docx');
    const [exportStatus, setExportStatus] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isExportReady, setIsExportReady] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            // Reset state when closed
            setExportStatus(null);
            setExportJobId(null);
            setIsExportReady(false);
            setExportError(null);
            setIsExporting(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!exportJobId || !isOpen) return;

        let active = true;
        let attempts = 0;
        const maxAttempts = 60; // Increased from 30 to 60 (2 minutes)

        const poll = async () => {
            if (!active) return;

            attempts += 1;

            try {
                const job = await getExportJob(exportJobId);
                if (!active) return;

                if (job.status === 'queued') {
                    setIsExportReady(false);
                    setExportStatus('queued');
                    setExportError(job.errorMessage ?? null);
                } else if (job.status === 'running') {
                    setIsExportReady(false);
                    setExportStatus('running');
                    setExportError(null);
                } else if (job.status === 'succeeded') {
                    setIsExportReady(true);
                    setExportStatus('succeeded');
                    setExportError(null);
                    setIsExporting(false);
                    return;
                } else if (job.status === 'failed') {
                    setIsExportReady(false);
                    setExportStatus('failed');
                    setExportError(job.errorMessage ?? 'Export job failed.');
                    setIsExporting(false);
                    return;
                }

                if (attempts >= maxAttempts) {
                    setExportStatus('timeout');
                    setExportError('Export is taking longer than expected. The job may still complete in the background.');
                    setIsExporting(false);
                    return;
                }

                // Adaptive polling: faster initially, slower after 10 attempts
                const delay = attempts < 10 ? 1500 : 3000;
                window.setTimeout(() => {
                    void poll();
                }, delay);
            } catch (err) {
                if (!active) return;
                setExportStatus('failed');
                setExportError(err instanceof Error ? err.message : 'Failed to poll export status.');
                setIsExporting(false);
            }
        };

        void poll();

        return () => {
            active = false;
        };
    }, [exportJobId, isOpen]);

    const handleExport = async () => {
        setIsExporting(true);
        setExportStatus('queued');
        setExportError(null);
        setExportJobId(null);
        setExportJobFormat(exportFormat);
        setIsExportReady(false);

        try {
            const job = await createExportJob({ documentId, format: exportFormat });
            setExportJobId(job.id);
        } catch (err) {
            setExportStatus('failed');
            setExportError(err instanceof Error ? err.message : 'Failed to queue export.');
            setIsExporting(false);
        }
    };

    const handleDownloadReadyExport = async () => {
        if (!exportJobId) return;

        setIsDownloading(true);
        setExportError(null);
        try {
            await downloadExportFile(exportJobId, exportJobFormat);
            // Optional: Show success message or auto-close after download
            // setTimeout(() => onClose(), 1500);
        } catch (err) {
            setExportError(err instanceof Error ? err.message : 'Failed to download export file.');
        } finally {
            setIsDownloading(false);
        }
    };

    if (!isOpen) return null;

    const normalizedError = (exportError ?? '').toLowerCase();
    const isUpgradeRequiredError =
        normalizedError.includes('export limit reached') ||
        normalizedError.includes('purchase more credits') ||
        normalizedError.includes('subscribe') ||
        normalizedError.includes('welcome bonus');

    const getStatusDisplay = () => {
        switch (exportStatus) {
            case 'queued':
                return { text: 'Queued...', color: 'text-slate-500', bg: 'bg-slate-100', icon: Loader2, animate: true };
            case 'running':
                return { text: 'Generating Document...', color: 'text-blue-600', bg: 'bg-blue-50', icon: Loader2, animate: true };
            case 'succeeded':
                return { text: 'Ready for Download', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle, animate: false };
            case 'failed':
                return { text: 'Export Failed', color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle, animate: false };
            case 'timeout':
                return { text: 'Operation Timed Out', color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertCircle, animate: false };
            default:
                return null;
        }
    };

    const statusProps = getStatusDisplay();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4">
            <div className="w-full max-w-2xl scale-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all transform">
                <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-8 sm:py-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Export Document</h2>
                        <p className="text-slate-500 text-sm mt-1">{documentTitle}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6 px-4 py-5 sm:space-y-8 sm:px-8 sm:py-8">
                    {/* Format Selection */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Select Format</h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {[
                                { name: 'Microsoft Word', ext: '.docx', value: 'docx', icon: FileText, desc: 'Editable office document' },
                                { name: 'PDF Document', ext: '.pdf', value: 'pdf', icon: FileDown, desc: 'Optimized for printing' },
                                { name: 'PowerPoint', ext: '.pptx', value: 'pptx', icon: FileText, desc: 'Academic slide deck' }
                            ].map((opt) => (
                                <label key={opt.value} className="cursor-pointer relative group">
                                    <input
                                        type="radio"
                                        name="format"
                                        className="peer sr-only"
                                        checked={exportFormat === opt.value}
                                        onChange={() => {
                                            if (!isExporting && !isExportReady) {
                                                setExportFormat(opt.value as 'docx' | 'pdf' | 'pptx');
                                            }
                                        }}
                                        disabled={isExporting || isExportReady}
                                    />
                                    <div className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${exportFormat === opt.value
                                            ? 'border-blue-500 bg-blue-50/30'
                                            : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                                        } ${isExporting || isExportReady ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <div className={`mb-4 p-3 rounded-full ${exportFormat === opt.value ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            <opt.icon size={32} strokeWidth={1.5} />
                                        </div>
                                        <span className={`font-semibold ${exportFormat === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>
                                            {opt.name}
                                        </span>
                                        <span className="text-xs text-slate-500 mt-1">{opt.desc}</span>

                                        {exportFormat === opt.value && (
                                            <div className="absolute top-3 right-3 text-blue-500 animate-in zoom-in duration-200">
                                                <CheckCircle size={20} fill="currentColor" className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Status & Errors */}
                    <div className="flex min-h-[80px] items-center justify-center">
                        {statusProps ? (
                            <div className={`flex flex-col items-center gap-3 w-full p-4 rounded-xl border ${statusProps.bg} border-transparent`}>
                                <div className={`flex items-center gap-2 ${statusProps.color} font-medium`}>
                                    <statusProps.icon size={20} className={statusProps.animate ? 'animate-spin' : ''} />
                                    {statusProps.text}
                                </div>
                                {exportError && (
                                    <p className="text-sm text-red-600 bg-white/60 px-3 py-2 rounded-lg max-w-md text-center">
                                        {exportError}
                                    </p>
                                )}
                                {exportStatus === 'running' && (
                                    <p className="text-xs text-slate-500 text-center">
                                        This may take up to a minute for complex documents
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="px-2 text-center text-sm text-slate-400 sm:px-8">
                                Ready to generate. Files are created using current content and saved versions.
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3">
                        {!isExportReady ? (
                            <button
                                onClick={handleExport}
                                disabled={isExporting}
                                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] ${isExporting
                                        ? 'bg-slate-300 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-xl'
                                    }`}
                            >
                                {isExporting ? 'Processing Request...' : 'Generate Export File'}
                            </button>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3.5 rounded-xl font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleDownloadReadyExport}
                                    disabled={isDownloading}
                                    className="flex-[2] py-3.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
                                >
                                    {isDownloading ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            Downloading...
                                        </>
                                    ) : (
                                        <>
                                            <FileDown size={20} />
                                            Download {exportJobFormat.toUpperCase()}
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {!isExportReady && (
                            <button
                                onClick={onClose}
                                disabled={isExporting}
                                className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        )}

                        {isUpgradeRequiredError && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                <p className="mb-2 text-xs text-amber-800">
                                    You have no export credits left on the current plan.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(true)}
                                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                >
                                    Upgrade Or Buy Credits
                                </button>
                            </div>
                        )}

                        <Link
                            to="/exports"
                            onClick={onClose}
                            className="text-center text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                            View Exported Files
                        </Link>

                    </div>
                </div>
            </div>

            <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                onSuccess={() => {
                    setShowPaymentModal(false);
                    setExportError(null);
                    setExportStatus(null);
                    setExportJobId(null);
                    setIsExportReady(false);
                }}
            />
        </div>
    );
};

export default ExportModal;
