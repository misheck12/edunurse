import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, BookOpen, Activity, ClipboardList, Thermometer, Calendar, FileText, Download, Sparkles } from 'lucide-react';
import { RECENT_DOCS } from '../constants';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const ActionCard = ({ icon: Icon, title, desc, color }: { icon: any, title: string, desc: string, color: string }) => (
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
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Educator Workspace</h1>
          <p className="text-slate-500">Generate structured, curriculum-grounded documentation for your nursing programme.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-lg shadow-blue-500/30 flex items-center gap-2 font-medium transition-all transform active:scale-95"
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
              {RECENT_DOCS.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded text-blue-600">
                        <FileText size={18} />
                      </div>
                      <span className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer" onClick={() => navigate('/editor')}>{doc.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                        ${doc.type.includes('Lesson') ? 'bg-blue-100 text-blue-800' : 
                          doc.type.includes('OSCE') ? 'bg-rose-100 text-rose-800' :
                          doc.type.includes('Scheme') ? 'bg-amber-100 text-amber-800' :
                          doc.type.includes('Clinical') ? 'bg-emerald-100 text-emerald-800' :
                          'bg-indigo-100 text-indigo-800'}`}>
                      {doc.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{doc.lastEdited}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-slate-400 hover:text-blue-600 transition-colors" title="Export PDF">
                      <Download size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;