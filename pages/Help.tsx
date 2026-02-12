import React from 'react';
import { Search, Rocket, FileText, Video, MessageSquare, Mail } from 'lucide-react';

const Help: React.FC = () => {
  return (
    <div>
       {/* Hero Search */}
       <div className="relative bg-white border-b border-slate-200 pb-16 pt-12 md:pt-20">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-50 rounded-full blur-3xl"></div>
          </div>
          <div className="relative max-w-4xl mx-auto px-4 text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Help & Support Center</h1>
              <p className="text-lg text-slate-500 mb-8 max-w-2xl mx-auto">Find answers, watch tutorials, and get back to teaching what matters most.</p>
              
              <div className="relative max-w-2xl mx-auto group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search className="text-slate-400" size={20} />
                  </div>
                  <input type="text" className="block w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 shadow-sm text-slate-900" placeholder="How can we help you today?" />
                  <div className="absolute inset-y-0 right-2 flex items-center">
                      <button className="hidden sm:flex px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">Search</button>
                  </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm text-slate-500">
                  <span>Popular:</span>
                  <a href="#" className="hover:text-blue-600 underline decoration-blue-200 underline-offset-2">Curriculum Mapping</a>,
                  <a href="#" className="hover:text-blue-600 underline decoration-blue-200 underline-offset-2">Student Grading</a>
              </div>
          </div>
       </div>

       {/* Quick Links */}
       <div className="max-w-7xl mx-auto px-4 -mt-8 mb-16 relative z-10">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {[
                   {title: 'Getting Started', icon: Rocket, color: 'blue', desc: 'New here? Learn the basics of the platform.'},
                   {title: 'Creating OSCE Stations', icon: ActivityIcon, color: 'teal', desc: 'Step-by-step guides for designing clinical exams.'},
                   {title: 'Exporting to Word', icon: FileText, color: 'indigo', desc: 'Learn how to format and download your curriculum.'}
               ].map(card => (
                   <a key={card.title} href="#" className="bg-white p-6 rounded-xl shadow-lg shadow-slate-200/50 border border-slate-100 hover:border-blue-300 hover:-translate-y-1 transition-all group">
                       <div className={`w-12 h-12 rounded-lg bg-${card.color}-50 flex items-center justify-center mb-4 text-${card.color}-600 group-hover:bg-${card.color}-600 group-hover:text-white transition-colors`}>
                           <card.icon size={24}/>
                       </div>
                       <h3 className="text-lg font-bold text-slate-900 mb-2">{card.title}</h3>
                       <p className="text-slate-500 text-sm leading-relaxed">{card.desc}</p>
                   </a>
               ))}
           </div>
       </div>

       {/* Video Section */}
       <div className="max-w-7xl mx-auto px-4 mb-20">
           <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-bold text-slate-900">NMCZ Alignment Tutorials</h2>
               <a href="#" className="text-blue-600 font-medium hover:text-blue-700">View all videos -></a>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
               {[1,2,3].map(i => (
                   <div key={i} className="group cursor-pointer">
                       <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-slate-200">
                           <img src={`https://picsum.photos/id/${i+20}/400/250`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt=""/>
                           <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/20">
                               <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center pl-1 shadow-lg group-hover:scale-110 transition-transform"><Video className="text-blue-600 fill-current"/></div>
                           </div>
                       </div>
                       <h3 className="font-bold text-slate-900 mb-1 group-hover:text-blue-600">Mapping to Competencies</h3>
                       <p className="text-sm text-slate-500 line-clamp-2">Learn how to effectively map your lesson plans directly to specific domains.</p>
                   </div>
               ))}
           </div>
       </div>

       {/* Contact */}
       <div className="max-w-7xl mx-auto px-4 mb-20">
           <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
               <div>
                   <h2 className="text-2xl font-bold text-slate-900 mb-2">Still can't find what you're looking for?</h2>
                   <p className="text-slate-600">Our support team is available Mon-Fri, 9am - 5pm CAT.</p>
               </div>
               <div className="flex gap-4">
                   <button className="flex items-center px-6 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50">
                       <Mail size={18} className="mr-2 text-blue-600"/> Submit a Ticket
                   </button>
                   <button className="flex items-center px-6 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50">
                       <MessageSquare size={18} className="mr-2 text-blue-600"/> Community Forum
                   </button>
               </div>
           </div>
       </div>
    </div>
  );
};

// Helper component for Icon
const ActivityIcon = ({size, className}: {size: number, className?: string}) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
)

export default Help;
