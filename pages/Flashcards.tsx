import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Star,
  Clock,
  Target,
  Brain,
  Sparkles,
  Loader2,
  Edit,
  Trash2,
  FolderOpen,
  Save,
  Download,
} from "lucide-react";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  timesReviewed: number;
  lastReviewed?: string;
  nextReview?: string;
  easeFactor: number; // For spaced repetition
}

interface FlashcardDeck {
  id: string;
  name: string;
  description: string;
  cards: Flashcard[];
  createdAt: string;
  lastStudied?: string;
}

interface StudySession {
  deckId: string;
  startTime: string;
  cardsStudied: number;
  correctAnswers: number;
  totalTime: number;
}

// Pre-built decks for nursing students
const PREBUILT_DECKS: FlashcardDeck[] = [
  {
    id: "vital-signs",
    name: "Vital Signs & Normal Ranges",
    description: "Essential vital sign parameters and their normal ranges",
    createdAt: new Date().toISOString(),
    cards: [
      { id: "vs1", front: "Normal adult heart rate", back: "60-100 beats per minute (bpm)", category: "Vital Signs", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "vs2", front: "Normal adult blood pressure", back: "Systolic: 90-120 mmHg\nDiastolic: 60-80 mmHg\nOptimal: <120/80 mmHg", category: "Vital Signs", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "vs3", front: "Normal adult respiratory rate", back: "12-20 breaths per minute", category: "Vital Signs", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "vs4", front: "Normal body temperature (oral)", back: "36.5-37.5°C (97.7-99.5°F)", category: "Vital Signs", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "vs5", front: "Normal oxygen saturation (SpO2)", back: "95-100%\n(88-92% for COPD patients)", category: "Vital Signs", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "vs6", front: "Normal newborn heart rate", back: "120-160 bpm", category: "Vital Signs", difficulty: "medium", timesReviewed: 0, easeFactor: 2.5 },
      { id: "vs7", front: "Normal newborn respiratory rate", back: "30-60 breaths per minute", category: "Vital Signs", difficulty: "medium", timesReviewed: 0, easeFactor: 2.5 },
      { id: "vs8", front: "Signs of shock (vital signs)", back: "↓ BP (systolic <90)\n↑ Heart rate (>100)\n↑ Respiratory rate\nCool, clammy skin\n↓ Urine output (<0.5ml/kg/hr)", category: "Vital Signs", difficulty: "hard", timesReviewed: 0, easeFactor: 2.5 },
    ],
  },
  {
    id: "drug-calculations",
    name: "Drug Calculations",
    description: "Essential formulas and conversions for drug calculations",
    createdAt: new Date().toISOString(),
    cards: [
      { id: "dc1", front: "IV drip rate formula (drops/min)", back: "Drip rate = (Volume × Drop factor) ÷ (Time in hours × 60)\n\nOr: Volume ÷ Time × Drop factor ÷ 60", category: "Calculations", difficulty: "medium", timesReviewed: 0, easeFactor: 2.5 },
      { id: "dc2", front: "Standard IV giving set drop factor", back: "20 drops/ml", category: "Calculations", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "dc3", front: "Blood giving set drop factor", back: "15 drops/ml", category: "Calculations", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "dc4", front: "Pediatric/microdrop set drop factor", back: "60 drops/ml", category: "Calculations", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "dc5", front: "Dose calculation formula", back: "Dose = Desired dose × (Stock volume ÷ Stock strength)\n\nOr: What you want ÷ What you've got × Volume", category: "Calculations", difficulty: "medium", timesReviewed: 0, easeFactor: 2.5 },
      { id: "dc6", front: "1 gram = ? milligrams", back: "1 g = 1000 mg", category: "Calculations", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "dc7", front: "1 milligram = ? micrograms", back: "1 mg = 1000 mcg (μg)", category: "Calculations", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "dc8", front: "1 litre = ? millilitres", back: "1 L = 1000 ml", category: "Calculations", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
    ],
  },
  {
    id: "malaria",
    name: "Malaria Management",
    description: "Diagnosis and treatment of malaria in Zambia",
    createdAt: new Date().toISOString(),
    cards: [
      { id: "ml1", front: "First-line treatment for uncomplicated malaria in Zambia", back: "Artemether-Lumefantrine (AL/Coartem)\n\n• Given for 3 days\n• Take with fatty food to improve absorption\n• Complete full course even if feeling better", category: "Malaria", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "ml2", front: "First-line treatment for SEVERE malaria", back: "IV/IM Artesunate\n\n• 2.4 mg/kg at 0, 12, and 24 hours\n• Then daily until oral therapy possible\n• Complete with full course of ACT", category: "Malaria", difficulty: "medium", timesReviewed: 0, easeFactor: 2.5 },
      { id: "ml3", front: "Signs of severe malaria", back: "• Impaired consciousness/coma (cerebral malaria)\n• Multiple convulsions\n• Prostration (unable to sit/drink)\n• Severe anemia (Hb <5 g/dL)\n• Hypoglycemia (<2.2 mmol/L)\n• Respiratory distress\n• Shock\n• Jaundice\n• Hemoglobinuria (dark urine)", category: "Malaria", difficulty: "hard", timesReviewed: 0, easeFactor: 2.5 },
      { id: "ml4", front: "Malaria test of choice", back: "GeneXpert (if available) or\nmRDT (Malaria Rapid Diagnostic Test)\n\nBlood slide for microscopy confirms species and parasitemia", category: "Malaria", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "ml5", front: "Management of hypoglycemia in severe malaria", back: "• Give 10% Dextrose 5ml/kg IV bolus\n• Recheck blood glucose in 30 minutes\n• Maintain with 10% Dextrose infusion\n• Hypoglycemia can recur - monitor closely", category: "Malaria", difficulty: "medium", timesReviewed: 0, easeFactor: 2.5 },
      { id: "ml6", front: "Pre-referral treatment for severe malaria", back: "IM Artesunate 2.4 mg/kg STAT\n\nOR rectal Artesunate (if unable to give injection)\n\nRefer immediately after giving first dose", category: "Malaria", difficulty: "medium", timesReviewed: 0, easeFactor: 2.5 },
    ],
  },
  {
    id: "hiv-tb",
    name: "HIV and TB Care",
    description: "HIV/AIDS and TB management guidelines for Zambia",
    createdAt: new Date().toISOString(),
    cards: [
      { id: "ht1", front: "First-line ART regimen in Zambia (adults)", back: "TDF + 3TC + DTG\n(Tenofovir + Lamivudine + Dolutegravir)\n\nFixed-dose combination, 1 tablet once daily", category: "HIV", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "ht2", front: "Standard TB treatment regimen", back: "2RHZE / 4RH\n\n• 2 months intensive: Rifampicin, Isoniazid, Pyrazinamide, Ethambutol\n• 4 months continuation: Rifampicin, Isoniazid\n\nTotal 6 months for drug-sensitive TB", category: "TB", difficulty: "medium", timesReviewed: 0, easeFactor: 2.5 },
      { id: "ht3", front: "What to add for HIV/TB co-infection?", back: "• Cotrimoxazole 960mg once daily (prophylaxis)\n• Pyridoxine 25mg daily (prevent INH neuropathy)\n• Adjust DTG to twice daily while on Rifampicin\n• Continue ART - never stop for TB treatment", category: "HIV/TB", difficulty: "hard", timesReviewed: 0, easeFactor: 2.5 },
      { id: "ht4", front: "CD4 threshold for OI prophylaxis", back: "Cotrimoxazole prophylaxis:\n• All HIV+ with CD4 <350\n• All HIV+ with WHO Stage 3 or 4\n• All HIV/TB co-infected\n• All HIV+ pregnant women", category: "HIV", difficulty: "medium", timesReviewed: 0, easeFactor: 2.5 },
      { id: "ht5", front: "Signs of TB (classic presentation)", back: "• Cough >2 weeks\n• Night sweats\n• Weight loss\n• Fever\n• Hemoptysis (coughing blood)\n\nRemember: Always suspect TB in HIV+ patients", category: "TB", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "ht6", front: "Viral load target on ART", back: "Undetectable = <50 copies/ml\n\nViral suppression (<1000 copies/ml) expected by 6 months of ART\n\nU=U: Undetectable = Untransmittable", category: "HIV", difficulty: "medium", timesReviewed: 0, easeFactor: 2.5 },
    ],
  },
  {
    id: "maternal",
    name: "Maternal Health",
    description: "Key concepts in antenatal, intrapartum, and postnatal care",
    createdAt: new Date().toISOString(),
    cards: [
      { id: "mh1", front: "Danger signs in pregnancy (for patient education)", back: "• Vaginal bleeding\n• Severe headache with blurred vision\n• Convulsions\n• High fever\n• Severe abdominal pain\n• Reduced fetal movement\n• Water breaking before term\n• Swelling of face/hands", category: "Maternal", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "mh2", front: "Management of PPH (Postpartum Hemorrhage)", back: "HEMOSTAT:\n• Help - call for assistance\n• Evaluate - ABC, cause\n• Massage uterus\n• Oxytocin 10IU IV + Ergometrine 0.5mg IM\n• Shift to theatre if needed\n• Tamponade (balloon)\n• Apply compression sutures\n• Transfer/transfuse", category: "Maternal", difficulty: "hard", timesReviewed: 0, easeFactor: 2.5 },
      { id: "mh3", front: "Active Management of Third Stage of Labor (AMTSL)", back: "Within 1 minute of delivery:\n1. Give Oxytocin 10 IU IM\n2. Controlled cord traction\n3. Uterine massage after placenta delivered\n\nReduces PPH risk by 60%", category: "Maternal", difficulty: "medium", timesReviewed: 0, easeFactor: 2.5 },
      { id: "mh4", front: "Definition of PPH", back: "Blood loss ≥500ml after vaginal delivery\nOR\nBlood loss ≥1000ml after cesarean section\n\nSevere PPH: >1000ml regardless of delivery mode", category: "Maternal", difficulty: "easy", timesReviewed: 0, easeFactor: 2.5 },
      { id: "mh5", front: "Magnesium Sulfate loading dose (eclampsia)", back: "4g IV over 15-20 minutes\n+\n10g IM (5g in each buttock)\n\nMaintenance: 5g IM 4-hourly OR 1g/hr IV infusion\n\nMonitor: RR, patellar reflexes, urine output", category: "Maternal", difficulty: "hard", timesReviewed: 0, easeFactor: 2.5 },
      { id: "mh6", front: "Signs of Magnesium toxicity", back: "• Loss of patellar reflexes (first sign)\n• Respiratory depression (<16/min)\n• Decreased urine output (<30ml/hr)\n\nAntidote: Calcium Gluconate 1g IV slowly", category: "Maternal", difficulty: "hard", timesReviewed: 0, easeFactor: 2.5 },
    ],
  },
];

export default function Flashcards() {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState<"browse" | "study" | "create">("browse");
  const [shuffled, setShuffled] = useState(false);
  const [studyCards, setStudyCards] = useState<Flashcard[]>([]);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, total: 0 });
  
  // Timer state for study sessions
  const [studyTimer, setStudyTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [cardTimer, setCardTimer] = useState(0);
  
  // Create deck form state
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckDescription, setNewDeckDescription] = useState("");
  const [newCards, setNewCards] = useState<{ front: string; back: string }[]>([{ front: "", back: "" }]);
  
  // AI generation state
  const [aiTopic, setAiTopic] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  // Load decks from localStorage on mount
  useEffect(() => {
    const savedDecks = localStorage.getItem("flashcardDecks");
    if (savedDecks) {
      setDecks(JSON.parse(savedDecks));
    } else {
      // Initialize with prebuilt decks
      setDecks(PREBUILT_DECKS);
      localStorage.setItem("flashcardDecks", JSON.stringify(PREBUILT_DECKS));
    }
  }, []);

  // Save decks to localStorage
  const saveDecks = (updatedDecks: FlashcardDeck[]) => {
    setDecks(updatedDecks);
    localStorage.setItem("flashcardDecks", JSON.stringify(updatedDecks));
  };

  // Study timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning && studyMode === "study") {
      interval = setInterval(() => {
        setStudyTimer(prev => prev + 1);
        setCardTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, studyMode]);

  const formatStudyTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startStudySession = (deck: FlashcardDeck) => {
    setSelectedDeck(deck);
    let cards = [...deck.cards];
    if (shuffled) {
      cards = cards.sort(() => Math.random() - 0.5);
    }
    setStudyCards(cards);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionStats({ correct: 0, incorrect: 0, total: 0 });
    setStudyMode("study");
    setStudyTimer(0);
    setCardTimer(0);
    setTimerRunning(true);
  };

  const handleAnswer = (correct: boolean) => {
    setSessionStats(prev => ({
      ...prev,
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
      total: prev.total + 1,
    }));

    // Update card's spaced repetition data
    const card = studyCards[currentCardIndex];
    const updatedCard = {
      ...card,
      timesReviewed: card.timesReviewed + 1,
      lastReviewed: new Date().toISOString(),
      easeFactor: correct ? Math.min(card.easeFactor + 0.1, 3) : Math.max(card.easeFactor - 0.2, 1.3),
    };

    // Update deck
    if (selectedDeck) {
      const updatedCards = selectedDeck.cards.map(c => 
        c.id === card.id ? updatedCard : c
      );
      const updatedDeck = { ...selectedDeck, cards: updatedCards, lastStudied: new Date().toISOString() };
      const updatedDecks = decks.map(d => d.id === selectedDeck.id ? updatedDeck : d);
      saveDecks(updatedDecks);
    }

    // Reset card timer and move to next card
    setCardTimer(0);
    if (currentCardIndex < studyCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const createDeck = () => {
    if (!newDeckName.trim() || newCards.some(c => !c.front.trim() || !c.back.trim())) {
      return;
    }

    const newDeck: FlashcardDeck = {
      id: `custom-${Date.now()}`,
      name: newDeckName.trim(),
      description: newDeckDescription.trim(),
      createdAt: new Date().toISOString(),
      cards: newCards.map((c, idx) => ({
        id: `card-${Date.now()}-${idx}`,
        front: c.front.trim(),
        back: c.back.trim(),
        category: "Custom",
        difficulty: "medium" as const,
        timesReviewed: 0,
        easeFactor: 2.5,
      })),
    };

    saveDecks([...decks, newDeck]);
    setNewDeckName("");
    setNewDeckDescription("");
    setNewCards([{ front: "", back: "" }]);
    setStudyMode("browse");
  };

  const deleteDeck = (deckId: string) => {
    if (confirm("Are you sure you want to delete this deck?")) {
      saveDecks(decks.filter(d => d.id !== deckId));
    }
  };

  const addCardField = () => {
    setNewCards([...newCards, { front: "", back: "" }]);
  };

  const updateCardField = (index: number, field: "front" | "back", value: string) => {
    const updated = [...newCards];
    updated[index][field] = value;
    setNewCards(updated);
  };

  const removeCardField = (index: number) => {
    if (newCards.length > 1) {
      setNewCards(newCards.filter((_, i) => i !== index));
    }
  };

  const currentCard = studyCards[currentCardIndex];
  const progress = studyCards.length > 0 ? ((currentCardIndex + 1) / studyCards.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-10">
        {studyMode === "browse" && (
          <>
            {/* Header */}
            <div className="mb-8">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                <BookOpen size={14} />
                Flashcards
              </div>
              <h1 className="text-3xl font-bold text-slate-900">
                Flashcard Study System
              </h1>
              <p className="mt-2 text-slate-600">
                Master nursing concepts with spaced repetition. Create your own cards or use pre-built decks.
              </p>
            </div>

            {/* Actions */}
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={() => setStudyMode("create")}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Plus size={16} />
                Create Deck
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={shuffled}
                  onChange={(e) => setShuffled(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Shuffle Cards
              </label>
            </div>

            {/* Stats Overview */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
                <FolderOpen className="mx-auto mb-2 h-6 w-6 text-indigo-500" />
                <p className="text-2xl font-bold text-slate-900">{decks.length}</p>
                <p className="text-xs text-slate-500">Decks</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
                <BookOpen className="mx-auto mb-2 h-6 w-6 text-purple-500" />
                <p className="text-2xl font-bold text-slate-900">
                  {decks.reduce((sum, d) => sum + d.cards.length, 0)}
                </p>
                <p className="text-xs text-slate-500">Total Cards</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
                <Brain className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                <p className="text-2xl font-bold text-slate-900">
                  {decks.reduce((sum, d) => sum + d.cards.filter(c => c.timesReviewed > 0).length, 0)}
                </p>
                <p className="text-xs text-slate-500">Studied</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
                <Target className="mx-auto mb-2 h-6 w-6 text-amber-500" />
                <p className="text-2xl font-bold text-slate-900">
                  {decks.filter(d => d.lastStudied).length}
                </p>
                <p className="text-xs text-slate-500">Active Decks</p>
              </div>
            </div>

            {/* Deck Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="rounded-xl bg-indigo-100 p-2">
                      <BookOpen className="h-5 w-5 text-indigo-600" />
                    </div>
                    {!deck.id.startsWith("custom-") && (
                      <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">
                        Pre-built
                      </span>
                    )}
                  </div>
                  
                  <h3 className="mb-2 text-lg font-semibold text-slate-900">{deck.name}</h3>
                  <p className="mb-4 text-sm text-slate-600 line-clamp-2">{deck.description}</p>
                  
                  <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                    <span>{deck.cards.length} cards</span>
                    {deck.lastStudied && (
                      <span>Last studied: {new Date(deck.lastStudied).toLocaleDateString()}</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => startStudySession(deck)}
                      className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Study
                    </button>
                    {deck.id.startsWith("custom-") && (
                      <button
                        onClick={() => deleteDeck(deck.id)}
                        className="rounded-lg border border-red-300 p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {studyMode === "study" && currentCard && (
          <>
            {/* Study Header */}
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setStudyMode("browse")}
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
              >
                <ChevronLeft size={16} />
                Back to Decks
              </button>
              <div className="text-sm text-slate-600">
                {selectedDeck?.name}
              </div>
            </div>

            {/* Progress & Timer */}
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  Card {currentCardIndex + 1} of {studyCards.length}
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-slate-600">
                    ✓ {sessionStats.correct} | ✗ {sessionStats.incorrect}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTimerRunning(!timerRunning)}
                      className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                    >
                      {timerRunning ? <Clock size={16} /> : <Clock size={16} className="opacity-50" />}
                    </button>
                    <span className={`font-mono text-sm ${timerRunning ? "text-indigo-600" : "text-slate-400"}`}>
                      {formatStudyTime(studyTimer)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {cardTimer > 0 && (
                <p className="mt-2 text-center text-xs text-slate-500">
                  Time on this card: {formatStudyTime(cardTimer)}
                </p>
              )}
            </div>

            {/* Flashcard */}
            <div className="mb-6 flex justify-center">
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="relative h-80 w-full max-w-xl cursor-pointer perspective-1000"
              >
                <div className={`relative h-full w-full transition-transform duration-500 transform-style-preserve-3d ${isFlipped ? "rotate-y-180" : ""}`}>
                  {/* Front */}
                  <div className="absolute inset-0 backface-hidden rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-8 shadow-lg flex flex-col items-center justify-center text-center">
                    <span className="mb-4 text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                      {currentCard.category}
                    </span>
                    <p className="text-xl font-semibold text-slate-800 whitespace-pre-wrap">
                      {currentCard.front}
                    </p>
                    <p className="mt-6 text-sm text-slate-400">Click to reveal answer</p>
                  </div>

                  {/* Back */}
                  <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8 shadow-lg flex flex-col items-center justify-center text-center">
                    <span className="mb-4 text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                      Answer
                    </span>
                    <p className="text-lg text-slate-800 whitespace-pre-wrap">
                      {currentCard.back}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Answer Buttons */}
            {isFlipped && currentCardIndex < studyCards.length - 1 && (
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => handleAnswer(false)}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-6 py-3 font-semibold text-red-700 hover:bg-red-100"
                >
                  <XCircle size={20} />
                  Got it Wrong
                </button>
                <button
                  onClick={() => handleAnswer(true)}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-green-300 bg-green-50 px-6 py-3 font-semibold text-green-700 hover:bg-green-100"
                >
                  <CheckCircle2 size={20} />
                  Got it Right
                </button>
              </div>
            )}

            {/* Session Complete */}
            {currentCardIndex === studyCards.length - 1 && isFlipped && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
                  <Star className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Session Complete!</h3>
                <p className="mt-2 text-slate-600">
                  You got {sessionStats.correct} out of {sessionStats.total} correct ({Math.round((sessionStats.correct / Math.max(sessionStats.total, 1)) * 100)}%)
                </p>
                <div className="mt-6 flex justify-center gap-4">
                  <button
                    onClick={() => startStudySession(selectedDeck!)}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
                  >
                    <RotateCcw size={16} />
                    Study Again
                  </button>
                  <button
                    onClick={() => setStudyMode("browse")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Back to Decks
                  </button>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={() => { setCurrentCardIndex(prev => Math.max(0, prev - 1)); setIsFlipped(false); }}
                disabled={currentCardIndex === 0}
                className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setIsFlipped(!isFlipped)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Flip Card
              </button>
              <button
                onClick={() => { setCurrentCardIndex(prev => Math.min(studyCards.length - 1, prev + 1)); setIsFlipped(false); }}
                disabled={currentCardIndex === studyCards.length - 1}
                className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </>
        )}

        {studyMode === "create" && (
          <>
            {/* Create Header */}
            <div className="mb-6">
              <button
                onClick={() => setStudyMode("browse")}
                className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
              >
                <ChevronLeft size={16} />
                Back to Decks
              </button>
              <h2 className="text-2xl font-bold text-slate-900">Create New Deck</h2>
              <p className="text-slate-600">Build your own flashcard deck for study</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Deck Info */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 font-semibold text-slate-900">Deck Information</h3>
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Deck Name *</span>
                    <input
                      type="text"
                      value={newDeckName}
                      onChange={(e) => setNewDeckName(e.target.value)}
                      placeholder="e.g. Pharmacology - Antibiotics"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
                    <textarea
                      value={newDeckDescription}
                      onChange={(e) => setNewDeckDescription(e.target.value)}
                      placeholder="What topics does this deck cover?"
                      rows={2}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>
                </div>
              </div>

              {/* Cards */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Cards ({newCards.length})</h3>
                  <button
                    onClick={addCardField}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-200"
                  >
                    <Plus size={14} />
                    Add Card
                  </button>
                </div>
                
                <div className="max-h-96 space-y-4 overflow-y-auto">
                  {newCards.map((card, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Card {index + 1}</span>
                        {newCards.length > 1 && (
                          <button
                            onClick={() => removeCardField(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={card.front}
                        onChange={(e) => updateCardField(index, "front", e.target.value)}
                        placeholder="Front (Question)"
                        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                      <textarea
                        value={card.back}
                        onChange={(e) => updateCardField(index, "back", e.target.value)}
                        placeholder="Back (Answer)"
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Create Button */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setStudyMode("browse")}
                className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={createDeck}
                disabled={!newDeckName.trim() || newCards.some(c => !c.front.trim() || !c.back.trim())}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save size={16} />
                Create Deck
              </button>
            </div>
          </>
        )}

      {/* CSS for 3D flip effect */}
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}
