import React, { useState, useEffect } from "react";
import {
  Briefcase,
  MapPin,
  Star,
  Clock,
  FileText,
  Users,
  Building,
  GraduationCap,
  ExternalLink,
  CheckCircle2,
  ChevronRight,
  Search,
  Filter,
  Bookmark,
  Award,
  Phone,
  Mail,
  Globe,
  Heart,
  TrendingUp,
} from "lucide-react";

interface Hospital {
  id: string;
  name: string;
  type: string;
  province: string;
  location: string;
  beds: string;
  departments: string[];
  internshipInfo: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  specialNotes?: string;
}

interface CareerTip {
  id: string;
  title: string;
  category: string;
  content: string[];
}

interface InterviewQuestion {
  question: string;
  sampleAnswer: string;
  tips: string[];
}

const ZAMBIAN_HOSPITALS: Hospital[] = [
  {
    id: "uth",
    name: "University Teaching Hospital (UTH)",
    type: "National Referral Hospital",
    province: "Lusaka",
    location: "Nationalist Road, Lusaka",
    beds: "1,800+",
    departments: ["Medical", "Surgical", "Pediatrics", "Obstetrics", "ICU", "Oncology", "Nephrology", "Cardiology"],
    internshipInfo: "Main training hospital for University of Zambia medical and nursing students. Competitive placements with excellent exposure to complex cases.",
    contactEmail: "info@uth.gov.zm",
    contactPhone: "+260 211 253 055",
    specialNotes: "Largest hospital in Zambia. Good for specialists exposure."
  },
  {
    id: "lmth",
    name: "Levy Mwanawasa Teaching Hospital",
    type: "Teaching Hospital",
    province: "Lusaka",
    location: "Kabulonga, Lusaka",
    beds: "800+",
    departments: ["Medical", "Surgical", "Pediatrics", "Obstetrics", "Emergency", "Oncology"],
    internshipInfo: "Modern facility with good learning environment. Growing internship program.",
    contactPhone: "+260 211 286 100",
    specialNotes: "Newer facility with modern equipment and good mentorship."
  },
  {
    id: "ndola",
    name: "Ndola Teaching Hospital",
    type: "Teaching Hospital",
    province: "Copperbelt",
    location: "Ndola",
    beds: "800+",
    departments: ["Medical", "Surgical", "Pediatrics", "Obstetrics", "Orthopedics", "TB/HIV"],
    internshipInfo: "Major training facility for Copperbelt University. Good exposure to mining-related health conditions.",
    contactPhone: "+260 212 612 034",
    specialNotes: "Serves mining communities - unique exposure to occupational health."
  },
  {
    id: "kitwe",
    name: "Kitwe Teaching Hospital",
    type: "Teaching Hospital",
    province: "Copperbelt",
    location: "Kitwe",
    beds: "600+",
    departments: ["Medical", "Surgical", "Pediatrics", "Obstetrics", "Emergency"],
    internshipInfo: "Growing internship program with hands-on experience opportunities.",
    specialNotes: "Good practical experience in busy hospital setting."
  },
  {
    id: "livingstone",
    name: "Livingstone Central Hospital",
    type: "Provincial Hospital",
    province: "Southern",
    location: "Livingstone",
    beds: "332",
    departments: ["Medical", "Surgical", "Pediatrics", "Obstetrics", "Dental"],
    internshipInfo: "Serves tourist area - exposure to travel medicine and emergency care.",
    specialNotes: "Unique exposure to travel/tropical medicine due to tourist traffic."
  },
  {
    id: "chipata",
    name: "Chipata General Hospital",
    type: "Provincial Hospital",
    province: "Eastern",
    location: "Chipata",
    beds: "300+",
    departments: ["Medical", "Surgical", "Pediatrics", "Obstetrics", "HIV/TB"],
    internshipInfo: "Good community health exposure. Serves rural population.",
    specialNotes: "Excellent for community health and rural medicine experience."
  },
  {
    id: "maina-soko",
    name: "Maina Soko Military Hospital",
    type: "Military Hospital",
    province: "Lusaka",
    location: "Lusaka",
    beds: "300+",
    departments: ["Medical", "Surgical", "Obstetrics", "Emergency"],
    internshipInfo: "Disciplined environment with structured training. Limited civilian placements.",
    specialNotes: "Good organizational structure and protocols."
  },
  {
    id: "fairview",
    name: "Fairview Hospital",
    type: "Mission Hospital",
    province: "Southern",
    location: "Chikankata, Southern Province",
    beds: "120",
    departments: ["Medical", "Obstetrics", "Community Health", "HIV Care"],
    internshipInfo: "Mission hospital with strong community outreach. Holistic care approach.",
    specialNotes: "Excellent for community health and holistic nursing approach."
  },
];

