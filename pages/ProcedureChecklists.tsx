import React, { useState, useEffect } from "react";
import {
  ClipboardList,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Timer,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Star,
  Syringe,
  Heart,
  Droplets,
  Thermometer,
  Activity,
  Baby,
  Wind,
  Stethoscope,
  Hand,
  Shield,
  Save,
  RotateCcw,
  Clock,
  BookOpen,
} from "lucide-react";

type ProcedureCategory = "vital-signs" | "injections" | "wound-care" | "catheter" | "iv" | "respiratory" | "maternal" | "pediatric" | "infection-control";

interface ProcedureStep {
  id: string;
  step: string;
  critical?: boolean;
  tips?: string;
}

interface Procedure {
  id: string;
  title: string;
  category: ProcedureCategory;
  description: string;
  indications: string[];
  contraindications?: string[];
  equipment: string[];
  steps: ProcedureStep[];
  complications?: string[];
  documentation: string[];
  estimatedTime: string;
}

interface SavedProgress {
  procedureId: string;
  completedSteps: string[];
  startedAt: string;
  lastUpdated: string;
  notes: string;
}

const PROCEDURES: Procedure[] = [
  {
    id: "hand-hygiene",
    title: "Hand Hygiene (WHO 5 Moments)",
    category: "infection-control",
    description: "Proper hand hygiene technique using soap and water or alcohol-based hand rub",
    indications: [
      "Before touching a patient",
      "Before clean/aseptic procedures",
      "After body fluid exposure risk",
      "After touching a patient",
      "After touching patient surroundings",
    ],
    equipment: ["Soap and running water OR alcohol-based hand rub", "Clean paper towels", "Elbow-operated tap preferred"],
    steps: [
      { id: "1", step: "Remove jewelry (rings, watches, bracelets)", tips: "Bacteria hide under jewelry" },
      { id: "2", step: "Wet hands with water (if using soap)", critical: true },
      { id: "3", step: "Apply enough soap/hand rub to cover all surfaces" },
      { id: "4", step: "Rub palm to palm", tips: "Count to 5 or sing 'Happy Birthday'" },
      { id: "5", step: "Rub right palm over left dorsum with interlaced fingers, then reverse" },
      { id: "6", step: "Rub palm to palm with fingers interlaced" },
      { id: "7", step: "Rub backs of fingers to opposing palms with fingers interlocked" },
      { id: "8", step: "Rotational rubbing of left thumb clasped in right palm, then reverse" },
      { id: "9", step: "Rotational rubbing backwards and forwards with fingers of right hand in left palm, then reverse" },
      { id: "10", step: "Rinse hands with water (if using soap)" },
      { id: "11", step: "Dry thoroughly with single-use towel", critical: true },
      { id: "12", step: "Use towel to turn off tap (if not elbow-operated)" },
    ],
    documentation: ["Not routinely documented unless part of infection audit"],
    estimatedTime: "40-60 seconds",
  },
  {
    id: "im-injection",
    title: "Intramuscular (IM) Injection",
    category: "injections",
    description: "Safe administration of medication into muscle tissue",
    indications: ["Medications requiring IM route", "Vaccines", "Oil-based medications"],
    contraindications: ["Skin infection at injection site", "Bleeding disorders (relative)", "Insufficient muscle mass"],
    equipment: [
      "Medication and prescription chart",
      "Appropriate syringe and needle (21-23G, 1-1.5 inch)",
      "Alcohol swab",
      "Cotton wool/gauze",
      "Sharps container",
      "Gloves",
    ],
    steps: [
      { id: "1", step: "Verify medication using 6 Rights: Right patient, drug, dose, route, time, documentation", critical: true },
      { id: "2", step: "Explain procedure to patient and obtain consent" },
      { id: "3", step: "Perform hand hygiene and put on gloves" },
      { id: "4", step: "Draw up medication using aseptic technique", tips: "Check expiry date, clarity, and for particles" },
      { id: "5", step: "Select injection site (deltoid, vastus lateralis, ventrogluteal, or dorsogluteal)", critical: true, tips: "Ventrogluteal is safest for adults" },
      { id: "6", step: "Clean site with alcohol swab in circular motion, allow to dry", tips: "Wet alcohol causes pain" },
      { id: "7", step: "Stretch skin taut OR use Z-track technique for irritating medications" },
      { id: "8", step: "Insert needle at 90° angle with quick, dart-like motion", critical: true },
      { id: "9", step: "Aspirate briefly (except vaccines) - if blood appears, withdraw and restart" },
      { id: "10", step: "Inject medication slowly and steadily (10 seconds per ml)" },
      { id: "11", step: "Wait 10 seconds before withdrawing needle" },
      { id: "12", step: "Withdraw needle quickly and apply pressure with cotton wool" },
      { id: "13", step: "Dispose of needle immediately in sharps container - never recap", critical: true },
      { id: "14", step: "Remove gloves and perform hand hygiene" },
      { id: "15", step: "Document administration and observe for reactions" },
    ],
    complications: ["Pain", "Hematoma", "Abscess", "Nerve injury", "Anaphylaxis"],
    documentation: ["Drug name, dose, route, site", "Time of administration", "Batch number (for vaccines)", "Patient response", "Signature"],
    estimatedTime: "5-10 minutes",
  },
  {
    id: "vital-signs",
    title: "Complete Vital Signs Assessment",
    category: "vital-signs",
    description: "Systematic measurement of temperature, pulse, respirations, blood pressure, and oxygen saturation",
    indications: ["Routine patient assessment", "Change in patient condition", "Pre/post procedure", "Medication administration"],
    equipment: [
      "Thermometer (digital/infrared)",
      "Watch with second hand or timer",
      "Sphygmomanometer and stethoscope",
      "Pulse oximeter",
      "Observation chart",
    ],
    steps: [
      { id: "1", step: "Explain procedure to patient, ensure comfort and privacy" },
      { id: "2", step: "Perform hand hygiene" },
      { id: "3", step: "Ensure patient has rested for at least 5 minutes" },
      { id: "4", step: "TEMPERATURE: Place thermometer in appropriate site (oral, axillary, tympanic)", tips: "Add 0.5°C for axillary readings" },
      { id: "5", step: "Record temperature and note site used" },
      { id: "6", step: "PULSE: Locate radial pulse with 2-3 fingers (not thumb)", critical: true },
      { id: "7", step: "Count pulse for 60 seconds, note rhythm and volume", tips: "30 seconds x2 only if regular" },
      { id: "8", step: "RESPIRATIONS: Count respiratory rate for 60 seconds without patient knowing", critical: true, tips: "Pretend to still be counting pulse" },
      { id: "9", step: "Note depth, pattern, and any abnormal sounds" },
      { id: "10", step: "BP: Apply cuff 2-3cm above antecubital fossa, bladder over brachial artery" },
      { id: "11", step: "Palpate brachial pulse, inflate to 30mmHg above when pulse disappears" },
      { id: "12", step: "Place stethoscope over brachial artery, deflate slowly (2-3mmHg/second)" },
      { id: "13", step: "Record systolic (first Korotkoff sound) and diastolic (disappearance)", critical: true },
      { id: "14", step: "OXYGEN SATURATION: Apply pulse oximeter to finger, wait for stable reading" },
      { id: "15", step: "Document all findings on observation chart" },
      { id: "16", step: "Report any abnormal findings immediately", critical: true },
    ],
    documentation: ["Time of assessment", "Temperature and site", "Pulse rate, rhythm, volume", "Respiratory rate and quality", "Blood pressure and position", "SpO2 and O2 therapy if any"],
    estimatedTime: "10-15 minutes",
  },
  {
    id: "urinary-catheter",
    title: "Female Urinary Catheterization",
    category: "catheter",
    description: "Aseptic insertion of indwelling urinary catheter in female patients",
    indications: ["Acute urinary retention", "Accurate urine output monitoring", "Perioperative use", "Bladder irrigation"],
    contraindications: ["Urethral trauma", "Recent urological surgery (without orders)"],
    equipment: [
      "Sterile catheterization pack",
      "Foley catheter (12-14 Fr for adults)",
      "Sterile water for balloon inflation (10ml)",
      "Sterile lubricating gel (lidocaine gel if available)",
      "Urine drainage bag",
      "Sterile gloves (2 pairs)",
      "Cleaning solution (normal saline or sterile water)",
      "Kidney dish",
      "Good lighting source",
    ],
    steps: [
      { id: "1", step: "Verify order and indication for catheterization" },
      { id: "2", step: "Explain procedure to patient, obtain consent, ensure privacy" },
      { id: "3", step: "Position patient in dorsal recumbent position with knees bent" },
      { id: "4", step: "Perform hand hygiene and put on non-sterile gloves" },
      { id: "5", step: "Clean perineal area with soap and water, pat dry" },
      { id: "6", step: "Remove gloves, perform hand hygiene" },
      { id: "7", step: "Open sterile pack using aseptic technique", critical: true },
      { id: "8", step: "Put on sterile gloves" },
      { id: "9", step: "Arrange sterile field and check catheter balloon by inflating/deflating" },
      { id: "10", step: "Lubricate catheter tip generously" },
      { id: "11", step: "Use non-dominant hand to separate labia (this hand is now contaminated)" },
      { id: "12", step: "Clean urethral meatus with swabs, front to back, one stroke each", critical: true },
      { id: "13", step: "Identify urethral opening (above vagina)", tips: "Ask patient to cough to help identify" },
      { id: "14", step: "Insert catheter gently into urethra (4-6cm) until urine flows", critical: true },
      { id: "15", step: "Advance catheter another 2-3cm to ensure it's in bladder" },
      { id: "16", step: "Inflate balloon with sterile water (usually 10ml)", critical: true },
      { id: "17", step: "Gently pull catheter back until resistance felt" },
      { id: "18", step: "Connect to drainage bag, secure bag below bladder level" },
      { id: "19", step: "Secure catheter to inner thigh with tape/strap" },
      { id: "20", step: "Document procedure including catheter size, balloon volume, urine output" },
    ],
    complications: ["Urinary tract infection", "Urethral trauma", "Bladder spasm", "Bypassing"],
    documentation: ["Date and time", "Indication", "Catheter size and type", "Balloon volume", "Initial urine output and appearance", "Patient tolerance", "Signature"],
    estimatedTime: "15-20 minutes",
  },
  {
    id: "wound-dressing",
    title: "Wound Dressing Change",
    category: "wound-care",
    description: "Aseptic technique for changing wound dressings",
    indications: ["Scheduled dressing change", "Soiled/wet dressing", "Wound assessment"],
    equipment: [
      "Sterile dressing pack",
      "Appropriate dressing for wound type",
      "Normal saline for cleaning",
      "Sterile gloves",
      "Non-sterile gloves",
      "Tape or bandage",
      "Disposal bag",
      "Pain medication (if prescribed, give 30 min before)",
    ],
    steps: [
      { id: "1", step: "Review wound care orders and previous documentation" },
      { id: "2", step: "Explain procedure to patient, provide analgesia if needed" },
      { id: "3", step: "Ensure good lighting and patient comfort" },
      { id: "4", step: "Perform hand hygiene, put on non-sterile gloves" },
      { id: "5", step: "Remove old dressing carefully, note amount and type of exudate" },
      { id: "6", step: "Assess wound: size, depth, color, odor, edges, surrounding skin", critical: true },
      { id: "7", step: "Dispose of old dressing and gloves in clinical waste" },
      { id: "8", step: "Perform hand hygiene" },
      { id: "9", step: "Open sterile pack using aseptic technique" },
      { id: "10", step: "Put on sterile gloves" },
      { id: "11", step: "Clean wound from center outward using saline-soaked gauze", critical: true, tips: "One stroke per gauze, discard" },
      { id: "12", step: "Pat dry with sterile gauze" },
      { id: "13", step: "Apply appropriate dressing for wound type", tips: "Moist wounds heal faster" },
      { id: "14", step: "Secure dressing with tape, avoid tension" },
      { id: "15", step: "Remove gloves and perform hand hygiene" },
      { id: "16", step: "Document wound assessment and dressing used" },
      { id: "17", step: "Set date for next dressing change" },
    ],
    documentation: ["Wound location and size", "Wound bed appearance", "Exudate amount and type", "Surrounding skin condition", "Dressing applied", "Patient tolerance"],
    estimatedTime: "15-30 minutes",
  },
  {
    id: "iv-cannulation",
    title: "Peripheral IV Cannulation",
    category: "iv",
    description: "Insertion of peripheral intravenous cannula for IV access",
    indications: ["IV fluid administration", "IV medication", "Blood transfusion", "Emergency access"],
    contraindications: ["Infection at site", "Phlebitis", "Lymphedema on that limb", "AV fistula arm"],
    equipment: [
      "Appropriate cannula (18-22G for adults)",
      "Tourniquet",
      "Alcohol swab",
      "Sterile gauze",
      "Transparent dressing",
      "Extension set/cap",
      "Saline flush (5-10ml)",
      "Tape",
      "Gloves",
      "Sharps container",
    ],
    steps: [
      { id: "1", step: "Verify order for IV therapy, explain procedure to patient" },
      { id: "2", step: "Select appropriate cannula size for therapy type" },
      { id: "3", step: "Perform hand hygiene and put on gloves" },
      { id: "4", step: "Select site: non-dominant arm, distal to proximal", tips: "Avoid wrist, antecubital fossa if possible" },
      { id: "5", step: "Apply tourniquet 10-15cm above intended site" },
      { id: "6", step: "Palpate vein, look for straight segment without valves", critical: true },
      { id: "7", step: "Clean site with alcohol, allow to dry (30 seconds)", critical: true },
      { id: "8", step: "Anchor vein by pulling skin taut distally" },
      { id: "9", step: "Insert cannula at 15-30° angle, bevel up", critical: true },
      { id: "10", step: "Watch for flashback in chamber", tips: "Reduce angle slightly after flashback" },
      { id: "11", step: "Advance cannula slightly, then slide plastic catheter forward while withdrawing needle" },
      { id: "12", step: "Release tourniquet" },
      { id: "13", step: "Apply pressure above tip, remove needle completely" },
      { id: "14", step: "Dispose of needle immediately in sharps container", critical: true },
      { id: "15", step: "Attach extension set/cap" },
      { id: "16", step: "Flush with saline to confirm patency - should flow easily" },
      { id: "17", step: "Secure with transparent dressing, note date and time" },
      { id: "18", step: "Document cannula size, site, and number of attempts" },
    ],
    complications: ["Infiltration", "Phlebitis", "Hematoma", "Infection", "Air embolism"],
    documentation: ["Date and time", "Cannula size and site", "Number of attempts", "Flushed and patent", "Signature"],
    estimatedTime: "10-15 minutes",
  },
  {
    id: "oxygen-therapy",
    title: "Oxygen Therapy Administration",
    category: "respiratory",
    description: "Safe administration of supplemental oxygen via various delivery devices",
    indications: ["Hypoxemia (SpO2 <94%)", "Respiratory distress", "Shock", "Carbon monoxide poisoning"],
    contraindications: ["Caution in COPD patients (target SpO2 88-92%)"],
    equipment: [
      "Oxygen source (piped or cylinder)",
      "Flowmeter",
      "Appropriate delivery device",
      "Humidifier (for high flow)",
      "Pulse oximeter",
    ],
    steps: [
      { id: "1", step: "Verify order for oxygen therapy (target SpO2, flow rate, device)" },
      { id: "2", step: "Explain procedure and importance to patient" },
      { id: "3", step: "Assess baseline SpO2 and respiratory status" },
      { id: "4", step: "Select appropriate delivery device based on oxygen needs", critical: true },
      { id: "5", step: "Check oxygen source - ensure adequate supply" },
      { id: "6", step: "Connect delivery device to flowmeter" },
      { id: "7", step: "Set prescribed flow rate", tips: "Nasal cannula: 1-6L/min, Face mask: 5-10L/min" },
      { id: "8", step: "Verify oxygen is flowing before applying to patient" },
      { id: "9", step: "Apply device to patient comfortably" },
      { id: "10", step: "Recheck SpO2 after 5-10 minutes", critical: true },
      { id: "11", step: "Adjust flow to maintain target SpO2" },
      { id: "12", step: "Check skin under device for pressure areas" },
      { id: "13", step: "Provide mouth care and humidification as needed" },
      { id: "14", step: "Document device, flow rate, and patient response" },
      { id: "15", step: "Monitor continuously and escalate if not improving", critical: true },
    ],
    documentation: ["Device type", "Flow rate (L/min)", "Target and achieved SpO2", "Patient tolerance", "Skin integrity"],
    estimatedTime: "5-10 minutes",
  },
  {
    id: "newborn-resuscitation",
    title: "Neonatal Resuscitation (HBB)",
    category: "pediatric",
    description: "Helping Babies Breathe - initial resuscitation of newborns",
    indications: ["Newborn not breathing or gasping at birth", "Heart rate below 100 bpm"],
    equipment: [
      "Clean, warm surface",
      "Warm towels/blankets",
      "Self-inflating bag with mask (size 0 or 1)",
      "Suction device (bulb or mechanical)",
      "Timer/clock",
      "Stethoscope",
    ],
    steps: [
      { id: "1", step: "Dry baby thoroughly with warm towel while calling for help", critical: true, tips: "This stimulates breathing" },
      { id: "2", step: "Remove wet cloth, place on clean warm surface" },
      { id: "3", step: "Position head in 'sniffing' position - slight extension", critical: true },
      { id: "4", step: "Clear airway - suction mouth then nose if needed", tips: "Only if visible secretions" },
      { id: "5", step: "EVALUATE: Is baby breathing or crying? - within first 60 seconds", critical: true },
      { id: "6", step: "If NOT BREATHING: Start bag-mask ventilation", critical: true },
      { id: "7", step: "Form seal with mask - cover mouth and nose", tips: "M-R technique if alone" },
      { id: "8", step: "Give 40 breaths per minute - 'squeeze, release, release'", critical: true },
      { id: "9", step: "Watch for chest rise with each breath" },
      { id: "10", step: "If no chest rise: Reposition head, reapply mask, open mouth" },
      { id: "11", step: "After 1 minute: Check heart rate and breathing" },
      { id: "12", step: "If HR <60: Continue ventilation, consider chest compressions (3:1 ratio)" },
      { id: "13", step: "If HR >100 and breathing: Stop ventilation, keep warm, monitor" },
      { id: "14", step: "Keep baby warm throughout - hypothermia kills", critical: true },
      { id: "15", step: "Document all interventions and times" },
    ],
    complications: ["Pneumothorax from overventilation", "Hypothermia", "Aspiration"],
    documentation: ["Time of birth", "Initial condition", "Interventions performed", "Apgar scores (1 and 5 minutes)", "Time to first breath", "Outcome"],
    estimatedTime: "Variable (Golden Minute critical)",
  },
];

