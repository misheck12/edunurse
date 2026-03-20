import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Activity, ClipboardList, Thermometer, Calendar, CheckCircle2, ArrowRight, ArrowLeft, Sparkles, Loader2, FileText } from 'lucide-react';

import { useDocument } from '../src/context/DocumentContext';
import { UpgradeBanner } from '../src/components/UpgradeBanner';
import { PaymentModal } from '../src/components/PaymentModal';
import SEO from '../src/components/SEO';
import {
  getCurriculumPlannerOptions,
  getCurriculumPlannerSuggestions,
  getStudioServices,
} from '../src/services/backendApi';

function sanitizePlannerLine(line: string) {
  const cleaned = line
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u00A0\t\r]+/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/__+/g, '')
    .replace(/`/g, '')
    .replace(/^\s*(?:[-*\u2022]|\d+[\.\)]|[a-z][\.\)]|[ivxlcdm]+[\.\)]|\(\d+\)|\[[x ]\])\s+/i, '')
    .replace(/^(?:learning\s+objectives?|learning\s+outcomes?|objectives?|outcomes?)\s*:\s*/i, '')
    .replace(/^\s*(?:\"|')+/, '')
    .replace(/(?:\"|')+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';
  if (cleaned.length < 10 || cleaned.length > 280) return '';
  if (/^(table|figure|references?|appendix|unknown section type)\b/i.test(cleaned)) return '';
  if (/^[^a-z0-9]+$/i.test(cleaned)) return '';

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function sanitizePlannerLines(lines: string[]) {
  const keys = new Set<string>();
  const unique: string[] = [];

  for (const raw of lines) {
    const cleaned = sanitizePlannerLine(raw);
    if (!cleaned) continue;
    const key = cleaned
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!key || keys.has(key)) continue;
    keys.add(key);
    unique.push(cleaned);
  }

  return unique;
}

function normalizePlannerOption(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function plannerOptionMatches(options: string[], value: string) {
  const needle = normalizePlannerOption(value);
  if (!needle) return false;

  return options.some((option) => {
    const normalized = normalizePlannerOption(option);
    return (
      normalized === needle ||
      normalized.includes(needle) ||
      needle.includes(normalized)
    );
  });
}

const CreateWizard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { createNewDocument, error, clearError } = useDocument();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<string>('Theory Lesson Plan');
  const [loadingText, setLoadingText] = useState('Initializing Curriculum Intelligence...');

  // Context Form State
  const [programme, setProgramme] = useState('Nursing');
  const [programmeLevel, setProgrammeLevel] = useState('Diploma');
  const [semester, setSemester] = useState('');
  const [course, setCourse] = useState('');
  const [topic, setTopic] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [subtopic, setSubtopic] = useState('');
  const [minorTopic, setMinorTopic] = useState('');
  const [objectivesText, setObjectivesText] = useState('');
  const [outcomesText, setOutcomesText] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [durationManuallyEdited, setDurationManuallyEdited] = useState(false);
  const [strictCurriculumAlignment, setStrictCurriculumAlignment] = useState(true);

  const [plannerOptions, setPlannerOptions] = useState<{
    programmeLevels: string[];
    semesters: string[];
    courses: string[];
    topics: string[];
    subtopics: string[];
    minorTopics: string[];
  }>({
    programmeLevels: ['Diploma', 'BSc'],
    semesters: [],
    courses: [],
    topics: [],
    subtopics: [],
    minorTopics: [],
  });
  const [isLoadingPlannerOptions, setIsLoadingPlannerOptions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [studioServiceState, setStudioServiceState] = useState<
    Record<string, { enabled: boolean; reason?: string | null }>
  >({});

  const hasStartedGenerationRef = useRef(false);
  const semesterRequired = true;
  const courseMatchesSelection =
    course.trim().length === 0 ||
    plannerOptions.courses.length === 0 ||
    plannerOptionMatches(plannerOptions.courses, course);
  const topicMatchesSelection =
    topic.trim().length === 0 ||
    plannerOptions.topics.length === 0 ||
    plannerOptionMatches(plannerOptions.topics, topic);
  const contextIsValid =
    (!semesterRequired || semester.trim().length > 0) &&
    course.trim().length > 0 &&
    topic.trim().length > 0 &&
    courseMatchesSelection &&
    topicMatchesSelection;

  const docTypes = [
    {
      id: 'theory_lesson_plan',
      name: 'Theory Lesson Plan',
      desc: 'Outcomes, content breakdown, and activities.',
      icon: BookOpen,
      color: 'blue',
    },
    {
      id: 'skills_lab_plan',
      name: 'Skills Lab Plan',
      desc: 'Equipment, scripts, and practice flow.',
      icon: Thermometer,
      color: 'teal',
    },
    {
      id: 'clinical_teaching_plan',
      name: 'Clinical Teaching Plan',
      desc: 'Ward-based targets and reflection prompts.',
      icon: Activity,
      color: 'emerald',
    },
    {
      id: 'osce_station',
      name: 'OSCE Station',
      desc: 'Scenario, actor script, and scoring rubric.',
      icon: ClipboardList,
      color: 'rose',
    },
    {
      id: 'assessment_tool',
      name: 'Assessment Tool',
      desc: 'MCQs, SAQs, and case studies.',
      icon: FileText,
      color: 'indigo',
    },
    {
      id: 'scheme_of_work',
      name: 'Scheme of Work',
      desc: 'Semester-long planning and mapping.',
      icon: Calendar,
      color: 'amber',
    },
  ] as const;

  const selectedTypeAvailability = docTypes.find(
    (type) => type.name === selectedType,
  );
  const selectedTypeEnabled =
    selectedTypeAvailability
      ? studioServiceState[selectedTypeAvailability.id]?.enabled ?? true
      : true;
  const selectedTypeDisabledReason =
    selectedTypeAvailability
      ? studioServiceState[selectedTypeAvailability.id]?.reason?.trim()
      : undefined;

  const parseLines = (input: string) =>
    sanitizePlannerLines(input.split(/\r?\n/));

  const formatSemesterOption = (value: string) =>
    value
      .replace(/^\d+\.\s*/, '')
      .replace(/\bYEAR\s+ONE\b/gi, 'Year 1')
      .replace(/\bYEAR\s+TWO\b/gi, 'Year 2')
      .replace(/\bYEAR\s+THREE\b/gi, 'Year 3')
      .replace(/\bSEMESTER\s+ONE\b/gi, 'Semester 1')
      .replace(/\bSEMESTER\s+TWO\b/gi, 'Semester 2')
      .replace(/\s+/g, ' ')
      .trim();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const templateId = params.get('templateId');
    setSelectedTemplateId(templateId || undefined);

    const directDocType = params.get('documentType');
    if (directDocType && docTypes.some((item) => item.name === directDocType)) {
      setSelectedType(directDocType);
    }

    if (params.get('source') !== 'curriculum') return;

    const documentType = params.get('documentType');
    if (documentType && docTypes.some((item) => item.name === documentType)) {
      setSelectedType(documentType);
    }

    const nextProgramme = params.get('programme');
    if (nextProgramme) setProgramme(nextProgramme);

    const nextProgrammeLevel = params.get('programmeLevel');
    if (nextProgrammeLevel) setProgrammeLevel(nextProgrammeLevel);

    const nextSemester = params.get('semester') || params.get('year');
    if (nextSemester) setSemester(nextSemester);

    const nextCourse = params.get('course');
    if (nextCourse) setCourse(nextCourse);

    const nextTopic = params.get('topic');
    if (nextTopic) setTopic(nextTopic);

    const nextSubtopic = params.get('subtopic');
    if (nextSubtopic) setSubtopic(nextSubtopic);

    const nextMinorTopic = params.get('minorTopic');
    if (nextMinorTopic) setMinorTopic(nextMinorTopic);

    setStep(2);
  }, [location.search]);

  useEffect(() => {
    if (step !== 2) return;

    let active = true;
    setIsLoadingPlannerOptions(true);

    const loadOptions = async () => {
      try {
        const response = await getCurriculumPlannerOptions({
          programme,
          programmeLevel,
          semester: semester.trim() || undefined,
          course: course.trim() || undefined,
          topic: topic.trim() || undefined,
          subtopic: subtopic.trim() || undefined,
          minorTopic: minorTopic.trim() || undefined,
          limit: 80,
        });

        if (!active) return;

        setPlannerOptions({
          programmeLevels:
            response.programmeLevels.length > 0
              ? response.programmeLevels
              : ['Diploma', 'BSc'],
          semesters: response.semesters,
          courses: response.courses,
          topics: response.topics,
          subtopics: response.subtopics,
          minorTopics: response.minorTopics,
        });
      } catch {
        if (!active) return;
      } finally {
        if (active) {
          setIsLoadingPlannerOptions(false);
        }
      }
    };

    void loadOptions();

    return () => {
      active = false;
    };
  }, [step, programme, programmeLevel, semester, course, topic, subtopic, minorTopic]);

  useEffect(() => {
    let active = true;
    const loadStudioServices = async () => {
      try {
        const response = await getStudioServices();
        if (!active) return;
        const nextState = response.items.reduce<Record<string, { enabled: boolean; reason?: string | null }>>(
          (acc, item) => {
            acc[item.id] = {
              enabled: item.enabled,
              reason: item.reason ?? null,
            };
            return acc;
          },
          {},
        );
        setStudioServiceState(nextState);
      } catch {
        if (!active) return;
        setStudioServiceState({});
      }
    };

    void loadStudioServices();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const selected = docTypes.find((type) => type.name === selectedType);
    if (!selected) return;
    const isEnabled = studioServiceState[selected.id]?.enabled ?? true;
    if (isEnabled) return;

    const fallback = docTypes.find(
      (type) => (studioServiceState[type.id]?.enabled ?? true) === true,
    );
    if (fallback) {
      setSelectedType(fallback.name);
    }
  }, [selectedType, studioServiceState]);

  useEffect(() => {
    if (step !== 2) return;
    if (!course.trim() || !topic.trim()) {
      setObjectivesText('');
      setOutcomesText('');
      setSuggestionsError(null);
      return;
    }
    if (
      !isLoadingPlannerOptions &&
      plannerOptions.courses.length > 0 &&
      !plannerOptionMatches(plannerOptions.courses, course)
    ) {
      setObjectivesText('');
      setOutcomesText('');
      setSuggestionsError('Select a valid course/module from the dropdown to load curriculum-aligned content.');
      return;
    }
    if (
      !isLoadingPlannerOptions &&
      plannerOptions.topics.length > 0 &&
      !plannerOptionMatches(plannerOptions.topics, topic)
    ) {
      setObjectivesText('');
      setOutcomesText('');
      setSuggestionsError('Select a valid topic from the dropdown to load curriculum-aligned content.');
      return;
    }

    let active = true;
    setIsLoadingSuggestions(true);
    setSuggestionsError(null);

    const loadSuggestions = async () => {
      try {
        const response = await getCurriculumPlannerSuggestions({
          programme,
          programmeLevel,
          semester: semester.trim() || undefined,
          course: course.trim(),
          topic: topic.trim(),
          subtopic: subtopic.trim() || undefined,
          minorTopic: minorTopic.trim() || undefined,
          limit: 8,
        });

        if (!active) return;

        const sanitizedObjectives = sanitizePlannerLines(response.objectives);
        const sanitizedOutcomes = sanitizePlannerLines(response.outcomes);
        setObjectivesText(sanitizedObjectives.join('\n'));
        setOutcomesText(sanitizedOutcomes.join('\n'));
        if (
          !durationManuallyEdited &&
          typeof response.durationMinutesHint === 'number' &&
          Number.isFinite(response.durationMinutesHint) &&
          response.durationMinutesHint > 0
        ) {
          setDurationMinutes(Math.max(15, Math.round(response.durationMinutesHint)));
        }
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to auto-populate objectives and outcomes.';
        setSuggestionsError(message);
      } finally {
        if (active) {
          setIsLoadingSuggestions(false);
        }
      }
    };

    void loadSuggestions();

    return () => {
      active = false;
    };
  }, [
    step,
    programme,
    programmeLevel,
    semester,
    course,
    topic,
    subtopic,
    minorTopic,
    durationManuallyEdited,
    isLoadingPlannerOptions,
    plannerOptions.courses,
    plannerOptions.topics,
  ]);

  // AI Loading Animation Effect
  useEffect(() => {
    if (step === 3 && !hasStartedGenerationRef.current) {
      hasStartedGenerationRef.current = true;
      clearError();
      const texts = [
        'Connecting to Curriculum Intelligence Layer...',
        'Retrieving curriculum hierarchy and competencies...',
        'Structuring Document Schema...',
        'Generating Section: Learning Outcomes...',
        'Generating Section: Teaching Methodology...',
        'Generating Section: Assessment Rubric...',
        'Validating Curriculum Citations...',
      ];
      let i = 0;
      setLoadingText(texts[0]);

      // Trigger Generation
      const generate = async () => {
        try {
          await createNewDocument(selectedType, {
            programme,
            programmeLevel,
            semester,
            year: semester,
            course: course.trim() || undefined,
            topic: topic.trim(),
            templateId: selectedTemplateId,
            subtopic: subtopic.trim() || undefined,
            minorTopic: minorTopic.trim() || undefined,
            objectives: parseLines(objectivesText),
            outcomes: parseLines(outcomesText),
            durationMinutes,
            strictCurriculumAlignment,
          });
          navigate('/editor');
        } catch {
          hasStartedGenerationRef.current = false;
          setStep(2);
        }
      };

      const interval = setInterval(() => {
        i++;
        if (i < texts.length) {
          setLoadingText(texts[i]);
        }
      }, 800);

      void generate();

      return () => clearInterval(interval);
    }
    if (step !== 3) {
      hasStartedGenerationRef.current = false;
    }
  }, [
    step,
    navigate,
    selectedType,
    programme,
    programmeLevel,
    semester,
    course,
    topic,
    subtopic,
    minorTopic,
    objectivesText,
    outcomesText,
    durationMinutes,
    strictCurriculumAlignment,
    selectedTemplateId,
    createNewDocument,
    clearError,
  ]);

  return (
    <div className="flex w-full flex-col items-center px-3 py-6 sm:px-6 sm:py-8">
      <SEO
        title="Create New Document"
        description="Create AI-powered lesson plans, OSCE stations, clinical teaching plans, and assessments aligned to the nursing and midwifery curriculum."
        canonicalPath="/create"
        keywords="create lesson plan, OSCE generator, nursing assessment, clinical teaching plan"
      />
      <div className="w-full max-w-4xl">
        <UpgradeBanner
          onUpgradeClick={() => setShowPaymentModal(true)}
          variant="editor"
          dismissible={false}
        />

        {/* Header */}
        <div className="mb-8 text-center sm:mb-10">
          <h2 className="text-3xl font-semibold mb-2 text-slate-900">Document Generation Studio</h2>
          <p className="text-slate-500">Create professional, inspection-ready documents grounded in curriculum standards.</p>
        </div>

        {/* Stepper */}
        <div className="mb-12">
          <div className="flex items-center justify-center w-full max-w-2xl mx-auto relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10" />
            <div
              className="absolute top-1/2 left-0 h-0.5 bg-blue-600 -z-10 transition-all duration-500 ease-in-out"
              style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
            />

            <div className="flex-1 flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ring-4 ring-white transition-colors duration-300 ${step >= 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                {step > 1 ? <CheckCircle2 size={20} /> : '1'}
              </div>
              <span className={`mt-2 text-xs font-medium sm:text-sm ${step >= 1 ? 'text-blue-600' : 'text-slate-500'}`}>Type</span>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ring-4 ring-white transition-colors duration-300 ${step >= 2 ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                {step > 2 ? <CheckCircle2 size={20} /> : '2'}
              </div>
              <span className={`mt-2 text-center text-xs font-medium sm:text-sm ${step >= 2 ? 'text-blue-600' : 'text-slate-500'}`}>Curriculum Context</span>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ring-4 ring-white transition-colors duration-300 ${step >= 3 ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                3
              </div>
              <span className={`mt-2 text-xs font-medium sm:text-sm ${step >= 3 ? 'text-blue-600' : 'text-slate-500'}`}>Generate</span>
            </div>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 min-h-[500px] flex flex-col">
          <div className="w-full h-1 bg-slate-100">
            <div className="h-full bg-blue-600 rounded-r-full transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }}></div>
          </div>

          <div className="flex-1 p-4 sm:p-6 md:p-10">

            {/* STEP 1: SELECT TYPE */}
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-6 flex items-center gap-2">
                  <h3 className="text-xl font-medium text-slate-900">Select Document Type</h3>
                </div>
                {selectedTemplateId && (
                  <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    Template selected for generation.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {docTypes.map((type) => {
                    const availability = studioServiceState[type.id];
                    const enabled = availability?.enabled ?? true;
                    const disabledReason = availability?.reason?.trim();
                    return (
                      <button
                        key={type.name}
                        onClick={() => {
                          if (!enabled) return;
                          setSelectedType(type.name);
                        }}
                        disabled={!enabled}
                        className={`group relative flex flex-col items-start p-5 rounded-xl border-2 text-left transition-all ${selectedType === type.name
                            ? 'border-blue-500 bg-blue-50/50 shadow-inner'
                            : enabled
                              ? 'border-slate-200 hover:border-blue-300 bg-white'
                              : 'border-slate-200 bg-slate-100 opacity-70 cursor-not-allowed'
                          }`}
                      >
                        <div className={`w-10 h-10 rounded-lg bg-${type.color}-50 text-${type.color}-600 flex items-center justify-center mb-3`}>
                          <type.icon size={20} />
                        </div>
                        <h4 className="font-semibold text-slate-800 mb-1">{type.name}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">{type.desc}</p>
                        {!enabled && (
                          <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
                            {disabledReason || "Unavailable right now."}
                          </p>
                        )}

                        <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border flex items-center justify-center ${selectedType === type.name ? 'border-blue-500' : 'border-slate-300'
                          }`}>
                          {selectedType === type.name && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!selectedTypeEnabled && (
                  <p className="mt-4 text-sm text-amber-700">
                    {selectedTypeDisabledReason ||
                      "This document type is currently unavailable. Choose another type."}
                  </p>
                )}
              </div>
            )}

            {/* STEP 2: CURRICULUM SETUP */}
            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-6">
                  <h3 className="text-xl font-medium text-slate-900">Define Curriculum Context</h3>
                  <p className="text-slate-500">Pick programme level, semester, course, topic, subtopic and minor topic. Objectives/outcomes are auto-populated.</p>
                </div>
                {error && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {suggestionsError && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {suggestionsError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Programme</label>
                      <select
                        value={programme}
                        onChange={(e) => {
                          setProgramme(e.target.value);
                          setSemester('');
                          setCourse('');
                          setTopic('');
                          setSubtopic('');
                          setMinorTopic('');
                          setObjectivesText('');
                          setOutcomesText('');
                          setDurationManuallyEdited(false);
                        }}
                        className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white"
                      >
                        <option>Nursing</option>
                        <option>Midwifery</option>
                        <option>Public Health Nursing</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Programme Level</label>
                      <select
                        value={programmeLevel}
                        onChange={(e) => {
                          setProgrammeLevel(e.target.value);
                          setSemester('');
                          setCourse('');
                          setTopic('');
                          setSubtopic('');
                          setMinorTopic('');
                          setObjectivesText('');
                          setOutcomesText('');
                          setDurationManuallyEdited(false);
                        }}
                        className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white"
                      >
                        {(plannerOptions.programmeLevels.length > 0
                          ? plannerOptions.programmeLevels
                          : ['Diploma', 'BSc']).map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Semester</label>
                      <select
                        value={semester}
                        onChange={(e) => {
                          setSemester(e.target.value);
                          setCourse('');
                          setTopic('');
                          setSubtopic('');
                          setMinorTopic('');
                          setDurationManuallyEdited(false);
                        }}
                        className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white"
                      >
                        <option value="">Select semester</option>
                        {plannerOptions.semesters.map((value) => (
                          <option key={value} value={value}>{formatSemesterOption(value)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Course / Module</label>
                      <select
                        value={course}
                        onChange={(e) => {
                          setCourse(e.target.value);
                          setTopic('');
                          setSubtopic('');
                          setMinorTopic('');
                          setDurationManuallyEdited(false);
                        }}
                        className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white"
                      >
                        <option value="">Select course/module</option>
                        {plannerOptions.courses.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Topic</label>
                      <select
                        value={topic}
                        onChange={(e) => {
                          setTopic(e.target.value);
                          setSubtopic('');
                          setMinorTopic('');
                          setDurationManuallyEdited(false);
                        }}
                        className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white"
                      >
                        <option value="">Select topic</option>
                        {plannerOptions.topics.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Subtopic (Optional)</label>
                      <select
                        value={subtopic}
                        onChange={(e) => {
                          setSubtopic(e.target.value);
                          setMinorTopic('');
                          setDurationManuallyEdited(false);
                        }}
                        className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white"
                      >
                        <option value="">None</option>
                        {plannerOptions.subtopics.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Minor Topic (Optional)</label>
                      <select
                        value={minorTopic}
                        onChange={(e) => {
                          setMinorTopic(e.target.value);
                          setDurationManuallyEdited(false);
                        }}
                        className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white"
                      >
                        <option value="">None</option>
                        {plannerOptions.minorTopics.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Session Duration (Minutes)</label>
                      <input
                        type="number"
                        min={15}
                        step={5}
                        value={durationMinutes}
                        onChange={(e) => {
                          setDurationManuallyEdited(true);
                          setDurationMinutes(Number(e.target.value) || 60);
                        }}
                        className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white"
                      />
                    </div>

                    {!contextIsValid && (
                      <p className="text-xs text-red-600">
                        {semesterRequired
                          ? 'Semester, course and topic are required before generation.'
                          : 'Course and topic are required before generation.'}
                      </p>
                    )}
                    {!courseMatchesSelection && course.trim().length > 0 && (
                      <p className="text-xs text-amber-700">
                        Selected course is not aligned to the current semester/programme. Please pick from the list.
                      </p>
                    )}
                    {!topicMatchesSelection && topic.trim().length > 0 && (
                      <p className="text-xs text-amber-700">
                        Selected topic is not aligned to the selected course. Please pick from the list.
                      </p>
                    )}
                    {isLoadingPlannerOptions && (
                      <p className="text-xs text-slate-500">Refreshing curriculum options...</p>
                    )}
                    {isLoadingSuggestions && (
                      <p className="text-xs text-slate-500">Auto-populating objectives and outcomes...</p>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                          <CheckCircle2 size={20} />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="font-medium text-slate-900">Curriculum Grounding</label>
                            <button
                              type="button"
                              onClick={() => setStrictCurriculumAlignment((prev) => !prev)}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${strictCurriculumAlignment ? 'bg-blue-600' : 'bg-slate-300'}`}
                            >
                              <span className={`${strictCurriculumAlignment ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
                            </button>
                          </div>
                          <p className="text-sm text-slate-500 leading-relaxed">
                            Curriculum alignment uses selected hierarchy (level, semester, course, topic, subtopic, minor topic) and retrieved source chunks.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Objectives (Auto-populated, editable)</label>
                      <textarea
                        value={objectivesText}
                        onChange={(e) => setObjectivesText(e.target.value)}
                        rows={7}
                        className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white text-sm"
                        placeholder="Objectives will populate from curriculum context."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Outcomes (Auto-populated, editable)</label>
                      <textarea
                        value={outcomesText}
                        onChange={(e) => setOutcomesText(e.target.value)}
                        rows={7}
                        className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 px-3 border bg-white text-sm"
                        placeholder="Outcomes will populate from curriculum context."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: LOADING */}
            {step === 3 && (
              <div className="h-full flex flex-col items-center justify-center py-10 animate-in fade-in duration-500">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl animate-pulse"></div>
                  <div className="relative bg-white p-4 rounded-full shadow-lg border border-slate-100">
                    <Sparkles size={48} className="text-blue-600 animate-spin-slow" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Generating Structured Document</h3>
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="font-medium animate-pulse">{loadingText}</span>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          {step < 3 && (
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-8">
              {step === 1 ? (
                <button
                  onClick={() => navigate('/')}
                  className="w-full rounded-lg border border-slate-300 px-6 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-100 sm:w-auto"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-6 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-100 sm:w-auto"
                >
                  <ArrowLeft size={18} /> Back
                </button>
              )}

              <button
                onClick={() => setStep(step + 1)}
                disabled={(step === 1 && !selectedTypeEnabled) || (step === 2 && !contextIsValid)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-8 py-2.5 font-medium text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {step === 2 ? 'Generate Document' : 'Next Step'}
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          setShowPaymentModal(false);
          window.location.reload();
        }}
      />
    </div>
  );
};

export default CreateWizard;