const CAREER_TIPS: CareerTip[] = [
  {
    id: "cv",
    title: "Writing Your Nursing CV",
    category: "Job Application",
    content: [
      "Start with a professional summary highlighting your nursing qualification and key strengths",
      "List your education: Nursing school, year of completion, any honors or awards",
      "Include clinical placements and departments rotated through",
      "Highlight any special training: BLS, PMTCT, ART, emergency care, etc.",
      "List relevant skills: Cannulation, catheterization, wound care, drug administration",
      "Include your NMC Zambia registration number and status",
      "Add professional references (lecturers, clinical instructors)",
      "Keep it to 2 pages maximum, well-organized and error-free"
    ]
  },
  {
    id: "cover-letter",
    title: "Writing a Cover Letter",
    category: "Job Application",
    content: [
      "Address the letter to a specific person if possible (HR Manager, Nursing Officer)",
      "State the position you're applying for and how you learned about it",
      "Explain why you're interested in that specific hospital/organization",
      "Highlight 2-3 relevant skills or experiences that make you suitable",
      "Mention your clinical placement experience and what you learned",
      "Express enthusiasm for contributing to the team",
      "Keep it to one page, professional tone",
      "Proofread carefully - no spelling or grammar errors"
    ]
  },
  {
    id: "interview-prep",
    title: "Interview Preparation",
    category: "Interview",
    content: [
      "Research the hospital: services offered, mission, recent developments",
      "Review common nursing procedures and guidelines",
      "Practice answering behavioral questions (situation, task, action, result)",
      "Prepare questions to ask the interviewer",
      "Dress professionally: clean uniform or business attire",
      "Bring copies of your certificates, CV, and registration",
      "Arrive 15-20 minutes early",
      "Show confidence but remain humble and eager to learn"
    ]
  },
  {
    id: "first-job",
    title: "Tips for Your First Job",
    category: "Career Development",
    content: [
      "Be punctual - arrive early for all shifts",
      "Ask questions when unsure - patient safety comes first",
      "Build good relationships with colleagues and senior nurses",
      "Accept feedback graciously and learn from mistakes",
      "Volunteer for learning opportunities and training",
      "Document everything accurately and on time",
      "Follow protocols even when busy - they protect you and patients",
      "Take care of your mental and physical health - nursing is demanding"
    ]
  },
  {
    id: "specialization",
    title: "Choosing a Nursing Specialization",
    category: "Career Development",
    content: [
      "Critical Care/ICU: For those who thrive in high-pressure situations",
      "Midwifery: High demand in Zambia, essential for maternal health",
      "Pediatrics: If you enjoy working with children and families",
      "Mental Health: Growing need and often underserved area",
      "Community Health: For those who prefer outreach and prevention",
      "Theatre/Perioperative: For those interested in surgical care",
      "Consider additional training and certificates to specialize",
      "Look for scholarship opportunities for further education"
    ]
  },
];

const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    question: "Tell us about yourself and why you chose nursing.",
    sampleAnswer: "I am a registered nurse who recently completed my training at [School]. I chose nursing because I have always been drawn to helping others, especially after seeing how nurses cared for my grandmother during her illness. I'm passionate about providing compassionate, evidence-based care.",
    tips: ["Keep it professional and relevant to nursing", "Share a genuine motivation story", "Mention your training and key skills"]
  },
  {
    question: "How would you handle a patient who refuses treatment?",
    sampleAnswer: "First, I would calmly try to understand their concerns by listening actively. I would explain the benefits and risks in simple terms. I would respect their autonomy while ensuring they understand the consequences. I would document the refusal and inform the doctor. If appropriate, I might involve family or a supervisor.",
    tips: ["Show respect for patient autonomy", "Emphasize communication skills", "Mention documentation and escalation"]
  },
  {
    question: "Describe a challenging situation during your clinical placement and how you handled it.",
    sampleAnswer: "During my placement in labor ward, we received a mother with severe PPH. I assisted by calling for help, preparing IV lines, and keeping the mother calm while senior staff managed the emergency. I learned the importance of teamwork and staying calm under pressure.",
    tips: ["Use the STAR method (Situation, Task, Action, Result)", "Be honest about your role as a student", "Show what you learned"]
  },
  {
    question: "What would you do if you saw a colleague making a medication error?",
    sampleAnswer: "Patient safety is the priority. I would intervene immediately to prevent harm if possible. I would speak privately with my colleague about the error. If the error occurred, I would ensure it's reported and documented following hospital protocol. I would support my colleague while ensuring the patient receives proper care.",
    tips: ["Prioritize patient safety", "Show professionalism and teamwork", "Know the importance of incident reporting"]
  },
  {
    question: "How do you stay updated with nursing knowledge and practices?",
    sampleAnswer: "I regularly review nursing guidelines from MoH and WHO. I participate in CME sessions when available. I read nursing journals and use online resources. I also learn from senior colleagues and ask questions to continuously improve my practice.",
    tips: ["Show commitment to lifelong learning", "Mention specific resources", "Emphasize learning from colleagues"]
  },
];

