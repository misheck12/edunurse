import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Activity, ClipboardList, Thermometer, Calendar, CheckCircle2, ArrowRight, ArrowLeft, Sparkles, Loader2, FileText } from 'lucide-react';

const CreateWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<string | null>('Theory Lesson Plan');
  const [loadingText, setLoadingText] = useState('Initializing Curriculum Intelligence...');

  // AI Loading Animation Effect
  useEffect(() => {
    if (step === 3) {
      const texts = [
        "Connecting to Curriculum Intelligence Layer...",
        "Retrieving NMCZ Competency Standards...",
        "Structuring Document Schema...",
        "Generating Section: Learning Outcomes...",
        "Generating Section: Teaching Methodology...",
        "Generating Section: Assessment Rubric...",
        "Validating Curriculum Citations..."
      ];
      let i = 0;
      setLoadingText(texts[0]);
      
      const interval = setInterval(() => {
        i++;
        if (i < texts.length) {
          setLoadingText(texts[i]);
        } else {
          clearInterval(interval);
          navigate('/editor');
        }
      }, 800);

      return () => clearInterval(interval);
    }
  }, [step, navigate]);

  const docTypes = [
    { name: 'Theory Lesson Plan', desc: 'Outcomes, content breakdown, and activities.', icon: BookOpen, color: 'blue' },
    { name: 'Skills Lab Plan', desc: 'Equipment, scripts, and practice flow.', icon: Thermometer, color: 'teal' },
    { name: 'Clinical Teaching Plan', desc: 'Ward-based targets and reflection prompts.', icon: Activity, color: 'emerald' },
    { name: 'OSCE Station', desc: 'Scenario, actor script, and scoring rubric.', icon: ClipboardList, color: 'rose' },
    { name: 'Assessment Tool', desc: 'MCQs, SAQs, and case studies.', icon: FileText, color: 'indigo' },
    { name: 'Scheme of Work', desc: 'Semester-long planning and mapping.', icon: Calendar, color: 'amber' },
  ];

  return (
    <div className="py-8 px-4 sm:px-6 w-full flex flex-col items-center">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-semibold mb-2 text-slate-900">Document Generation Studio</h2>
          <p className="text-slate-500">Create professional, inspection-ready documents grounded in curriculum standards.</p>
        </div>

        {/* Stepper */}
        <div className="mb-12">
          <div className="flex items-center justify-center w-full max-w-2xl mx-auto relative">
             <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10" />
             <div 
               className="absolute top-1/2 left-0 h-0.5 bg-blue-600 -z-10 transition-all duration-500 ease-in-out" 
               style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
             />
             
            <div className="flex-1 flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ring-4 ring-white transition-colors duration-300 ${step >= 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                {step > 1 ? <CheckCircle2 size={20} /> : '1'}
              </div>
              <span className={`mt-2 text-sm font-medium ${step >= 1 ? 'text-blue-600' : 'text-slate-500'}`}>Type</span>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ring-4 ring-white transition-colors duration-300 ${step >= 2 ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                {step > 2 ? <CheckCircle2 size={20} /> : '2'}
              </div>
              <span className={`mt-2 text-sm font-medium ${step >= 2 ? 'text-blue-600' : 'text-slate-500'}`}>Curriculum Context</span>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ring-4 ring-white transition-colors duration-300 ${step >= 3 ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                3
              </div>
              <span className={`mt-2 text-sm font-medium ${step >= 3 ? 'text-blue-600' : 'text-slate-500'}`}>Generate</span>
            </div>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 min-h-[500px] flex flex-col">
           <div className="w-full h-1 bg-slate-100">
               <div className="h-full bg-blue-600 rounded-r-full transition-all duration-500" style={{ width: `${(step/3)*100}%` }}></div>
           </div>
           
           <div className="p-8 md:p-10 flex-1">
             
             {/* STEP 1: SELECT TYPE */}
             {step === 1 && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                 <div className="mb-6 flex items-center gap-2">
                   <h3 className="text-xl font-medium text-slate-900">Select Document Type</h3>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                   {docTypes.map((type) => (
                     <button
                       key={type.name}
                       onClick={() => setSelectedType(type.name)}
                       className={`group relative flex flex-col items-start p-5 rounded-xl border-2 text-left transition-all ${
                         selectedType === type.name
                           ? 'border-blue-500 bg-blue-50/50 shadow-inner'
                           : 'border-slate-200 hover:border-blue-300 bg-white'
                       }`}
                     >
                        <div className={`w-10 h-10 rounded-lg bg-${type.color}-50 text-${type.color}-600 flex items-center justify-center mb-3`}>
                            <type.icon size={20} />
                        </div>
                        <h4 className="font-semibold text-slate-800 mb-1">{type.name}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">{type.desc}</p>
                        
                        <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border flex items-center justify-center ${
                            selectedType === type.name ? 'border-blue-500' : 'border-slate-300'
                        }`}>
                            {selectedType === type.name && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                        </div>
                     </button>
                   ))}
                 </div>
               </div>
             )}

             {/* STEP 2: CURRICULUM SETUP */}
             {step === 2 && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="mb-6">
                      <h3 className="text-xl font-medium text-slate-900">Define Curriculum Context</h3>
                      <p className="text-slate-500">The AI will pull specific competencies and standards based on this context.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Programme</label>
                              <select className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white">
                                  <option>Registered Nursing</option>
                                  <option>Midwifery</option>
                                  <option>Public Health Nursing</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Year & Semester</label>
                              <select className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white">
                                  <option>Year 1 - Semester 1</option>
                                  <option>Year 1 - Semester 2</option>
                                  <option>Year 2 - Semester 1</option>
                                  <option>Year 2 - Semester 2</option>
                                  <option>Year 3 - Semester 1</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Topic / Procedure / Skill</label>
                              <input 
                                type="text" 
                                className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white" 
                                placeholder="e.g. Postpartum Hemorrhage Management" 
                              />
                          </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 flex flex-col justify-center">
                          <div className="flex items-start gap-4">
                               <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                                   <CheckCircle2 size={20} />
                               </div>
                               <div>
                                   <div className="flex items-center justify-between mb-2">
                                       <label className="font-medium text-slate-900">Curriculum Grounding</label>
                                       <div className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-blue-600">
                                          <span className="translate-x-5 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                                       </div>
                                   </div>
                                   <p className="text-sm text-slate-500 leading-relaxed">
                                       When enabled, the system retrieves live data from the indexed <strong>NMCZ Syllabus</strong> and <strong>Competency Framework</strong>.
                                       <br/><br/>
                                       Output will include direct citations, correct domain mappings (Cognitive/Psychomotor), and standard-aligned wording.
                                   </p>
                               </div>
                          </div>
                      </div>
                  </div>
               </div>
             )}

             {/* STEP 3: LOADING */}
             {step === 3 && (
               <div className="h-full flex flex-col items-center justify-center py-10 animate-in fade-in duration-500">
                 <div className="relative mb-8">
                    <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl animate-pulse"></div>
                    <div className="relative bg-white p-4 rounded-full shadow-lg border border-slate-100">
                       <Sparkles size={48} className="text-blue-600 animate-spin-slow" />
                    </div>
                 </div>
                 <h3 className="text-2xl font-bold text-slate-900 mb-2">Generating Structured Document</h3>
                 <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="font-medium animate-pulse">{loadingText}</span>
                 </div>
               </div>
             )}

           </div>

           {/* Footer */}
           {step < 3 && (
             <div className="bg-slate-50 border-t border-slate-100 px-8 py-4 flex items-center justify-between">
                  {step === 1 ? (
                    <button 
                      onClick={() => navigate('/')}
                      className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button 
                      onClick={() => setStep(step - 1)}
                      className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium transition-colors flex items-center gap-2"
                    >
                      <ArrowLeft size={18} /> Back
                    </button>
                  )}
                  
                  <button 
                      onClick={() => setStep(step + 1)}
                      className="px-8 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
                  >
                      {step === 2 ? 'Generate Document' : 'Next Step'}
                      <ArrowRight size={18} />
                  </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default CreateWizard;