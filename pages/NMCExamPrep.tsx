import React, { useState, useEffect, useCallback } from "react";
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertTriangle,
  Trophy,
  RotateCcw,
  Bookmark,
  ArrowRight,
  Target,
  Brain,
  Star,
  FileText,
  Award,
} from "lucide-react";

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
}

interface ExamSet {
  id: string;
  title: string;
  description: string;
  topics: string[];
  questions: Question[];
  timeLimit: number; // in minutes
  passScore: number; // percentage
}

interface ExamResult {
  examId: string;
  date: string;
  score: number;
  totalQuestions: number;
  timeTaken: number;
  answers: number[];
}

// NMC Zambia-style exam questions
const EXAM_SETS: ExamSet[] = [
  {
    id: "fundamentals-1",
    title: "Fundamentals of Nursing I",
    description: "Basic nursing principles, patient care, vital signs, and documentation",
    topics: ["Vital Signs", "Patient Assessment", "Documentation", "Infection Control"],
    timeLimit: 60,
    passScore: 50,
    questions: [
      {
        id: "f1",
        question: "A patient's blood pressure is 180/110 mmHg. This reading is classified as:",
        options: [
          "Normal blood pressure",
          "Elevated blood pressure",
          "Stage 1 hypertension",
          "Stage 2 hypertension (Hypertensive crisis)"
        ],
        correctAnswer: 3,
        explanation: "Blood pressure ≥180/≥120 mmHg is classified as hypertensive crisis requiring immediate medical attention. Stage 2 hypertension is ≥140/≥90 mmHg.",
        topic: "Vital Signs",
        difficulty: "easy"
      },
      {
        id: "f2",
        question: "The normal respiratory rate for an adult at rest is:",
        options: [
          "8-10 breaths/minute",
          "12-20 breaths/minute",
          "22-28 breaths/minute",
          "30-40 breaths/minute"
        ],
        correctAnswer: 1,
        explanation: "Normal adult respiratory rate at rest is 12-20 breaths per minute. Rates below 12 (bradypnea) or above 20 (tachypnea) may indicate respiratory distress or other conditions.",
        topic: "Vital Signs",
        difficulty: "easy"
      },
      {
        id: "f3",
        question: "When performing hand hygiene, the minimum duration for effective handwashing with soap and water is:",
        options: [
          "5 seconds",
          "10 seconds",
          "20 seconds",
          "60 seconds"
        ],
        correctAnswer: 2,
        explanation: "Effective handwashing requires at least 20 seconds of rubbing hands together with soap, covering all surfaces. This is equivalent to singing 'Happy Birthday' twice.",
        topic: "Infection Control",
        difficulty: "easy"
      },
      {
        id: "f4",
        question: "Which of the following is the FIRST step in patient assessment?",
        options: [
          "Check vital signs",
          "Review medical history",
          "Introduce yourself and explain the procedure",
          "Perform physical examination"
        ],
        correctAnswer: 2,
        explanation: "Patient assessment begins with introducing yourself and explaining what you will do. This establishes rapport, obtains consent, and reduces patient anxiety.",
        topic: "Patient Assessment",
        difficulty: "easy"
      },
      {
        id: "f5",
        question: "A patient with a temperature of 38.5°C would be classified as having:",
        options: [
          "Hypothermia",
          "Normal temperature",
          "Low-grade fever",
          "High-grade fever"
        ],
        correctAnswer: 2,
        explanation: "Low-grade fever is typically 37.5-38.5°C. High-grade fever is above 38.5°C. Normal body temperature ranges from 36.1-37.2°C.",
        topic: "Vital Signs",
        difficulty: "easy"
      },
      {
        id: "f6",
        question: "The principle of medical asepsis is aimed at:",
        options: [
          "Creating a sterile field",
          "Reducing the number of microorganisms",
          "Eliminating all microorganisms",
          "Preventing wound infection only"
        ],
        correctAnswer: 1,
        explanation: "Medical asepsis (clean technique) aims to reduce the number and spread of microorganisms. Surgical asepsis (sterile technique) aims to eliminate all microorganisms.",
        topic: "Infection Control",
        difficulty: "medium"
      },
      {
        id: "f7",
        question: "When documenting in a patient's chart, the nurse discovers an error. The correct action is to:",
        options: [
          "Use correction fluid to cover the error",
          "Erase the error completely",
          "Draw a single line through the error, initial, and date",
          "Tear out the page and rewrite it"
        ],
        correctAnswer: 2,
        explanation: "Errors in documentation should be corrected by drawing a single line through the error, writing 'error', initialing, dating, and writing the correct information. This maintains legal integrity of the record.",
        topic: "Documentation",
        difficulty: "easy"
      },
      {
        id: "f8",
        question: "The pulse deficit is calculated by:",
        options: [
          "Apical pulse minus radial pulse",
          "Radial pulse minus apical pulse",
          "Systolic BP minus diastolic BP",
          "Heart rate minus respiratory rate"
        ],
        correctAnswer: 0,
        explanation: "Pulse deficit = Apical pulse - Radial pulse. It indicates the number of heartbeats not reaching the peripheral circulation, often seen in atrial fibrillation.",
        topic: "Vital Signs",
        difficulty: "medium"
      },
      {
        id: "f9",
        question: "Standard precautions should be used when caring for:",
        options: [
          "Only patients with known infections",
          "Only patients in isolation",
          "All patients regardless of diagnosis",
          "Only immunocompromised patients"
        ],
        correctAnswer: 2,
        explanation: "Standard precautions apply to ALL patients regardless of their diagnosis or presumed infection status. This includes hand hygiene, PPE use, and safe handling of sharps.",
        topic: "Infection Control",
        difficulty: "easy"
      },
      {
        id: "f10",
        question: "Which vital sign change indicates early shock?",
        options: [
          "Decreased heart rate",
          "Increased blood pressure",
          "Narrowing pulse pressure",
          "Decreased respiratory rate"
        ],
        correctAnswer: 2,
        explanation: "Early shock shows compensatory mechanisms: tachycardia, narrowing pulse pressure (difference between systolic and diastolic BP decreases), and increased respiratory rate.",
        topic: "Vital Signs",
        difficulty: "medium"
      },
    ]
  },
  {
    id: "maternal-1",
    title: "Maternal & Newborn Health",
    description: "Antenatal care, labor & delivery, postpartum care, and newborn assessment",
    topics: ["Antenatal Care", "Labor & Delivery", "Postpartum Care", "Newborn Care"],
    timeLimit: 60,
    passScore: 50,
    questions: [
      {
        id: "m1",
        question: "The drug of choice for preventing and treating eclamptic seizures is:",
        options: [
          "Diazepam",
          "Phenytoin",
          "Magnesium Sulfate",
          "Phenobarbital"
        ],
        correctAnswer: 2,
        explanation: "Magnesium Sulfate is the gold standard for preventing and treating eclamptic seizures. It is more effective than diazepam or phenytoin and has a better safety profile for mother and baby.",
        topic: "Labor & Delivery",
        difficulty: "easy"
      },
      {
        id: "m2",
        question: "Active Management of the Third Stage of Labor (AMTSL) includes all EXCEPT:",
        options: [
          "Oxytocin within 1 minute of delivery",
          "Controlled cord traction",
          "Early cord clamping (within 30 seconds)",
          "Uterine massage after placenta delivery"
        ],
        correctAnswer: 2,
        explanation: "Current WHO guidelines recommend delayed cord clamping (1-3 minutes) for improved neonatal outcomes. AMTSL includes uterotonic administration, controlled cord traction, and uterine massage.",
        topic: "Labor & Delivery",
        difficulty: "medium"
      },
      {
        id: "m3",
        question: "A primigravida is a woman who:",
        options: [
          "Has given birth once",
          "Is pregnant for the first time",
          "Has had multiple pregnancies",
          "Has never been pregnant"
        ],
        correctAnswer: 1,
        explanation: "Primigravida refers to a woman pregnant for the first time. Gravida indicates number of pregnancies, Para indicates number of births ≥24 weeks.",
        topic: "Antenatal Care",
        difficulty: "easy"
      },
      {
        id: "m4",
        question: "The normal APGAR score range for a healthy newborn is:",
        options: [
          "0-3",
          "4-6",
          "7-10",
          "10-15"
        ],
        correctAnswer: 2,
        explanation: "APGAR scores 7-10 indicate a healthy newborn. Scores 4-6 indicate moderate depression requiring stimulation. Scores 0-3 indicate severe depression requiring immediate resuscitation.",
        topic: "Newborn Care",
        difficulty: "easy"
      },
      {
        id: "m5",
        question: "Postpartum hemorrhage (PPH) is defined as blood loss of:",
        options: [
          "≥200ml after vaginal delivery",
          "≥500ml after vaginal delivery",
          "≥300ml after vaginal delivery",
          "≥800ml after vaginal delivery"
        ],
        correctAnswer: 1,
        explanation: "PPH is blood loss ≥500ml after vaginal delivery or ≥1000ml after cesarean section. It is a leading cause of maternal mortality globally.",
        topic: "Postpartum Care",
        difficulty: "easy"
      },
      {
        id: "m6",
        question: "The most common cause of PPH is:",
        options: [
          "Trauma to birth canal",
          "Retained placental tissue",
          "Uterine atony",
          "Coagulation disorders"
        ],
        correctAnswer: 2,
        explanation: "Uterine atony (failure of uterus to contract) accounts for 70-80% of PPH cases. Remember the 4 T's: Tone, Trauma, Tissue, Thrombin.",
        topic: "Postpartum Care",
        difficulty: "easy"
      },
      {
        id: "m7",
        question: "The normal fetal heart rate (FHR) range is:",
        options: [
          "80-100 beats per minute",
          "110-160 beats per minute",
          "170-200 beats per minute",
          "60-80 beats per minute"
        ],
        correctAnswer: 1,
        explanation: "Normal FHR is 110-160 bpm. FHR <110 bpm is bradycardia, >160 bpm is tachycardia. Both may indicate fetal distress and require immediate evaluation.",
        topic: "Antenatal Care",
        difficulty: "easy"
      },
      {
        id: "m8",
        question: "Which sign indicates a positive pregnancy test?",
        options: [
          "Detection of human chorionic gonadotropin (hCG)",
          "Presence of estrogen in urine",
          "Detection of progesterone",
          "Increased luteinizing hormone"
        ],
        correctAnswer: 0,
        explanation: "Pregnancy tests detect human chorionic gonadotropin (hCG), a hormone produced by the placenta after implantation. It can be detected in urine about 1-2 weeks after conception.",
        topic: "Antenatal Care",
        difficulty: "easy"
      },
      {
        id: "m9",
        question: "The partograph's alert line should be crossed when:",
        options: [
          "Labor is progressing normally",
          "Cervical dilatation is slower than 1cm/hour",
          "There is adequate uterine activity",
          "The baby has been delivered"
        ],
        correctAnswer: 1,
        explanation: "The alert line on a partograph represents cervical dilatation of 1cm/hour. Crossing this line indicates slow progress and the need for closer monitoring and possible intervention.",
        topic: "Labor & Delivery",
        difficulty: "medium"
      },
      {
        id: "m10",
        question: "Kangaroo Mother Care (KMC) is recommended for:",
        options: [
          "All newborns",
          "Only premature babies",
          "Low birth weight babies (<2500g)",
          "Only babies in NICU"
        ],
        correctAnswer: 2,
        explanation: "KMC is especially recommended for low birth weight babies (<2500g) and premature infants. It involves prolonged skin-to-skin contact and promotes breastfeeding, thermal regulation, and bonding.",
        topic: "Newborn Care",
        difficulty: "easy"
      },
    ]
  },
  {
    id: "hiv-1",
    title: "HIV/AIDS & TB Care",
    description: "HIV testing, ART management, TB diagnosis, and co-infection management",
    topics: ["HIV Testing", "ART", "TB Management", "HIV/TB Co-infection"],
    timeLimit: 45,
    passScore: 50,
    questions: [
      {
        id: "h1",
        question: "The current first-line ART regimen in Zambia for adults is:",
        options: [
          "AZT + 3TC + EFV",
          "TDF + 3TC + DTG",
          "ABC + 3TC + LPV/r",
          "d4T + 3TC + NVP"
        ],
        correctAnswer: 1,
        explanation: "Zambia's current first-line ART for adults is TDF (tenofovir) + 3TC (lamivudine) + DTG (dolutegravir), following WHO 2019 guidelines recommending DTG-based regimens.",
        topic: "ART",
        difficulty: "medium"
      },
      {
        id: "h2",
        question: "For PMTCT, when should a pregnant woman start ART?",
        options: [
          "Only during third trimester",
          "Only during labor",
          "Immediately upon HIV diagnosis",
          "After delivery"
        ],
        correctAnswer: 2,
        explanation: "Under Option B+, all HIV-positive pregnant women should start ART immediately upon diagnosis, regardless of CD4 count, and continue for life.",
        topic: "ART",
        difficulty: "easy"
      },
      {
        id: "h3",
        question: "A CD4 count of 180 cells/mm³ indicates:",
        options: [
          "Normal immune function",
          "Mild immunosuppression",
          "Severe immunosuppression",
          "AIDS-defining condition"
        ],
        correctAnswer: 2,
        explanation: "CD4 <200 cells/mm³ indicates severe immunosuppression and increased risk of opportunistic infections. CD4 <350 was the old threshold for starting ART; now all HIV+ patients start immediately.",
        topic: "HIV Testing",
        difficulty: "easy"
      },
      {
        id: "h4",
        question: "The diagnostic criteria for pulmonary TB includes all EXCEPT:",
        options: [
          "Cough for 2+ weeks",
          "Positive sputum smear (GeneXpert/Microscopy)",
          "High blood pressure",
          "Weight loss and night sweats"
        ],
        correctAnswer: 2,
        explanation: "TB symptoms include persistent cough (2+ weeks), weight loss, night sweats, fever, and hemoptysis. Diagnosis is confirmed by sputum examination (GeneXpert is preferred in Zambia).",
        topic: "TB Management",
        difficulty: "easy"
      },
      {
        id: "h5",
        question: "An undetectable viral load in HIV patients is typically defined as:",
        options: [
          "<1000 copies/ml",
          "<500 copies/ml",
          "<50 copies/ml",
          "<10,000 copies/ml"
        ],
        correctAnswer: 2,
        explanation: "Undetectable viral load is typically <50 copies/ml (or below detection limit of the test). This indicates effective ART and means the person cannot transmit HIV sexually (U=U: Undetectable = Untransmittable).",
        topic: "ART",
        difficulty: "medium"
      },
      {
        id: "h6",
        question: "The standard duration of TB treatment for drug-sensitive pulmonary TB is:",
        options: [
          "2 months",
          "4 months",
          "6 months",
          "12 months"
        ],
        correctAnswer: 2,
        explanation: "Standard TB treatment is 6 months: 2 months intensive phase (RHZE) + 4 months continuation phase (RH). Multi-drug resistant TB requires longer treatment.",
        topic: "TB Management",
        difficulty: "easy"
      },
      {
        id: "h7",
        question: "In HIV/TB co-infection, when should ART be started?",
        options: [
          "After completing TB treatment",
          "Within 2-8 weeks of starting TB treatment",
          "Only if CD4 <200",
          "Never during TB treatment"
        ],
        correctAnswer: 1,
        explanation: "ART should be started within 2-8 weeks of TB treatment initiation. For patients with CD4 <50, start ART within 2 weeks. Early ART reduces mortality significantly.",
        topic: "HIV/TB Co-infection",
        difficulty: "medium"
      },
      {
        id: "h8",
        question: "The window period for HIV testing is typically:",
        options: [
          "1-2 days",
          "2-4 weeks (up to 3 months)",
          "6 months",
          "1 year"
        ],
        correctAnswer: 1,
        explanation: "The window period is 2-4 weeks (antibody tests may take up to 3 months). During this period, a person may test negative despite being infected. Repeat testing is recommended after potential exposure.",
        topic: "HIV Testing",
        difficulty: "medium"
      },
      {
        id: "h9",
        question: "Cotrimoxazole prophylaxis (CPT) is given to HIV patients to prevent:",
        options: [
          "TB only",
          "Malaria only",
          "Opportunistic infections (PCP, toxoplasmosis, malaria)",
          "HIV transmission"
        ],
        correctAnswer: 2,
        explanation: "CPT prevents opportunistic infections including Pneumocystis pneumonia (PCP), toxoplasmosis, isosporiasis, and malaria. It's given to all HIV+ patients until immune recovery.",
        topic: "ART",
        difficulty: "easy"
      },
      {
        id: "h10",
        question: "The 90-90-90 UNAIDS targets refer to:",
        options: [
          "90% cure rate for TB",
          "90% diagnosed, 90% on ART, 90% virally suppressed",
          "90% prevention, 90% treatment, 90% care",
          "90% vaccination coverage"
        ],
        correctAnswer: 1,
        explanation: "90-90-90 targets: 90% of PLHIV know their status, 90% of those diagnosed are on ART, 90% of those on ART are virally suppressed. The new target is 95-95-95 by 2030.",
        topic: "HIV Testing",
        difficulty: "easy"
      },
    ]
  },
  {
    id: "pediatrics-1",
    title: "Pediatric Nursing",
    description: "Child assessment, IMCI, immunization, and common pediatric conditions",
    topics: ["Child Assessment", "IMCI", "Immunization", "Pediatric Conditions"],
    timeLimit: 45,
    passScore: 50,
    questions: [
      {
        id: "p1",
        question: "According to IMCI, a child with severe pneumonia shows which danger sign?",
        options: [
          "Fast breathing only",
          "Chest indrawing or stridor when calm",
          "Runny nose",
          "Mild cough"
        ],
        correctAnswer: 1,
        explanation: "Severe pneumonia in IMCI is identified by chest indrawing, stridor when calm, or general danger signs. These children need urgent hospital referral and antibiotics.",
        topic: "IMCI",
        difficulty: "easy"
      },
      {
        id: "p2",
        question: "The 'fast breathing' cutoff for a child aged 2-12 months is:",
        options: [
          "≥40 breaths/min",
          "≥50 breaths/min",
          "≥60 breaths/min",
          "≥30 breaths/min"
        ],
        correctAnswer: 1,
        explanation: "IMCI respiratory rate thresholds: <2 months ≥60/min, 2-12 months ≥50/min, 1-5 years ≥40/min. These indicate pneumonia requiring antibiotic treatment.",
        topic: "IMCI",
        difficulty: "medium"
      },
      {
        id: "p3",
        question: "Plan C in ORS therapy is used for:",
        options: [
          "No dehydration",
          "Some dehydration",
          "Severe dehydration",
          "Mild diarrhea"
        ],
        correctAnswer: 2,
        explanation: "Plan A: No dehydration (home treatment), Plan B: Some dehydration (ORS at facility), Plan C: Severe dehydration (IV fluids urgently). Remember: A-B-C = Increasing severity.",
        topic: "IMCI",
        difficulty: "easy"
      },
      {
        id: "p4",
        question: "BCG vaccine should be given:",
        options: [
          "At 6 weeks",
          "At birth",
          "At 14 weeks",
          "At 9 months"
        ],
        correctAnswer: 1,
        explanation: "BCG is given at birth to protect against severe forms of TB (miliary TB, TB meningitis). Zambia's immunization schedule starts with BCG and OPV0 at birth.",
        topic: "Immunization",
        difficulty: "easy"
      },
      {
        id: "p5",
        question: "The general danger signs in IMCI that require urgent referral include all EXCEPT:",
        options: [
          "Unable to drink or breastfeed",
          "Vomiting everything",
          "Convulsions",
          "Mild fever"
        ],
        correctAnswer: 3,
        explanation: "General danger signs requiring urgent referral: unable to drink/breastfeed, vomits everything, convulsions, lethargy/unconscious. Mild fever alone is not a danger sign.",
        topic: "IMCI",
        difficulty: "easy"
      },
      {
        id: "p6",
        question: "A child with mid-upper arm circumference (MUAC) <11.5cm is classified as:",
        options: [
          "Normal nutrition",
          "Moderate acute malnutrition",
          "Severe acute malnutrition",
          "At risk of malnutrition"
        ],
        correctAnswer: 2,
        explanation: "MUAC <11.5cm (red zone) = Severe Acute Malnutrition (SAM). MUAC 11.5-12.4cm (yellow) = Moderate Acute Malnutrition (MAM). MUAC ≥12.5cm (green) = Normal.",
        topic: "Child Assessment",
        difficulty: "easy"
      },
      {
        id: "p7",
        question: "Zinc supplementation in diarrhea should be given for:",
        options: [
          "3 days",
          "7 days",
          "10-14 days",
          "Only during diarrhea episode"
        ],
        correctAnswer: 2,
        explanation: "Zinc should be given for 10-14 days: 10mg/day for infants <6 months, 20mg/day for older children. It reduces diarrhea duration and prevents episodes for 2-3 months.",
        topic: "IMCI",
        difficulty: "medium"
      },
      {
        id: "p8",
        question: "The first sign of dehydration to appear is usually:",
        options: [
          "Sunken eyes",
          "Increased thirst/restlessness",
          "Loss of skin turgor",
          "Depressed fontanelle"
        ],
        correctAnswer: 1,
        explanation: "Increased thirst and restlessness are early signs of dehydration. As dehydration worsens, sunken eyes, reduced skin turgor, and depressed fontanelle appear (in infants).",
        topic: "Child Assessment",
        difficulty: "medium"
      },
      {
        id: "p9",
        question: "Measles vaccine is given at:",
        options: [
          "At birth",
          "6 weeks",
          "9 months",
          "14 weeks"
        ],
        correctAnswer: 2,
        explanation: "First measles vaccine (MR1) is given at 9 months in Zambia. A second dose (MR2) is given at 18 months to ensure immunity in those who didn't respond to the first dose.",
        topic: "Immunization",
        difficulty: "easy"
      },
      {
        id: "p10",
        question: "Exclusive breastfeeding is recommended for:",
        options: [
          "First 3 months",
          "First 6 months",
          "First 12 months",
          "First 2 years"
        ],
        correctAnswer: 1,
        explanation: "WHO recommends exclusive breastfeeding (only breast milk, no water/other foods) for the first 6 months. Continued breastfeeding with complementary foods is recommended until 2 years or beyond.",
        topic: "Child Assessment",
        difficulty: "easy"
      },
    ]
  },
];

