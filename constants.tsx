import { Document, Template, CurriculumModule } from './types';
import { BookOpen, Activity, ClipboardList, Thermometer, GraduationCap, FileText, Settings, HelpCircle, LayoutDashboard, FolderOpen, BrainCircuit } from 'lucide-react';

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

export const SIDEBAR_ITEMS = [
  { name: 'Document Studio', icon: LayoutDashboard, path: '/' },
  { name: 'Create New', icon: Activity, path: '/create' },
  { name: 'My Documents', icon: FolderOpen, path: '/library' },
  { name: 'Template Library', icon: FileText, path: '/templates' },
  { name: 'Curriculum Intelligence', icon: BrainCircuit, path: '/curriculum' },
  { name: 'Settings', icon: Settings, path: '/settings' },
  { name: 'Help & Support', icon: HelpCircle, path: '/help' },
];

export const MOCK_STUDENTS = [
  { id: 1, name: 'Alice Mumba', id_num: 'SN-23-001', attendance: 92, placement: 'Maternity Ward', grade: 85, status: 'On Track' },
  { id: 2, name: 'Brian Phiri', id_num: 'SN-23-014', attendance: 76, placement: 'Pediatrics', grade: 62, status: 'At Risk' },
  { id: 3, name: 'Catherine Zulu', id_num: 'SN-23-022', attendance: 95, placement: 'Surgical Ward', grade: 88, status: 'Exceeding' },
  { id: 4, name: 'David Banda', id_num: 'SN-23-009', attendance: 88, placement: 'Outpatient Dept', grade: 74, status: 'On Track' },
  { id: 5, name: 'Esther Lungu', id_num: 'SN-23-045', attendance: 65, placement: 'Community Clinic', grade: 58, status: 'At Risk' },
  { id: 6, name: 'Fines Mulenga', id_num: 'SN-23-011', attendance: 90, placement: 'Maternity Ward', grade: 82, status: 'On Track' },
];