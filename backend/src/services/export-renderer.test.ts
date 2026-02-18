/**
 * Unit Tests for Lesson Plan Export Renderer
 * Tests formatting functions for PDF and DOCX export generation.
 */

import { describe, it, expect } from 'vitest';
import { renderExportBuffer } from './export-renderer.js';

// Helpers to extract text from buffers
async function extractPdfText(buffer: Buffer): Promise<string> {
  return buffer.toString('latin1');
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  return buffer.toString('utf8');
}

const minimalInput = {
  title: 'Test Lesson Plan',
  programme: 'Diploma in Nursing',
  topic: 'Anatomy and Physiology',
  documentType: 'lesson_plan',
  contentJson: { sections: [] }
};

// Test 12.1: Header Rendering
describe('Header Rendering', () => {
  it('PDF should include LUSAKA SCHOOL OF NURSING', async () => {
    const buffer = await renderExportBuffer('pdf', minimalInput);
    const text = await extractPdfText(buffer);
    expect(text).toContain('LUSAKA SCHOOL OF NURSING');
  });

  it('PDF should include CLASS TRIAL PLAN', async () => {
    const buffer = await renderExportBuffer('pdf', minimalInput);
    const text = await extractPdfText(buffer);
    expect(text).toContain('CLASS TRIAL PLAN');
  });

  it('PDF should have school name before document title', async () => {
    const buffer = await renderExportBuffer('pdf', minimalInput);
    const text = await extractPdfText(buffer);
    const schoolIdx = text.indexOf('LUSAKA SCHOOL OF NURSING');
    const titleIdx = text.indexOf('CLASS TRIAL PLAN');
    expect(schoolIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeGreaterThan(-1);
    expect(schoolIdx).toBeLessThan(titleIdx);
  });
});

// Test 12.2: Metadata Table Generation
describe('Metadata Table Generation', () => {
  const requiredFields = [
    'NAME OF STUDENT', 'INDEX NUMBER', 'COURSE NAME', 'PROGRAMME',
    'TOPIC', 'DATE', 'VENUE', 'TIME', 'DURATION', 'NUMBER OF STUDENTS',
    'METHOD OF INSTRUCTION', 'MEDIA', 'NAME OF SUPERVISOR', 'SIGNATURE'
  ];

  it('PDF should include all 14 required metadata fields', async () => {
    const buffer = await renderExportBuffer('pdf', minimalInput);
    const text = await extractPdfText(buffer);
    requiredFields.forEach(field => expect(text).toContain(field));
  });

  it('PDF should show underscores for missing fields', async () => {
    const buffer = await renderExportBuffer('pdf', minimalInput);
    const text = await extractPdfText(buffer);
    expect(text).toContain('______________________');
  });

  it('PDF should populate provided metadata fields', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{
          id: 'lesson_metadata',
          title: 'Metadata',
          type: 'metadata',
          content: [
            { field: 'NAME OF STUDENT', value: 'John Doe' },
            { field: 'INDEX NUMBER', value: '12345' }
          ]
        }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('John Doe');
    expect(text).toContain('12345');
  });
});

// Test 12.3: Section Heading Formatting
describe('Section Heading Formatting', () => {
  const expectedHeadings = [
    'INTRODUCTION', 'GENERAL OBJECTIVES', 'LEARNING OUTCOMES',
    'LESSON PRESENTATION',
    'ASSIGNMENT', 'FACILITATOR NOTES', 'EVALUATION / SUMMARY', 'REFERENCES'
  ];

  it('PDF should include standard section headings', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [
          { id: 'introduction', title: 'Introduction', type: 'text', content: 'Intro text' },
          { id: 'objectives', title: 'Objectives', type: 'list', content: ['Obj 1'] },
          { id: 'outcomes', title: 'Outcomes', type: 'list', content: ['Out 1'] }
        ]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('INTRODUCTION');
    expect(text).toContain('GENERAL OBJECTIVES');
    expect(text).toContain('LEARNING OUTCOMES');
  });

  it('PDF should use exact institutional heading names', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{ id: 'objectives', title: 'Objectives', type: 'list', content: ['Obj 1'] }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('GENERAL OBJECTIVES');
    expect(text).not.toContain('OBJECTIVES:');
  });
});

