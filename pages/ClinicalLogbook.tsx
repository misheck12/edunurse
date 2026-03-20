import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  Clock,
  CheckCircle2,
  Calendar,
  FileText,
  Star,
  Trash2,
  Edit2,
  Download,
  Filter,
  Activity,
  Stethoscope,
  Heart,
  Baby,
  Users,
  Home,
  Pill,
  Award,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface LogEntry {
  id: string;
  date: string;
  facility: string;
  department: string;
  procedure: string;
  category: string;
  patientType: string;
  supervisor: string;
  hours: number;
  competencyLevel: "observed" | "assisted" | "performed" | "independent";
  notes: string;
  reflection?: string;
  supervisorSignature?: string;
}

interface ProcedureCategory {
  name: string;
  icon: React.ElementType;
  color: string;
  procedures: string[];
}

const PROCEDURE_CATEGORIES: ProcedureCategory[] = [
  {
    name: "General Nursing",
    icon: Activity,
    color: "blue",
    procedures: [
      "Vital Signs Measurement",
      "Patient Assessment",
      "Bed Making (Occupied/Unoccupied)",
      "Patient Hygiene & Bed Bath",
      "Positioning & Mobilization",
      "Wound Dressing",
      "Medication Administration (Oral)",
      "Documentation & Reporting",
    ],
  },
  {
    name: "Medication & IV",
    icon: Pill,
    color: "purple",
    procedures: [
      "IV Cannulation",
      "IV Fluid Administration",
      "IV Medication Administration",
      "IM Injection",
      "SC Injection",
      "Blood Transfusion Monitoring",
      "Drug Calculation & Preparation",
      "Medication Error Prevention",
    ],
  },
  {
    name: "Maternal Health",
    icon: Heart,
    color: "pink",
    procedures: [
      "Antenatal Assessment",
      "Fundal Height Measurement",
      "Fetal Heart Rate Monitoring",
      "Labor Monitoring (Partograph)",
      "Normal Vaginal Delivery",
      "Active Management of 3rd Stage",
      "Postpartum Hemorrhage Management",
      "Breastfeeding Support",
      "Postnatal Assessment",
    ],
  },
  {
    name: "Pediatrics & Newborn",
    icon: Baby,
    color: "green",
    procedures: [
      "Newborn Assessment (APGAR)",
      "Newborn Resuscitation",
      "Kangaroo Mother Care",
      "Immunization Administration",
      "Growth Monitoring (Weight, Height)",
      "ORS Preparation & Administration",
      "Nasogastric Tube Feeding",
      "Pediatric Vital Signs",
    ],
  },
  {
    name: "Community Health",
    icon: Home,
    color: "cyan",
    procedures: [
      "Home Visit Assessment",
      "Health Education Session",
      "TB Contact Tracing",
      "HIV Counseling & Testing (HCT)",
      "ART Adherence Counseling",
      "Under-5 Clinic",
      "Antenatal Outreach",
      "Community Mapping",
    ],
  },
  {
    name: "Emergency & Critical",
    icon: AlertCircle,
    color: "red",
    procedures: [
      "Basic Life Support (BLS)",
      "Oxygen Therapy Administration",
      "Suctioning",
      "Catheterization (Male/Female)",
      "NGT Insertion",
      "Emergency Triage",
      "Shock Management",
      "Burns Management",
    ],
  },
];

const DEPARTMENTS = [
  "Medical Ward",
  "Surgical Ward",
  "Pediatric Ward",
  "Maternity/Labour Ward",
  "Postnatal Ward",
  "Emergency/Casualty",
  "OPD",
  "Theatre",
  "ICU",
  "Community/Outreach",
  "TB Ward",
  "HIV/ART Clinic",
  "MCH Clinic",
];

const PATIENT_TYPES = ["Adult", "Pediatric", "Neonatal", "Maternal"];

const COMPETENCY_LEVELS = [
  { value: "observed", label: "Observed", color: "bg-slate-500", description: "Watched procedure being performed" },
  { value: "assisted", label: "Assisted", color: "bg-blue-500", description: "Helped during procedure" },
  { value: "performed", label: "Performed (Supervised)", color: "bg-amber-500", description: "Did procedure under supervision" },
  { value: "independent", label: "Independent", color: "bg-green-500", description: "Did procedure independently" },
];

