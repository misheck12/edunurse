import React, { useState } from "react";
import {
  BookOpen,
  FileText,
  ExternalLink,
  Search,
  Download,
  Star,
  Globe,
  Building,
  GraduationCap,
  Stethoscope,
  Baby,
  Heart,
  Shield,
  Pill,
  Activity,
  ChevronRight,
  BookMarked,
  Link2,
} from "lucide-react";

type ResourceCategory = "guidelines" | "textbooks" | "journals" | "organizations" | "tools";

interface Resource {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  subcategory?: string;
  url: string;
  type: "pdf" | "website" | "app" | "database";
  free: boolean;
  zambia?: boolean; // Specific to Zambia
  icon?: React.ElementType;
}

const RESOURCES: Resource[] = [
  // Zambia-Specific Guidelines
  {
    id: "moh-guidelines",
    title: "Ministry of Health Zambia - Clinical Guidelines",
    description: "Official clinical care guidelines from the Zambian Ministry of Health, including STGs and essential medicines",
    category: "guidelines",
    subcategory: "Zambia National",
    url: "https://www.moh.gov.zm",
    type: "website",
    free: true,
    zambia: true,
  },
  {
    id: "zambia-hiv",
    title: "Zambia HIV/AIDS Treatment Guidelines",
    description: "National ART guidelines, PMTCT protocols, and HIV testing algorithms for Zambia",
    category: "guidelines",
    subcategory: "HIV/AIDS",
    url: "https://www.moh.gov.zm",
    type: "pdf",
    free: true,
    zambia: true,
  },
  {
    id: "zambia-malaria",
    title: "National Malaria Control Guidelines",
    description: "Zambia malaria treatment protocols, prevention strategies, and IPTp guidelines",
    category: "guidelines",
    subcategory: "Infectious Disease",
    url: "https://www.nmec.org.zm",
    type: "pdf",
    free: true,
    zambia: true,
  },
  {
    id: "zambia-imci",
    title: "IMCI - Integrated Management of Childhood Illness",
    description: "Assessment and treatment of common childhood illnesses in Zambia",
    category: "guidelines",
    subcategory: "Pediatrics",
    url: "https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/child-health/imci",
    type: "pdf",
    free: true,
    zambia: true,
  },
  {
    id: "zambia-emonc",
    title: "Emergency Obstetric and Newborn Care (EmONC) Guidelines",
    description: "Management of obstetric emergencies including PPH, eclampsia, and neonatal resuscitation",
    category: "guidelines",
    subcategory: "Maternal & Newborn",
    url: "https://www.moh.gov.zm",
    type: "pdf",
    free: true,
    zambia: true,
  },
  
  // WHO Guidelines
  {
    id: "who-antenatal",
    title: "WHO Antenatal Care Guidelines",
    description: "Evidence-based recommendations for routine antenatal care",
    category: "guidelines",
    subcategory: "Maternal Health",
    url: "https://www.who.int/publications/i/item/9789241549912",
    type: "pdf",
    free: true,
  },
  {
    id: "who-malaria",
    title: "WHO Malaria Treatment Guidelines",
    description: "Latest WHO recommendations for malaria treatment including severe malaria",
    category: "guidelines",
    subcategory: "Infectious Disease",
    url: "https://www.who.int/teams/global-malaria-programme",
    type: "pdf",
    free: true,
  },
  {
    id: "who-hiv",
    title: "WHO HIV Treatment Guidelines",
    description: "Consolidated guidelines on HIV prevention, testing, treatment, service delivery and monitoring",
    category: "guidelines",
    subcategory: "HIV/AIDS",
    url: "https://www.who.int/publications/i/item/9789240031593",
    type: "pdf",
    free: true,
  },
  {
    id: "who-epi",
    title: "WHO Immunization Guidelines",
    description: "Vaccine position papers and immunization schedules",
    category: "guidelines",
    subcategory: "Immunization",
    url: "https://www.who.int/teams/immunization-vaccines-and-biologicals",
    type: "website",
    free: true,
  },

  // Free Textbooks & Learning Resources
  {
    id: "openstax-anatomy",
    title: "OpenStax Anatomy & Physiology",
    description: "Free, peer-reviewed textbook covering human anatomy and physiology",
    category: "textbooks",
    subcategory: "Basic Sciences",
    url: "https://openstax.org/details/books/anatomy-and-physiology-2e",
    type: "pdf",
    free: true,
  },
  {
    id: "openstax-microbiology",
    title: "OpenStax Microbiology",
    description: "Free comprehensive microbiology textbook",
    category: "textbooks",
    subcategory: "Basic Sciences",
    url: "https://openstax.org/details/books/microbiology",
    type: "pdf",
    free: true,
  },
  {
    id: "ncbi-bookshelf",
    title: "NCBI Bookshelf",
    description: "Free access to biomedical and life science books including StatPearls",
    category: "textbooks",
    subcategory: "Medical Reference",
    url: "https://www.ncbi.nlm.nih.gov/books/",
    type: "database",
    free: true,
  },
  {
    id: "statpearls",
    title: "StatPearls",
    description: "Free, continuously updated medical reference with nursing content",
    category: "textbooks",
    subcategory: "Medical Reference",
    url: "https://www.statpearls.com",
    type: "website",
    free: true,
  },
  {
    id: "geeky-medics",
    title: "Geeky Medics",
    description: "Free clinical skills guides, OSCE practice, and medical education resources",
    category: "textbooks",
    subcategory: "Clinical Skills",
    url: "https://geekymedics.com",
    type: "website",
    free: true,
  },

  // Journals & Research
  {
    id: "pubmed",
    title: "PubMed / PubMed Central",
    description: "Free access to biomedical literature, including many free full-text articles",
    category: "journals",
    subcategory: "Database",
    url: "https://pubmed.ncbi.nlm.nih.gov",
    type: "database",
    free: true,
  },
  {
    id: "ajol",
    title: "African Journals Online (AJOL)",
    description: "Access to African-published research including nursing and health sciences",
    category: "journals",
    subcategory: "African Research",
    url: "https://www.ajol.info",
    type: "database",
    free: true,
  },
  {
    id: "hinari",
    title: "HINARI (Research4Life)",
    description: "Free/low-cost access to health research for qualifying institutions in Zambia",
    category: "journals",
    subcategory: "Database",
    url: "https://www.who.int/hinari",
    type: "database",
    free: true,
    zambia: true,
  },
  {
    id: "doaj",
    title: "Directory of Open Access Journals (DOAJ)",
    description: "Quality open access peer-reviewed journals",
    category: "journals",
    subcategory: "Open Access",
    url: "https://doaj.org",
    type: "database",
    free: true,
  },

  // Professional Organizations
  {
    id: "nmcz",
    title: "Nursing and Midwifery Council of Zambia",
    description: "Regulatory body for nursing in Zambia - licensing, standards, and guidelines",
    category: "organizations",
    subcategory: "Regulatory",
    url: "https://www.nmcz.org.zm",
    type: "website",
    free: true,
    zambia: true,
  },
  {
    id: "zna",
    title: "Zambia Nurses Association",
    description: "Professional association for nurses in Zambia",
    category: "organizations",
    subcategory: "Professional",
    url: "https://www.zna.org.zm",
    type: "website",
    free: true,
    zambia: true,
  },
  {
    id: "icn",
    title: "International Council of Nurses",
    description: "Global voice of nursing - resources, guidelines, and advocacy",
    category: "organizations",
    subcategory: "International",
    url: "https://www.icn.ch",
    type: "website",
    free: true,
  },

  // Tools & Apps
  {
    id: "medscape",
    title: "Medscape Drug Reference",
    description: "Free drug information, interactions, and dosing calculators",
    category: "tools",
    subcategory: "Drug Reference",
    url: "https://reference.medscape.com",
    type: "app",
    free: true,
  },
  {
    id: "uptodate-free",
    title: "UpToDate (Via HINARI)",
    description: "Evidence-based clinical decision support (free for eligible Zambian institutions)",
    category: "tools",
    subcategory: "Clinical Decision",
    url: "https://www.uptodate.com",
    type: "website",
    free: true,
    zambia: true,
  },
  {
    id: "who-essential-medicines",
    title: "WHO Model List of Essential Medicines",
    description: "Core medicines needed for a basic health system",
    category: "tools",
    subcategory: "Medicines",
    url: "https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines/essential-medicines-lists",
    type: "pdf",
    free: true,
  },
];

