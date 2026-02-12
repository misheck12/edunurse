import React, { useState } from 'react';
import { Search, Filter, BookOpen, Activity, ClipboardList, Thermometer, Smile, Plus, X } from 'lucide-react';
import { TEMPLATES } from '../constants';
import { useNavigate } from 'react-router-dom';

const Templates: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'BookOpen': return BookOpen;
      case 'Activity': return Activity;
      case 'ClipboardList': return ClipboardList;
      case 'Thermometer': return Thermometer;
      default: return Smile;
    }
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full relative">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Template Library</h1>
        <p className="text-slate-500 text-lg">Select a template to generate compliant curriculum documents for your nursing students.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center">
         <div className="bg-slate-100 p-1 rounded-lg flex gap-1 w-full md:w-auto">
             <button className="flex-1 md:flex-none px-6 py-2 rounded-md bg-white shadow-sm text-blue-600 font-medium text-sm">Built-in Templates</button>
             <button className="flex-1 md:flex-none px-6 py-2 rounded-md text-slate-500 hover:text-slate-700 font-medium text-sm">My Templates</button>
         </div>
         <div className="flex gap-3 w-full md:w-auto">
             <div className="relative flex-grow md:w-80">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                 <input className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 outline-none text-sm" placeholder="Search lesson plans..." />
             </div>
             <button className="flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white hover:bg-slate-50">
                 <Filter size={18} className="mr-2 text-slate-400"/> Filter
             </button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEMPLATES.map((template) => {
              const Icon = getIcon(template.icon);
              return (
                  <div key={template.id} className="group bg-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all duration-300 flex flex-col h-full overflow-hidden">
                      <div className={`h-32 bg-gradient-to-br from-${template.color}-50 to-${template.color}-100 relative p-6 flex flex-col justify-between`}>
                          <div className="absolute top-0 right-0 p-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${template.color}-100 text-${template.color}-800`}>{template.category}</span>
                          </div>
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                              <Icon className={`text-${template.color}-600`} size={24}/>
                          </div>
                      </div>
                      <div className="p-6 flex-grow flex flex-col">
                          <h3 className="text-lg font-bold text-slate-900 mb-2">{template.title}</h3>
                          <p className="text-sm text-slate-500 mb-4 line-clamp-2">{template.description}</p>
                          <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-3">
                              <div className="flex items-center text-xs text-slate-400">
                                  <span>{template.usage} Usage</span>
                              </div>
                              <div className="flex gap-3">
                                  <button onClick={() => setSelectedTemplate(template)} className="flex-1 py-2 px-3 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Preview</button>
                                  <button onClick={() => navigate('/create')} className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">Use Template</button>
                              </div>
                          </div>
                      </div>
                  </div>
              )
          })}
      </div>

      {/* Preview Modal */}
      {selectedTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-${selectedTemplate.color}-100 flex items-center justify-center text-${selectedTemplate.color}-600`}>
                             {React.createElement(getIcon(selectedTemplate.icon), {size: 20})}
                          </div>
                          <div>
                              <h3 className="text-xl font-bold text-slate-900">{selectedTemplate.title}</h3>
                              <p className="text-sm text-slate-500">{selectedTemplate.category} Template</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedTemplate(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <div className="p-8 overflow-y-auto flex-1 bg-slate-50/50">
                      <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-10 min-h-[500px]">
                          {/* Skeleton Preview Content */}
                          <div className="w-1/3 h-6 bg-slate-200 rounded mb-8"></div>
                          <div className="space-y-4 mb-8">
                              <div className="w-full h-4 bg-slate-100 rounded"></div>
                              <div className="w-full h-4 bg-slate-100 rounded"></div>
                              <div className="w-3/4 h-4 bg-slate-100 rounded"></div>
                          </div>
                          
                          <div className="w-1/4 h-5 bg-blue-100 rounded mb-4"></div>
                          <div className="grid grid-cols-2 gap-4 mb-8">
                              <div className="h-24 bg-slate-50 border border-slate-100 rounded-lg"></div>
                              <div className="h-24 bg-slate-50 border border-slate-100 rounded-lg"></div>
                          </div>

                          <div className="w-1/4 h-5 bg-slate-200 rounded mb-4"></div>
                          <div className="space-y-4">
                              <div className="w-full h-20 bg-slate-50 border border-slate-100 rounded-lg"></div>
                              <div className="w-full h-20 bg-slate-50 border border-slate-100 rounded-lg"></div>
                          </div>
                      </div>
                  </div>

                  <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-white">
                      <button onClick={() => setSelectedTemplate(null)} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium">Close Preview</button>
                      <button onClick={() => navigate('/create')} className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-500/30">Use This Template</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Templates;