export default function NMCExamPrep() {
  const [selectedExam, setSelectedExam] = useState<ExamSet | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [examStarted, setExamStarted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [examHistory, setExamHistory] = useState<ExamResult[]>([]);
  const [reviewMode, setReviewMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("nmcExamHistory");
    if (saved) {
      setExamHistory(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (examStarted && timeLeft > 0 && !showResult) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            submitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [examStarted, timeLeft, showResult]);

  const startExam = (exam: ExamSet) => {
    setSelectedExam(exam);
    setCurrentQuestion(0);
    setAnswers(new Array(exam.questions.length).fill(-1));
    setTimeLeft(exam.timeLimit * 60);
    setExamStarted(true);
    setShowResult(false);
    setReviewMode(false);
  };

  const selectAnswer = (answerIndex: number) => {
    if (reviewMode) return;
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);
  };

  const submitExam = useCallback(() => {
    if (!selectedExam) return;
    
    const correctAnswers = selectedExam.questions.reduce((count, q, idx) => {
      return count + (answers[idx] === q.correctAnswer ? 1 : 0);
    }, 0);
    
    const score = Math.round((correctAnswers / selectedExam.questions.length) * 100);
    
    const result: ExamResult = {
      examId: selectedExam.id,
      date: new Date().toISOString(),
      score,
      totalQuestions: selectedExam.questions.length,
      timeTaken: selectedExam.timeLimit * 60 - timeLeft,
      answers: [...answers],
    };
    
    const newHistory = [result, ...examHistory].slice(0, 50);
    setExamHistory(newHistory);
    localStorage.setItem("nmcExamHistory", JSON.stringify(newHistory));
    
    setShowResult(true);
    setExamStarted(false);
  }, [selectedExam, answers, timeLeft, examHistory]);

  const reviewExam = () => {
    setReviewMode(true);
    setShowResult(false);
    setCurrentQuestion(0);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Exam Selection Screen
  if (!selectedExam) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">
          <div className="mb-8">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
              <GraduationCap size={14} />
              NMC Exam Prep
            </div>
            <h1 className="text-3xl font-bold text-slate-900">
              Practice Exams for NMC Zambia
            </h1>
            <p className="mt-2 text-slate-600">
              Timed mock exams aligned with Nursing & Midwifery Council of Zambia standards
            </p>
          </div>

          {/* Stats Overview */}
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-100 p-3">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Exams Taken</p>
                  <p className="text-2xl font-bold text-slate-900">{examHistory.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-green-100 p-3">
                  <Trophy className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Best Score</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {examHistory.length > 0 ? Math.max(...examHistory.map(e => e.score)) : 0}%
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
                  <p className="text-sm text-slate-600">Average Score</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {examHistory.length > 0 
                      ? Math.round(examHistory.reduce((sum, e) => sum + e.score, 0) / examHistory.length)
                      : 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Exam Sets */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Available Exams</h2>
            {EXAM_SETS.map((exam) => {
              const pastAttempts = examHistory.filter(e => e.examId === exam.id);
              const bestScore = pastAttempts.length > 0 
                ? Math.max(...pastAttempts.map(e => e.score)) 
                : null;
              
              return (
                <div
                  key={exam.id}
                  className="rounded-xl border border-slate-200 bg-white p-6 hover:border-indigo-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{exam.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{exam.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {exam.topics.map(topic => (
                          <span key={topic} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                            {topic}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <FileText size={14} />
                          {exam.questions.length} questions
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {exam.timeLimit} minutes
                        </span>
                        <span className="flex items-center gap-1">
                          <Target size={14} />
                          Pass: {exam.passScore}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      {bestScore !== null && (
                        <div className="mb-2">
                          <span className="text-xs text-slate-500">Best: </span>
                          <span className={`font-semibold ${bestScore >= exam.passScore ? "text-green-600" : "text-amber-600"}`}>
                            {bestScore}%
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => startExam(exam)}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        Start Exam
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent History */}
          {examHistory.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">Recent Attempts</h2>
              <div className="space-y-2">
                {examHistory.slice(0, 5).map((result, idx) => {
                  const exam = EXAM_SETS.find(e => e.id === result.examId);
                  return (
                    <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                      <div>
                        <p className="font-semibold text-slate-900">{exam?.title}</p>
                        <p className="text-sm text-slate-500">
                          {new Date(result.date).toLocaleDateString()} • {Math.floor(result.timeTaken / 60)}:{(result.timeTaken % 60).toString().padStart(2, '0')} min
                        </p>
                      </div>
                      <div className={`text-lg font-bold ${
                        result.score >= (exam?.passScore || 50) ? "text-green-600" : "text-red-600"
                      }`}>
                        {result.score}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
    );
  }

  // Results Screen
  if (showResult) {
    const correctCount = selectedExam.questions.reduce((count, q, idx) => {
      return count + (answers[idx] === q.correctAnswer ? 1 : 0);
    }, 0);
    const score = Math.round((correctCount / selectedExam.questions.length) * 100);
    const passed = score >= selectedExam.passScore;

    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6 md:p-10">
          <div className={`rounded-xl border-2 ${passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"} p-8 text-center`}>
            <div className={`mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full ${passed ? "bg-green-100" : "bg-red-100"}`}>
              {passed ? (
                <Trophy className="h-10 w-10 text-green-600" />
              ) : (
                <RotateCcw className="h-10 w-10 text-red-600" />
              )}
            </div>
            <h2 className={`text-3xl font-bold ${passed ? "text-green-800" : "text-red-800"}`}>
              {passed ? "Congratulations! You Passed!" : "Keep Practicing!"}
            </h2>
            <p className="mt-2 text-lg text-slate-600">
              {selectedExam.title}
            </p>
            <div className="mt-6 flex justify-center gap-8">
              <div>
                <p className={`text-4xl font-bold ${passed ? "text-green-600" : "text-red-600"}`}>{score}%</p>
                <p className="text-sm text-slate-500">Your Score</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-slate-700">{correctCount}/{selectedExam.questions.length}</p>
                <p className="text-sm text-slate-500">Correct Answers</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Pass mark: {selectedExam.passScore}% • Time used: {formatTime(selectedExam.timeLimit * 60 - timeLeft)}
            </p>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={reviewExam}
              className="flex-1 rounded-xl border border-indigo-300 bg-white px-4 py-3 font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              Review Answers
            </button>
            <button
              onClick={() => setSelectedExam(null)}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
            >
              Back to Exams
            </button>
          </div>
          <button
            onClick={() => startExam(selectedExam)}
            className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="mr-2 inline h-4 w-4" />
            Retake Exam
          </button>
      </div>
    );
  }

  // Question Screen
  const question = selectedExam.questions[currentQuestion];
  const isAnswered = answers[currentQuestion] !== -1;
  const isCorrect = reviewMode && answers[currentQuestion] === question.correctAnswer;
  const isWrong = reviewMode && answers[currentQuestion] !== -1 && answers[currentQuestion] !== question.correctAnswer;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 md:p-10">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{selectedExam.title}</p>
            <p className="font-semibold text-slate-700">
              Question {currentQuestion + 1} of {selectedExam.questions.length}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {reviewMode ? (
              <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
                Review Mode
              </span>
            ) : (
              <div className={`flex items-center gap-2 rounded-full px-4 py-2 font-mono font-bold ${
                timeLeft < 300 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"
              }`}>
                <Clock size={16} />
                {formatTime(timeLeft)}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6 h-2 rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${((currentQuestion + 1) / selectedExam.questions.length) * 100}%` }}
          />
        </div>

        {/* Question Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
              question.difficulty === "easy" ? "bg-green-100 text-green-700" :
              question.difficulty === "medium" ? "bg-amber-100 text-amber-700" :
              "bg-red-100 text-red-700"
            }`}>
              {question.difficulty}
            </span>
            <span className="text-xs text-slate-500">{question.topic}</span>
          </div>
          <h3 className="mb-6 text-lg font-semibold text-slate-900">
            {question.question}
          </h3>

          {/* Options */}
          <div className="space-y-3">
            {question.options.map((option, idx) => {
              const isSelected = answers[currentQuestion] === idx;
              const showCorrect = reviewMode && idx === question.correctAnswer;
              const showWrong = reviewMode && isSelected && idx !== question.correctAnswer;

              return (
                <button
                  key={idx}
                  onClick={() => selectAnswer(idx)}
                  disabled={reviewMode}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                    showCorrect ? "border-green-500 bg-green-50" :
                    showWrong ? "border-red-500 bg-red-50" :
                    isSelected ? "border-indigo-500 bg-indigo-50" :
                    "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      showCorrect ? "bg-green-500 text-white" :
                      showWrong ? "bg-red-500 text-white" :
                      isSelected ? "bg-indigo-500 text-white" :
                      "bg-slate-200 text-slate-600"
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-slate-700">{option}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation (Review Mode) */}
          {reviewMode && (
            <div className="mt-6 rounded-xl bg-slate-100 p-4">
              <h4 className="mb-2 font-semibold text-slate-900 flex items-center gap-2">
                <Brain size={16} />
                Explanation
              </h4>
              <p className="text-sm text-slate-700">{question.explanation}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestion(prev => prev - 1)}
            disabled={currentQuestion === 0}
            className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:opacity-50 hover:bg-slate-50"
          >
            Previous
          </button>

          <div className="flex flex-wrap justify-center gap-1">
            {selectedExam.questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`h-8 w-8 rounded-lg text-xs font-semibold ${
                  idx === currentQuestion ? "bg-indigo-600 text-white" :
                  reviewMode && answers[idx] === selectedExam.questions[idx].correctAnswer ? "bg-green-500 text-white" :
                  reviewMode && answers[idx] !== -1 ? "bg-red-500 text-white" :
                  answers[idx] !== -1 ? "bg-indigo-200 text-indigo-700" :
                  "bg-slate-200 text-slate-600"
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          {currentQuestion === selectedExam.questions.length - 1 ? (
            reviewMode ? (
              <button
                onClick={() => setSelectedExam(null)}
                className="rounded-xl bg-indigo-600 px-6 py-2 font-semibold text-white hover:bg-indigo-700"
              >
                Finish Review
              </button>
            ) : (
              <button
                onClick={submitExam}
                className="rounded-xl bg-green-600 px-6 py-2 font-semibold text-white hover:bg-green-700"
              >
                Submit Exam
              </button>
            )
          ) : (
            <button
              onClick={() => setCurrentQuestion(prev => prev + 1)}
              className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
            >
              Next
            </button>
          )}
        </div>

        {/* Unanswered warning */}
        {!reviewMode && answers.filter(a => a === -1).length > 0 && (
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
            <AlertTriangle className="mr-2 inline h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-700">
              {answers.filter(a => a === -1).length} question(s) unanswered
            </span>
          </div>
        )}
    </div>
  );
}
