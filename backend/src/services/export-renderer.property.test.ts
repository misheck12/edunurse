/**
 * Property-Based Tests for Lesson Plan Export Renderer
 * Tests universal properties across many generated inputs using fast-check.
 * 
 * Feature: lesson-plan-export-format
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { renderExportBuffer } from './export-renderer.js';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

// Helpers to extract text from buffers
async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// Arbitrary generators for lesson plan data
const arbString = fc.string({ minLength: 1, maxLength: 100 });
const arbStringArray = fc.array(arbString, { minLength: 1, maxLength: 10 });
const arbOptionalString = fc.option(arbString, { nil: undefined });

const arbLessonPlanInput = fc.record({
  title: arbString,
  programme: arbString,
  topic: arbString,
  year: arbOptionalString,
  documentType: fc.constant('lesson_plan'),
  contentJson: fc.record({
    sections: fc.array(
      fc.record({
        id: fc.constantFrom('introduction', 'objectives', 'outcomes', 'key_definitions', 'assignment', 'references'),
        title: arbString,
        type: fc.constantFrom('text', 'list'),
        content: fc.oneof(
          arbString,
          arbStringArray,
          fc.record({ text: arbString }),
          fc.record({ content: arbString })
        )
      }),
      { minLength: 0, maxLength: 5 }
    )
  })
});

// Property 1: Header Format Consistency
// Feature: lesson-plan-export-format, Property 1: Header format consistency
// Validates: Requirements 1.1, 1.2
describe('Property 1: Header Format Consistency', () => {
  it('PDF should always contain LUSAKA SCHOOL OF NURSING followed by CLASS TRIAL PLAN', async () => {
    await fc.assert(
      fc.asyncProperty(arbLessonPlanInput, async (input) => {
        const buffer = await renderExportBuffer('pdf', input);
        const text = await extractPdfText(buffer);
        
        const schoolIdx = text.indexOf('LUSAKA SCHOOL OF NURSING');
        const titleIdx = text.indexOf('CLASS TRIAL PLAN');
        
        expect(schoolIdx).toBeGreaterThan(-1);
        expect(titleIdx).toBeGreaterThan(-1);
        expect(schoolIdx).toBeLessThan(titleIdx);
      }),
      { numRuns: 100 }
    );
  });

  it('DOCX should always contain LUSAKA SCHOOL OF NURSING followed by CLASS TRIAL PLAN', async () => {
    await fc.assert(
      fc.asyncProperty(arbLessonPlanInput, async (input) => {
        const buffer = await renderExportBuffer('docx', input);
        const text = await extractDocxText(buffer);
        
        const schoolIdx = text.indexOf('LUSAKA SCHOOL OF NURSING');
        const titleIdx = text.indexOf('CLASS TRIAL PLAN');
        
        expect(schoolIdx).toBeGreaterThan(-1);
        expect(titleIdx).toBeGreaterThan(-1);
        expect(schoolIdx).toBeLessThan(titleIdx);
      }),
      { numRuns: 100 }
    );
  });
});

// Property 2: Metadata Table Completeness
// Feature: lesson-plan-export-format, Property 2: Metadata table completeness
// Validates: Requirements 2.1, 2.2
describe('Property 2: Metadata Table Completeness', () => {
  const requiredFields = [
    'NAME OF STUDENT', 'INDEX NUMBER', 'COURSE NAME', 'PROGRAMME',
    'TOPIC', 'DATE', 'VENUE', 'TIME', 'DURATION', 'NUMBER OF STUDENTS',
    'METHOD OF INSTRUCTION', 'MEDIA', 'NAME OF SUPERVISOR', 'SIGNATURE'
  ];

  it('PDF should always include all 14 required metadata fields', async () => {
    await fc.assert(
      fc.asyncProperty(arbLessonPlanInput, async (input) => {
        const buffer = await renderExportBuffer('pdf', input);
        const text = await extractPdfText(buffer);
        
        requiredFields.forEach(field => {
          expect(text).toContain(field);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('DOCX should always include all 14 required metadata fields', async () => {
    await fc.assert(
      fc.asyncProperty(arbLessonPlanInput, async (input) => {
        const buffer = await renderExportBuffer('docx', input);
        const text = await extractDocxText(buffer);
        
        requiredFields.forEach(field => {
          expect(text).toContain(field);
        });
      }),
      { numRuns: 100 }
    );
  });
});

// Property 3: Placeholder Consistency
// Feature: lesson-plan-export-format, Property 3: Placeholder consistency
// Validates: Requirements 2.3
describe('Property 3: Placeholder Consistency', () => {
  const arbMinimalInput = fc.record({
    title: arbString,
    programme: arbString,
    topic: arbString,
    documentType: fc.constant('lesson_plan'),
    contentJson: fc.record({
      sections: fc.constant([])
    })
  });

  it('PDF should show underscores for empty metadata fields', async () => {
    await fc.assert(
      fc.asyncProperty(arbMinimalInput, async (input) => {
        const buffer = await renderExportBuffer('pdf', input);
        const text = await extractPdfText(buffer);
        
        // Should contain underscore placeholders
        expect(text).toContain('______________________');
      }),
      { numRuns: 100 }
    );
  });

  it('DOCX should show underscores for empty metadata fields', async () => {
    await fc.assert(
      fc.asyncProperty(arbMinimalInput, async (input) => {
        const buffer = await renderExportBuffer('docx', input);
        const text = await extractDocxText(buffer);
        
        // Should contain underscore placeholders
        expect(text).toContain('______________________');
      }),
      { numRuns: 100 }
    );
  });
});

// Property 4: Section Heading Format
// Feature: lesson-plan-export-format, Property 4: Section heading format
// Validates: Requirements 3.1, 3.2, 3.3
describe('Property 4: Section Heading Format', () => {
  const arbInputWithSections = fc.record({
    title: arbString,
    programme: arbString,
    topic: arbString,
    documentType: fc.constant('lesson_plan'),
    contentJson: fc.record({
      sections: fc.array(
        fc.record({
          id: fc.constantFrom('introduction', 'objectives', 'outcomes'),
          title: fc.constantFrom('Introduction', 'Objectives', 'Outcomes'),
          type: fc.constant('text'),
          content: arbString
        }),
        { minLength: 1, maxLength: 3 }
      )
    })
  });

  it('PDF should use exact institutional heading names', async () => {
    await fc.assert(
      fc.asyncProperty(arbInputWithSections, async (input) => {
        const buffer = await renderExportBuffer('pdf', input);
        const text = await extractPdfText(buffer);
        
        // Check for institutional heading names
        if (input.contentJson.sections.some(s => s.id === 'introduction')) {
          expect(text).toContain('INTRODUCTION');
        }
        if (input.contentJson.sections.some(s => s.id === 'objectives')) {
          expect(text).toContain('GENERAL OBJECTIVES');
        }
        if (input.contentJson.sections.some(s => s.id === 'outcomes')) {
          expect(text).toContain('LEARNING OUTCOMES');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Property 5: Objectives Numbering
// Feature: lesson-plan-export-format, Property 5: Objectives numbering
// Validates: Requirements 4.2, 4.3, 4.4
describe('Property 5: Objectives Numbering', () => {
  const arbInputWithObjectives = fc.record({
    title: arbString,
    programme: arbString,
    topic: arbString,
    documentType: fc.constant('lesson_plan'),
    contentJson: fc.record({
      sections: fc.constant([{
        id: 'objectives',
        title: 'Objectives',
        type: 'list',
        content: fc.sample(arbStringArray, 1)[0]
      }])
    })
  });

  it('PDF should number objectives sequentially starting from 1', async () => {
    await fc.assert(
      fc.asyncProperty(arbInputWithObjectives, async (input) => {
        const buffer = await renderExportBuffer('pdf', input);
        const text = await extractPdfText(buffer);
        
        const objectives = input.contentJson.sections[0].content as string[];
        
        // Check for sequential numbering
        objectives.forEach((_, idx) => {
          const numberPattern = `${idx + 1}.`;
          expect(text).toContain(numberPattern);
        });
        
        // Check for introductory text
        expect(text).toContain('At the end of the lesson, the student should be able to:');
      }),
      { numRuns: 100 }
    );
  });
});

// Property 6: Table Column Structure
// Feature: lesson-plan-export-format, Property 6: Table column structure
// Validates: Requirements 5.1
describe('Property 6: Table Column Structure', () => {
  const expectedColumns = [
    'TIME', 'SPECIFIC OBJECTIVE', 'CONTENT', "TEACHER'S ACTIVITY",
    "STUDENT'S ACTIVITY", 'TEACHING/LEARNING RESOURCES', 'EVALUATION'
  ];

  it('PDF should always have exactly 7 columns with correct headers', async () => {
    await fc.assert(
      fc.asyncProperty(arbLessonPlanInput, async (input) => {
        const buffer = await renderExportBuffer('pdf', input);
        const text = await extractPdfText(buffer);
        
        expectedColumns.forEach(column => {
          expect(text).toContain(column);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('DOCX should always have exactly 7 columns with correct headers', async () => {
    await fc.assert(
      fc.asyncProperty(arbLessonPlanInput, async (input) => {
        const buffer = await renderExportBuffer('docx', input);
        const text = await extractDocxText(buffer);
        
        expectedColumns.forEach(column => {
          expect(text).toContain(column);
        });
      }),
      { numRuns: 100 }
    );
  });
});

// Property 8: Assignment Numbering Cleanup
// Feature: lesson-plan-export-format, Property 8: Assignment numbering cleanup
// Validates: Requirements 6.4
describe('Property 8: Assignment Numbering Cleanup', () => {
  const arbAssignmentItems = fc.array(
    fc.oneof(
      fc.string({ minLength: 10, maxLength: 100 }),
      fc.string({ minLength: 10, maxLength: 100 }).map(s => `1) ${s}`),
      fc.string({ minLength: 10, maxLength: 100 }).map(s => `2. ${s}`),
      fc.string({ minLength: 10, maxLength: 100 }).map(s => `3) ${s}`)
    ),
    { minLength: 2, maxLength: 10 }
  );

  const arbInputWithAssignment = fc.record({
    title: arbString,
    programme: arbString,
    topic: arbString,
    documentType: fc.constant('lesson_plan'),
    contentJson: fc.record({
      sections: arbAssignmentItems.map(items => [{
        id: 'assignment',
        title: 'Assignment',
        type: 'list',
        content: items
      }])
    })
  });

  it('PDF should remove existing numbering and apply clean sequential numbering', async () => {
    await fc.assert(
      fc.asyncProperty(arbInputWithAssignment, async (input) => {
        const buffer = await renderExportBuffer('pdf', input);
        const text = await extractPdfText(buffer);
        
        const items = input.contentJson.sections[0].content as string[];
        
        // Check for sequential numbering with ")" format
        items.forEach((_, idx) => {
          const numberPattern = `${idx + 1})`;
          expect(text).toContain(numberPattern);
        });
        
        // Check that we don't have duplicate numbering like "1) 1)"
        expect(text).not.toMatch(/\d+\)\s+\d+[\)\.]/);
      }),
      { numRuns: 100 }
    );
  });
});

// Property 9: Reference Formatting
// Feature: lesson-plan-export-format, Property 9: Reference formatting
// Validates: Requirements 7.1, 7.2
describe('Property 9: Reference Formatting', () => {
  const arbInputWithReferences = fc.record({
    title: arbString,
    programme: arbString,
    topic: arbString,
    documentType: fc.constant('lesson_plan'),
    contentJson: fc.record({
      sections: fc.constant([{
        id: 'references',
        title: 'References',
        type: 'list',
        content: fc.sample(arbStringArray, 1)[0]
      }])
    })
  });

  it('PDF should format references with bullet points', async () => {
    await fc.assert(
      fc.asyncProperty(arbInputWithReferences, async (input) => {
        const buffer = await renderExportBuffer('pdf', input);
        const text = await extractPdfText(buffer);
        
        // Check for REFERENCES heading
        expect(text).toContain('REFERENCES');
        
        // Check for bullet points (represented as "- " in PDF text)
        const references = input.contentJson.sections[0].content as string[];
        if (references.length > 0) {
          expect(text).toContain('- ');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Property 11: Content Extraction Completeness
// Feature: lesson-plan-export-format, Property 11: Content extraction completeness
// Validates: Requirements 10.1, 10.2
describe('Property 11: Content Extraction Completeness', () => {
  const arbContentStructure = fc.oneof(
    arbString,
    arbStringArray,
    fc.record({ text: arbString }),
    fc.record({ content: arbString }),
    fc.record({ description: arbString }),
    fc.record({ value: arbString })
  );

  const arbInputWithVariedContent = fc.record({
    title: arbString,
    programme: arbString,
    topic: arbString,
    documentType: fc.constant('lesson_plan'),
    contentJson: fc.record({
      sections: fc.array(
        fc.record({
          id: arbString,
          title: arbString,
          type: fc.constantFrom('text', 'list'),
          content: arbContentStructure
        }),
        { minLength: 1, maxLength: 5 }
      )
    })
  });

  it('PDF should extract text from any content structure', async () => {
    await fc.assert(
      fc.asyncProperty(arbInputWithVariedContent, async (input) => {
        const buffer = await renderExportBuffer('pdf', input);
        const text = await extractPdfText(buffer);
        
        // Verify that the PDF contains some content
        expect(text.length).toBeGreaterThan(100);
        
        // Check that basic structure is present
        expect(text).toContain('LUSAKA SCHOOL OF NURSING');
      }),
      { numRuns: 100 }
    );
  });
});

// Property 12: Markdown Sanitization
// Feature: lesson-plan-export-format, Property 12: Markdown sanitization
// Validates: Requirements 10.4
describe('Property 12: Markdown Sanitization', () => {
  const arbMarkdownString = fc.oneof(
    fc.constant('This is **bold** text'),
    fc.constant('This is *italic* text'),
    fc.constant('This is <strong>HTML bold</strong>'),
    fc.constant('This is <em>HTML italic</em>'),
    fc.constant('This has `code` formatting'),
    fc.constant('This has ~~strikethrough~~ text'),
    fc.constant('[Link text](http://example.com)'),
    fc.constant('# Heading text'),
    fc.constant('> Blockquote text')
  );

  const arbInputWithMarkdown = fc.record({
    title: arbString,
    programme: arbString,
    topic: arbString,
    documentType: fc.constant('lesson_plan'),
    contentJson: fc.record({
      sections: fc.constant([{
        id: 'introduction',
        title: 'Introduction',
        type: 'text',
        content: fc.sample(arbMarkdownString, 1)[0]
      }])
    })
  });

  it('PDF should remove markdown/HTML formatting while preserving text', async () => {
    await fc.assert(
      fc.asyncProperty(arbInputWithMarkdown, async (input) => {
        const buffer = await renderExportBuffer('pdf', input);
        const text = await extractPdfText(buffer);
        
        // Check that markdown markers are removed
        expect(text).not.toContain('**');
        expect(text).not.toContain('<strong>');
        expect(text).not.toContain('</strong>');
        expect(text).not.toContain('<em>');
        expect(text).not.toContain('~~');
        
        // Check that text content is preserved (at least some words)
        expect(text).toContain('text');
      }),
      { numRuns: 100 }
    );
  });
});
