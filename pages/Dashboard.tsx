import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Activity, ClipboardList, Thermometer, Calendar, FileText, Sparkles } from 'lucide-react';
import { UpgradeBanner } from '../src/components/UpgradeBanner';
import { PaymentModal } from '../src/components/PaymentModal';
import { GenerationReconnectModal } from '../components/GenerationReconnectModal';
import { useGenerationReconnect } from '../src/hooks/useGenerationReconnect';
import SEO from '../src/components/SEO';
import { DocumentListItem, listDocuments } from '../src/services/backendApi';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { inProgressGeneration, dismissInProgressGeneration } = useGenerationReconnect();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [recentProjects, setRecentProjects] = useState<DocumentListItem[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadRecentProjects = async () => {
      setIsLoadingProjects(true);
      setProjectsError(null);

      try {
        const response = await listDocuments({ page: 1, pageSize: 5 });
        if (!mounted) return;
        setRecentProjects(response.items);
      } catch (error) {
        if (!mounted) return;
        setProjectsError(
          error instanceof Error ? error.message : 'Failed to load recent projects.',
        );
      } finally {
        if (mounted) {
          setIsLoadingProjects(false);
        }
      }
    };

    void loadRecentProjects();

    return () => {
      mounted = false;
    };
  }, []);

  const formatLastEdited = (iso: string) => {
    const updatedAt = new Date(iso);
    const diffMs = updatedAt.getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / (1000 * 60));

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    if (Math.abs(diffMinutes) < 60) {
      return rtf.format(diffMinutes, 'minute');
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) {
      return rtf.format(diffHours, 'hour');
    }

    const diffDays = Math.round(diffHours / 24);
    if (Math.abs(diffDays) < 7) {
      return rtf.format(diffDays, 'day');
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(updatedAt);
  };

  const getTypeBadgeClassName = (documentType: string) => {
    if (documentType.includes('Lesson')) return 'bg-blue-100 text-blue-800';
    if (documentType.includes('OSCE')) return 'bg-rose-100 text-rose-800';
    if (documentType.includes('Scheme')) return 'bg-amber-100 text-amber-800';
    if (documentType.includes('Clinical')) return 'bg-emerald-100 text-emerald-800';
    return 'bg-indigo-100 text-indigo-800';
  };

  const ActionCard = ({ icon: Icon, title, desc, color }: { icon: React.ComponentType<{ size?: number }>, title: string, desc: string, color: string }) => (
    <div 
        onClick={() => navigate('/create')}
        className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer relative overflow-hidden"
    >
      <div className={`w-12 h-12 rounded-lg bg-${color}-100 text-${color}-600 flex items-center justify-center mb-4 group-hover:bg-${color}-600 group-hover:text-white transition-colors`}>
        <Icon size={24} />
      </div>
      <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 line-clamp-2">{desc}</p>
    </div>
  );

  return (
    <>
      <SEO
        title="Dashboard"
        description="Your educator workspace. Generate structured, curriculum-grounded lesson plans, OSCE stations, and assessments for nursing and midwifery programmes."
        canonicalPath="/"
        keywords="nursing lesson plans, educator dashboard, AI teaching tools"
      />
      {inProgressGeneration && (
        <GenerationReconnectModal
          documentId={inProgressGeneration.documentId}
          documentName={inProgressGeneration.documentName}
          status={inProgressGeneration.status}
          onDismiss={dismissInProgressGeneration}
        />
      )}
      <div className="mx-auto max-w-7xl p-4 sm:p-6 md:p-10">
      {/* Upgrade Banner */}
      <UpgradeBanner
        onUpgradeClick={() => setShowPaymentModal(true)}
        variant="dashboard"
        dismissible={false}
      />

      {/* Header */}
      <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Educator Workspace</h1>
          <p className="text-slate-500">Generate structured, curriculum-grounded documentation for your nursing programme.</p>
        </div>
        <div className="flex w-full items-center gap-4 md:w-auto">
          <button 
            onClick={() => navigate('/create')}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white shadow-lg shadow-blue-500/30 transition-all active:scale-95 hover:bg-blue-700 md:w-auto"
          >
            <Sparkles size={20} />
            Generate New Document
          </button>
        </div>
      </header>

      {/* Generation Studio */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-600 rounded-full"></span>
            Document Studio
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <ActionCard icon={BookOpen} title="Theory Lesson Plan" desc="Outcomes, timing, and activities grounded in theory." color="blue" />
            <ActionCard icon={Thermometer} title="Skills Lab Plan" desc="Equipment, scripts, and practice flows for practicals." color="teal" />
            <ActionCard icon={Activity} title="Clinical Teaching Plan" desc="Ward-based instruction templates and reflection." color="emerald" />
            <ActionCard icon={ClipboardList} title="OSCE Station" desc="Scenarios, instructions, and weighted marking rubrics." color="rose" />
            <ActionCard icon={FileText} title="Assessment Tool" desc="MCQs, SAQs, and Case Studies with rationales." color="indigo" />
            <ActionCard icon={Calendar} title="Scheme of Work" desc="Weekly curriculum breakdowns and scheduling." color="amber" />
        </div>
      </section>

      {/* Recent Documents */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800">Recent Projects</h2>
          <button onClick={() => navigate('/library')} className="text-sm font-medium text-blue-600 hover:text-blue-700">View all projects</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Document Title</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Last Edited</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingProjects && (
                <tr>
                  <td className="px-6 py-8 text-sm text-slate-500" colSpan={4}>
                    Loading recent projects...
                  </td>
                </tr>
              )}

              {!isLoadingProjects && projectsError && (
                <tr>
                  <td className="px-6 py-8 text-sm text-red-600" colSpan={4}>
                    {projectsError}
                  </td>
                </tr>
              )}

              {!isLoadingProjects && !projectsError && recentProjects.length === 0 && (
                <tr>
                  <td className="px-6 py-8 text-sm text-slate-500" colSpan={4}>
                    No projects yet. Generate your first document to see it here.
                  </td>
                </tr>
              )}

              {!isLoadingProjects &&
                !projectsError &&
                recentProjects.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded text-blue-600">
                          <FileText size={18} />
                        </div>
                        <span
                          className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer"
                          onClick={() => navigate(`/editor/${doc.id}`)}
                        >
                          {doc.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeClassName(
                          doc.documentType,
                        )}`}
                      >
                        {doc.documentType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {formatLastEdited(doc.updatedAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/editor/${doc.id}`)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          setShowPaymentModal(false);
          window.location.reload();
        }}
      />
    </div>
    </>
  );
};

export default Dashboard;
