import { z } from 'zod';

// --- Shared Core Schemas ---
export const MetaDataSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: z.enum(['Lesson Plan', 'OSCE Station', 'Clinical Plan', 'Assessment Tool', 'Scheme of Work']),
  createdAt: z.date(),
  lastEdited: z.date(),
  curriculumContext: z.object({
    programme: z.string(),
    year: z.string(),
    topic: z.string(),
  }),
});

export const ReferenceSchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.string(), // e.g. "NMCZ Midwifery Syllabus 2023"
  competencyId: z.string().optional(),
});

// --- OSCE Station Schema ---
export const OSCESectionSchema = z.object({
  id: z.string(),
  title: z.string(), // e.g., "Candidate Instructions", "Scenario"
  type: z.enum(['text', 'list', 'script', 'rubric']),
  content: z.union([
    z.string(), // For 'text'
    z.array(z.string()), // For 'list'
    z.array(z.object({ speaker: z.string(), text: z.string(), note: z.string().optional() })), // For 'script'
    z.array(z.object({ // For 'rubric'
      item: z.string(),
      marks: z.number(),
      critical: z.boolean(),
      category: z.string().optional()
    }))
  ]),
});

export const OSCEStationSchema = z.object({
  metadata: MetaDataSchema,
  sections: z.array(OSCESectionSchema),
});

// --- Lesson Plan Schema ---
export const LessonPlanSectionSchema = z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['text', 'list', 'table', 'duration_list']),
    content: z.union([
        z.string(),
        z.array(z.string()), // Learning Outcomes
        z.array(z.object({ // Teaching Activity Flow
            time: z.string(),
            activity: z.string(),
            method: z.string(),
            resources: z.string()
        }))
    ])
});

export const LessonPlanSchema = z.object({
    metadata: MetaDataSchema,
    sections: z.array(LessonPlanSectionSchema),
});


// Union of all documented types
export const AnyDocumentSchema = z.union([OSCEStationSchema, LessonPlanSchema]);

export type MetaData = z.infer<typeof MetaDataSchema>;
export type OSCEStation = z.infer<typeof OSCEStationSchema>;
export type LessonPlan = z.infer<typeof LessonPlanSchema>;
export type AnyDocument = z.infer<typeof AnyDocumentSchema>;
export type Section = z.infer<typeof OSCESectionSchema>; // Generic section type
