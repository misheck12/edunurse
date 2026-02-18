import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BookOpen,
  ClipboardList,
  Copy,
  Eye,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  BackendDocumentType,
  TemplateLibraryItem,
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from "../src/services/backendApi";

type TemplateFormState = {
  name: string;
  documentType: BackendDocumentType;
  description: string;
  templateSchemaVersion: number;
};

type TemplateSectionShape = {
  key?: string;
  title?: string;
  type?: string;
  content?: unknown;
  columns?: string[];
  rows?: Array<Record<string, unknown>>;
};

function normalizeTemplateJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeTemplateSections(value: unknown): TemplateSectionShape[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === "object" ? (item as TemplateSectionShape) : null))
    .filter((item): item is TemplateSectionShape => Boolean(item));
}

function sampleListItems(title: string): string[] {
  if (/objective/i.test(title)) {
    return [
      "Define core concepts in the selected topic.",
      "Explain relevance to nursing and midwifery practice.",
      "Apply concepts to one clinical scenario.",
    ];
  }
  if (/reference/i.test(title)) {
    return [
      "NMCZ Curriculum Module (latest approved version).",
      "Teaching Guide and Local Clinical Protocol.",
      "Instructor Notes and Supplementary Reading.",
    ];
  }
  if (/evaluation/i.test(title)) {
    return [
      "Ask oral questions linked to the objective.",
      "Observe learner participation and responses.",
      "Use short formative checklist for competence.",
    ];
  }
  return [
    "Facilitator introduces the section scope.",
    "Learners discuss and respond to guided prompts.",
    "Facilitator summarizes key learning points.",
  ];
}

