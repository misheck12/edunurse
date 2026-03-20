import React, { useState, useEffect, useCallback } from "react";
import {
  Stethoscope,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  AlertCircle,
  Award,
  Target,
  Volume2,
  Info,
  ClipboardList,
  User,
  Heart,
  ThermometerSun,
  Activity,
} from "lucide-react";

interface OSCEStation {
  id: string;
  title: string;
  duration: number; // in seconds
  category: string;
  scenario: string;
  patientInfo: {
    name: string;
    age: string;
    complaint: string;
    background?: string;
  };
  tasks: {
    task: string;
    points: number;
    hints?: string[];
    critical?: boolean;
  }[];
  keyPoints: string[];
  commonMistakes: string[];
}

const OSCE_STATIONS: OSCEStation[] = [
  {
    id: "vitals-1",
    title: "Vital Signs Assessment",
    duration: 420, // 7 minutes
    category: "Clinical Skills",
    scenario: "You are a student nurse on the medical ward. Your patient requires routine vital signs monitoring. Perform a complete vital signs assessment and document your findings.",
    patientInfo: {
      name: "Mrs. Mwape",
      age: "45 years",
      complaint: "Admitted for hypertension management",
      background: "Known hypertensive on treatment"
    },
    tasks: [
      { task: "Introduce yourself and explain the procedure", points: 5 },
      { task: "Confirm patient identity (check name band)", points: 5, critical: true },
      { task: "Obtain verbal consent", points: 5 },
      { task: "Ensure patient comfort and privacy", points: 5 },
      { task: "Perform hand hygiene", points: 5, critical: true },
      { task: "Measure temperature correctly (oral/axillary)", points: 10 },
      { task: "Count respiratory rate for 60 seconds", points: 10, hints: ["Count breaths without patient awareness", "Note rhythm and depth"] },
      { task: "Measure pulse rate and note rhythm", points: 10 },
      { task: "Measure blood pressure correctly", points: 15, hints: ["Correct cuff size", "Position arm at heart level", "Deflate slowly"], critical: true },
      { task: "Assess oxygen saturation if available", points: 5 },
      { task: "Document findings accurately", points: 10 },
      { task: "Report abnormal findings to supervisor", points: 10 },
      { task: "Thank patient and ensure comfort", points: 5 }
    ],
    keyPoints: [
      "Normal ranges: Temp 36.1-37.2°C, RR 12-20/min, Pulse 60-100/min, BP <140/90 mmHg",
      "Count respirations without patient's awareness for accuracy",
      "Use appropriate BP cuff size (cuff bladder should encircle 80% of arm)",
      "Allow patient to rest for 5 minutes before BP measurement",
      "Document all findings immediately to prevent errors"
    ],
    commonMistakes: [
      "Counting respiratory rate for only 15 seconds and multiplying",
      "Using wrong cuff size for blood pressure",
      "Not allowing patient to rest before BP measurement",
      "Forgetting to document or report abnormal findings",
      "Not verifying patient identity before procedure"
    ]
  },
  {
    id: "handwash-1",
    title: "Hand Hygiene Technique",
    duration: 300, // 5 minutes
    category: "Infection Control",
    scenario: "Demonstrate the proper technique for hand hygiene using both soap/water and alcohol-based hand rub (ABHR). Explain when each method is appropriate.",
    patientInfo: {
      name: "N/A",
      age: "N/A",
      complaint: "Skills demonstration station",
    },
    tasks: [
      { task: "Explain the 5 moments of hand hygiene", points: 10 },
      { task: "Remove watch and jewelry", points: 5 },
      { task: "Wet hands with water first", points: 5 },
      { task: "Apply adequate soap", points: 5 },
      { task: "Perform WHO 6-step technique correctly", points: 20, critical: true, hints: ["Palm to palm", "Back of hands", "Interlaced fingers", "Back of fingers", "Thumbs", "Fingertips"] },
      { task: "Rub for minimum 20 seconds", points: 10 },
      { task: "Rinse thoroughly under running water", points: 5 },
      { task: "Dry hands with single-use towel", points: 5 },
      { task: "Use towel to turn off tap", points: 5 },
      { task: "Demonstrate ABHR technique correctly", points: 15 },
      { task: "Explain when to use soap vs ABHR", points: 10 },
      { task: "State when ABHR is NOT appropriate", points: 5, hints: ["Visibly soiled hands", "After C. diff exposure", "After norovirus contact"] }
    ],
    keyPoints: [
      "5 Moments: Before patient contact, before aseptic procedure, after body fluid exposure, after patient contact, after touching patient surroundings",
      "ABHR takes 20-30 seconds, handwashing takes 40-60 seconds",
      "ABHR is NOT effective when hands are visibly soiled",
      "Nails should be short and clean, no artificial nails",
      "Hand hygiene is the single most effective way to prevent healthcare-associated infections"
    ],
    commonMistakes: [
      "Not rubbing for sufficient time",
      "Missing areas between fingers and around thumbs",
      "Touching tap with clean hands",
      "Using ABHR on visibly soiled hands",
      "Not covering all hand surfaces"
    ]
  },
  {
    id: "im-injection",
    title: "Intramuscular Injection",
    duration: 480, // 8 minutes
    category: "Medication Administration",
    scenario: "Mrs. Banda has been prescribed an IM injection. Prepare and administer the medication safely, following the 10 rights of medication administration.",
    patientInfo: {
      name: "Mrs. Banda",
      age: "35 years",
      complaint: "Post-operative pain",
      background: "No known drug allergies"
    },
    tasks: [
      { task: "Verify prescription (10 rights)", points: 10, critical: true, hints: ["Right patient, drug, dose, route, time, documentation, reason, response, form, to refuse"] },
      { task: "Check patient allergies", points: 5, critical: true },
      { task: "Introduce yourself and explain procedure", points: 5 },
      { task: "Obtain informed consent", points: 5 },
      { task: "Perform hand hygiene", points: 5, critical: true },
      { task: "Gather correct equipment", points: 5, hints: ["Correct syringe size", "Correct needle gauge", "Sharps container"] },
      { task: "Check medication (name, dose, expiry)", points: 10, critical: true },
      { task: "Prepare medication using aseptic technique", points: 10 },
      { task: "Select appropriate injection site", points: 10, hints: ["Ventrogluteal preferred", "Deltoid for small volumes", "Avoid sciatic nerve"] },
      { task: "Clean injection site correctly", points: 5 },
      { task: "Administer injection at 90-degree angle", points: 10 },
      { task: "Dispose of sharps safely immediately", points: 5, critical: true },
      { task: "Document administration and site", points: 10 },
      { task: "Monitor for adverse reactions", points: 5 }
    ],
    keyPoints: [
      "Ventrogluteal site is preferred for adults (safest, well-defined)",
      "Deltoid: max 1ml, Ventrogluteal: up to 3ml",
      "Z-track technique prevents medication leakage",
      "No need to aspirate for most IM injections (CDC/WHO guidance)",
      "Never recap needles - dispose immediately in sharps container"
    ],
    commonMistakes: [
      "Not checking patient allergies before administration",
      "Using dorsogluteal site (risk of sciatic nerve injury)",
      "Recapping needles (needlestick injury risk)",
      "Not documenting site of injection",
      "Forgetting to monitor patient after injection"
    ]
  },
  {
    id: "maternal-assessment",
    title: "Antenatal Assessment",
    duration: 600, // 10 minutes
    category: "Maternal Health",
    scenario: "Mrs. Phiri is attending her antenatal clinic visit at 32 weeks gestation. Perform a focused antenatal assessment including fundal height measurement and fetal heart rate monitoring.",
    patientInfo: {
      name: "Mrs. Phiri",
      age: "28 years",
      complaint: "Routine ANC visit at 32 weeks",
      background: "G2P1, previous normal delivery"
    },
    tasks: [
      { task: "Review antenatal card/records", points: 5 },
      { task: "Greet patient and ensure privacy", points: 5 },
      { task: "Take focused history (danger signs, fetal movements)", points: 10, hints: ["Bleeding", "Severe headache", "Blurred vision", "Reduced fetal movements"] },
      { task: "Perform hand hygiene", points: 5, critical: true },
      { task: "Measure blood pressure correctly", points: 10, critical: true },
      { task: "Check for edema (feet, hands, face)", points: 5 },
      { task: "Measure fundal height (symphysis-fundus)", points: 10, hints: ["From symphysis pubis to top of fundus", "Tape measure in cm", "Weeks = cm ± 2"] },
      { task: "Determine fetal lie and presentation", points: 10 },
      { task: "Auscultate fetal heart rate", points: 10, critical: true, hints: ["Use Pinard or Doppler", "Count for full minute", "Normal: 110-160 bpm"] },
      { task: "Test urine (protein, glucose)", points: 5 },
      { task: "Give appropriate health education", points: 10, hints: ["Danger signs", "Birth preparedness", "Nutrition", "Iron/folate compliance"] },
      { task: "Document all findings", points: 10 },
      { task: "Schedule next visit", points: 5 }
    ],
    keyPoints: [
      "Fundal height in cm should approximately equal gestational age in weeks (±2cm)",
      "Fetal movements should be felt by 20 weeks (primi) or 18 weeks (multi)",
      "BP ≥140/90 with proteinuria = preeclampsia - refer urgently",
      "Reduced fetal movements require further investigation",
      "All pregnant women should receive iron/folate supplementation"
    ],
    commonMistakes: [
      "Not asking about danger signs and fetal movements",
      "Measuring fundal height with full bladder (affects accuracy)",
      "Not counting FHR for full minute",
      "Forgetting to test urine for protein",
      "Not providing adequate health education"
    ]
  },
  {
    id: "newborn-resus",
    title: "Newborn Resuscitation",
    duration: 480, // 8 minutes
    category: "Neonatal Care",
    scenario: "You have just delivered a baby who is not breathing and is floppy. Demonstrate the initial steps of newborn resuscitation using the Helping Babies Breathe approach.",
    patientInfo: {
      name: "Baby (just delivered)",
      age: "Newborn",
      complaint: "Not crying, not breathing at birth",
    },
    tasks: [
      { task: "Call for help", points: 5, critical: true },
      { task: "Keep baby warm (dry thoroughly)", points: 10, critical: true },
      { task: "Position head in neutral position", points: 10, critical: true, hints: ["Slight extension", "Neck neither flexed nor extended"] },
      { task: "Clear airway if needed (suction mouth then nose)", points: 10 },
      { task: "Stimulate by rubbing back", points: 5 },
      { task: "Assess breathing within 'The Golden Minute'", points: 10, critical: true },
      { task: "If not breathing, start ventilation with bag-mask", points: 15, hints: ["40-60 breaths/min", "Watch for chest rise", "Use correct mask size"] },
      { task: "Perform MRSOPA if chest not rising", points: 10, hints: ["Mask adjustment, Reposition, Suction, Open mouth, Pressure increase, Airway alternative"] },
      { task: "Continue ventilation until baby breathes", points: 5 },
      { task: "Assess heart rate (umbilical cord pulse)", points: 10 },
      { task: "Start compressions if HR <60 after adequate ventilation", points: 5, hints: ["3 compressions: 1 breath", "Compress 1/3 of chest depth"] },
      { task: "Assign APGAR score at 1 and 5 minutes", points: 5 }
    ],
    keyPoints: [
      "The Golden Minute: Baby should be breathing by 1 minute of life",
      "Warmth is critical - hypothermia worsens outcomes",
      "Ventilation is the most important intervention in newborn resuscitation",
      "Most babies (90%) respond to drying, stimulation, and warmth",
      "Only about 1% of newborns require chest compressions"
    ],
    commonMistakes: [
      "Not drying and keeping baby warm",
      "Over-extending or flexing the neck",
      "Starting compressions before adequate ventilation",
      "Using adult-sized mask or incorrect ventilation rate",
      "Suctioning too aggressively or for too long"
    ]
  },
  {
    id: "hiv-counseling",
    title: "HIV Pre-Test Counseling",
    duration: 600, // 10 minutes
    category: "HIV/AIDS",
    scenario: "Mr. Mulenga has come to the clinic for HIV testing. Conduct pre-test counseling following national guidelines, ensuring informed consent.",
    patientInfo: {
      name: "Mr. Mulenga",
      age: "30 years",
      complaint: "Requesting HIV test",
      background: "First time testing"
    },
    tasks: [
      { task: "Ensure privacy and confidentiality", points: 10, critical: true },
      { task: "Greet and build rapport", points: 5 },
      { task: "Explain purpose of session", points: 5 },
      { task: "Assess client's knowledge about HIV", points: 5 },
      { task: "Explain what HIV/AIDS is", points: 5 },
      { task: "Explain modes of HIV transmission", points: 10, hints: ["Sexual contact", "Blood contact", "Mother to child"] },
      { task: "Explain window period", points: 10, hints: ["2-4 weeks to 3 months", "May need repeat test"] },
      { task: "Discuss prevention methods", points: 10, hints: ["Abstinence", "Being faithful", "Condom use", "PrEP"] },
      { task: "Explain testing process", points: 5 },
      { task: "Discuss meaning of results (positive/negative)", points: 10, hints: ["Positive: confirm with second test", "Negative: may be in window period"] },
      { task: "Assess risk factors sensitively", points: 10 },
      { task: "Explain benefits of knowing status", points: 5 },
      { task: "Obtain informed consent", points: 10, critical: true },
      { task: "Allow questions", points: 5 }
    ],
    keyPoints: [
      "Confidentiality is paramount - information shared only with consent",
      "Window period: time between infection and detectable antibodies",
      "Testing is voluntary - client can refuse",
      "U=U: Undetectable viral load = Untransmittable",
      "If positive, ART should be started immediately (Test and Treat)"
    ],
    commonMistakes: [
      "Testing without informed consent",
      "Conducting counseling in non-private area",
      "Being judgmental about risk behaviors",
      "Not explaining window period clearly",
      "Not allowing client to ask questions"
    ]
  },
];

