import React, { useState, useEffect } from "react";
import {
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Heart,
  Activity,
  Thermometer,
  Baby,
  User,
  Brain,
  Droplets,
  Shield,
  RefreshCw,
  Award,
  MessageCircle,
  XCircle,
  HelpCircle,
  BookOpen,
  Timer,
  Pause,
  Play,
} from "lucide-react";

type CaseCategory = "maternal" | "pediatric" | "medical" | "emergency" | "infectious";
type DifficultyLevel = "easy" | "moderate" | "challenging";

interface VitalSigns {
  bp?: string;
  pulse?: number;
  temp?: number;
  rr?: number;
  spo2?: number;
  gcs?: number;
}

interface ClinicalCase {
  id: string;
  title: string;
  category: CaseCategory;
  difficulty: DifficultyLevel;
  patientInfo: {
    name: string;
    age: string;
    sex: string;
    location: string;
  };
  presentingComplaint: string;
  history: string;
  examination: string;
  vitalSigns: VitalSigns;
  investigations?: string[];
  questions: {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    learningPoint: string;
  }[];
  finalDiagnosis: string;
  managementPlan: string[];
  keyLearningPoints: string[];
}

const CLINICAL_CASES: ClinicalCase[] = [
  {
    id: "1",
    title: "Severe Malaria in a Child",
    category: "pediatric",
    difficulty: "moderate",
    patientInfo: {
      name: "Bupe",
      age: "4 years",
      sex: "Female",
      location: "Chipata District Hospital",
    },
    presentingComplaint: "High fever for 3 days, reduced consciousness since morning",
    history: "The child has had fever for 3 days with poor appetite. Mother gave Panadol at home. This morning the child became drowsy and stopped talking. No convulsions witnessed. Lives in a malaria endemic area. Immunizations up to date. Last deworming 2 months ago.",
    examination: "Drowsy, responds to pain only. Pale conjunctivae. No neck stiffness. Heart sounds normal. Chest clear. Abdomen soft, spleen palpable 3cm below costal margin. No skin rash. Capillary refill 3 seconds.",
    vitalSigns: {
      bp: "80/50",
      pulse: 140,
      temp: 39.8,
      rr: 44,
      spo2: 94,
      gcs: 10,
    },
    investigations: [
      "mRDT: Positive for P. falciparum",
      "Hb: 5.2 g/dL",
      "Blood glucose: 2.8 mmol/L",
      "Lumbar puncture: Clear CSF, normal cells",
    ],
    questions: [
      {
        id: "q1",
        question: "What is the most likely diagnosis?",
        options: [
          "Uncomplicated malaria",
          "Severe malaria with complications",
          "Bacterial meningitis",
          "Viral encephalitis",
        ],
        correctAnswer: 1,
        explanation: "This child has severe malaria with multiple danger signs: impaired consciousness (GCS 10), severe anemia (Hb 5.2), hypoglycemia (glucose 2.8), and tachypnea. The positive mRDT confirms malaria.",
        learningPoint: "Severe malaria criteria include: impaired consciousness, multiple convulsions, prostration, respiratory distress, shock, jaundice, hemoglobinuria, severe anemia (Hb<5g/dL), hypoglycemia (<2.2mmol/L), and acidosis.",
      },
      {
        id: "q2",
        question: "What is the FIRST priority in management?",
        options: [
          "Give IV Artesunate",
          "Start IV antibiotics",
          "Correct hypoglycemia with 10% dextrose",
          "Give blood transfusion",
        ],
        correctAnswer: 2,
        explanation: "Hypoglycemia is immediately life-threatening and must be corrected first. Give 5ml/kg of 10% dextrose IV push, then recheck in 30 minutes. Hypoglycemia can cause brain damage and death if not promptly treated.",
        learningPoint: "In severe malaria, always check blood glucose. Hypoglycemia is common especially in children and pregnant women. Treat with 10% dextrose 5ml/kg IV bolus.",
      },
      {
        id: "q3",
        question: "Which antimalarial is recommended for severe malaria?",
        options: [
          "Oral Artemether-Lumefantrine (Coartem)",
          "IV Quinine",
          "IV/IM Artesunate",
          "Sulfadoxine-Pyrimethamine (Fansidar)",
        ],
        correctAnswer: 2,
        explanation: "IV or IM Artesunate is the first-line treatment for severe malaria in Zambia (and globally per WHO guidelines). It has faster parasite clearance and lower mortality compared to quinine.",
        learningPoint: "Artesunate dosing: 2.4mg/kg IV/IM at 0, 12, and 24 hours, then daily until patient can take oral therapy. Complete treatment with full course of ACT.",
      },
      {
        id: "q4",
        question: "When should blood transfusion be given in this case?",
        options: [
          "Immediately - Hb is below 5g/dL",
          "Only if Hb drops below 4g/dL",
          "After starting antimalarials",
          "Not needed if patient is stable",
        ],
        correctAnswer: 0,
        explanation: "Transfusion is indicated when Hb <5g/dL (or Hb <7g/dL with respiratory distress). This child has Hb 5.2 g/dL with signs of decompensation (tachycardia, tachypnea). Transfuse 10-20ml/kg packed cells slowly.",
        learningPoint: "Transfusion thresholds in children: Hb <4g/dL - always transfuse; Hb 4-5g/dL - transfuse if symptomatic; Hb 5-7g/dL - transfuse if respiratory distress or shock.",
      },
    ],
    finalDiagnosis: "Severe falciparum malaria with cerebral involvement, severe anemia, and hypoglycemia",
    managementPlan: [
      "Correct hypoglycemia: 10% dextrose 5ml/kg IV bolus, then maintenance",
      "IV Artesunate 2.4mg/kg stat, repeat at 12h and 24h",
      "Blood transfusion: 10ml/kg packed cells over 3-4 hours",
      "Maintain airway, position semi-prone",
      "Monitor GCS, vitals, and blood glucose hourly",
      "Once able to take orally, complete with 3 days of ACT",
      "Counsel mother on malaria prevention and ITN use",
    ],
    keyLearningPoints: [
      "Severe malaria is a medical emergency requiring immediate treatment",
      "Always check and correct hypoglycemia first",
      "Artesunate is preferred over quinine for severe malaria",
      "Severe anemia (Hb<5g/dL) requires transfusion",
      "Monitor for complications: seizures, respiratory failure, renal failure",
    ],
  },
  {
    id: "2",
    title: "Postpartum Hemorrhage",
    category: "maternal",
    difficulty: "challenging",
    patientInfo: {
      name: "Grace Banda",
      age: "28 years",
      sex: "Female",
      location: "Choma General Hospital",
    },
    presentingComplaint: "Heavy vaginal bleeding 30 minutes after delivery",
    history: "G4P3+0, just delivered a live baby boy (3.8kg) 30 minutes ago. Spontaneous vaginal delivery, no episiotomy. Placenta delivered complete 10 minutes after baby. Now with heavy vaginal bleeding soaking multiple pads. Previous deliveries were normal. No known medical conditions.",
    examination: "Anxious, pale, cold and clammy. Uterus feels soft and boggy at umbilicus level. Vagina: Active bright red bleeding, no obvious tears. Placenta checked - appears complete. Estimated blood loss: 800ml and ongoing.",
    vitalSigns: {
      bp: "90/60",
      pulse: 120,
      temp: 37.0,
      rr: 24,
    },
    questions: [
      {
        id: "q1",
        question: "What is the most likely cause of this PPH?",
        options: [
          "Retained placental fragments",
          "Uterine atony",
          "Genital tract trauma",
          "Coagulation disorder",
        ],
        correctAnswer: 1,
        explanation: "The soft, boggy uterus at umbilicus level indicates uterine atony - the most common cause of PPH (70-80% of cases). The '4 Ts' of PPH: Tone, Tissue, Trauma, Thrombin. A well-contracted uterus should be firm and at or below umbilicus.",
        learningPoint: "Uterine atony is the #1 cause of PPH. Risk factors include: prolonged labor, overdistended uterus (twins, big baby, polyhydramnios), multiparity, and uterine infection.",
      },
      {
        id: "q2",
        question: "What is your FIRST action?",
        options: [
          "Call for help and prepare blood",
          "Rub up the uterus (uterine massage)",
          "Give IV oxytocin",
          "Prepare for theatre",
        ],
        correctAnswer: 1,
        explanation: "The immediate first action is bimanual uterine massage to stimulate contraction. Place one hand on the abdomen and rub the fundus firmly in a circular motion. This is faster than waiting for drugs and can be life-saving.",
        learningPoint: "HEMOSTAT approach: Help, Evaluate (ABC), Massage uterus, Oxytocin, Shift to theatre if needed, Tamponade, Apply compression sutures, Transfer.",
      },
      {
        id: "q3",
        question: "Which uterotonic regimen is recommended?",
        options: [
          "Oxytocin 10 IU IV only",
          "Oxytocin 10 IU IV + Ergometrine 0.5mg IM",
          "Misoprostol 800mcg sublingual only",
          "Oxytocin 40 IU in 1L NS running fast",
        ],
        correctAnswer: 1,
        explanation: "For PPH due to atony, give Oxytocin 10 IU IV/IM PLUS Ergometrine 0.5mg IM (if no hypertension). If still bleeding, add Misoprostol 800mcg SL. Oxytocin infusion (40 IU in 1L) can run alongside for sustained effect.",
        learningPoint: "Uterotonic ladder: 1st Oxytocin, 2nd Ergometrine (avoid in hypertension), 3rd Misoprostol, 4th Tranexamic acid 1g IV. Use them in combination.",
      },
      {
        id: "q4",
        question: "The bleeding continues. What non-surgical intervention should you try?",
        options: [
          "Apply uterine compression sutures",
          "Insert a Bakri balloon or condom catheter tamponade",
          "Perform hysterectomy",
          "Ligate uterine arteries",
        ],
        correctAnswer: 1,
        explanation: "Uterine balloon tamponade (using Bakri balloon or improvised condom catheter) is an effective bridge to surgery or definitive treatment. Inflate with 300-500ml saline. This can control bleeding while arranging surgery.",
        learningPoint: "Condom catheter tamponade: Tie a condom to a Foley catheter, insert into uterus, inflate with 300-500ml saline, apply traction. This simple technique saves lives in low-resource settings.",
      },
    ],
    finalDiagnosis: "Primary postpartum hemorrhage due to uterine atony",
    managementPlan: [
      "Call for help - activate emergency response team",
      "Continuous uterine massage",
      "Two large-bore IV cannulas, start crystalloids rapidly",
      "Oxytocin 10 IU IV + Ergometrine 0.5mg IM",
      "Misoprostol 800mcg sublingual",
      "Tranexamic acid 1g IV over 10 minutes",
      "Insert Foley catheter to monitor urine output",
      "Cross-match 4 units blood, transfuse if Hb<7 or ongoing loss",
      "If medical management fails: balloon tamponade → surgical options",
      "Document blood loss, interventions, and outcomes",
    ],
    keyLearningPoints: [
      "PPH is defined as blood loss ≥500ml after vaginal delivery",
      "Uterine atony is the most common cause - check tone immediately",
      "Bimanual uterine massage should start immediately",
      "Use multiple uterotonics in combination",
      "Balloon tamponade is an effective non-surgical option",
      "Early recognition and rapid response save lives",
    ],
  },
  {
    id: "3",
    title: "Adult HIV Patient with TB Symptoms",
    category: "infectious",
    difficulty: "moderate",
    patientInfo: {
      name: "James Phiri",
      age: "35 years",
      sex: "Male",
      location: "Kabwe Central Hospital",
    },
    presentingComplaint: "Cough for 3 weeks, night sweats, weight loss",
    history: "Known HIV positive for 2 years, on ART (TDF/3TC/DTG) with good adherence. CD4 count 6 months ago was 180 cells/μL. Now presents with productive cough for 3 weeks, night sweats, and has lost 8kg over 2 months. No hemoptysis. Smokes occasionally. No TB contact identified.",
    examination: "Wasted, BMI 17. Oral thrush present. Cervical lymphadenopathy (non-tender, 2cm). Chest: reduced air entry right upper zone, bronchial breathing. No hepatosplenomegaly.",
    vitalSigns: {
      bp: "110/70",
      pulse: 88,
      temp: 38.2,
      rr: 22,
      spo2: 94,
    },
    investigations: [
      "GeneXpert MTB/RIF: MTB detected, Rifampicin resistance NOT detected",
      "Chest X-ray: Right upper lobe infiltrates with possible cavitation",
      "CD4: 95 cells/μL",
      "Viral load: 250 copies/ml (previously undetectable)",
    ],
    questions: [
      {
        id: "q1",
        question: "What is the diagnosis?",
        options: [
          "Community-acquired pneumonia",
          "Pulmonary tuberculosis with HIV co-infection",
          "Pneumocystis jirovecii pneumonia (PCP)",
          "Kaposi sarcoma lung involvement",
        ],
        correctAnswer: 1,
        explanation: "This is pulmonary TB confirmed by GeneXpert in an HIV-positive patient. Classic presentation: >2 weeks cough, night sweats, weight loss, upper lobe infiltrates on CXR. TB is the leading cause of death in HIV patients globally.",
        learningPoint: "In Zambia, always suspect TB in HIV patients with cough >2 weeks. GeneXpert is the preferred first test - it detects TB and rifampicin resistance in 2 hours.",
      },
      {
        id: "q2",
        question: "What is the recommended TB treatment regimen?",
        options: [
          "2 months RHZE followed by 4 months RH",
          "2 months RHZE followed by 10 months RH",
          "6 months of Rifampicin only",
          "2 months RHZE followed by 4 months RHE",
        ],
        correctAnswer: 0,
        explanation: "Standard TB treatment in Zambia: 2 months intensive phase (RHZE: Rifampicin, Isoniazid, Pyrazinamide, Ethambutol) followed by 4 months continuation phase (RH). Total 6 months for drug-sensitive TB.",
        learningPoint: "TB treatment phases: Intensive (2 months) - 4 drugs to rapidly kill bacteria; Continuation (4 months) - 2 drugs to eliminate remaining bacteria. DOT (Directly Observed Therapy) improves adherence.",
      },
      {
        id: "q3",
        question: "Should ART be modified, and what prophylaxis is needed?",
        options: [
          "Stop ART and restart after TB treatment",
          "Continue current ART, add Cotrimoxazole prophylaxis",
          "Change to ART without integrase inhibitor",
          "Continue ART, no changes needed",
        ],
        correctAnswer: 1,
        explanation: "Continue ART - DTG (dolutegravir) is compatible with rifampicin but needs dose adjustment (50mg BD instead of OD). Add Cotrimoxazole 960mg daily as prophylaxis (required for all HIV/TB co-infected patients). Also add Pyridoxine 25mg to prevent INH-induced neuropathy.",
        learningPoint: "ART + TB treatment: Never stop ART. DTG dose doubles with rifampicin. EFV doesn't need adjustment. Add Cotrimoxazole 960mg OD + Pyridoxine 25mg OD.",
      },
      {
        id: "q4",
        question: "The patient improves but develops jaundice at week 3. Which drug is most likely responsible?",
        options: [
          "Isoniazid",
          "Pyrazinamide",
          "Ethambutol",
          "Dolutegravir",
        ],
        correctAnswer: 1,
        explanation: "Pyrazinamide is the most hepatotoxic TB drug, especially in the first 2 months. Isoniazid can also cause hepatitis. Management: Stop all TB drugs, check LFTs, restart one drug at a time when LFTs improve.",
        learningPoint: "Monitor for drug-induced hepatitis: jaundice, nausea, abdominal pain, dark urine. Check LFTs if symptomatic. Stop TB meds if ALT >5x normal or >3x with symptoms.",
      },
    ],
    finalDiagnosis: "Pulmonary tuberculosis with HIV co-infection (WHO Stage 3)",
    managementPlan: [
      "Start TB treatment: 2RHZE/4RH (fixed-dose combination)",
      "Adjust DTG to 50mg twice daily while on Rifampicin",
      "Add Cotrimoxazole 960mg once daily",
      "Add Pyridoxine 25mg daily",
      "Baseline LFTs, check at 2 weeks and if symptomatic",
      "Nutritional support and counseling",
      "Contact tracing for household members",
      "Monthly follow-up with sputum at month 2 and 5",
      "Encourage adherence with DOTS",
    ],
    keyLearningPoints: [
      "TB is the most common opportunistic infection in HIV patients",
      "GeneXpert is first-line test for TB diagnosis",
      "Standard TB treatment is 2RHZE/4RH (6 months total)",
      "Continue ART during TB treatment - adjust DTG dose",
      "Add Cotrimoxazole and Pyridoxine prophylaxis",
      "Monitor for hepatotoxicity, especially in first 2 months",
    ],
  },
  {
    id: "4",
    title: "Neonatal Sepsis",
    category: "pediatric",
    difficulty: "challenging",
    patientInfo: {
      name: "Baby Mwila",
      age: "5 days old",
      sex: "Male",
      location: "Livingstone Central Hospital",
    },
    presentingComplaint: "Not breastfeeding, feels cold, lethargic",
    history: "Born at home 5 days ago to a 19-year-old G1P1+0 mother. Normal vaginal delivery, cried immediately. Birthweight estimated 2.5kg. Was breastfeeding well until yesterday. Mother noticed baby became 'floppy', stopped feeding, and felt cold. No history of convulsions. Mother had fever during labor but delivered before reaching hospital. Cord stump looks red.",
    examination: "Lethargic, hypotonic, poor cry. Hypothermic. Anterior fontanelle normal. Umbilical stump erythematous with purulent discharge. Chest: grunting respirations, subcostal retractions. Abdomen distended, reduced bowel sounds. Skin mottled.",
    vitalSigns: {
      pulse: 180,
      temp: 35.8,
      rr: 68,
      spo2: 88,
    },
    questions: [
      {
        id: "q1",
        question: "What is the most likely diagnosis?",
        options: [
          "Neonatal jaundice",
          "Late-onset neonatal sepsis",
          "Early-onset neonatal sepsis",
          "Neonatal tetanus",
        ],
        correctAnswer: 1,
        explanation: "This is late-onset neonatal sepsis (occurring after 72 hours of life). Signs include: lethargy, poor feeding, temperature instability (hypothermia or fever), respiratory distress, and abdominal distension. The infected umbilical stump (omphalitis) is the likely source.",
        learningPoint: "Early-onset sepsis (<72 hours) is usually from maternal sources (GBS, E. coli). Late-onset sepsis (>72 hours) is often from environmental sources or procedures. Omphalitis is a common portal of entry.",
      },
      {
        id: "q2",
        question: "What are the danger signs you identified in this neonate?",
        options: [
          "Only fever",
          "Not feeding, lethargy, hypothermia, respiratory distress",
          "Only jaundice",
          "Only umbilical discharge",
        ],
        correctAnswer: 1,
        explanation: "Multiple danger signs: not feeding (or poor feeding), lethargy/floppiness, hypothermia (<36.5°C), tachypnea with grunting/retractions, SpO2 <90%, abdominal distension. Any one of these requires urgent treatment.",
        learningPoint: "IMCI danger signs in young infants: not feeding, convulsions, movement only when stimulated, fast breathing (≥60), severe chest indrawing, temperature <35.5°C or ≥37.5°C.",
      },
      {
        id: "q3",
        question: "What is the first-line antibiotic regimen for neonatal sepsis?",
        options: [
          "Oral Amoxicillin only",
          "IV Ampicillin + Gentamicin",
          "IV Ceftriaxone only",
          "IV Metronidazole only",
        ],
        correctAnswer: 1,
        explanation: "First-line for neonatal sepsis in Zambia: IV Ampicillin (50mg/kg/dose) + Gentamicin (5mg/kg/dose OD for term, 4mg/kg for preterm). This covers common organisms: GBS, E. coli, Listeria, Staphylococcus. Give for 7-10 days.",
        learningPoint: "Neonatal sepsis antibiotic dosing: Ampicillin 50mg/kg 12-hourly (≤7 days) or 8-hourly (>7 days). Gentamicin 5mg/kg once daily. If meningitis suspected, add cefotaxime or increase duration.",
      },
      {
        id: "q4",
        question: "What supportive care measures are essential?",
        options: [
          "Antibiotics only",
          "Warmth, oxygen, IV fluids, glucose monitoring, NPO",
          "Immediate surgery for omphalitis",
          "Phototherapy",
        ],
        correctAnswer: 1,
        explanation: "Supportive care is crucial: Maintain warmth (kangaroo care or incubator), give O2 to keep SpO2 >90%, IV fluids (10% dextrose with electrolytes), check blood glucose frequently, keep NPO initially, and involve mother for kangaroo care when stable.",
        learningPoint: "Sick neonates lose heat rapidly - hypothermia increases mortality. Maintain temperature 36.5-37.5°C. Hypoglycemia is common - check glucose and give 10% dextrose.",
      },
    ],
    finalDiagnosis: "Late-onset neonatal sepsis secondary to omphalitis",
    managementPlan: [
      "Thermal care: Kangaroo mother care or incubator to maintain temp 36.5-37.5°C",
      "Oxygen via nasal prongs to keep SpO2 >92%",
      "IV access: 10% dextrose initially, then maintenance fluids",
      "IV Ampicillin 50mg/kg 12-hourly + Gentamicin 5mg/kg daily for 10 days",
      "Local umbilical care: clean with chlorhexidine, keep dry",
      "Monitor glucose 6-hourly, treat hypoglycemia",
      "NPO initially, start expressed breast milk when stable",
      "Blood culture (if available) before antibiotics",
      "Monitor for complications: meningitis, DIC, NEC",
    ],
    keyLearningPoints: [
      "Neonatal sepsis can present with subtle, non-specific signs",
      "Hypothermia is as concerning as fever in neonates",
      "Omphalitis is a serious infection requiring systemic antibiotics",
      "First-line antibiotics: Ampicillin + Gentamicin",
      "Supportive care (warmth, oxygen, glucose) is as important as antibiotics",
      "Prevention: clean delivery, hygienic cord care, exclusive breastfeeding",
    ],
  },
];

