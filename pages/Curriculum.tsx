import React, { useState } from 'react';
import { Search, ChevronRight, Download, Bookmark, BookOpen, Copy, BrainCircuit, Database } from 'lucide-react';

const Curriculum: React.FC = () => {
  const [expandedYear, setExpandedYear] = useState('Year 2');

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
       {/* Header */}
       <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4">
             <div>
                 <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                     <BrainCircuit size={16} className="text-purple-600"/> <span className="font-medium text-purple-600">Curriculum Intelligence Layer</span>
                 </div>
                 <h1 className="text-2xl font-bold text-slate-900">Source of Truth</h1>
                 <p className="text-slate-500 text-sm mt-1 max-w-3xl">The AI uses these indexed standards to ground all document generation. Read-only view.</p>
             </div>
             <div className="flex gap-3">
                 <button className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">
                     <Database size={16} /> Version History
                 </button>
             </div>
          </div>
       </div>

       {/* Main Content Split */}
       <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
          {/* Sidebar Tree */}
          <aside className="w-80 bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex p-1 bg-slate-200 rounded-lg">
                      <button className="flex-1 py-1 px-3 rounded text-sm font-medium text-slate-600">Nursing</button>
                      <button className="flex-1 py-1 px-3 rounded bg-white shadow-sm text-sm font-medium text-blue-600">Midwifery</button>
                  </div>
              </div>
              <div className="p-2 space-y-1">
                  {['Year 1: Foundation', 'Year 2: Specialized Care', 'Year 3: Advanced Practice'].map(year => (
                      <div key={year}>
                          <button 
                            onClick={() => setExpandedYear(year.split(':')[0])}
                            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm font-medium ${expandedYear === year.split(':')[0] ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-700'}`}
                          >
                              <ChevronRight size={16} className={`transition-transform ${expandedYear === year.split(':')[0] ? 'rotate-90' : ''}`} />
                              {year}
                          </button>
                          {expandedYear === year.split(':')[0] && (
                              <div className="ml-4 pl-2 border-l-2 border-slate-100 mt-1 space-y-1">
                                  {['MW-201: Reproductive Anatomy', 'MW-202: Antenatal Care', 'MW-203: Labor & Delivery', 'MW-204: Postnatal Care'].map((mod, i) => (
                                      <button key={mod} className={`w-full text-left p-2 rounded-lg text-sm ${i === 1 ? 'bg-white border border-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
                                          <div className="flex justify-between items-center">
                                              <span>{mod}</span>
                                              {i === 1 && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                                          </div>
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </aside>

          {/* Content Area */}
          <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden mb-6">
                 <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                     <BookOpen size={120} />
                 </div>
                 <div className="relative z-10">
                     <div className="flex items-center gap-3 mb-2">
                         <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Core Module</span>
                         <span className="text-slate-400 text-sm font-medium">Credits: 12</span>
                     </div>
                     <h2 className="text-2xl font-bold text-slate-900 mb-2">MW-202: Antenatal Care Essentials</h2>
                     <p className="text-slate-600 max-w-3xl">This module covers the comprehensive assessment and management of women during the antenatal period, including risk assessment, health promotion, and the detection of complications.</p>
                 </div>
                 <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
                     {[
                         {label: 'Duration', val: '8 Weeks'},
                         {label: 'Prerequisites', val: 'MW-104'},
                         {label: 'Indexed Date', val: 'Oct 24, 2024'},
                         {label: 'Assessment', val: 'Exam & OSCE'},
                     ].map(stat => (
                         <div key={stat.label}>
                             <p className="text-xs text-slate-500 uppercase font-medium">{stat.label}</p>
                             <p className="font-semibold text-slate-900">{stat.val}</p>
                         </div>
                     ))}
                 </div>
             </div>

             <div className="space-y-4">
                 <div className="flex items-center justify-between">
                     <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                         <span className="w-1 h-6 bg-blue-600 rounded-full"></span> Indexed Learning Objectives
                     </h3>
                     <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded font-medium">Read Only</span>
                 </div>
                 
                 {[
                     { code: 'NMCZ-MW-4.2', title: 'Abdominal Examination & Palpation', text: 'Demonstrate ability to perform abdominal palpation to determine fetal lie, presentation, position, and engagement.', tags: [{name: 'Cognitive', color: 'blue'}, {name: 'Psychomotor', color: 'emerald'}] },
                     { code: 'NMCZ-MW-4.3', title: 'Fetal Heart Rate Monitoring', text: 'Correctly identify and interpret the fetal heart rate using a Pinard stethoscope and Doppler device.', highlight: 'fetal heart', tags: [{name: 'Psychomotor', color: 'purple'}] },
                     { code: 'NMCZ-MW-4.5', title: 'Risk Identification & Referral', text: 'Identify high-risk factors during antenatal screening and initiate appropriate referral pathways.', tags: [{name: 'Cognitive', color: 'orange'}, {name: 'Affective', color: 'blue'}] }
                 ].map((obj, idx) => (
                     <div key={obj.code} className={`bg-white rounded-xl shadow-sm border-l-4 p-5 relative group ${idx === 1 ? 'border-slate-300 ring-2 ring-blue-500/20' : 'border-blue-500'}`}>
                         <div className="flex justify-between items-start gap-4">
                             <div className="flex-1">
                                 <div className="flex items-center gap-2 mb-2">
                                     <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{obj.code}</span>
                                     <span className="text-xs text-slate-400 font-medium">NMCZ Standard</span>
                                 </div>
                                 <h4 className="text-base font-semibold text-slate-900 mb-2">{obj.title}</h4>
                                 <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                                     {obj.highlight ? (
                                         <>Correctly identify and interpret the <span className="bg-yellow-200 px-1 rounded">{obj.highlight}</span> rate using a Pinard stethoscope and Doppler device.</>
                                     ) : obj.text}
                                 </p>
                                 <div className="flex flex-wrap items-center gap-3">
                                     <span className="text-xs font-medium text-slate-500">Domains:</span>
                                     {obj.tags.map(tag => (
                                         <span key={tag.name} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${tag.color}-50 text-${tag.color}-700`}>
                                             <span className={`w-1.5 h-1.5 rounded-full bg-${tag.color}-500 mr-1.5`}></span>
                                             {tag.name}
                                         </span>
                                     ))}
                                 </div>
                             </div>
                             <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-all">
                                 <Copy size={18}/>
                             </button>
                         </div>
                     </div>
                 ))}
             </div>
          </main>
       </div>
    </div>
  );
};

export default Curriculum;