export default function ClinicalLogbook() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);
  const [filterDepartment, setFilterDepartment] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"log" | "summary" | "goals">("log");

  // Form state
  const [formData, setFormData] = useState<Partial<LogEntry>>({
    date: new Date().toISOString().split("T")[0],
    facility: "",
    department: "",
    procedure: "",
    category: "",
    patientType: "Adult",
    supervisor: "",
    hours: 0,
    competencyLevel: "observed",
    notes: "",
    reflection: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem("clinicalLogbook");
    if (saved) {
      setEntries(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("clinicalLogbook", JSON.stringify(entries));
  }, [entries]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.procedure || !formData.department) return;

    if (editingEntry) {
      setEntries(prev => prev.map(entry => 
        entry.id === editingEntry.id 
          ? { ...entry, ...formData } as LogEntry
          : entry
      ));
      setEditingEntry(null);
    } else {
      const newEntry: LogEntry = {
        id: Date.now().toString(),
        ...formData as LogEntry,
      };
      setEntries(prev => [newEntry, ...prev]);
    }
    setShowAddForm(false);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      facility: "",
      department: "",
      procedure: "",
      category: "",
      patientType: "Adult",
      supervisor: "",
      hours: 0,
      competencyLevel: "observed",
      notes: "",
      reflection: "",
    });
  };

  const deleteEntry = (id: string) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesDept = filterDepartment === "All" || entry.department === filterDepartment;
    const matchesCat = filterCategory === "All" || entry.category === filterCategory;
    return matchesDept && matchesCat;
  });

  // Calculate summary stats
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const procedureCounts = entries.reduce((acc, e) => {
    acc[e.procedure] = (acc[e.procedure] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const departmentHours = entries.reduce((acc, e) => {
    acc[e.department] = (acc[e.department] || 0) + e.hours;
    return acc;
  }, {} as Record<string, number>);

  const exportToPDF = () => {
    // In real implementation, use jsPDF or similar
    const data = entries.map(e => 
      `${e.date} | ${e.department} | ${e.procedure} | ${e.hours}hrs | ${e.competencyLevel} | ${e.supervisor}`
    ).join("\n");
    
    const blob = new Blob([
      "CLINICAL LOGBOOK EXPORT\n",
      `Generated: ${new Date().toLocaleDateString()}\n`,
      `Total Hours: ${totalHours}\n`,
      `Total Procedures: ${entries.length}\n\n`,
      "DATE | DEPARTMENT | PROCEDURE | HOURS | LEVEL | SUPERVISOR\n",
      "-".repeat(80) + "\n",
      data
    ], { type: "text/plain" });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinical_logbook_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-10">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              <BookOpen size={14} />
              Clinical Logbook
            </div>
            <h1 className="text-3xl font-bold text-slate-900">
              Track Your Clinical Experience
            </h1>
            <p className="mt-2 text-slate-600">
              Document procedures, clinical hours, and competency development
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToPDF}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Entry
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-3">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Hours</p>
                <p className="text-2xl font-bold text-slate-900">{totalHours}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-green-100 p-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Procedures</p>
                <p className="text-2xl font-bold text-slate-900">{entries.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-100 p-3">
                <Star className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Independent</p>
                <p className="text-2xl font-bold text-slate-900">
                  {entries.filter(e => e.competencyLevel === "independent").length}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-100 p-3">
                <Activity className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Departments</p>
                <p className="text-2xl font-bold text-slate-900">
                  {new Set(entries.map(e => e.department)).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-200 pb-2">
          {[
            { id: "log", label: "Log Entries", icon: FileText },
            { id: "summary", label: "Summary", icon: Activity },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "log" && (
          <>
            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-3">
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="All">All Departments</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="All">All Categories</option>
                {PROCEDURE_CATEGORIES.map(cat => (
                  <option key={cat.name} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Entries List */}
            <div className="space-y-3">
              {filteredEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <BookOpen className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <h3 className="text-lg font-semibold text-slate-700">No entries yet</h3>
                  <p className="text-slate-500 mb-4">Start documenting your clinical experience</p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus size={16} />
                    Add First Entry
                  </button>
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                  >
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                      onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-12 rounded-full ${
                          COMPETENCY_LEVELS.find(l => l.value === entry.competencyLevel)?.color
                        }`} />
                        <div>
                          <h3 className="font-semibold text-slate-900">{entry.procedure}</h3>
                          <p className="text-sm text-slate-600">{entry.department} • {entry.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{entry.hours}hrs</p>
                          <p className="text-xs text-slate-500 capitalize">{entry.competencyLevel}</p>
                        </div>
                        <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${
                          expandedEntry === entry.id ? "rotate-90" : ""
                        }`} />
                      </div>
                    </div>
                    
                    {expandedEntry === entry.id && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Facility</p>
                            <p className="text-sm text-slate-700">{entry.facility || "Not specified"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Supervisor</p>
                            <p className="text-sm text-slate-700">{entry.supervisor || "Not specified"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Patient Type</p>
                            <p className="text-sm text-slate-700">{entry.patientType}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Category</p>
                            <p className="text-sm text-slate-700">{entry.category}</p>
                          </div>
                        </div>
                        {entry.notes && (
                          <div className="mt-4">
                            <p className="text-xs text-slate-500 mb-1">Notes</p>
                            <p className="text-sm text-slate-700">{entry.notes}</p>
                          </div>
                        )}
                        {entry.reflection && (
                          <div className="mt-4">
                            <p className="text-xs text-slate-500 mb-1">Reflection</p>
                            <p className="text-sm text-slate-700">{entry.reflection}</p>
                          </div>
                        )}
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEntry(entry);
                              setFormData(entry);
                              setShowAddForm(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                          >
                            <Edit2 size={14} />
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEntry(entry.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === "summary" && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Hours by Department */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Hours by Department</h3>
              <div className="space-y-3">
                {(Object.entries(departmentHours) as [string, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([dept, hours]) => (
                    <div key={dept}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-700">{dept}</span>
                        <span className="text-sm font-semibold text-slate-900">{hours}hrs</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200">
                        <div 
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${(hours / Math.max(...(Object.values(departmentHours) as number[]))) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                {Object.keys(departmentHours).length === 0 && (
                  <p className="text-sm text-slate-500">No data yet</p>
                )}
              </div>
            </div>

            {/* Most Performed Procedures */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Most Performed Procedures</h3>
              <div className="space-y-2">
                {(Object.entries(procedureCounts) as [string, number][])
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([proc, count], idx) => (
                    <div key={proc} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-700">{idx + 1}. {proc}</span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {count}x
                      </span>
                    </div>
                  ))}
                {Object.keys(procedureCounts).length === 0 && (
                  <p className="text-sm text-slate-500">No data yet</p>
                )}
              </div>
            </div>

            {/* Competency Progress */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Competency Progress</h3>
              <div className="grid grid-cols-2 gap-4">
                {COMPETENCY_LEVELS.map(level => {
                  const count = entries.filter(e => e.competencyLevel === level.value).length;
                  const percentage = entries.length > 0 ? (count / entries.length * 100).toFixed(0) : 0;
                  return (
                    <div key={level.value} className="rounded-xl bg-slate-50 p-4">
                      <div className={`mb-2 h-2 w-8 rounded-full ${level.color}`} />
                      <p className="text-2xl font-bold text-slate-900">{count}</p>
                      <p className="text-xs text-slate-500">{level.label} ({percentage}%)</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NMC Requirements Check */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">NMC Zambia Requirements</h3>
              <p className="mb-4 text-sm text-slate-600">Track progress toward NMC clinical hours requirements</p>
              <div className="space-y-4">
                {[
                  { name: "Medical Ward", required: 320, category: "Medical Ward" },
                  { name: "Surgical Ward", required: 320, category: "Surgical Ward" },
                  { name: "Maternity", required: 400, category: "Maternity/Labour Ward" },
                  { name: "Pediatrics", required: 240, category: "Pediatric Ward" },
                  { name: "Community Health", required: 160, category: "Community/Outreach" },
                ].map(req => {
                  const achieved = entries
                    .filter(e => e.department === req.category)
                    .reduce((sum, e) => sum + e.hours, 0);
                  const percentage = Math.min((achieved / req.required) * 100, 100);
                  return (
                    <div key={req.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-700">{req.name}</span>
                        <span className="text-xs text-slate-500">{achieved}/{req.required}hrs</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200">
                        <div 
                          className={`h-full rounded-full ${percentage >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6">
              <h2 className="mb-6 text-xl font-bold text-slate-900">
                {editingEntry ? "Edit Entry" : "Add Clinical Entry"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Date *</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Facility</label>
                    <input
                      type="text"
                      value={formData.facility}
                      onChange={(e) => setFormData(prev => ({ ...prev, facility: e.target.value }))}
                      placeholder="e.g., UTH, Levy Mwanawasa"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Department *</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      required
                    >
                      <option value="">Select department</option>
                      {DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select category</option>
                      {PROCEDURE_CATEGORIES.map(cat => (
                        <option key={cat.name} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Procedure *</label>
                  <select
                    value={formData.procedure}
                    onChange={(e) => setFormData(prev => ({ ...prev, procedure: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">Select or type procedure</option>
                    {formData.category && PROCEDURE_CATEGORIES.find(c => c.name === formData.category)?.procedures.map(proc => (
                      <option key={proc} value={proc}>{proc}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Hours</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.hours}
                      onChange={(e) => setFormData(prev => ({ ...prev, hours: parseFloat(e.target.value) || 0 }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Patient Type</label>
                    <select
                      value={formData.patientType}
                      onChange={(e) => setFormData(prev => ({ ...prev, patientType: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    >
                      {PATIENT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Competency Level</label>
                    <select
                      value={formData.competencyLevel}
                      onChange={(e) => setFormData(prev => ({ ...prev, competencyLevel: e.target.value as LogEntry["competencyLevel"] }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    >
                      {COMPETENCY_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Supervisor</label>
                  <input
                    type="text"
                    value={formData.supervisor}
                    onChange={(e) => setFormData(prev => ({ ...prev, supervisor: e.target.value }))}
                    placeholder="Supervisor name"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    placeholder="Brief notes about the procedure/experience"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Reflection</label>
                  <textarea
                    value={formData.reflection}
                    onChange={(e) => setFormData(prev => ({ ...prev, reflection: e.target.value }))}
                    rows={2}
                    placeholder="What did you learn? What would you do differently?"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingEntry(null);
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {editingEntry ? "Save Changes" : "Add Entry"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

    </div>
  );
}