// Test 12.4: Objectives Numbering
describe('Objectives Numbering', () => {
  it('PDF should include introductory text for objectives', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{ id: 'objectives', title: 'Objectives', type: 'list', content: ['Describe', 'Explain'] }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('At the end of the lesson, the student should be able to:');
  });

  it('PDF should number objectives sequentially from 1', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{
          id: 'objectives',
          title: 'Objectives',
          type: 'list',
          content: ['Describe the heart', 'Explain the function', 'Identify vessels']
        }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('1. Describe the heart');
    expect(text).toContain('2. Explain the function');
    expect(text).toContain('3. Identify vessels');
  });
});

// Test 12.5: Assignment Numbering Cleanup
describe('Assignment Numbering Cleanup', () => {
  it('PDF should remove existing "1)" numbering', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{
          id: 'assignment',
          title: 'Assignment',
          type: 'list',
          content: ['1) Heart has four chambers', '2) Blood flows one direction']
        }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('1) Heart has four chambers');
    expect(text).not.toContain('1) 1)');
  });

  it('PDF should remove existing "1." numbering', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{
          id: 'assignment',
          title: 'Assignment',
          type: 'list',
          content: ['1. Heart has four chambers', '2. Blood flows one direction']
        }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('1) Heart has four chambers');
    expect(text).not.toContain('1) 1.');
  });

  it('PDF should add numbering to unnumbered items', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{
          id: 'assignment',
          title: 'Assignment',
          type: 'list',
          content: ['Heart has four chambers', 'Blood flows one direction']
        }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('1) Heart has four chambers');
    expect(text).toContain('2) Blood flows one direction');
  });

  it('PDF should include assignment instructions', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{ id: 'assignment', title: 'Assignment', type: 'list', content: ['Q1', 'Q2'] }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('Indicate whether the following statements are True (T) or False (F)');
  });
});

// Test 12.6: Content Extraction
describe('Content Extraction', () => {
  it('should extract text from string content', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{ id: 'introduction', title: 'Introduction', type: 'text', content: 'Simple string content' }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('Simple string content');
  });

  it('should extract text from array content', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{ id: 'objectives', title: 'Objectives', type: 'list', content: ['First', 'Second', 'Third'] }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('First');
    expect(text).toContain('Second');
    expect(text).toContain('Third');
  });

  it('should extract text from object with "text" field', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{ id: 'objectives', title: 'Objectives', type: 'list', content: [{ text: 'Obj with text' }] }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('Obj with text');
  });

  it('should extract text from object with "content" field', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{ id: 'objectives', title: 'Objectives', type: 'list', content: [{ content: 'Obj with content' }] }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('Obj with content');
  });

  it('should extract text from object with "description" field', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{ id: 'key_definitions', title: 'Definitions', type: 'list', content: [{ description: 'Def with desc' }] }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('Def with desc');
  });

  it('should sanitize markdown formatting', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{ id: 'introduction', title: 'Introduction', type: 'text', content: 'This is **bold** and *italic*' }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('This is bold and italic');
    expect(text).not.toContain('**bold**');
  });

  it('should sanitize HTML formatting', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{ id: 'introduction', title: 'Introduction', type: 'text', content: 'This is <strong>bold</strong>' }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('This is bold');
    expect(text).not.toContain('<strong>');
  });

  it('should handle multi-line text splitting', async () => {
    const input = {
      ...minimalInput,
      contentJson: {
        sections: [{ id: 'introduction', title: 'Introduction', type: 'text', content: 'Line 1\nLine 2\nLine 3' }]
      }
    };
    const buffer = await renderExportBuffer('pdf', input);
    const text = await extractPdfText(buffer);
    expect(text).toContain('Line 1');
    expect(text).toContain('Line 2');
    expect(text).toContain('Line 3');
  });
});
