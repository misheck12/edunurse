import React, { useState, useEffect } from "react";
import {
  Calculator,
  Pill,
  Droplets,
  Baby,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Trophy,
  Target,
  TrendingUp,
  BookOpen,
  Beaker,
  Scale,
  Heart,
  Syringe,
  Activity,
} from "lucide-react";

type CalculatorMode = "iv-drip" | "dose-weight" | "unit-conversion" | "practice";
type DifficultyLevel = "beginner" | "intermediate" | "advanced";

interface PracticeQuestion {
  id: string;
  type: "iv-drip" | "dose-weight" | "unit-conversion";
  question: string;
  givenValues: Record<string, number>;
  correctAnswer: number;
  unit: string;
  explanation: string;
  difficulty: DifficultyLevel;
}

interface PracticeResult {
  questionId: string;
  userAnswer: number;
  correct: boolean;
  timeTaken: number;
}

// Common drug reference data
const DRUG_REFERENCE = [
  { name: "Paracetamol", adultDose: "500-1000mg", pediatricDose: "15mg/kg", maxDaily: "4g", route: "PO/IV" },
  { name: "Amoxicillin", adultDose: "250-500mg", pediatricDose: "25-50mg/kg/day", maxDaily: "3g", route: "PO" },
  { name: "Metronidazole", adultDose: "400-500mg", pediatricDose: "7.5mg/kg", maxDaily: "4g", route: "PO/IV" },
  { name: "Gentamicin", adultDose: "5-7mg/kg/day", pediatricDose: "5-7.5mg/kg/day", maxDaily: "varies", route: "IV/IM" },
  { name: "Artemether-Lumefantrine", adultDose: "80/480mg", pediatricDose: "weight-based", maxDaily: "varies", route: "PO" },
  { name: "Quinine", adultDose: "600mg", pediatricDose: "10mg/kg", maxDaily: "1.8g", route: "PO/IV" },
  { name: "Cotrimoxazole", adultDose: "960mg", pediatricDose: "24mg/kg/day", maxDaily: "1920mg", route: "PO" },
  { name: "Morphine", adultDose: "5-10mg", pediatricDose: "0.1-0.2mg/kg", maxDaily: "varies", route: "IV/IM/SC" },
  { name: "Diazepam", adultDose: "5-10mg", pediatricDose: "0.1-0.3mg/kg", maxDaily: "40mg", route: "PO/IV/PR" },
  { name: "Furosemide", adultDose: "20-80mg", pediatricDose: "1-2mg/kg", maxDaily: "600mg", route: "PO/IV" },
];

