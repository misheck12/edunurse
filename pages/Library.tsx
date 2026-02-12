import React from 'react';
import { Search, Filter, Calendar, LayoutGrid, List, FileText, ClipboardList, MoreHorizontal } from 'lucide-react';
import { RECENT_DOCS } from '../constants';

const Library: React.FC = () => {
  // Generate more dummy data for the full library view
  const allDocs = [
    { id: '101', title: 'Postnatal Care Module 1', type: 'Lesson Plan', programme: 'Midwifery BSc', lastEdited: '2 hours ago', status: 'Final' },
    { id: '102', title: 'Pediatric CPR Scenario', type: 'OSCE Station', programme: 'Nursing Yr 2', lastEdited: 'Yesterday', status: 'Review' },
    { id: '103', title: 'Anatomy Quiz - Week 4', type: 'Assessment', programme: 'Nursing Yr 1', lastEdited: 'Oct 24, 2023', status: 'Final' },
    { id: '104', title: 'Maternal Health Overview', type: 'Lesson Plan', programme: 'Midwifery BSc', lastEdited: 'Oct 20, 2023', status: 'Draft' },
    { id: '105', title: 'Venipuncture Checklist', type: 'OSCE Station', programme: 'Nursing Yr 1', lastEdited: 'Sep 15, 2023', status: 'Final' },
  ];

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'Final': return 'bg-emerald-500';
        case 'Review': return 'bg-amber-500';
        default: return 'bg-slate-300';
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">My Documents Library</h1>
        <p className="text-slate-500">Manage and organize your lesson plans and OSCE stations.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
         <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Search by title, keyword..." 
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
            </div>
            <div className="flex gap-3">
                <select className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm">
                    <option>All Types</option>
                    <option>Lesson Plans</option>
                    <option>OSCE Stations</option>
                </select>
                <select className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm">
                    <option>All Programmes</option>
                    <option>Nursing</option>
                    <option>Midwifery</option>
                </select>
                <button className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 flex items-center gap-2 text-sm hover:bg-slate-50">
                    <Calendar size={16} /> Date Range
                </button>
                 <div className="border-l border-slate-200 mx-2"></div>
                 <div className="flex bg-slate-100 rounded-lg p-1">
                    <button className="p-1.5 bg-white rounded shadow-sm text-blue-600"><List size={18}/></button>
                    <button className="p-1.5 text-slate-500 hover:text-slate-700"><LayoutGrid size={18}/></button>
                 </div>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4 w-12"><input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"/></th>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Programme</th>
                    <th className="px-6 py-4">Last Edited</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {allDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4"><input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"/></td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded ${doc.type === 'Lesson Plan' ? 'bg-blue-50 text-blue-600' : doc.type === 'Assessment' ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {doc.type === 'Lesson Plan' ? <FileText size={18} /> : <ClipboardList size={18}/>}
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900">{doc.title}</p>
                                    <p className="text-xs text-slate-500">Created by Sarah J.</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${doc.type === 'Lesson Plan' ? 'bg-blue-100 text-blue-800' : doc.type === 'Assessment' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {doc.type}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{doc.programme}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{doc.lastEdited}</td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(doc.status)}`}></div>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                             <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={20}/></button>
                        </td>
                    </tr>
                ))}
            </tbody>
         </table>
         <div className="p-4 border-t border-slate-200 flex items-center justify-between">
             <div className="text-sm text-slate-500">Showing 1 to 5 of 24 results</div>
             <div className="flex gap-2">
                 <button className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50 text-sm">Previous</button>
                 <button className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50 text-sm">Next</button>
             </div>
         </div>
      </div>
    </div>
  );
};

export default Library;