export default function CareerPlacement() {
  const [activeTab, setActiveTab] = useState<"hospitals" | "tips" | "interview">("hospitals");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("All");
  const [savedHospitals, setSavedHospitals] = useState<string[]>([]);
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  const provinces = ["All", "Lusaka", "Copperbelt", "Southern", "Eastern", "Northern", "Western", "Central", "North-Western", "Luapula", "Muchinga"];

  useEffect(() => {
    const saved = localStorage.getItem("savedHospitals");
    if (saved) setSavedHospitals(JSON.parse(saved));
  }, []);

  const toggleSave = (hospitalId: string) => {
    const newSaved = savedHospitals.includes(hospitalId)
      ? savedHospitals.filter(id => id !== hospitalId)
      : [...savedHospitals, hospitalId];
    setSavedHospitals(newSaved);
    localStorage.setItem("savedHospitals", JSON.stringify(newSaved));
  };

  const filteredHospitals = ZAMBIAN_HOSPITALS.filter(h => {
    const matchesProvince = selectedProvince === "All" || h.province === selectedProvince;
    const matchesSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         h.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProvince && matchesSearch;
  });

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 md:p-10">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Briefcase size={14} />
            Career & Placement
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Prepare for Your Nursing Career
          </h1>
          <p className="mt-2 text-slate-600">
            Hospital information, job application tips, and interview preparation for Zambian nurses
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-200 pb-2">
          {[
            { id: "hospitals", label: "Hospitals", icon: Building },
            { id: "tips", label: "Career Tips", icon: TrendingUp },
            { id: "interview", label: "Interview Prep", icon: Users },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Hospitals Tab */}
        {activeTab === "hospitals" && (
          <>
            {/* Search & Filter */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search hospitals..."
                  className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
              >
                {provinces.map(p => (
                  <option key={p} value={p}>{p} Province</option>
                ))}
              </select>
            </div>

            {/* Hospital Cards */}
            <div className="space-y-4">
              {filteredHospitals.map((hospital) => (
                <div
                  key={hospital.id}
                  className="rounded-xl border border-slate-200 bg-white p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">{hospital.name}</h3>
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                          {hospital.type}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                        <MapPin size={14} />
                        {hospital.location}, {hospital.province} Province
                      </p>
                    </div>
                    <button
                      onClick={() => toggleSave(hospital.id)}
                      className={`rounded-lg p-2 ${
                        savedHospitals.includes(hospital.id)
                          ? "text-amber-500"
                          : "text-slate-400 hover:text-amber-500"
                      }`}
                    >
                      <Bookmark size={20} fill={savedHospitals.includes(hospital.id) ? "currentColor" : "none"} />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">BEDS</p>
                      <p className="text-sm text-slate-700">{hospital.beds}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">DEPARTMENTS</p>
                      <div className="flex flex-wrap gap-1">
                        {hospital.departments.map(dept => (
                          <span key={dept} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {dept}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg bg-indigo-50 p-3">
                    <p className="text-xs font-semibold text-indigo-700">INTERNSHIP INFO</p>
                    <p className="mt-1 text-sm text-indigo-900">{hospital.internshipInfo}</p>
                  </div>

                  {hospital.specialNotes && (
                    <p className="mt-3 text-sm italic text-slate-500">💡 {hospital.specialNotes}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    {hospital.contactPhone && (
                      <a href={`tel:${hospital.contactPhone}`} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                        <Phone size={14} />
                        {hospital.contactPhone}
                      </a>
                    )}
                    {hospital.contactEmail && (
                      <a href={`mailto:${hospital.contactEmail}`} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                        <Mail size={14} />
                        {hospital.contactEmail}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Career Tips Tab */}
        {activeTab === "tips" && (
          <div className="space-y-4">
            {CAREER_TIPS.map((tip) => (
              <div
                key={tip.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedTip(expandedTip === tip.id ? null : tip.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-indigo-100 p-3">
                      {tip.category === "Job Application" ? <FileText className="h-6 w-6 text-indigo-600" /> :
                       tip.category === "Interview" ? <Users className="h-6 w-6 text-indigo-600" /> :
                       <TrendingUp className="h-6 w-6 text-indigo-600" />}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-indigo-600">{tip.category}</span>
                      <h3 className="font-semibold text-slate-900">{tip.title}</h3>
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${
                    expandedTip === tip.id ? "rotate-90" : ""
                  }`} />
                </div>
                {expandedTip === tip.id && (
                  <div className="border-t border-slate-200 bg-slate-50 p-5">
                    <ul className="space-y-3">
                      {tip.content.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                          <span className="text-sm text-slate-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {/* NMC Registration Info */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-green-800">
                <Award size={20} />
                NMC Zambia Registration
              </h3>
              <p className="mt-2 text-sm text-green-700">
                Before you can practice as a nurse in Zambia, you must be registered with the Nursing & Midwifery Council of Zambia.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-start gap-2 text-sm text-green-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  Complete your approved nursing program
                </li>
                <li className="flex items-start gap-2 text-sm text-green-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  Pass the NMC licensure examination
                </li>
                <li className="flex items-start gap-2 text-sm text-green-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  Apply for registration with required documents
                </li>
                <li className="flex items-start gap-2 text-sm text-green-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  Renew license annually
                </li>
              </ul>
              <a
                href="https://nmcz.org.zm"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:underline"
              >
                Visit NMC Zambia Website <ExternalLink size={14} />
              </a>
            </div>
          </div>
        )}

        {/* Interview Tab */}
        {activeTab === "interview" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6">
              <h3 className="text-lg font-semibold text-indigo-800">Common Nursing Interview Questions</h3>
              <p className="mt-1 text-sm text-indigo-700">
                Practice these questions before your interview. Review the sample answers and tips.
              </p>
            </div>

            {INTERVIEW_QUESTIONS.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <div
                  className="flex items-start justify-between p-5 cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600">
                      {idx + 1}
                    </div>
                    <h3 className="font-semibold text-slate-900">{item.question}</h3>
                  </div>
                  <ChevronRight className={`mt-1 h-5 w-5 flex-shrink-0 text-slate-400 transition-transform ${
                    expandedQuestion === idx ? "rotate-90" : ""
                  }`} />
                </div>
                {expandedQuestion === idx && (
                  <div className="border-t border-slate-200 bg-slate-50 p-5">
                    <div className="mb-4">
                      <h4 className="mb-2 text-sm font-semibold text-slate-700">Sample Answer:</h4>
                      <p className="rounded-lg bg-white p-3 text-sm text-slate-600 border border-slate-200">
                        {item.sampleAnswer}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-slate-700">Tips:</h4>
                      <ul className="space-y-1">
                        {item.tips.map((tip, tidx) => (
                          <li key={tidx} className="flex items-start gap-2 text-sm text-slate-600">
                            <Star className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Interview Day Checklist */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <CheckCircle2 size={20} className="text-green-600" />
                Interview Day Checklist
              </h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 font-semibold text-slate-700">Documents to Bring:</h4>
                  <ul className="space-y-1 text-sm text-slate-600">
                    <li>☑️ Original certificates</li>
                    <li>☑️ Certified copies of qualifications</li>
                    <li>☑️ CV (multiple copies)</li>
                    <li>☑️ NMC registration certificate</li>
                    <li>☑️ National ID/Passport</li>
                    <li>☑️ Reference letters</li>
                  </ul>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold text-slate-700">Preparation:</h4>
                  <ul className="space-y-1 text-sm text-slate-600">
                    <li>☑️ Research the organization</li>
                    <li>☑️ Practice common questions</li>
                    <li>☑️ Plan your route</li>
                    <li>☑️ Prepare professional attire</li>
                    <li>☑️ Get adequate sleep</li>
                    <li>☑️ Arrive 15-20 minutes early</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