export default function ClinicalCases() {
  const [selectedCategory, setSelectedCategory] = useState<CaseCategory | "all">("all");
  const [selectedCase, setSelectedCase] = useState<ClinicalCase | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [caseCompleted, setCaseCompleted] = useState(false);
  const [completedCases, setCompletedCases] = useState<string[]>([]);
  
  // Timer state
  const [caseTimer, setCaseTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [questionTimes, setQuestionTimes] = useState<number[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(0);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning && selectedCase && !caseCompleted) {
      interval = setInterval(() => {
        setCaseTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, selectedCase, caseCompleted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const categories = [
    { id: "all", label: "All Cases", icon: Stethoscope },
    { id: "maternal", label: "Maternal Health", icon: Baby },
    { id: "pediatric", label: "Pediatric", icon: Heart },
    { id: "medical", label: "Medical", icon: Activity },
    { id: "infectious", label: "Infectious Disease", icon: Shield },
    { id: "emergency", label: "Emergency", icon: AlertTriangle },
  ];

  const filteredCases = selectedCategory === "all" 
    ? CLINICAL_CASES 
    : CLINICAL_CASES.filter(c => c.category === selectedCategory);

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answerIndex }));
    setShowExplanation(true);
    // Track time spent on this question
    const timeOnQuestion = Math.floor((Date.now() - questionStartTime) / 1000);
    setQuestionTimes(prev => [...prev, timeOnQuestion]);
  };

  const nextQuestion = () => {
    if (selectedCase && currentQuestionIndex < selectedCase.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setShowExplanation(false);
      setQuestionStartTime(Date.now());
    } else {
      setCaseCompleted(true);
      setTimerRunning(false);
      if (selectedCase && !completedCases.includes(selectedCase.id)) {
        setCompletedCases(prev => [...prev, selectedCase.id]);
      }
    }
  };

  const startCase = (caseItem: ClinicalCase) => {
    setSelectedCase(caseItem);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowExplanation(false);
    setCaseCompleted(false);
    setCaseTimer(0);
    setQuestionTimes([]);
    setQuestionStartTime(Date.now());
    setTimerRunning(true);
  };

  const resetCase = () => {
    setSelectedCase(null);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setCaseCompleted(false);
    setCaseTimer(0);
    setTimerRunning(false);
    setQuestionTimes([]);
  };

  const currentQuestion = selectedCase?.questions[currentQuestionIndex];
  const isCorrect = currentQuestion 
    ? selectedAnswers[currentQuestion.id] === currentQuestion.correctAnswer 
    : false;

  const correctAnswersCount = selectedCase
    ? selectedCase.questions.filter(q => selectedAnswers[q.id] === q.correctAnswer).length
    : 0;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-10">
        {!selectedCase ? (
          <>
            {/* Header */}
            <div className="mb-8">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                <Stethoscope size={14} />
                Clinical Cases
              </div>
              <h1 className="text-3xl font-bold text-slate-900">
                Clinical Case Simulator
              </h1>
              <p className="mt-2 text-slate-600">
                Practice clinical reasoning with realistic Zambian patient scenarios. 
                Work through cases from maternal health, pediatrics, infectious diseases, and emergencies.
              </p>
            </div>

            {/* Category Filter */}
            <div className="mb-6 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id as CaseCategory | "all")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                    selectedCategory === cat.id
                      ? "bg-red-600 text-white shadow-lg shadow-red-200"
                      : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  <cat.icon size={16} />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
                <BookOpen className="mx-auto mb-2 h-6 w-6 text-blue-500" />
                <p className="text-2xl font-bold text-slate-900">{CLINICAL_CASES.length}</p>
                <p className="text-xs text-slate-500">Total Cases</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-500" />
                <p className="text-2xl font-bold text-slate-900">{completedCases.length}</p>
                <p className="text-xs text-slate-500">Completed</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
                <Award className="mx-auto mb-2 h-6 w-6 text-amber-500" />
                <p className="text-2xl font-bold text-slate-900">
                  {completedCases.length > 0 ? Math.round((completedCases.length / CLINICAL_CASES.length) * 100) : 0}%
                </p>
                <p className="text-xs text-slate-500">Progress</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
                <Brain className="mx-auto mb-2 h-6 w-6 text-purple-500" />
                <p className="text-2xl font-bold text-slate-900">{CLINICAL_CASES.length - completedCases.length}</p>
                <p className="text-xs text-slate-500">Remaining</p>
              </div>
            </div>

            {/* Case Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              {filteredCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          caseItem.category === "maternal" ? "bg-pink-100 text-pink-700" :
                          caseItem.category === "pediatric" ? "bg-blue-100 text-blue-700" :
                          caseItem.category === "infectious" ? "bg-orange-100 text-orange-700" :
                          caseItem.category === "emergency" ? "bg-red-100 text-red-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {caseItem.category}
                        </span>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          caseItem.difficulty === "easy" ? "bg-green-100 text-green-700" :
                          caseItem.difficulty === "moderate" ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {caseItem.difficulty}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">{caseItem.title}</h3>
                    </div>
                    {completedCases.includes(caseItem.id) && (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    )}
                  </div>
                  
                  <p className="mb-4 text-sm text-slate-600">
                    {caseItem.patientInfo.age} {caseItem.patientInfo.sex.toLowerCase()} presenting with: {caseItem.presentingComplaint}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {caseItem.questions.length} questions • {caseItem.patientInfo.location}
                    </span>
                    <button
                      onClick={() => startCase(caseItem)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Start Case
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Case View */}
            <div className="mb-4">
              <button
                onClick={resetCase}
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
              >
                ← Back to Cases
              </button>
            </div>

            {!caseCompleted ? (
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Patient Info Panel */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">{selectedCase.title}</h2>
                    
                    <div className="mb-4 rounded-xl bg-blue-50 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                        <User size={16} />
                        {selectedCase.patientInfo.name}, {selectedCase.patientInfo.age}
                      </div>
                      <p className="text-xs text-blue-600">{selectedCase.patientInfo.location}</p>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-700">Presenting Complaint:</p>
                        <p className="text-slate-600">{selectedCase.presentingComplaint}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">History:</p>
                        <p className="text-slate-600">{selectedCase.history}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">Examination:</p>
                        <p className="text-slate-600">{selectedCase.examination}</p>
                      </div>
                    </div>
                  </div>

                  {/* Vital Signs */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                      <Activity size={18} />
                      Vital Signs
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedCase.vitalSigns.bp && (
                        <div className="rounded-lg bg-red-50 p-2">
                          <span className="text-red-600">BP:</span> {selectedCase.vitalSigns.bp}
                        </div>
                      )}
                      {selectedCase.vitalSigns.pulse && (
                        <div className="rounded-lg bg-pink-50 p-2">
                          <span className="text-pink-600">HR:</span> {selectedCase.vitalSigns.pulse}/min
                        </div>
                      )}
                      {selectedCase.vitalSigns.temp && (
                        <div className="rounded-lg bg-orange-50 p-2">
                          <span className="text-orange-600">Temp:</span> {selectedCase.vitalSigns.temp}°C
                        </div>
                      )}
                      {selectedCase.vitalSigns.rr && (
                        <div className="rounded-lg bg-blue-50 p-2">
                          <span className="text-blue-600">RR:</span> {selectedCase.vitalSigns.rr}/min
                        </div>
                      )}
                      {selectedCase.vitalSigns.spo2 && (
                        <div className="rounded-lg bg-purple-50 p-2">
                          <span className="text-purple-600">SpO2:</span> {selectedCase.vitalSigns.spo2}%
                        </div>
                      )}
                      {selectedCase.vitalSigns.gcs && (
                        <div className="rounded-lg bg-slate-100 p-2">
                          <span className="text-slate-600">GCS:</span> {selectedCase.vitalSigns.gcs}/15
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Investigations */}
                  {selectedCase.investigations && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                        <Droplets size={18} />
                        Investigations
                      </h3>
                      <ul className="space-y-2 text-sm">
                        {selectedCase.investigations.map((inv, idx) => (
                          <li key={idx} className="rounded bg-slate-50 p-2">{inv}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Question Panel */}
                <div className="lg:col-span-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                        Question {currentQuestionIndex + 1} of {selectedCase.questions.length}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setTimerRunning(!timerRunning)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                          title={timerRunning ? "Pause timer" : "Resume timer"}
                        >
                          {timerRunning ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-sm font-bold ${
                          caseTimer >= 300 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                        }`}>
                          <Timer size={14} />
                          {formatTime(caseTimer)}
                        </div>
                      </div>
                    </div>
                    <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div 
                        className="h-full bg-red-500 transition-all"
                        style={{ width: `${((currentQuestionIndex + 1) / selectedCase.questions.length) * 100}%` }}
                      />
                    </div>

                    {currentQuestion && (
                      <>
                        <h3 className="mb-6 text-xl font-semibold text-slate-900">
                          {currentQuestion.question}
                        </h3>

                        <div className="space-y-3">
                          {currentQuestion.options.map((option, idx) => {
                            const isSelected = selectedAnswers[currentQuestion.id] === idx;
                            const isCorrectOption = idx === currentQuestion.correctAnswer;
                            const showCorrect = showExplanation && isCorrectOption;
                            const showWrong = showExplanation && isSelected && !isCorrectOption;

                            return (
                              <button
                                key={idx}
                                onClick={() => !showExplanation && handleAnswerSelect(currentQuestion.id, idx)}
                                disabled={showExplanation}
                                className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                                  showCorrect ? "border-green-500 bg-green-50" :
                                  showWrong ? "border-red-500 bg-red-50" :
                                  isSelected ? "border-blue-500 bg-blue-50" :
                                  "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                                    showCorrect ? "bg-green-500 text-white" :
                                    showWrong ? "bg-red-500 text-white" :
                                    isSelected ? "bg-blue-500 text-white" :
                                    "bg-slate-200 text-slate-600"
                                  }`}>
                                    {String.fromCharCode(65 + idx)}
                                  </span>
                                  <span className="text-slate-800">{option}</span>
                                  {showCorrect && <CheckCircle2 className="ml-auto h-5 w-5 text-green-600" />}
                                  {showWrong && <XCircle className="ml-auto h-5 w-5 text-red-600" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {showExplanation && (
                          <div className="mt-6 space-y-4">
                            <div className={`rounded-xl p-4 ${isCorrect ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                              <div className="mb-2 flex items-center gap-2">
                                {isCorrect ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                ) : (
                                  <HelpCircle className="h-5 w-5 text-amber-600" />
                                )}
                                <span className="font-semibold">{isCorrect ? "Correct!" : "Explanation"}</span>
                              </div>
                              <p className="text-sm text-slate-700">{currentQuestion.explanation}</p>
                            </div>

                            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                              <div className="mb-2 flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-blue-600" />
                                <span className="font-semibold text-blue-800">Learning Point</span>
                              </div>
                              <p className="text-sm text-blue-700">{currentQuestion.learningPoint}</p>
                            </div>

                            <button
                              onClick={nextQuestion}
                              className="w-full rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
                            >
                              {currentQuestionIndex < selectedCase.questions.length - 1 ? "Next Question" : "Complete Case"}
                              <ChevronRight className="ml-2 inline h-5 w-5" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Case Completed View */
              <div className="mx-auto max-w-3xl">
                <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
                  <div className="mb-6">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                      <Award className="h-10 w-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Case Completed!</h2>
                    <p className="mt-2 text-slate-600">
                      You got {correctAnswersCount} out of {selectedCase.questions.length} questions correct
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Timer size={18} />
                        <span className="font-mono">Total: {formatTime(caseTimer)}</span>
                      </div>
                      {questionTimes.length > 0 && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Clock size={18} />
                          <span className="font-mono">Avg: {formatTime(Math.floor(questionTimes.reduce((a, b) => a + b, 0) / questionTimes.length))}/Q</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-6 rounded-xl bg-slate-50 p-6 text-left">
                    <h3 className="mb-3 font-semibold text-slate-900">Final Diagnosis:</h3>
                    <p className="mb-4 text-slate-700">{selectedCase.finalDiagnosis}</p>

                    <h3 className="mb-3 font-semibold text-slate-900">Management Plan:</h3>
                    <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                      {selectedCase.managementPlan.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>

                    <h3 className="mb-3 font-semibold text-slate-900">Key Learning Points:</h3>
                    <ul className="space-y-2">
                      {selectedCase.keyLearningPoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={resetCase}
                      className="flex-1 rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Browse Cases
                    </button>
                    <button
                      onClick={() => startCase(selectedCase)}
                      className="flex-1 rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
                    >
                      <RefreshCw className="mr-2 inline h-4 w-4" />
                      Retry Case
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}