function renderTemplatePreviewSection(
  section: TemplateSectionShape,
  index: number,
): React.ReactNode {
  const title = section.title?.trim() || `Section ${index + 1}`;
  const type = section.type?.trim() || "text";
  const sectionKey = section.key?.toLowerCase() ?? "";

  if (type === "table") {
    const lessonColumns = [
      "Time",
      "Specific Objective",
      "Content",
      "Teacher Activity",
      "Student Activity",
      "Resources",
      "Evaluation",
    ];
    const genericColumns = ["Item", "Description", "Notes"];
    const columns =
      Array.isArray(section.columns) && section.columns.length > 0
        ? section.columns
        : sectionKey === "lesson_presentation" || sectionKey === "teaching_flow"
          ? lessonColumns
          : genericColumns;
    const rows = [
      [
        "10 min",
        "Introduce session context",
        "Definition and overview with key terms.",
        "Guide discussion and clarify concepts.",
        "Respond to prompts and take notes.",
        "Whiteboard, handbook",
        "Oral questioning",
      ],
      [
        "20 min",
        "Develop core understanding",
        "Detailed explanation with examples.",
        "Demonstrate and facilitate reflection.",
        "Pair discussion and short feedback.",
        "Charts, slides",
        "Checklist",
      ],
    ];

    return (
      <div key={`${title}-${index}`} className="mb-6">
        <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
          {title}
        </h4>
        <div className="overflow-x-auto border border-slate-300">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr>
                {columns.map((column, colIndex) => (
                  <th
                    key={`${column}-${colIndex}`}
                    className="border border-slate-300 bg-slate-100 px-2 py-2 text-left font-bold text-slate-700"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {columns.map((_, colIndex) => (
                    <td key={`cell-${rowIndex}-${colIndex}`} className="border border-slate-300 px-2 py-2 align-top text-slate-700">
                      {row[colIndex] ?? `Sample content ${rowIndex + 1}`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (type === "list" || type === "duration_list") {
    return (
      <div key={`${title}-${index}`} className="mb-6">
        <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
          {title}
        </h4>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {sampleListItems(title).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div key={`${title}-${index}`} className="mb-6">
      <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
        {title}
      </h4>
      <p className="text-sm leading-6 text-slate-700">
        This section is generated in formal academic style with curriculum alignment,
        contextual definitions, and clear instructor guidance for classroom delivery.
      </p>
    </div>
  );
}

function templateSectionsForType(
  documentType: BackendDocumentType,
): Array<Record<string, unknown>> {
  switch (documentType) {
    case "Lesson Plan":
      return [
        { key: "overview", title: "Overview", type: "text" },
        { key: "outcomes", title: "Learning Outcomes", type: "list" },
        { key: "lesson_presentation", title: "Lesson Presentation", type: "table" },
        { key: "evaluation", title: "Evaluation", type: "list" },
        { key: "references", title: "References", type: "list" },
      ];
    case "OSCE Station":
      return [
        { key: "objective", title: "Objective", type: "text" },
        { key: "scenario", title: "Scenario", type: "text" },
        { key: "candidate_instructions", title: "Candidate Instructions", type: "list" },
        { key: "examiner_checklist", title: "Examiner Checklist", type: "table" },
      ];
    case "Clinical Plan":
      return [
        { key: "ward_objective", title: "Ward Objective", type: "text" },
        { key: "competency_targets", title: "Competency Targets", type: "list" },
        { key: "teaching_flow", title: "Teaching Flow", type: "table" },
        { key: "reflection", title: "Reflection Prompts", type: "list" },
      ];
    case "Assessment Tool":
      return [
        { key: "assessment_scope", title: "Assessment Scope", type: "text" },
        { key: "questions", title: "Questions", type: "table" },
        { key: "marking_guide", title: "Marking Guide", type: "table" },
      ];
    case "Scheme of Work":
      return [
        { key: "overview", title: "Semester Overview", type: "text" },
        { key: "weekly_plan", title: "Weekly Plan", type: "table" },
        { key: "assessment_schedule", title: "Assessment Schedule", type: "table" },
      ];
    default:
      return [];
  }
}

function wizardTypeFromDocumentType(type: BackendDocumentType) {
  switch (type) {
    case "Lesson Plan":
      return "Theory Lesson Plan";
    case "Clinical Plan":
      return "Clinical Teaching Plan";
    default:
      return type;
  }
}

function templateMeta(item: TemplateLibraryItem) {
  const json = normalizeTemplateJson(item.templateJson);
  const description =
    typeof json.description === "string" && json.description.trim().length > 0
      ? json.description.trim()
      : `Template for ${item.documentType}.`;

  switch (item.documentType) {
    case "Lesson Plan":
      return {
        description,
        category: "Classroom",
        icon: BookOpen,
        classes: {
          gradient: "from-blue-50 to-blue-100",
          badge: "bg-blue-100 text-blue-700",
          icon: "text-blue-600",
        },
      };
    case "Clinical Plan":
      return {
        description,
        category: "Clinical",
        icon: Activity,
        classes: {
          gradient: "from-emerald-50 to-emerald-100",
          badge: "bg-emerald-100 text-emerald-700",
          icon: "text-emerald-600",
        },
      };
    case "OSCE Station":
      return {
        description,
        category: "Clinical",
        icon: ClipboardList,
        classes: {
          gradient: "from-rose-50 to-rose-100",
          badge: "bg-rose-100 text-rose-700",
          icon: "text-rose-600",
        },
      };
    case "Assessment Tool":
      return {
        description,
        category: "Assessment",
        icon: FileText,
        classes: {
          gradient: "from-indigo-50 to-indigo-100",
          badge: "bg-indigo-100 text-indigo-700",
          icon: "text-indigo-600",
        },
      };
    case "Scheme of Work":
      return {
        description,
        category: "Planning",
        icon: FileText,
        classes: {
          gradient: "from-amber-50 to-amber-100",
          badge: "bg-amber-100 text-amber-700",
          icon: "text-amber-600",
        },
      };
    default:
      return {
        description,
        category: "General",
        icon: FileText,
        classes: {
          gradient: "from-slate-50 to-slate-100",
          badge: "bg-slate-100 text-slate-700",
          icon: "text-slate-600",
        },
      };
  }
}

const Templates: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"builtin" | "mine">("builtin");
  const [search, setSearch] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<
    BackendDocumentType | "all"
  >("all");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "Classroom" | "Clinical" | "Assessment" | "Planning" | "General"
  >("all");
  const [loading, setLoading] = useState(false);
  const [cloneTemplateId, setCloneTemplateId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TemplateLibraryItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateLibraryItem | null>(
    null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingTemplate, setEditingTemplate] = useState<TemplateLibraryItem | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TemplateFormState>({
    name: "",
    documentType: "Lesson Plan",
    description: "",
    templateSchemaVersion: 1,
  });

  const scopedItems = useMemo(
    () =>
      items.filter((item) =>
        categoryFilter === "all"
          ? true
          : templateMeta(item).category === categoryFilter,
      ),
    [items, categoryFilter],
  );

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listTemplates({
        scope: tab,
        search: search.trim() || undefined,
        documentType:
          documentTypeFilter === "all" ? undefined : documentTypeFilter,
        pageSize: 80,
      });
      setItems(response.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load templates.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, [tab, search, documentTypeFilter]);

  const openCreateModal = () => {
    setEditorMode("create");
    setEditingTemplate(null);
    setForm({
      name: "",
      documentType: "Lesson Plan",
      description: "",
      templateSchemaVersion: 1,
    });
    setShowEditor(true);
  };

  const openEditModal = (template: TemplateLibraryItem) => {
    const json = normalizeTemplateJson(template.templateJson);
    setEditorMode("edit");
    setEditingTemplate(template);
    setForm({
      name: template.name,
      documentType: template.documentType,
      description:
        typeof json.description === "string" ? json.description : "",
      templateSchemaVersion: template.templateSchemaVersion,
    });
    setShowEditor(true);
  };

  const saveTemplate = async () => {
    setSaving(true);
    setError(null);

    try {
      if (editorMode === "create") {
        await createTemplate({
          name: form.name.trim(),
          documentType: form.documentType,
          templateSchemaVersion: form.templateSchemaVersion,
          templateJson: {
            description: form.description.trim(),
            sections: templateSectionsForType(form.documentType),
          },
        });
      } else if (editingTemplate) {
        const current = normalizeTemplateJson(editingTemplate.templateJson);
        await updateTemplate(editingTemplate.id, {
          name: form.name.trim(),
          templateSchemaVersion: form.templateSchemaVersion,
          templateJson: {
            ...current,
            description: form.description.trim(),
            sections: Array.isArray(current.sections)
              ? current.sections
              : templateSectionsForType(editingTemplate.documentType),
          },
        });
      }

      setShowEditor(false);
      await loadTemplates();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save template.",
      );
    } finally {
      setSaving(false);
    }
  };

  const archiveTemplate = async (templateId: string) => {
    const confirmed = window.confirm("Archive this template?");
    if (!confirmed) return;
    setError(null);
    setNotice(null);
    try {
      await deleteTemplate(templateId);
      await loadTemplates();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to archive template.",
      );
    }
  };

  const duplicateTemplate = async (template: TemplateLibraryItem) => {
    setCloneTemplateId(template.id);
    setError(null);
    setNotice(null);

    try {
      const sourceJson = normalizeTemplateJson(template.templateJson);
      const nextNameRaw = `${template.name} Copy`;
      const nextName = nextNameRaw.slice(0, 120).trim();

      await createTemplate({
        name: nextName.length >= 2 ? nextName : "Template Copy",
        documentType: template.documentType,
        templateSchemaVersion: template.templateSchemaVersion || 1,
        templateJson: sourceJson,
      });

      setNotice(`Template duplicated: ${template.name}`);
      if (tab === "mine") {
        await loadTemplates();
      } else {
        setTab("mine");
      }
    } catch (cloneError) {
      setError(
        cloneError instanceof Error
          ? cloneError.message
          : "Failed to duplicate template.",
      );
    } finally {
      setCloneTemplateId(null);
    }
  };

  const selectedTemplateJson = selectedTemplate
    ? normalizeTemplateJson(selectedTemplate.templateJson)
    : {};
  const selectedTemplateSections = normalizeTemplateSections(
    selectedTemplateJson.sections,
  );
  const selectedTemplateDescription =
    typeof selectedTemplateJson.description === "string"
      ? selectedTemplateJson.description
      : "";

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Template Library</h1>
        <p className="text-lg text-slate-500">
          Manage built-in and custom templates used in document generation.
        </p>
      </div>

      <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="flex w-full gap-1 rounded-lg bg-slate-100 p-1 md:w-auto">
          <button
            type="button"
            onClick={() => setTab("builtin")}
            className={`flex-1 rounded-md px-6 py-2 text-sm font-medium md:flex-none ${
              tab === "builtin"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Built-in Templates
          </button>
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={`flex-1 rounded-md px-6 py-2 text-sm font-medium md:flex-none ${
              tab === "mine"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            My Templates
          </button>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
          <div className="relative w-full grow lg:w-80">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Search templates..."
            />
          </div>
          <select
            value={documentTypeFilter}
            onChange={(event) =>
              setDocumentTypeFilter(
                event.target.value as BackendDocumentType | "all",
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm lg:w-auto"
          >
            <option value="all">All Types</option>
            <option value="Lesson Plan">Lesson Plan</option>
            <option value="Clinical Plan">Clinical Plan</option>
            <option value="OSCE Station">OSCE Station</option>
            <option value="Assessment Tool">Assessment Tool</option>
            <option value="Scheme of Work">Scheme of Work</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(
                event.target.value as
                  | "all"
                  | "Classroom"
                  | "Clinical"
                  | "Assessment"
                  | "Planning"
                  | "General",
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm lg:w-auto"
          >
            <option value="all">All Categories</option>
            <option value="Classroom">Classroom</option>
            <option value="Clinical">Clinical</option>
            <option value="Assessment">Assessment</option>
            <option value="Planning">Planning</option>
            <option value="General">General</option>
          </select>
          {tab === "mine" && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 lg:w-auto"
            >
              <Plus size={16} className="mr-2" />
              New
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {loading && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Loading templates...
        </div>
      )}

      {!loading && scopedItems.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-600">
          No templates found for this view.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {scopedItems.map((template) => {
          const meta = templateMeta(template);
          const Icon = meta.icon;
          return (
            <div
              key={template.id}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300 hover:border-blue-300 hover:shadow-lg"
            >
              <div
                className={`relative h-32 bg-gradient-to-br ${meta.classes.gradient} p-6`}
              >
                <div className="absolute right-0 top-0 p-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.classes.badge}`}
                  >
                    {meta.category}
                  </span>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                  <Icon className={meta.classes.icon} size={24} />
                </div>
              </div>
              <div className="flex grow flex-col p-6">
                <h3 className="mb-2 text-lg font-bold text-slate-900">{template.name}</h3>
                <p className="mb-4 line-clamp-3 text-sm text-slate-500">
                  {meta.description}
                </p>
                <div className="mt-auto border-t border-slate-100 pt-4">
                  <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{template.documentType}</span>
                    <span>{template.usageCount} docs</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTemplate(template)}
                      className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                    >
                      <Eye size={15} className="mr-1" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/create?templateId=${template.id}&documentType=${encodeURIComponent(
                            wizardTypeFromDocumentType(template.documentType),
                          )}`,
                        )
                      }
                      className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      onClick={() => void duplicateTemplate(template)}
                      disabled={cloneTemplateId === template.id}
                      className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
                      title="Duplicate to My Templates"
                    >
                      <Copy size={14} />
                    </button>
                    {!template.isBuiltin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(template)}
                          className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void archiveTemplate(template.id)}
                          className="inline-flex items-center rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4 sm:p-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedTemplate.name}</h3>
                <p className="text-sm text-slate-500">
                  {selectedTemplate.documentType} | v{selectedTemplate.templateSchemaVersion}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mx-auto max-w-[840px] rounded-lg border border-slate-300 bg-white p-4 shadow-sm sm:p-8">
                <div className="mb-4 border-b border-slate-200 pb-4 text-center">
                  <h2 className="text-xl font-bold text-slate-900">EduNurse Document Template</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{selectedTemplate.name}</p>
                  <p className="text-xs text-slate-500">
                    {selectedTemplate.documentType} | Schema v{selectedTemplate.templateSchemaVersion}
                  </p>
                </div>

                <div className="mb-6 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <div className="border border-slate-300 px-2 py-2">
                    <span className="font-semibold text-slate-700">Programme:</span> Nursing
                  </div>
                  <div className="border border-slate-300 px-2 py-2">
                    <span className="font-semibold text-slate-700">Semester:</span> Semester 1
                  </div>
                  <div className="border border-slate-300 px-2 py-2">
                    <span className="font-semibold text-slate-700">Course:</span> Sample Course
                  </div>
                  <div className="border border-slate-300 px-2 py-2">
                    <span className="font-semibold text-slate-700">Duration:</span> 60 Minutes
                  </div>
                </div>

                {selectedTemplateDescription && (
                  <div className="mb-6">
                    <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                      Template Description
                    </h4>
                    <p className="text-sm leading-6 text-slate-700">{selectedTemplateDescription}</p>
                  </div>
                )}

                {selectedTemplateSections.length > 0 ? (
                  selectedTemplateSections.map((section, index) =>
                    renderTemplatePreviewSection(section, index),
                  )
                ) : (
                  <p className="text-sm text-slate-600">
                    No section schema found in this template.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row sm:p-6">
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="w-full rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/create?templateId=${selectedTemplate.id}&documentType=${encodeURIComponent(
                      wizardTypeFromDocumentType(selectedTemplate.documentType),
                    )}`,
                  )
                }
                className="w-full rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700 sm:w-auto"
              >
                Use This Template
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="text-lg font-semibold text-slate-900">
                {editorMode === "create" ? "Create Template" : "Edit Template"}
              </h3>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Template name"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Document Type
                  </label>
                  <select
                    value={form.documentType}
                    disabled={editorMode === "edit"}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        documentType: event.target.value as BackendDocumentType,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  >
                    <option>Lesson Plan</option>
                    <option>Clinical Plan</option>
                    <option>OSCE Station</option>
                    <option>Assessment Tool</option>
                    <option>Scheme of Work</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Schema Version
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.templateSchemaVersion}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        templateSchemaVersion:
                          Number(event.target.value) > 0
                            ? Number(event.target.value)
                            : 1,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Describe how this template should be used."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || form.name.trim().length < 2}
                onClick={() => void saveTemplate()}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : editorMode === "create" ? "Create Template" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;
