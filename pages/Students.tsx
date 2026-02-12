import React from 'react';
import { Search, Filter, Download, MoreHorizontal, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { MOCK_STUDENTS } from '../constants';

const Students: React.FC = () => {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Student Progress</h1>
          <p className="text-slate-500">Track attendance, clinical placement grades, and academic performance.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 bg-white">
            <Download size={16} /> Export Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
            + Add Student
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Class Attendance</p>
            <h3 className="text-2xl font-bold text-slate-900">88.5%</h3>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <TrendingUp size={12} className="mr-1" /> +2.4% vs last month
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <CheckCircle2 size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Students At Risk</p>
            <h3 className="text-2xl font-bold text-slate-900">3</h3>
            <p className="text-xs text-slate-400 mt-1">Requires intervention</p>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <AlertCircle size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Active Placements</p>
            <h3 className="text-2xl font-bold text-slate-900">42</h3>
            <p className="text-xs text-slate-400 mt-1">Across 5 wards</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <ActivityIcon size={24} />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
           <div className="relative w-full sm:w-72">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             <input type="text" placeholder="Search student name or ID..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
           </div>
           <div className="flex items-center gap-2 w-full sm:w-auto">
             <button className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white hover:bg-slate-50 text-slate-700 flex-1 sm:flex-none justify-center">
                <Filter size={16} /> Filters
             </button>
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4">Student ID</th>
                <th className="px-6 py-4">Attendance</th>
                <th className="px-6 py-4">Current Placement</th>
                <th className="px-6 py-4">Overall Grade</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_STUDENTS.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={`https://picsum.photos/id/${student.id + 60}/40/40`} alt="" className="w-8 h-8 rounded-full bg-slate-200" />
                      <span className="font-medium text-slate-900">{student.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-mono">{student.id_num}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${student.attendance > 85 ? 'bg-green-500' : student.attendance > 70 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${student.attendance}%`}}></div>
                       </div>
                       <span className="text-xs font-medium text-slate-600">{student.attendance}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{student.placement}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">{student.grade}%</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                      ${student.status === 'On Track' ? 'bg-green-50 text-green-700 border-green-200' : 
                        student.status === 'At Risk' ? 'bg-red-50 text-red-700 border-red-200' : 
                        student.status === 'Exceeding' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-slate-400 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-slate-100">
                      <MoreHorizontal size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
           <p className="text-sm text-slate-500">Showing 1-6 of 28 students</p>
           <div className="flex gap-2">
              <button className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50">Previous</button>
              <button className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50">Next</button>
           </div>
        </div>
      </div>
    </div>
  );
};

// Local Icon Helper
const ActivityIcon = ({size, className}: {size: number, className?: string}) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
)

export default Students;