// Practice questions bank
const PRACTICE_QUESTIONS: PracticeQuestion[] = [
  {
    id: "1",
    type: "iv-drip",
    question: "A patient is prescribed 1000ml of Normal Saline to run over 8 hours. The giving set delivers 20 drops/ml. Calculate the drip rate in drops per minute.",
    givenValues: { volume: 1000, time: 8, dropFactor: 20 },
    correctAnswer: 42,
    unit: "drops/min",
    explanation: "Drip rate = (Volume × Drop factor) / (Time in hours × 60) = (1000 × 20) / (8 × 60) = 20000 / 480 = 41.67 ≈ 42 drops/min",
    difficulty: "beginner",
  },
  {
    id: "2",
    type: "iv-drip",
    question: "Administer 500ml of 5% Dextrose over 4 hours using a blood giving set (15 drops/ml). What is the drip rate?",
    givenValues: { volume: 500, time: 4, dropFactor: 15 },
    correctAnswer: 31,
    unit: "drops/min",
    explanation: "Drip rate = (500 × 15) / (4 × 60) = 7500 / 240 = 31.25 ≈ 31 drops/min",
    difficulty: "beginner",
  },
  {
    id: "3",
    type: "dose-weight",
    question: "A child weighing 15kg needs Paracetamol at 15mg/kg. The syrup contains 120mg/5ml. How many ml should be given?",
    givenValues: { weight: 15, dosePerKg: 15, concentration: 120, concentrationVolume: 5 },
    correctAnswer: 9.4,
    unit: "ml",
    explanation: "Total dose = 15kg × 15mg/kg = 225mg. Volume = (225mg × 5ml) / 120mg = 9.375ml ≈ 9.4ml",
    difficulty: "intermediate",
  },
  {
    id: "4",
    type: "dose-weight",
    question: "Prescribe Amoxicillin 40mg/kg/day in 3 divided doses for a 12kg child. Suspension is 125mg/5ml. Calculate the dose per administration in ml.",
    givenValues: { weight: 12, dosePerKg: 40, doses: 3, concentration: 125, concentrationVolume: 5 },
    correctAnswer: 6.4,
    unit: "ml",
    explanation: "Daily dose = 12 × 40 = 480mg. Per dose = 480/3 = 160mg. Volume = (160 × 5) / 125 = 6.4ml",
    difficulty: "intermediate",
  },
  {
    id: "5",
    type: "iv-drip",
    question: "A critically ill patient needs 1 unit (450ml) of blood transfused over 3 hours. Blood set delivers 15 drops/ml. Calculate the drip rate.",
    givenValues: { volume: 450, time: 3, dropFactor: 15 },
    correctAnswer: 38,
    unit: "drops/min",
    explanation: "Drip rate = (450 × 15) / (3 × 60) = 6750 / 180 = 37.5 ≈ 38 drops/min",
    difficulty: "intermediate",
  },
  {
    id: "6",
    type: "unit-conversion",
    question: "Convert 0.25g to milligrams.",
    givenValues: { grams: 0.25 },
    correctAnswer: 250,
    unit: "mg",
    explanation: "1g = 1000mg, so 0.25g = 0.25 × 1000 = 250mg",
    difficulty: "beginner",
  },
  {
    id: "7",
    type: "unit-conversion",
    question: "A patient needs 2.5 litres of fluid. Express this in millilitres.",
    givenValues: { litres: 2.5 },
    correctAnswer: 2500,
    unit: "ml",
    explanation: "1L = 1000ml, so 2.5L = 2.5 × 1000 = 2500ml",
    difficulty: "beginner",
  },
  {
    id: "8",
    type: "dose-weight",
    question: "Gentamicin 5mg/kg IV for a 70kg adult. Vial contains 80mg/2ml. What volume is needed?",
    givenValues: { weight: 70, dosePerKg: 5, concentration: 80, concentrationVolume: 2 },
    correctAnswer: 8.75,
    unit: "ml",
    explanation: "Total dose = 70 × 5 = 350mg. Volume = (350 × 2) / 80 = 8.75ml",
    difficulty: "advanced",
  },
  {
    id: "9",
    type: "iv-drip",
    question: "Dopamine infusion: 400mg in 250ml D5W at 5mcg/kg/min for 60kg patient. What is the rate in ml/hr?",
    givenValues: { drugMg: 400, volume: 250, mcgKgMin: 5, weight: 60 },
    correctAnswer: 11.25,
    unit: "ml/hr",
    explanation: "mcg/min = 5 × 60 = 300mcg/min. mg/min = 0.3mg/min. Concentration = 400mg/250ml = 1.6mg/ml. Rate = 0.3/1.6 × 60 = 11.25ml/hr",
    difficulty: "advanced",
  },
  {
    id: "10",
    type: "dose-weight",
    question: "Quinine loading dose 20mg/kg for severe malaria. Patient weighs 55kg. Ampoule is 300mg/ml. Calculate volume for IV infusion.",
    givenValues: { weight: 55, dosePerKg: 20, concentration: 300, concentrationVolume: 1 },
    correctAnswer: 3.67,
    unit: "ml",
    explanation: "Total dose = 55 × 20 = 1100mg. Volume = 1100 / 300 = 3.67ml",
    difficulty: "advanced",
  },
];