const CATEGORY_INFO: Record<ProcedureCategory, { label: string; icon: React.ElementType; color: string }> = {
  "vital-signs": { label: "Vital Signs", icon: Activity, color: "blue" },
  "injections": { label: "Injections", icon: Syringe, color: "purple" },
  "wound-care": { label: "Wound Care", icon: Heart, color: "red" },
  "catheter": { label: "Catheterization", icon: Droplets, color: "amber" },
  "iv": { label: "IV Therapy", icon: Droplets, color: "green" },
  "respiratory": { label: "Respiratory", icon: Wind, color: "cyan" },
  "maternal": { label: "Maternal", icon: Baby, color: "pink" },
  "pediatric": { label: "Pediatric", icon: Baby, color: "indigo" },
  "infection-control": { label: "Infection Control", icon: Shield, color: "emerald" },
};

export default function ProcedureChecklists() {
  const [selectedCategory, setSelectedCategory] = useState<ProcedureCategory | "all">("all");
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [savedProgress, setSavedProgress] = useState<SavedProgress[]>([]);
  const [notes, setNotes] = useState("");
  const [showTimer, setShowTimer] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Load saved progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("procedureProgress");
    if (saved) {
      setSavedProgress(JSON.parse(saved));
    }
  }, []);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const filteredProcedures = PROCEDURES.filter(p => {
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleStep = (stepId: string) => {
    setCompletedSteps(prev => 
      prev.includes(stepId) 
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    );
  };

  const saveProgress = () => {
    if (!selectedProcedure) return;
    
    const progress: SavedProgress = {
      procedureId: selectedProcedure.id,
      completedSteps,
      startedAt: savedProgress.find(p => p.procedureId === selectedProcedure.id)?.startedAt || new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      notes,
    };

    const newSaved = [
      ...savedProgress.filter(p => p.procedureId !== selectedProcedure.id),
      progress,
    ];
    
    setSavedProgress(newSaved);
    localStorage.setItem("procedureProgress", JSON.stringify(newSaved));
  };

  const loadProgress = () => {
    if (!selectedProcedure) return;
    const saved = savedProgress.find(p => p.procedureId === selectedProcedure.id);
    if (saved) {
      setCompletedSteps(saved.completedSteps);
      setNotes(saved.notes);
    }
  };

  const resetProgress = () => {
    setCompletedSteps([]);
    setNotes("");
    setTimerSeconds(0);
    setTimerRunning(false);
  };

  const startProcedure = (procedure: Procedure) => {
    setSelectedProcedure(procedure);
    setCompletedSteps([]);
    setNotes("");
    setTimerSeconds(0);
    
    // Check for saved progress
    const saved = savedProgress.find(p => p.procedureId === procedure.id);
    if (saved) {
      setCompletedSteps(saved.completedSteps);
      setNotes(saved.notes);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = selectedProcedure 
    ? Math.round((completedSteps.length / selectedProcedure.steps.length) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-10">
        {!selectedProcedure ? (
          <>
            {/* Header */}
            <div className="mb-8">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                <ClipboardList size={14} />
                Clinical Skills
              </div>
              <h1 className="text-3xl font-bold text-slate-900">
                Nursing Procedure Checklists
              </h1>
              <p className="mt-2 text-slate-600">
                Step-by-step guides for essential nursing procedures. Use during clinical practice to ensure completeness and safety.
              </p>
            </div>

            {/* Search and Filter */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search procedures..."
                  className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="mb-6 flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  selectedCategory === "all"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-200"
                    : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                <ClipboardList size={16} />
                All Procedures
              </button>
              {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key as ProcedureCategory)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                    selectedCategory === key
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-200"
                      : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  <info.icon size={16} />
                  {info.label}
                </button>
              ))}
            </div>

            {/* Procedure Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProcedures.map((procedure) => {
                const catInfo = CATEGORY_INFO[procedure.category];
                const hasSavedProgress = savedProgress.some(p => p.procedureId === procedure.id);
                
                return (
                  <div
                    key={procedure.id}
                    className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => startProcedure(procedure)}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className={`rounded-xl bg-${catInfo.color}-100 p-2`}>
                        <catInfo.icon className={`h-5 w-5 text-${catInfo.color}-600`} />
                      </div>
                      {hasSavedProgress && (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                          In Progress
                        </span>
                      )}
                    </div>
                    
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">{procedure.title}</h3>
                    <p className="mb-3 text-sm text-slate-600 line-clamp-2">{procedure.description}</p>
                    
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <ClipboardList size={14} />
                        {procedure.steps.length} steps
                      </span>
                      <span className="flex items-center gap-1">
                        <Timer size={14} />
                        {procedure.estimatedTime}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Procedure Detail View */
          <>
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setSelectedProcedure(null)}
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
              >
                ← Back to Procedures
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTimer(!showTimer)}
                  className={`rounded-lg p-2 ${showTimer ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-600"}`}
                >
                  <Timer size={18} />
                </button>
                <button
                  onClick={saveProgress}
                  className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                >
                  <Save size={14} />
                  Save
                </button>
                <button
                  onClick={resetProgress}
                  className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
                >
                  <RotateCcw size={18} />
                </button>
              </div>
            </div>

            {/* Timer Bar */}
            {showTimer && (
              <div className="mb-4 flex items-center justify-between rounded-xl bg-purple-50 border border-purple-200 p-3">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-mono font-bold text-purple-700">{formatTime(timerSeconds)}</span>
                  <span className="text-sm text-purple-600">Est: {selectedProcedure.estimatedTime}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTimerRunning(!timerRunning)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                      timerRunning ? "bg-red-500 text-white" : "bg-purple-600 text-white"
                    }`}
                  >
                    {timerRunning ? "Pause" : "Start"}
                  </button>
                  <button
                    onClick={() => { setTimerSeconds(0); setTimerRunning(false); }}
                    className="rounded-lg border border-purple-300 px-4 py-2 text-sm font-semibold text-purple-700"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main Steps */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">{selectedProcedure.title}</h2>
                      <p className="text-sm text-slate-500">{selectedProcedure.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600">{progressPercentage}%</div>
                      <div className="text-xs text-slate-500">{completedSteps.length}/{selectedProcedure.steps.length} steps</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div 
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>

                  {/* Steps */}
                  <div className="space-y-3">
                    {selectedProcedure.steps.map((step, index) => (
                      <div
                        key={step.id}
                        onClick={() => toggleStep(step.id)}
                        className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                          completedSteps.includes(step.id)
                            ? "border-green-500 bg-green-50"
                            : step.critical
                              ? "border-red-200 bg-red-50"
                              : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                            completedSteps.includes(step.id)
                              ? "bg-green-500 text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}>
                            {completedSteps.includes(step.id) ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <span className="text-xs font-bold">{index + 1}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`font-medium ${
                                completedSteps.includes(step.id) ? "text-green-700 line-through" : "text-slate-800"
                              }`}>
                                {step.step}
                              </p>
                              {step.critical && (
                                <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                                  CRITICAL
                                </span>
                              )}
                            </div>
                            {step.tips && (
                              <p className="mt-1 text-xs text-slate-500 italic">💡 {step.tips}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-3 font-semibold text-slate-900">Your Notes</h3>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes during your practice session..."
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-4">
                {/* Equipment */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 font-semibold text-slate-900">Equipment Needed</h3>
                  <ul className="space-y-2">
                    {selectedProcedure.equipment.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Circle className="mt-1 h-3 w-3 flex-shrink-0 text-purple-500" />
                        <span className="text-slate-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Indications */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 font-semibold text-slate-900">Indications</h3>
                  <ul className="space-y-2">
                    {selectedProcedure.indications.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                        <span className="text-slate-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Contraindications */}
                {selectedProcedure.contraindications && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                    <h3 className="mb-3 flex items-center gap-2 font-semibold text-red-800">
                      <AlertTriangle size={16} />
                      Contraindications
                    </h3>
                    <ul className="space-y-2">
                      {selectedProcedure.contraindications.map((item, idx) => (
                        <li key={idx} className="text-sm text-red-700">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Documentation */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                    <BookOpen size={16} />
                    Documentation
                  </h3>
                  <ul className="space-y-1">
                    {selectedProcedure.documentation.map((item, idx) => (
                      <li key={idx} className="text-sm text-slate-700">• {item}</li>
                    ))}
                  </ul>
                </div>

                {/* Complications */}
                {selectedProcedure.complications && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                    <h3 className="mb-3 font-semibold text-amber-800">Possible Complications</h3>
                    <ul className="space-y-1">
                      {selectedProcedure.complications.map((item, idx) => (
                        <li key={idx} className="text-sm text-amber-700">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
    </div>
  );
}
