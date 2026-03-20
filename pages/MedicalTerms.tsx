import React, { useState } from "react";
import {
  BookOpen,
  Search,
  Volume2,
  Copy,
  CheckCircle2,
  ChevronRight,
  Star,
  Lightbulb,
  Filter,
  Bookmark,
  Languages,
} from "lucide-react";

interface MedicalTerm {
  id: string;
  term: string;
  pronunciation: string;
  simpleMeaning: string;
  medicalDefinition: string;
  etymology?: string;
  examples: string[];
  relatedTerms?: string[];
  category: string;
  prefix?: string;
  suffix?: string;
  root?: string;
}

const MEDICAL_TERMS: MedicalTerm[] = [
  // Prefixes and their meanings
  {
    id: "hyper",
    term: "Hyper-",
    pronunciation: "HY-per",
    simpleMeaning: "Too much, above normal",
    medicalDefinition: "A prefix meaning excessive, above, or beyond normal limits",
    examples: ["Hypertension (high blood pressure)", "Hyperglycemia (high blood sugar)", "Hyperthermia (high body temperature)"],
    relatedTerms: ["Hypo- (opposite)"],
    category: "Prefix",
  },
  {
    id: "hypo",
    term: "Hypo-",
    pronunciation: "HY-poh",
    simpleMeaning: "Too little, below normal",
    medicalDefinition: "A prefix meaning under, below, or less than normal",
    examples: ["Hypotension (low blood pressure)", "Hypoglycemia (low blood sugar)", "Hypothermia (low body temperature)"],
    relatedTerms: ["Hyper- (opposite)"],
    category: "Prefix",
  },
  {
    id: "tachy",
    term: "Tachy-",
    pronunciation: "TAK-ee",
    simpleMeaning: "Fast, rapid",
    medicalDefinition: "A prefix meaning fast or rapid",
    examples: ["Tachycardia (fast heart rate >100 bpm)", "Tachypnea (fast breathing)", "Tachyarrhythmia (fast abnormal heart rhythm)"],
    relatedTerms: ["Brady- (opposite)"],
    category: "Prefix",
  },
  {
    id: "brady",
    term: "Brady-",
    pronunciation: "BRAY-dee",
    simpleMeaning: "Slow",
    medicalDefinition: "A prefix meaning slow",
    examples: ["Bradycardia (slow heart rate <60 bpm)", "Bradypnea (slow breathing)", "Bradykinesia (slow movement)"],
    relatedTerms: ["Tachy- (opposite)"],
    category: "Prefix",
  },
  {
    id: "poly",
    term: "Poly-",
    pronunciation: "POL-ee",
    simpleMeaning: "Many, much",
    medicalDefinition: "A prefix meaning many or much",
    examples: ["Polyuria (excessive urination)", "Polydipsia (excessive thirst)", "Polypharmacy (many medications)"],
    category: "Prefix",
  },
  {
    id: "oligo",
    term: "Oligo-",
    pronunciation: "OL-ih-go",
    simpleMeaning: "Few, little",
    medicalDefinition: "A prefix meaning scanty, few, or little",
    examples: ["Oliguria (reduced urine output)", "Oligohydramnios (low amniotic fluid)", "Oligomenorrhea (infrequent periods)"],
    relatedTerms: ["Poly- (opposite)"],
    category: "Prefix",
  },

  // Suffixes
  {
    id: "itis",
    term: "-itis",
    pronunciation: "EYE-tis",
    simpleMeaning: "Inflammation",
    medicalDefinition: "A suffix meaning inflammation of a body part",
    examples: ["Appendicitis (inflammation of appendix)", "Bronchitis (inflammation of bronchi)", "Meningitis (inflammation of meninges)"],
    category: "Suffix",
  },
  {
    id: "ectomy",
    term: "-ectomy",
    pronunciation: "EK-toh-mee",
    simpleMeaning: "Surgical removal",
    medicalDefinition: "A suffix meaning surgical removal or excision",
    examples: ["Appendectomy (removal of appendix)", "Hysterectomy (removal of uterus)", "Mastectomy (removal of breast)"],
    category: "Suffix",
  },
  {
    id: "otomy",
    term: "-otomy / -tomy",
    pronunciation: "OT-oh-mee",
    simpleMeaning: "Cutting into",
    medicalDefinition: "A suffix meaning to cut into or make an incision",
    examples: ["Tracheotomy (incision into trachea)", "Laparotomy (incision into abdomen)", "Craniotomy (incision into skull)"],
    category: "Suffix",
  },
  {
    id: "ostomy",
    term: "-ostomy",
    pronunciation: "OS-toh-mee",
    simpleMeaning: "Creating an opening",
    medicalDefinition: "A suffix meaning to create an artificial opening",
    examples: ["Colostomy (opening in colon)", "Tracheostomy (opening in trachea)", "Gastrostomy (opening in stomach)"],
    category: "Suffix",
  },
  {
    id: "pathy",
    term: "-pathy",
    pronunciation: "PATH-ee",
    simpleMeaning: "Disease or disorder",
    medicalDefinition: "A suffix meaning disease, suffering, or disorder",
    examples: ["Neuropathy (nerve disease)", "Cardiomyopathy (heart muscle disease)", "Nephropathy (kidney disease)"],
    category: "Suffix",
  },
  {
    id: "emia",
    term: "-emia",
    pronunciation: "EE-mee-ah",
    simpleMeaning: "Blood condition",
    medicalDefinition: "A suffix referring to a condition of the blood",
    examples: ["Anemia (low red blood cells)", "Septicemia (bacteria in blood)", "Hyperglycemia (high blood sugar)"],
    category: "Suffix",
  },
  {
    id: "uria",
    term: "-uria",
    pronunciation: "YOO-ree-ah",
    simpleMeaning: "Urine condition",
    medicalDefinition: "A suffix referring to urine or urination",
    examples: ["Hematuria (blood in urine)", "Glycosuria (sugar in urine)", "Dysuria (painful urination)"],
    category: "Suffix",
  },

  // Common Clinical Terms
  {
    id: "cyanosis",
    term: "Cyanosis",
    pronunciation: "sy-ah-NO-sis",
    simpleMeaning: "Blue skin color from low oxygen",
    medicalDefinition: "Bluish discoloration of skin and mucous membranes due to inadequate oxygenation of blood",
    etymology: "Greek 'kyanos' = blue",
    examples: ["Central cyanosis (lips, tongue - serious)", "Peripheral cyanosis (fingers, toes)", "In newborns, check mouth and tongue"],
    category: "Signs & Symptoms",
  },
  {
    id: "dyspnea",
    term: "Dyspnea",
    pronunciation: "DISP-nee-ah",
    simpleMeaning: "Difficulty breathing, shortness of breath",
    medicalDefinition: "Subjective sensation of uncomfortable breathing or breathlessness",
    etymology: "Greek 'dys' = difficult + 'pnea' = breathing",
    examples: ["Dyspnea on exertion (DOE)", "Orthopnea (dyspnea when lying flat)", "Paroxysmal nocturnal dyspnea (PND)"],
    category: "Signs & Symptoms",
  },
  {
    id: "edema",
    term: "Edema",
    pronunciation: "eh-DEE-mah",
    simpleMeaning: "Swelling from fluid buildup",
    medicalDefinition: "Accumulation of excess fluid in tissues causing swelling",
    etymology: "Greek 'oidema' = swelling",
    examples: ["Peripheral edema (legs, ankles)", "Pulmonary edema (lungs)", "Pitting edema (leaves indent when pressed)"],
    relatedTerms: ["Anasarca (whole body edema)"],
    category: "Signs & Symptoms",
  },
  {
    id: "pyrexia",
    term: "Pyrexia",
    pronunciation: "py-REK-see-ah",
    simpleMeaning: "Fever, high temperature",
    medicalDefinition: "Elevated body temperature above normal range (usually >37.5°C/99.5°F)",
    etymology: "Greek 'pyretos' = fever",
    examples: ["Low-grade pyrexia (37.5-38°C)", "High-grade pyrexia (>39°C)", "Hyperpyrexia (>40°C - dangerous)"],
    relatedTerms: ["Febrile, Afebrile, Hypothermia"],
    category: "Signs & Symptoms",
  },
  {
    id: "diaphoresis",
    term: "Diaphoresis",
    pronunciation: "dy-ah-for-EE-sis",
    simpleMeaning: "Excessive sweating",
    medicalDefinition: "Profuse perspiration, often associated with shock, MI, hypoglycemia, or infection",
    etymology: "Greek 'diaphorein' = to carry through",
    examples: ["Patient presented diaphoretic (sweaty)", "Diaphoresis with chest pain suggests MI", "Night sweats in TB"],
    category: "Signs & Symptoms",
  },
  {
    id: "pallor",
    term: "Pallor",
    pronunciation: "PAL-or",
    simpleMeaning: "Pale skin color",
    medicalDefinition: "Abnormal paleness of the skin, often indicating anemia, shock, or blood loss",
    etymology: "Latin 'pallere' = to be pale",
    examples: ["Pallor of conjunctivae (check for anemia)", "Pallor with tachycardia (possible bleeding)", "Pallor in shock"],
    category: "Signs & Symptoms",
  },

  // Maternal Health Terms
  {
    id: "gravida",
    term: "Gravida",
    pronunciation: "GRAV-id-ah",
    simpleMeaning: "Number of pregnancies",
    medicalDefinition: "Total number of times a woman has been pregnant, regardless of outcome",
    examples: ["G3 = pregnant 3 times", "Primigravida = first pregnancy", "Multigravida = multiple pregnancies"],
    relatedTerms: ["Para, Nulligravida"],
    category: "Obstetrics",
  },
  {
    id: "para",
    term: "Para",
    pronunciation: "PAR-ah",
    simpleMeaning: "Number of births after 24 weeks",
    medicalDefinition: "Number of pregnancies carried to viable gestational age (≥24 weeks), regardless of outcome",
    examples: ["P2 = delivered 2 times", "Nullipara = never delivered", "G4P2+1 = 4 pregnancies, 2 live births, 1 miscarriage"],
    relatedTerms: ["Gravida, Primipara, Multipara"],
    category: "Obstetrics",
  },
  {
    id: "pph",
    term: "PPH (Postpartum Hemorrhage)",
    pronunciation: "post-PAR-tum HEM-or-ij",
    simpleMeaning: "Heavy bleeding after childbirth",
    medicalDefinition: "Blood loss ≥500ml after vaginal delivery or ≥1000ml after cesarean section",
    examples: ["Primary PPH (within 24 hours)", "Secondary PPH (24 hours to 6 weeks)", "Causes: Tone, Trauma, Tissue, Thrombin (4 Ts)"],
    category: "Obstetrics",
  },
  {
    id: "eclampsia",
    term: "Eclampsia",
    pronunciation: "eh-KLAMP-see-ah",
    simpleMeaning: "Seizures in pregnancy with high BP",
    medicalDefinition: "Occurrence of convulsions in a pregnant woman with preeclampsia, not attributable to other causes",
    etymology: "Greek 'eklampsis' = sudden flash",
    examples: ["Treat with Magnesium Sulfate", "Medical emergency requiring delivery", "Warning signs: severe headache, visual changes"],
    relatedTerms: ["Preeclampsia, HELLP syndrome"],
    category: "Obstetrics",
  },

  // Pediatric Terms
  {
    id: "apgar",
    term: "APGAR Score",
    pronunciation: "AP-gar",
    simpleMeaning: "Quick health check for newborns",
    medicalDefinition: "Scoring system assessing newborn condition at 1 and 5 minutes: Appearance, Pulse, Grimace, Activity, Respiration",
    examples: ["Score 0-3: Severely depressed", "Score 4-6: Moderately depressed", "Score 7-10: Normal"],
    category: "Pediatrics",
  },
  {
    id: "jaundice",
    term: "Neonatal Jaundice",
    pronunciation: "JAWN-dis",
    simpleMeaning: "Yellow skin in newborns",
    medicalDefinition: "Yellowing of skin and sclera due to elevated bilirubin levels",
    examples: ["Physiological (normal, days 2-5)", "Pathological (within 24 hours - dangerous)", "Treat with phototherapy"],
    category: "Pediatrics",
  },

  // Infection/HIV Terms
  {
    id: "opportunistic",
    term: "Opportunistic Infection (OI)",
    pronunciation: "op-or-too-NIS-tik",
    simpleMeaning: "Infection that occurs in weakened immunity",
    medicalDefinition: "Infections that occur more frequently or are more severe in immunocompromised individuals",
    examples: ["TB in HIV patients", "Pneumocystis pneumonia (PCP)", "Cryptococcal meningitis", "Candidiasis"],
    category: "HIV/Infectious Disease",
  },
  {
    id: "viral-load",
    term: "Viral Load",
    pronunciation: "VY-ral lode",
    simpleMeaning: "Amount of virus in blood",
    medicalDefinition: "Measurement of HIV RNA copies per milliliter of blood, indicating disease activity",
    examples: ["Undetectable: <50 copies/ml", "Suppressed: <1000 copies/ml", "Treatment goal: undetectable VL"],
    category: "HIV/Infectious Disease",
  },
];

