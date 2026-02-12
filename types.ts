export interface Document {
  id: string;
  title: string;
  type: 'Lesson Plan' | 'OSCE Station' | 'Scheme of Work' | 'Clinical Plan' | 'Assessment';
  lastEdited: string;
  status: 'Draft' | 'Final' | 'Review';
  programme?: string;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  category: 'Classroom' | 'Clinical' | 'Assignment' | 'Safety' | 'Practical' | 'Reflection';
  icon: string;
  color: string;
  usage: string;
}

export interface CurriculumModule {
  code: string;
  title: string;
  description: string;
  credits: number;
  duration: string;
  prerequisites: string;
}
