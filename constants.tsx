import React from 'react';
import { Document, Template, CurriculumModule } from './types';
import { BookOpen, Activity, Calendar, ClipboardList, Thermometer, GraduationCap, FileText, Settings, HelpCircle, LayoutDashboard, FolderOpen, BrainCircuit, FileDown, Calculator, Stethoscope, CheckSquare, Layers, BookMarked, Languages, Briefcase, Target, PenTool, Lightbulb, LucideIcon } from 'lucide-react';
import type { FeatureKey } from './src/components/FeatureGate';

export const RECENT_DOCS: Document[] = [
  { id: '1', title: 'Postpartum Hemorrhage: Theory Lesson', type: 'Lesson Plan', lastEdited: '2 mins ago', status: 'Draft', programme: 'Midwifery' },
  { id: '2', title: 'IV Cannulation: Skills Lab Guide', type: 'Clinical Plan', lastEdited: 'Yesterday', status: 'Review', programme: 'Nursing Yr 1' },
  { id: '3', title: 'Year 2 Semester 1: Scheme of Work', type: 'Scheme of Work', lastEdited: '3 days ago', status: 'Final', programme: 'Nursing Yr 2' },
  { id: '4', title: 'Preeclampsia Management Scenario', type: 'OSCE Station', lastEdited: 'Last week', status: 'Final', programme: 'Midwifery' },
  { id: '5', title: 'Pharmacology: Mid-Term Exam', type: 'Assessment', lastEdited: 'Last week', status: 'Draft', programme: 'Nursing Yr 2' },
];

export const TEMPLATES: Template[] = [
  { id: '1', title: 'Theory Lesson Plan', description: 'Curriculum-aligned lecture structure with learning outcomes, timed breakdown, and discussion prompts.', category: 'Classroom', icon: 'BookOpen', color: 'blue', usage: 'High' },
  { id: '2', title: 'Skills Lab Plan', description: 'Step-by-step demonstration scripts, equipment checklists, and student practice flows.', category: 'Practical', icon: 'Thermometer', color: 'teal', usage: 'High' },
  { id: '3', title: 'Clinical Teaching Plan', description: 'Ward-based teaching scripts, competency targets, and reflection prompts for bedside instruction.', category: 'Clinical', icon: 'Activity', color: 'emerald', usage: 'Med' },
  { id: '4', title: 'OSCE Station', description: 'Complete station setup with candidate instructions, actor scripts, and weighted scoring rubrics.', category: 'Clinical', icon: 'ClipboardList', color: 'rose', usage: 'High' },
  { id: '5', title: 'Assessment Tool', description: 'Generate MCQs with rationales, SAQs, and case-based questions linked to curriculum domains.', category: 'Assignment', icon: 'FileText', color: 'indigo', usage: 'Med' },
  { id: '6', title: 'Scheme of Work', description: 'Week-by-week curriculum breakdown with outcomes and method suggestions.', category: 'Classroom', icon: 'Calendar', color: 'amber', usage: 'Low' },
];

export const CURRICULUM_DATA: CurriculumModule = {
  code: 'MW-202',
  title: 'Antenatal Care Essentials',
  description: 'This module covers the comprehensive assessment and management of women during the antenatal period, including risk assessment, health promotion, and the detection of complications.',
  credits: 12,
  duration: '8 Weeks',
  prerequisites: 'MW-104'
};

interface SidebarItem {
  name: string;
  label?: string;
  icon: LucideIcon | null;
  path: string | null;
  feature?: FeatureKey;
  /** Hidden from navigation — flip to false to re-enable */
  comingSoon?: boolean;
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  // Teaching Tools Section
  { name: 'section', label: 'Teaching Tools', icon: null, path: null },
  { name: 'Document Studio', icon: LayoutDashboard, path: '/' },
  { name: 'Create New', icon: PenTool, path: '/create', feature: 'lesson_generator' },
  { name: 'My Documents', icon: FolderOpen, path: '/library' },
  { name: 'Exports', icon: FileDown, path: '/exports' },
  { name: 'Templates', icon: FileText, path: '/templates', feature: 'templates' },
  { name: 'Curriculum AI', icon: BrainCircuit, path: '/curriculum', feature: 'curriculum_ai' },
  { name: 'Assignment Studio', icon: GraduationCap, path: '/assignment-support', feature: 'assignments' },
  
  // Study Tools Section — coming soon (flip comingSoon to re-enable)
  { name: 'section', label: 'Study Tools', icon: null, path: null, comingSoon: true },
  { name: 'Drug Calculator', icon: Calculator, path: '/drug-calculator', feature: 'drug_calculator', comingSoon: true },
  { name: 'Clinical Cases', icon: Stethoscope, path: '/clinical-cases', feature: 'clinical_cases', comingSoon: true },
  { name: 'Procedures', icon: CheckSquare, path: '/procedures', feature: 'procedures', comingSoon: true },
  { name: 'Flashcards', icon: Layers, path: '/flashcards', feature: 'flashcards', comingSoon: true },
  { name: 'Medical Terms', icon: Languages, path: '/medical-terms', feature: 'medical_terms', comingSoon: true },
  { name: 'Resources', icon: BookMarked, path: '/resources', feature: 'resources', comingSoon: true },
  
  // Exam & Career Section
  { name: 'section', label: 'Exam & Career', icon: null, path: null },
  { name: 'NMC Exam Prep', icon: Target, path: '/exam-prep', feature: 'nmc_exam_prep' },
  { name: 'Clinical Logbook', icon: ClipboardList, path: '/logbook', feature: 'clinical_logbook', comingSoon: true },
  { name: 'OSCE Practice', icon: Activity, path: '/osce', feature: 'osce_practice', comingSoon: true },
  { name: 'Career', icon: Briefcase, path: '/career', feature: 'career', comingSoon: true },
  
  // Settings Section
  { name: 'section', label: null, icon: null, path: null },
  { name: 'Settings', icon: Settings, path: '/settings' },
  { name: 'Help', icon: HelpCircle, path: '/help' },
];