export default function OSCEPractice() {
  const [selectedStation, setSelectedStation] = useState<OSCEStation | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());
  const [showResults, setShowResults] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState<{ stationId: string; score: number; date: string }[]>([]);
  const [showHints, setShowHints] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("oscePracticeHistory");
    if (saved) {
      setPracticeHistory(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            setShowResults(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const startStation = (station: OSCEStation) => {
    setSelectedStation(station);
    setTimeLeft(station.duration);
    setCompletedTasks(new Set());
    setIsRunning(false);
    setShowResults(false);
  };

  const toggleTask = (taskIndex: number) => {
    setCompletedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskIndex)) {
        newSet.delete(taskIndex);
      } else {
        newSet.add(taskIndex);
      }
      return newSet;
    });
  };

  const finishStation = () => {
    if (!selectedStation) return;
    setIsRunning(false);
    setShowResults(true);
    
    const totalPoints = selectedStation.tasks.reduce((sum, t) => sum + t.points, 0);
    const earnedPoints = selectedStation.tasks.reduce((sum, t, idx) => 
      sum + (completedTasks.has(idx) ? t.points : 0), 0);
    const score = Math.round((earnedPoints / totalPoints) * 100);
    
    const result = {
      stationId: selectedStation.id,
      score,
      date: new Date().toISOString(),
    };
    
    const newHistory = [result, ...practiceHistory].slice(0, 50);
    setPracticeHistory(newHistory);
    localStorage.setItem("oscePracticeHistory", JSON.stringify(newHistory));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Station Selection
  if (!selectedStation) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">
          <div className="mb-8">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
              <Stethoscope size={14} />
              OSCE Practice
            </div>
            <h1 className="text-3xl font-bold text-slate-900">
              OSCE Station Practice
            </h1>
            <p className="mt-2 text-slate-600">
              Practice clinical skills stations with timed scenarios and checklists
            </p>
          </div>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-teal-100 p-3">
                  <Activity className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Stations Practiced</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {new Set(practiceHistory.map(h => h.stationId)).size}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-green-100 p-3">
                  <Award className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Best Score</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {practiceHistory.length > 0 ? Math.max(...practiceHistory.map(h => h.score)) : 0}%
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-100 p-3">
                  <Target className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total Attempts</p>
                  <p className="text-2xl font-bold text-slate-900">{practiceHistory.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stations Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {OSCE_STATIONS.map((station) => {
              const attempts = practiceHistory.filter(h => h.stationId === station.id);
              const bestScore = attempts.length > 0 ? Math.max(...attempts.map(h => h.score)) : null;
              
              return (
                <div
                  key={station.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 hover:border-teal-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => startStation(station)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-700">
                        {station.category}
                      </span>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">{station.title}</h3>
                      <p className="mt-1 text-sm text-slate-500 line-clamp-2">{station.scenario}</p>
                      <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {Math.floor(station.duration / 60)} min
                        </span>
                        <span className="flex items-center gap-1">
                          <ClipboardList size={14} />
                          {station.tasks.length} tasks
                        </span>
                      </div>
                    </div>
                    {bestScore !== null && (
                      <div className={`rounded-full px-3 py-1 text-sm font-bold ${
                        bestScore >= 70 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {bestScore}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
    );
  }

  // Results Screen
  if (showResults) {
    const totalPoints = selectedStation.tasks.reduce((sum, t) => sum + t.points, 0);
    const earnedPoints = selectedStation.tasks.reduce((sum, t, idx) => 
      sum + (completedTasks.has(idx) ? t.points : 0), 0);
    const score = Math.round((earnedPoints / totalPoints) * 100);
    const criticalMissed = selectedStation.tasks.filter((t, idx) => t.critical && !completedTasks.has(idx));
    const passed = score >= 50 && criticalMissed.length === 0;

    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 md:p-10">
          {/* Score Card */}
          <div className={`rounded-xl border-2 p-8 text-center ${
            passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
          }`}>
            <div className={`mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full ${
              passed ? "bg-green-100" : "bg-red-100"
            }`}>
              {passed ? (
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              ) : (
                <XCircle className="h-10 w-10 text-red-600" />
              )}
            </div>
            <h2 className={`text-3xl font-bold ${passed ? "text-green-800" : "text-red-800"}`}>
              {passed ? "Station Passed!" : "More Practice Needed"}
            </h2>
            <p className="mt-2 text-slate-600">{selectedStation.title}</p>
            <div className="mt-6 flex justify-center gap-8">
              <div>
                <p className={`text-4xl font-bold ${passed ? "text-green-600" : "text-red-600"}`}>{score}%</p>
                <p className="text-sm text-slate-500">Score</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-slate-700">{earnedPoints}/{totalPoints}</p>
                <p className="text-sm text-slate-500">Points</p>
              </div>
            </div>
            {criticalMissed.length > 0 && (
              <div className="mt-4 rounded-xl bg-red-100 p-3">
                <p className="text-sm font-semibold text-red-800">
                  <AlertCircle className="inline mr-1 h-4 w-4" />
                  Critical tasks missed: {criticalMissed.map(t => t.task).join(", ")}
                </p>
              </div>
            )}
          </div>

          {/* Task Review */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Task Review</h3>
            <div className="space-y-2">
              {selectedStation.tasks.map((task, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center justify-between rounded-lg p-3 ${
                    completedTasks.has(idx) ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {completedTasks.has(idx) ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="text-sm text-slate-700">
                      {task.task}
                      {task.critical && (
                        <span className="ml-2 rounded bg-red-200 px-1 text-xs text-red-700">Critical</span>
                      )}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-600">{task.points} pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Learning Points */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Key Learning Points</h3>
            <ul className="space-y-2">
              {selectedStation.keyPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-600" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Common Mistakes */}
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-amber-800">Common Mistakes to Avoid</h3>
            <ul className="space-y-2">
              {selectedStation.commonMistakes.map((mistake, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  {mistake}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-4">
            <button
              onClick={() => startStation(selectedStation)}
              className="flex-1 rounded-xl border border-teal-300 bg-white px-4 py-3 font-semibold text-teal-700 hover:bg-teal-50"
            >
              <RotateCcw className="mr-2 inline h-4 w-4" />
              Try Again
            </button>
            <button
              onClick={() => setSelectedStation(null)}
              className="flex-1 rounded-xl bg-teal-600 px-4 py-3 font-semibold text-white hover:bg-teal-700"
            >
              All Stations
            </button>
          </div>
      </div>
    );
  }

  // Practice Screen
  const totalPoints = selectedStation.tasks.reduce((sum, t) => sum + t.points, 0);
  const earnedPoints = selectedStation.tasks.reduce((sum, t, idx) => 
    sum + (completedTasks.has(idx) ? t.points : 0), 0);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 md:p-10">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-700">
              {selectedStation.category}
            </span>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{selectedStation.title}</h1>
          </div>
          <div className={`flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xl font-bold ${
            timeLeft < 60 ? "bg-red-100 text-red-700 animate-pulse" : 
            timeLeft < 120 ? "bg-amber-100 text-amber-700" : 
            "bg-slate-100 text-slate-700"
          }`}>
            <Clock size={20} />
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Timer Controls */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white ${
              isRunning ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-600 hover:bg-teal-700"
            }`}
          >
            {isRunning ? <Pause size={20} /> : <Play size={20} />}
            {isRunning ? "Pause" : "Start Timer"}
          </button>
          <button
            onClick={() => {
              setTimeLeft(selectedStation.duration);
              setIsRunning(false);
              setCompletedTasks(new Set());
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <div className="ml-auto text-sm text-slate-600">
            Progress: {earnedPoints}/{totalPoints} points
          </div>
        </div>

        {/* Scenario */}
        <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-5">
          <h3 className="mb-2 font-semibold text-teal-800">Scenario</h3>
          <p className="text-sm text-teal-900">{selectedStation.scenario}</p>
          {selectedStation.patientInfo.name !== "N/A" && (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <div className="rounded-lg bg-white/50 p-2">
                <span className="text-xs text-teal-600">Patient:</span>
                <p className="font-semibold text-teal-900">{selectedStation.patientInfo.name}, {selectedStation.patientInfo.age}</p>
              </div>
              <div className="rounded-lg bg-white/50 p-2">
                <span className="text-xs text-teal-600">Complaint:</span>
                <p className="font-semibold text-teal-900">{selectedStation.patientInfo.complaint}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tasks Checklist */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Tasks Checklist</h3>
          <div className="space-y-2">
            {selectedStation.tasks.map((task, idx) => (
              <div key={idx}>
                <div
                  onClick={() => toggleTask(idx)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-4 transition-all ${
                    completedTasks.has(idx) 
                      ? "border-green-500 bg-green-50" 
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      completedTasks.has(idx) ? "bg-green-500" : "bg-slate-200"
                    }`}>
                      {completedTasks.has(idx) && (
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div>
                      <span className={`text-sm ${completedTasks.has(idx) ? "text-green-800" : "text-slate-700"}`}>
                        {task.task}
                      </span>
                      {task.critical && (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                          CRITICAL
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.hints && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowHints(showHints === idx ? null : idx);
                        }}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-teal-600"
                      >
                        <Info size={16} />
                      </button>
                    )}
                    <span className="text-sm font-semibold text-slate-500">{task.points}pts</span>
                  </div>
                </div>
                {showHints === idx && task.hints && (
                  <div className="ml-9 mt-2 rounded-lg bg-teal-50 p-3">
                    <p className="text-xs font-semibold text-teal-700 mb-1">Hints:</p>
                    <ul className="space-y-1">
                      {task.hints.map((hint, hIdx) => (
                        <li key={hIdx} className="text-xs text-teal-800">• {hint}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Finish Button */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => setSelectedStation(null)}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Exit Station
          </button>
          <button
            onClick={finishStation}
            className="flex-1 rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white hover:bg-teal-700"
          >
            Finish & View Results
          </button>
        </div>
    </div>
  );
}