const CATEGORY_INFO: Record<ResourceCategory, { label: string; icon: React.ElementType; color: string }> = {
  guidelines: { label: "Clinical Guidelines", icon: FileText, color: "blue" },
  textbooks: { label: "Free Textbooks", icon: BookOpen, color: "purple" },
  journals: { label: "Journals & Research", icon: BookMarked, color: "green" },
  organizations: { label: "Organizations", icon: Building, color: "amber" },
  tools: { label: "Tools & Apps", icon: Activity, color: "red" },
};

export default function Resources() {
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | "all" | "zambia">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredResources = RESOURCES.filter(resource => {
    const matchesCategory = selectedCategory === "all" 
      ? true 
      : selectedCategory === "zambia"
        ? resource.zambia
        : resource.category === selectedCategory;
    const matchesSearch = resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedResources = filteredResources.reduce((acc, resource) => {
    const key = resource.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(resource);
    return acc;
  }, {} as Record<string, Resource[]>);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-10">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            <BookOpen size={14} />
            Learning Resources
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Free Nursing Resources
          </h1>
          <p className="mt-2 text-slate-600">
            Curated collection of free clinical guidelines, textbooks, journals, and tools for nursing students in Zambia.
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
              placeholder="Search resources..."
              className="w-full rounded-xl border border-slate-300 py-3 pl-12 pr-4 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
              selectedCategory === "all"
                ? "bg-green-600 text-white shadow-lg shadow-green-200"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            <Globe size={16} />
            All Resources
          </button>
          <button
            onClick={() => setSelectedCategory("zambia")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
              selectedCategory === "zambia"
                ? "bg-green-600 text-white shadow-lg shadow-green-200"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            🇿🇲 Zambia-Specific
          </button>
          {Object.entries(CATEGORY_INFO).map(([key, info]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key as ResourceCategory)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                selectedCategory === key
                  ? "bg-green-600 text-white shadow-lg shadow-green-200"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              <info.icon size={16} />
              {info.label}
            </button>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
            <FileText className="mx-auto mb-2 h-6 w-6 text-blue-500" />
            <p className="text-xl font-bold text-slate-900">
              {RESOURCES.filter(r => r.category === "guidelines").length}
            </p>
            <p className="text-xs text-slate-500">Guidelines</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
            <BookOpen className="mx-auto mb-2 h-6 w-6 text-purple-500" />
            <p className="text-xl font-bold text-slate-900">
              {RESOURCES.filter(r => r.category === "textbooks").length}
            </p>
            <p className="text-xs text-slate-500">Textbooks</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
            <BookMarked className="mx-auto mb-2 h-6 w-6 text-green-500" />
            <p className="text-xl font-bold text-slate-900">
              {RESOURCES.filter(r => r.category === "journals").length}
            </p>
            <p className="text-xs text-slate-500">Journals</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
            <Building className="mx-auto mb-2 h-6 w-6 text-amber-500" />
            <p className="text-xl font-bold text-slate-900">
              {RESOURCES.filter(r => r.category === "organizations").length}
            </p>
            <p className="text-xs text-slate-500">Organizations</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-center border border-slate-200">
            <span className="mx-auto mb-2 block text-2xl">🇿🇲</span>
            <p className="text-xl font-bold text-slate-900">
              {RESOURCES.filter(r => r.zambia).length}
            </p>
            <p className="text-xs text-slate-500">Zambia-Specific</p>
          </div>
        </div>

        {/* Resources by Category */}
        {Object.entries(groupedResources).map(([category, resources]) => {
          const catInfo = CATEGORY_INFO[category as ResourceCategory];
          return (
            <div key={category} className="mb-8">
              <div className="mb-4 flex items-center gap-2">
                <catInfo.icon className={`h-5 w-5 text-${catInfo.color}-600`} />
                <h2 className="text-lg font-semibold text-slate-900">{catInfo.label}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {resources.length}
                </span>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                {resources.map((resource) => (
                  <a
                    key={resource.id}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-green-300 transition-all"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {resource.zambia && (
                          <span className="text-lg" title="Zambia-specific">🇿🇲</span>
                        )}
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          resource.type === "pdf" ? "bg-red-100 text-red-700" :
                          resource.type === "website" ? "bg-blue-100 text-blue-700" :
                          resource.type === "app" ? "bg-purple-100 text-purple-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {resource.type.toUpperCase()}
                        </span>
                        {resource.free && (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                            FREE
                          </span>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-green-600" />
                    </div>
                    
                    <h3 className="mb-2 font-semibold text-slate-900 group-hover:text-green-700">
                      {resource.title}
                    </h3>
                    <p className="mb-3 text-sm text-slate-600 line-clamp-2">
                      {resource.description}
                    </p>
                    
                    {resource.subcategory && (
                      <span className="text-xs text-slate-500">
                        {resource.subcategory}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          );
        })}

        {filteredResources.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Search className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700">No resources found</h3>
            <p className="text-slate-500">Try adjusting your search or filter</p>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-blue-800">
            <GraduationCap size={20} />
            How to Access HINARI (Free Medical Journals)
          </h3>
          <div className="space-y-2 text-sm text-blue-700">
            <p>Zambian nursing schools qualify for free access to thousands of medical journals through HINARI:</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>Check if your institution is registered at <a href="https://www.who.int/hinari" target="_blank" rel="noreferrer" className="underline">who.int/hinari</a></li>
              <li>Get login credentials from your school library</li>
              <li>Access full-text articles from journals like Lancet, NEJM, and more</li>
            </ol>
          </div>
        </div>
      </div>
  );
}
