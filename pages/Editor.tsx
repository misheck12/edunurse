import React, { useState } from 'react';
import { ArrowLeft, Share2, Upload, Sparkles, Search, PlusCircle, MoreHorizontal, CheckCircle, X, Maximize2, Minimize2, FileDown, Printer, FileText, BrainCircuit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Editor: React.FC = () => {
  const navigate = useNavigate();
  const [showExportModal, setShowExportModal] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-[#f6f7f8] relative overflow-hidden">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-4 w-1/3">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-blue-600 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <input 
                className="font-semibold text-lg bg-transparent border-none p-0 focus:ring-0 text-slate-900 placeholder-slate-400 w-full hover:bg-slate-50 rounded px-1 -ml-1 transition-colors truncate outline-none" 
                type="text" 
                defaultValue="OSCE Station: PPH Management" 
            />
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <CheckCircle size={12} /> Auto-saved to Workspace
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 w-1/3">
           <div className="hidden lg:flex items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1">Midwifery</span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="flex items-center gap-1">Year 2</span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="flex items-center gap-1 font-medium text-blue-600">NMCZ Standard</span>
           </div>
        </div>

        <div className="flex items-center justify-end gap-3 w-1/3">
           <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
             <Share2 size={16} /> Share
           </button>
           <button 
             onClick={() => setShowExportModal(true)}
             className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
           >
             <Upload size={16} /> Export
           </button>
        </div>
      </header>

      {/* Editor Body */}
      <div className="flex flex-1 overflow-hidden relative">
         {/* Left Sidebar: Schema Structure */}
         <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 hidden md:flex">
             <div className="p-4 border-b border-slate-100">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Station Structure</h3>
                 <div className="relative">
                     <Search className="absolute left-2 top-1.5 text-slate-400" size={14} />
                     <input className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="Filter sections..." />
                 </div>
             </div>
             <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                 {['Station Metadata', 'Candidate Instructions', 'Actor Script', 'Examiner Checklist'].map((item, idx) => (
                     <a key={item} href="#" className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg group transition-colors ${idx === 1 ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                         <span className={`text-xs font-mono ${idx === 1 ? 'text-blue-500' : 'text-slate-400'}`}>0{idx + 1}</span>
                         {item}
                     </a>
                 ))}
                 <div className="pl-9 space-y-1">
                    <a className="block text-xs text-slate-500 hover:text-blue-600 py-1" href="#">Scenario Overview</a>
                    <a className="block text-xs text-slate-500 hover:text-blue-600 py-1" href="#">Safety Criticals</a>
                 </div>
                 {['Scoring Rubric', 'Equipment List'].map((item, idx) => (
                     <a key={item} href="#" className="flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg group transition-colors">
                         <span className="text-xs font-mono text-slate-400">0{idx + 5}</span>
                         {item}
                     </a>
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
         <main className="flex-1 bg-[#eef4fb] overflow-y-auto relative flex justify-center p-4 md:p-8">
            <div className="w-full max-w-[850px] bg-white min-h-[1000px] shadow-sm rounded-lg p-12 relative group">
                
                {/* Section Block 1 */}
                <div className="border border-slate-100 rounded-lg p-6 mb-6 hover:border-blue-300 transition-colors relative group/block">
                    <div className="absolute top-4 right-4 opacity-0 group-hover/block:opacity-100 flex gap-2">
                         <button className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Regenerate</button>
                    </div>
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Candidate Instructions</h2>
                    <div className="prose prose-slate max-w-none">
                        <p className="font-semibold text-slate-900">Scenario:</p>
                        <p className="text-slate-600 mb-4">You are a midwife in the labor ward. Mrs. Mulenga, a 28-year-old G2P1, has just delivered a healthy baby boy. 15 minutes after delivery, you notice heavy vaginal bleeding. She appears pale and anxious.</p>
                        
                        <p className="font-semibold text-slate-900">Task:</p>
                        <ol className="text-slate-600 list-decimal pl-5 space-y-1">
                            <li>Assess the patient's condition immediately.</li>
                            <li>Identify the likely cause of the hemorrhage.</li>
                            <li>Demonstrate the initial management steps for uterine atony (Tone).</li>
                            <li>Communicate effectively with the patient and the team.</li>
                        </ol>
                    </div>
                </div>

                {/* Section Block 2 */}
                <div className="border border-blue-500 ring-4 ring-blue-500/10 rounded-lg p-6 mb-6 bg-blue-50/10 relative group/block">
                     <div className="absolute -left-3 top-6 bg-blue-500 text-white p-1 rounded-r text-xs font-bold">ACTIVE</div>
                    <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Sparkles size={14} /> Actor Script (Patient)
                    </h2>
                    <div className="space-y-4 text-slate-800">
                        <div className="flex gap-4">
                            <span className="font-bold w-24 shrink-0 text-slate-500 text-sm">Initial State:</span>
                            <p className="text-sm">Lying in bed, looking distressed. Holding abdomen.</p>
                        </div>
                        <div className="flex gap-4">
                            <span className="font-bold w-24 shrink-0 text-slate-500 text-sm">Dialogue 1:</span>
                            <p className="text-sm">"Nurse, I feel something flowing... it feels wet and warm."</p>
                        </div>
                        <div className="flex gap-4">
                            <span className="font-bold w-24 shrink-0 text-slate-500 text-sm">Dialogue 2:</span>
                            <p className="text-sm">"I feel dizzy... is everything okay?" (If candidate checks pulse)</p>
                        </div>
                    </div>
                </div>

                {/* Section Block 3: Rubric */}
                <div className="border border-slate-100 rounded-lg p-6 mb-6 hover:border-blue-300 transition-colors relative">
                     <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Examiner Marking Checklist</h2>
                     <table className="min-w-full divide-y divide-slate-200 text-sm">
                         <thead className="bg-slate-50">
                             <tr>
                                 <th className="px-3 py-2 text-left font-medium text-slate-500">Action</th>
                                 <th className="px-3 py-2 text-left font-medium text-slate-500">Marks</th>
                                 <th className="px-3 py-2 text-left font-medium text-slate-500">Critical?</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             <tr>
                                 <td className="px-3 py-2">Calls for help immediately</td>
                                 <td className="px-3 py-2">2</td>
                                 <td className="px-3 py-2 text-red-500 font-bold">YES</td>
                             </tr>
                             <tr>
                                 <td className="px-3 py-2">Massages the uterus continuously</td>
                                 <td className="px-3 py-2">4</td>
                                 <td className="px-3 py-2 text-red-500 font-bold">YES</td>
                             </tr>
                             <tr>
                                 <td className="px-3 py-2">Checks bladder and catheterizes if full</td>
                                 <td className="px-3 py-2">2</td>
                                 <td className="px-3 py-2 text-slate-400">No</td>
                             </tr>
                         </tbody>
                     </table>
                </div>

                {/* Add Block Placeholder */}
                <div className="pt-4 flex justify-center">
                    <button className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors px-4 py-2 rounded-full hover:bg-white border border-transparent hover:border-slate-200">
                        <PlusCircle size={18} /> Add Section
                    </button>
                </div>
            </div>
         </main>

         {/* Right Sidebar: Intelligence */}
         <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 z-10 shadow-xl lg:shadow-none hidden xl:flex">
             <div className="p-4 border-b border-slate-100 flex items-center gap-2 text-slate-800 font-semibold bg-slate-50/50">
                 <BrainCircuit size={18} className="text-purple-600" /> 
                 <span>Curriculum Intelligence</span>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* Grounding Source */}
                <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Source Material</div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded">NMCZ SYLLABUS</span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium">Competency 4.2: Management of Obstetric Emergencies</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-3">"The candidate must demonstrate the ability to rapidly identify and manage postpartum hemorrhage using the 4 T's approach..."</p>
                    <a href="#" className="text-[10px] text-blue-600 hover:underline mt-2 block">View Full Standard &rarr;</a>
                </div>

                {/* Suggestions */}
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <Sparkles size={14} /> AI Suggestion
                    </h4>
                    <p className="text-xs text-blue-700 mb-3 leading-relaxed">
                        The current scenario does not explicitly mention "checking for placental completeness". This is a key requirement in the Year 2 Midwifery syllabus for PPH.
                    </p>
                    <button className="w-full bg-white text-blue-700 text-xs font-semibold py-2 rounded border border-blue-200 hover:bg-blue-50 transition-all">
                        Add Placental Check Step
                    </button>
                </div>

                {/* Tools */}
                <div>
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Refinement Tools</h5>
                    <div className="grid grid-cols-1 gap-2">
                        <button className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg text-left transition-all text-sm text-slate-600">
                             <Minimize2 size={16} /> Simplify Language
                        </button>
                        <button className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg text-left transition-all text-sm text-slate-600">
                             <CheckCircle size={16} /> Validate References
                        </button>
                    </div>
                </div>
             </div>
         </aside>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-start">
                 <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Export Document</h2>
                    <p className="text-slate-500 text-sm">Inspection-ready formats for printing or archiving.</p>
                 </div>
                 <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-full"><X size={24}/></button>
              </div>
              
              <div className="px-8 py-8 space-y-8">
                 <section>
                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">File Format</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       {[
                           { name: 'Word (.docx)', icon: FileText, desc: 'Editable' },
                           { name: 'PDF', icon: FileDown, desc: 'Print Ready' },
                           { name: 'LMS Package', icon: Upload, desc: 'Moodle / Canvas' }
                       ].map((opt, i) => (
                           <label key={opt.name} className="cursor-pointer relative group">
                               <input type="radio" name="format" className="peer sr-only" defaultChecked={i === 0} />
                               <div className="flex flex-col items-center justify-center p-6 rounded-lg border-2 border-slate-200 hover:border-blue-300 bg-white peer-checked:border-blue-500 peer-checked:bg-blue-50/50 transition-all">
                                   <div className="mb-3 p-3 rounded-full bg-slate-100 text-slate-500 peer-checked:bg-blue-100 peer-checked:text-blue-600">
                                       <opt.icon size={30} />
                                   </div>
                                   <span className="font-medium text-slate-900">{opt.name}</span>
                                   <span className="text-xs text-slate-500 mt-1">{opt.desc}</span>
                                   <div className="absolute top-2 right-2 opacity-0 peer-checked:opacity-100 text-blue-600">
                                       <CheckCircle size={20} />
                                   </div>
                               </div>
                           </label>
                       ))}
                    </div>
                 </section>
              </div>

              <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                  </div>
                  <div className="flex gap-4">
                      <button onClick={() => setShowExportModal(false)} className="px-6 py-2.5 rounded-lg text-slate-600 font-medium hover:bg-slate-200">Cancel</button>
                      <button className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-medium shadow-lg shadow-blue-500/30 flex items-center gap-2 hover:bg-blue-700">
                          <FileDown size={20} /> Download
                      </button>
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Editor;