const CATEGORIES = [
  "All",
  "Prefix",
  "Suffix", 
  "Signs & Symptoms",
  "Obstetrics",
  "Pediatrics",
  "HIV/Infectious Disease",
];

export default function MedicalTerms() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);
  const [savedTerms, setSavedTerms] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const filteredTerms = MEDICAL_TERMS.filter(term => {
    const matchesCategory = selectedCategory === "All" || term.category === selectedCategory;
    const matchesSearch = term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         term.simpleMeaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         term.medicalDefinition.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleSaved = (termId: string) => {
    setSavedTerms(prev => 
      prev.includes(termId) 
        ? prev.filter(id => id !== termId)
        : [...prev, termId]
    );
  };

  const copyTerm = (text: string, termId: string) => {
    navigator.clipboard.writeText(text);
    setCopied(termId);
    setTimeout(() => setCopied(null), 2000);
  };

  const speakTerm = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
            <Languages size={14} />
            Medical Terminology
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Medical Terms Explained Simply
          </h1>
          <p className="mt-2 text-slate-600">
            Break down complex medical terms into simple language. Learn prefixes, suffixes, and common clinical terms.
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search terms (e.g., 'hyper', 'inflammation', 'breathing')..."
              className="w-full rounded-xl border border-slate-300 py-3 pl-12 pr-4 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
                selectedCategory === cat
                  ? "bg-cyan-600 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
          {savedTerms.length > 0 && (
            <button
              onClick={() => setSelectedCategory("Saved")}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                selectedCategory === "Saved"
                  ? "bg-amber-600 text-white"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200"
              }`}
            >
              <Star size={14} />
              Saved ({savedTerms.length})
            </button>
          )}
        </div>

        {/* Quick Tip */}
        <div className="mb-6 rounded-xl bg-cyan-50 border border-cyan-200 p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-600" />
            <div className="text-sm text-cyan-800">
              <p className="font-semibold">Tip: Break down complex words!</p>
              <p>Most medical terms are made of prefixes + roots + suffixes. Learn these building blocks to understand any term.</p>
              <p className="mt-1">Example: <span className="font-mono bg-white px-1 rounded">Tachy-card-ia</span> = fast + heart + condition = fast heart rate</p>
            </div>
          </div>
        </div>

        {/* Terms List */}
        <div className="space-y-3">
          {(selectedCategory === "Saved" 
            ? MEDICAL_TERMS.filter(t => savedTerms.includes(t.id))
            : filteredTerms
          ).map((term) => (
            <div
              key={term.id}
              className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              {/* Term Header */}
              <div
                className="flex cursor-pointer items-center justify-between p-4 hover:bg-slate-50"
                onClick={() => setExpandedTerm(expandedTerm === term.id ? null : term.id)}
              >
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    term.category === "Prefix" ? "bg-blue-100 text-blue-700" :
                    term.category === "Suffix" ? "bg-purple-100 text-purple-700" :
                    term.category === "Obstetrics" ? "bg-pink-100 text-pink-700" :
                    term.category === "Pediatrics" ? "bg-green-100 text-green-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    {term.category}
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900">{term.term}</h3>
                    <p className="text-sm text-slate-600">{term.simpleMeaning}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSaved(term.id); }}
                    className={`rounded-lg p-2 ${savedTerms.includes(term.id) ? "text-amber-500" : "text-slate-400 hover:text-amber-500"}`}
                  >
                    <Star size={18} fill={savedTerms.includes(term.id) ? "currentColor" : "none"} />
                  </button>
                  <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${expandedTerm === term.id ? "rotate-90" : ""}`} />
                </div>
              </div>

              {/* Expanded Content */}
              {expandedTerm === term.id && (
                <div className="border-t border-slate-200 bg-slate-50 p-4">
                  {/* Pronunciation */}
                  <div className="mb-4 flex items-center gap-3">
                    <button
                      onClick={() => speakTerm(term.term)}
                      className="inline-flex items-center gap-2 rounded-lg bg-cyan-100 px-3 py-1.5 text-sm font-medium text-cyan-700 hover:bg-cyan-200"
                    >
                      <Volume2 size={14} />
                      {term.pronunciation}
                    </button>
                    <button
                      onClick={() => copyTerm(`${term.term}: ${term.simpleMeaning}`, term.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      {copied === term.id ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                      {copied === term.id ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  {/* Medical Definition */}
                  <div className="mb-4">
                    <h4 className="mb-1 text-sm font-semibold text-slate-700">Medical Definition:</h4>
                    <p className="text-sm text-slate-600">{term.medicalDefinition}</p>
                  </div>

                  {/* Etymology */}
                  {term.etymology && (
                    <div className="mb-4">
                      <h4 className="mb-1 text-sm font-semibold text-slate-700">Origin:</h4>
                      <p className="text-sm italic text-slate-600">{term.etymology}</p>
                    </div>
                  )}

                  {/* Examples */}
                  <div className="mb-4">
                    <h4 className="mb-2 text-sm font-semibold text-slate-700">Examples:</h4>
                    <ul className="space-y-1">
                      {term.examples.map((example, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-cyan-500">•</span>
                          {example}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Related Terms */}
                  {term.relatedTerms && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-slate-700">Related Terms:</h4>
                      <div className="flex flex-wrap gap-2">
                        {term.relatedTerms.map((related, idx) => (
                          <span key={idx} className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs text-slate-600">
                            {related}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredTerms.length === 0 && selectedCategory !== "Saved" && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Search className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700">No terms found</h3>
            <p className="text-slate-500">Try a different search term</p>
          </div>
        )}

        {/* Common Word Parts Reference */}
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Quick Reference: Common Word Parts</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h4 className="mb-2 font-semibold text-blue-700">Body Parts (Roots)</h4>
              <ul className="space-y-1 text-sm text-slate-600">
                <li><strong>cardi-</strong> = heart</li>
                <li><strong>hepat-</strong> = liver</li>
                <li><strong>nephr-</strong> = kidney</li>
                <li><strong>pulmon-</strong> = lung</li>
                <li><strong>gastr-</strong> = stomach</li>
                <li><strong>neur-</strong> = nerve</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold text-purple-700">Conditions (Suffixes)</h4>
              <ul className="space-y-1 text-sm text-slate-600">
                <li><strong>-itis</strong> = inflammation</li>
                <li><strong>-osis</strong> = abnormal condition</li>
                <li><strong>-pathy</strong> = disease</li>
                <li><strong>-algia</strong> = pain</li>
                <li><strong>-emia</strong> = blood condition</li>
                <li><strong>-pnea</strong> = breathing</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold text-green-700">Procedures (Suffixes)</h4>
              <ul className="space-y-1 text-sm text-slate-600">
                <li><strong>-ectomy</strong> = removal</li>
                <li><strong>-otomy</strong> = cut into</li>
                <li><strong>-ostomy</strong> = opening</li>
                <li><strong>-plasty</strong> = repair</li>
                <li><strong>-scopy</strong> = viewing</li>
                <li><strong>-gram</strong> = record</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
  );
}