export default function DrugCalculator() {
  const [mode, setMode] = useState<CalculatorMode>("iv-drip");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("beginner");
  
  // IV Drip Calculator State
  const [volume, setVolume] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [dropFactor, setDropFactor] = useState<string>("20");
  const [dripRate, setDripRate] = useState<number | null>(null);
  
  // Dose by Weight State
  const [weight, setWeight] = useState<string>("");
  const [dosePerKg, setDosePerKg] = useState<string>("");
  const [concentration, setConcentration] = useState<string>("");
  const [concentrationVol, setConcentrationVol] = useState<string>("1");
  const [calculatedDose, setCalculatedDose] = useState<{ totalDose: number; volume: number } | null>(null);
  
  // Unit Conversion State
  const [conversionType, setConversionType] = useState<string>("g-to-mg");
  const [inputValue, setInputValue] = useState<string>("");
  const [convertedValue, setConvertedValue] = useState<number | null>(null);
  
  // Practice Mode State
  const [currentQuestion, setCurrentQuestion] = useState<PracticeQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [showResult, setShowResult] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [practiceResults, setPracticeResults] = useState<PracticeResult[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [showDrugReference, setShowDrugReference] = useState<boolean>(false);
  
  // Timer State
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number>(0);
  const [timerEnabled, setTimerEnabled] = useState<boolean>(true);
  const QUESTION_TIME_LIMITS: Record<DifficultyLevel, number> = {
    beginner: 120,    // 2 minutes
    intermediate: 90, // 1.5 minutes
    advanced: 60,     // 1 minute
  };

  // Calculate IV Drip Rate
  const calculateDripRate = () => {
    const vol = parseFloat(volume);
    const hrs = parseFloat(time);
    const df = parseFloat(dropFactor);
    
    if (vol > 0 && hrs > 0 && df > 0) {
      const rate = (vol * df) / (hrs * 60);
      setDripRate(Math.round(rate * 100) / 100);
    }
  };

  // Calculate Dose by Weight
  const calculateDoseByWeight = () => {
    const wt = parseFloat(weight);
    const dose = parseFloat(dosePerKg);
    const conc = parseFloat(concentration);
    const concVol = parseFloat(concentrationVol);
    
    if (wt > 0 && dose > 0) {
      const totalDose = wt * dose;
      const volumeNeeded = conc > 0 ? (totalDose * concVol) / conc : 0;
      setCalculatedDose({
        totalDose: Math.round(totalDose * 100) / 100,
        volume: Math.round(volumeNeeded * 100) / 100,
      });
    }
  };

  // Unit Conversions
  const performConversion = () => {
    const val = parseFloat(inputValue);
    if (isNaN(val)) return;
    
    let result = 0;
    switch (conversionType) {
      case "g-to-mg": result = val * 1000; break;
      case "mg-to-g": result = val / 1000; break;
      case "mg-to-mcg": result = val * 1000; break;
      case "mcg-to-mg": result = val / 1000; break;
      case "l-to-ml": result = val * 1000; break;
      case "ml-to-l": result = val / 1000; break;
      case "kg-to-g": result = val * 1000; break;
      case "g-to-kg": result = val / 1000; break;
      default: result = val;
    }
    setConvertedValue(Math.round(result * 1000) / 1000);
  };

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerEnabled && questionTimeLeft > 0 && !showResult && mode === "practice") {
      interval = setInterval(() => {
        setQuestionTimeLeft(prev => {
          if (prev <= 1) {
            // Time's up - auto-submit wrong answer
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [questionTimeLeft, showResult, timerEnabled, mode]);

  const handleTimeUp = () => {
    if (!currentQuestion || showResult) return;
    setIsCorrect(false);
    setShowResult(true);
    const timeTaken = QUESTION_TIME_LIMITS[difficulty];
    setPracticeResults(prev => [...prev, {
      questionId: currentQuestion.id,
      userAnswer: 0,
      correct: false,
      timeTaken,
    }]);
  };

  // Practice Mode Functions
  const getNewQuestion = () => {
    const filteredQuestions = PRACTICE_QUESTIONS.filter(q => q.difficulty === difficulty);
    const availableQuestions = filteredQuestions.filter(
      q => !practiceResults.slice(-5).some(r => r.questionId === q.id)
    );
    const questions = availableQuestions.length > 0 ? availableQuestions : filteredQuestions;
    const randomIndex = Math.floor(Math.random() * questions.length);
    setCurrentQuestion(questions[randomIndex]);
    setUserAnswer("");
    setShowResult(false);
    setQuestionStartTime(Date.now());
    if (timerEnabled) {
      setQuestionTimeLeft(QUESTION_TIME_LIMITS[difficulty]);
    }
  };

  const checkAnswer = () => {
    if (!currentQuestion || !userAnswer) return;
    
    const userNum = parseFloat(userAnswer);
    const tolerance = currentQuestion.correctAnswer * 0.05; // 5% tolerance
    const correct = Math.abs(userNum - currentQuestion.correctAnswer) <= tolerance;
    
    setIsCorrect(correct);
    setShowResult(true);
    
    const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);
    setPracticeResults(prev => [...prev, {
      questionId: currentQuestion.id,
      userAnswer: userNum,
      correct,
      timeTaken,
    }]);
  };

  useEffect(() => {
    if (mode === "practice" && !currentQuestion) {
      getNewQuestion();
    }
  }, [mode]);

  const correctCount = practiceResults.filter(r => r.correct).length;
  const accuracy = practiceResults.length > 0 ? Math.round((correctCount / practiceResults.length) * 100) : 0;
  const avgTime = practiceResults.length > 0 
    ? Math.round(practiceResults.reduce((a, b) => a + b.timeTaken, 0) / practiceResults.length) 
    : 0;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-10">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Calculator size={14} />
            Drug Calculations
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Drug Dosage Calculator & Trainer
          </h1>
          <p className="mt-2 text-slate-600">
            Master IV drip rates, pediatric doses, and unit conversions - essential skills for nursing practice.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { id: "iv-drip", label: "IV Drip Rate", icon: Droplets },
            { id: "dose-weight", label: "Dose by Weight", icon: Baby },
            { id: "unit-conversion", label: "Unit Conversion", icon: Scale },
            { id: "practice", label: "Practice Mode", icon: Target },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setMode(item.id as CalculatorMode)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                mode === item.id
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Calculator Area */}
          <div className="lg:col-span-2">
            {/* IV Drip Rate Calculator */}
            {mode === "iv-drip" && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-blue-100 p-3">
                    <Droplets className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">IV Drip Rate Calculator</h2>
                    <p className="text-sm text-slate-500">Calculate drops per minute for IV infusions</p>
                  </div>
                </div>

                <div className="mb-4 rounded-xl bg-blue-50 p-4">
                  <p className="text-sm font-medium text-blue-800">Formula:</p>
                  <p className="mt-1 font-mono text-blue-900">
                    Drip Rate = (Volume × Drop Factor) ÷ (Time in hours × 60)
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        Volume (ml)
                      </span>
                      <input
                        type="number"
                        value={volume}
                        onChange={(e) => setVolume(e.target.value)}
                        placeholder="e.g. 1000"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        Time (hours)
                      </span>
                      <input
                        type="number"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        placeholder="e.g. 8"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Drop Factor (drops/ml)
                    </span>
                    <select
                      value={dropFactor}
                      onChange={(e) => setDropFactor(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="20">Standard IV set (20 drops/ml)</option>
                      <option value="15">Blood set (15 drops/ml)</option>
                      <option value="60">Microdrop/Pediatric (60 drops/ml)</option>
                    </select>
                  </label>

                  <button
                    onClick={calculateDripRate}
                    className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                  >
                    Calculate Drip Rate
                  </button>

                  {dripRate !== null && (
                    <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white">
                      <p className="text-sm font-medium text-emerald-100">Result:</p>
                      <p className="text-4xl font-bold">{dripRate} drops/min</p>
                      <p className="mt-2 text-sm text-emerald-100">
                        Set the IV to approximately {dripRate} drops per minute
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dose by Weight Calculator */}
            {mode === "dose-weight" && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-purple-100 p-3">
                    <Baby className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Dose by Weight Calculator</h2>
                    <p className="text-sm text-slate-500">Calculate pediatric and weight-based doses</p>
                  </div>
                </div>

                <div className="mb-4 rounded-xl bg-purple-50 p-4">
                  <p className="text-sm font-medium text-purple-800">Formula:</p>
                  <p className="mt-1 font-mono text-purple-900">
                    Total Dose = Weight (kg) × Dose (mg/kg)
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        Patient Weight (kg)
                      </span>
                      <input
                        type="number"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="e.g. 15"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        Dose (mg/kg)
                      </span>
                      <input
                        type="number"
                        value={dosePerKg}
                        onChange={(e) => setDosePerKg(e.target.value)}
                        placeholder="e.g. 15"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        Drug Concentration (mg)
                      </span>
                      <input
                        type="number"
                        value={concentration}
                        onChange={(e) => setConcentration(e.target.value)}
                        placeholder="e.g. 120"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        Per Volume (ml)
                      </span>
                      <input
                        type="number"
                        value={concentrationVol}
                        onChange={(e) => setConcentrationVol(e.target.value)}
                        placeholder="e.g. 5"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      />
                    </label>
                  </div>

                  <button
                    onClick={calculateDoseByWeight}
                    className="w-full rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
                  >
                    Calculate Dose
                  </button>

                  {calculatedDose && (
                    <div className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-purple-100">Total Dose:</p>
                          <p className="text-3xl font-bold">{calculatedDose.totalDose} mg</p>
                        </div>
                        {calculatedDose.volume > 0 && (
                          <div>
                            <p className="text-sm font-medium text-purple-100">Volume to Give:</p>
                            <p className="text-3xl font-bold">{calculatedDose.volume} ml</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Unit Conversion */}
            {mode === "unit-conversion" && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-amber-100 p-3">
                    <Scale className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Unit Conversion</h2>
                    <p className="text-sm text-slate-500">Quick conversions for drug calculations</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Conversion Type
                    </span>
                    <select
                      value={conversionType}
                      onChange={(e) => {
                        setConversionType(e.target.value);
                        setConvertedValue(null);
                      }}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    >
                      <optgroup label="Mass">
                        <option value="g-to-mg">Grams → Milligrams</option>
                        <option value="mg-to-g">Milligrams → Grams</option>
                        <option value="mg-to-mcg">Milligrams → Micrograms</option>
                        <option value="mcg-to-mg">Micrograms → Milligrams</option>
                        <option value="kg-to-g">Kilograms → Grams</option>
                        <option value="g-to-kg">Grams → Kilograms</option>
                      </optgroup>
                      <optgroup label="Volume">
                        <option value="l-to-ml">Litres → Millilitres</option>
                        <option value="ml-to-l">Millilitres → Litres</option>
                      </optgroup>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Enter Value
                    </span>
                    <input
                      type="number"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Enter value to convert"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    />
                  </label>

                  <button
                    onClick={performConversion}
                    className="w-full rounded-xl bg-amber-600 px-6 py-3 font-semibold text-white hover:bg-amber-700"
                  >
                    Convert
                  </button>

                  {convertedValue !== null && (
                    <div className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
                      <p className="text-sm font-medium text-amber-100">Result:</p>
                      <p className="text-4xl font-bold">{convertedValue}</p>
                      <p className="mt-1 text-sm text-amber-100">
                        {conversionType.split("-to-")[1].toUpperCase()}
                      </p>
                    </div>
                  )}

                  {/* Quick Reference */}
                  <div className="rounded-xl bg-slate-50 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700">Quick Reference:</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-white p-2">1 g = 1000 mg</div>
                      <div className="rounded bg-white p-2">1 mg = 1000 mcg</div>
                      <div className="rounded bg-white p-2">1 L = 1000 ml</div>
                      <div className="rounded bg-white p-2">1 kg = 1000 g</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Practice Mode */}
            {mode === "practice" && (
              <div className="space-y-6">
                {/* Difficulty Selector & Timer Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    {(["beginner", "intermediate", "advanced"] as DifficultyLevel[]).map((level) => (
                      <button
                        key={level}
                        onClick={() => {
                          setDifficulty(level);
                          setCurrentQuestion(null);
                          setTimeout(getNewQuestion, 100);
                        }}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
                          difficulty === level
                            ? level === "beginner" ? "bg-green-600 text-white" :
                              level === "intermediate" ? "bg-amber-600 text-white" :
                              "bg-red-600 text-white"
                            : "bg-white text-slate-700 border border-slate-200"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={timerEnabled}
                      onChange={(e) => setTimerEnabled(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <Clock size={14} className="text-slate-500" />
                    <span className="text-slate-700">Timer</span>
                  </label>
                </div>

                {/* Question Card */}
                {currentQuestion && (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          currentQuestion.type === "iv-drip" ? "bg-blue-100 text-blue-700" :
                          currentQuestion.type === "dose-weight" ? "bg-purple-100 text-purple-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {currentQuestion.type === "iv-drip" ? "IV Drip Rate" :
                           currentQuestion.type === "dose-weight" ? "Dose by Weight" :
                           "Unit Conversion"}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          currentQuestion.difficulty === "beginner" ? "bg-green-100 text-green-700" :
                          currentQuestion.difficulty === "intermediate" ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {currentQuestion.difficulty}
                        </span>
                      </div>
                      {timerEnabled && !showResult && (
                        <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-sm font-bold ${
                          questionTimeLeft <= 10 ? "bg-red-100 text-red-700 animate-pulse" :
                          questionTimeLeft <= 30 ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          <Clock size={14} />
                          {Math.floor(questionTimeLeft / 60)}:{(questionTimeLeft % 60).toString().padStart(2, "0")}
                        </div>
                      )}
                    </div>

                    <p className="mb-6 text-lg text-slate-800">{currentQuestion.question}</p>

                    {!showResult ? (
                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <input
                            type="number"
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            placeholder="Enter your answer"
                            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                            onKeyDown={(e) => e.key === "Enter" && checkAnswer()}
                          />
                          <span className="flex items-center rounded-xl bg-slate-100 px-4 text-sm font-medium text-slate-600">
                            {currentQuestion.unit}
                          </span>
                        </div>
                        <button
                          onClick={checkAnswer}
                          disabled={!userAnswer}
                          className="w-full rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Check Answer
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className={`rounded-xl p-4 ${isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                          <div className="mb-2 flex items-center gap-2">
                            {isCorrect ? (
                              <>
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <span className="font-semibold text-green-700">Correct! Well done!</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                                <span className="font-semibold text-red-700">
                                  Not quite. The correct answer is {currentQuestion.correctAnswer} {currentQuestion.unit}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">{currentQuestion.explanation}</p>
                        </div>
                        <button
                          onClick={getNewQuestion}
                          className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                        >
                          <RefreshCw className="mr-2 inline h-4 w-4" />
                          Next Question
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats */}
                {practiceResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
                      <Trophy className="mx-auto mb-2 h-6 w-6 text-amber-500" />
                      <p className="text-2xl font-bold text-slate-900">{correctCount}/{practiceResults.length}</p>
                      <p className="text-xs text-slate-500">Correct</p>
                    </div>
                    <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
                      <Target className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                      <p className="text-2xl font-bold text-slate-900">{accuracy}%</p>
                      <p className="text-xs text-slate-500">Accuracy</p>
                    </div>
                    <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
                      <Clock className="mx-auto mb-2 h-6 w-6 text-blue-500" />
                      <p className="text-2xl font-bold text-slate-900">{avgTime}s</p>
                      <p className="text-xs text-slate-500">Avg Time</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar - Drug Reference */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <button
                onClick={() => setShowDrugReference(!showDrugReference)}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-slate-900">Quick Drug Reference</h3>
                </div>
                <span className={`transition-transform ${showDrugReference ? "rotate-180" : ""}`}>▼</span>
              </button>

              {showDrugReference && (
                <div className="mt-4 space-y-3">
                  {DRUG_REFERENCE.map((drug) => (
                    <div key={drug.name} className="rounded-xl bg-slate-50 p-3">
                      <p className="font-semibold text-slate-800">{drug.name}</p>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-slate-600">
                        <span>Adult: {drug.adultDose}</span>
                        <span>Peds: {drug.pediatricDose}</span>
                        <span>Max: {drug.maxDaily}/day</span>
                        <span>Route: {drug.route}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tips Card */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-amber-800">Safety Tips</h3>
              </div>
              <ul className="space-y-2 text-sm text-amber-700">
                <li>• Always double-check calculations</li>
                <li>• Verify drug concentrations on packaging</li>
                <li>• Consider patient's renal/hepatic function</li>
                <li>• Check for drug allergies first</li>
                <li>• When in doubt, ask a senior colleague</li>
              </ul>
            </div>

            {/* Common Drop Factors */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 font-semibold text-slate-900">IV Set Drop Factors</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between rounded-lg bg-blue-50 p-2">
                  <span>Standard IV set</span>
                  <span className="font-mono font-bold">20 drops/ml</span>
                </div>
                <div className="flex justify-between rounded-lg bg-red-50 p-2">
                  <span>Blood giving set</span>
                  <span className="font-mono font-bold">15 drops/ml</span>
                </div>
                <div className="flex justify-between rounded-lg bg-green-50 p-2">
                  <span>Pediatric/Micro set</span>
                  <span className="font-mono font-bold">60 drops/ml</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
