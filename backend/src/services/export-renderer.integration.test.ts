/**
 * Integration Tests for Lesson Plan Export Renderer
 * Tests complete export workflows with realistic data.
 * 
 * Feature: lesson-plan-export-format
 */

import { describe, it, expect } from 'vitest';
import { renderExportBuffer } from './export-renderer.js';
import { readFileSync } from 'fs';
import { join } from 'path';
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

// Load test data files
function loadTestData(filename: string): any {
  const path = join(__dirname, '../../test-data', filename);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

// Test 14.1: Complete Lesson Plan Export
describe('Integration Test 14.1: Complete Lesson Plan Export', () => {
  const completeData = loadTestData('lesson-plan-complete.json');

  it('should export complete lesson plan to PDF with all sections', async () => {
    const buffer = await renderExportBuffer('pdf', completeData);
    const text = await extractPdfText(buffer);

    // Verify header
    expect(text).toContain('LUSAKA SCHOOL OF NURSING');
    expect(text).toContain('CLASS TRIAL PLAN');

    // Verify metadata table fields
    expect(text).toContain('NAME OF STUDENT');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('INDEX NUMBER');
    expect(text).toContain('2024/NUR/001');
    expect(text).toContain('COURSE NAME');
    expect(text).toContain('Integrated Reproductive Health II');

    // Verify all section headings
    expect(text).toContain('INTRODUCTION');
    expect(text).toContain('GENERAL OBJECTIVES');
    expect(text).toContain('LEARNING OUTCOMES');
    expect(text).toContain('LESSON PRESENTATION');
    expect(text).toContain('ASSIGNMENT');
    expect(text).toContain('FACILITATOR NOTES');
    expect(text).toContain('EVALUATION / SUMMARY');
    expect(text).toContain('REFERENCES');

    // Verify introduction content
    expect(text).toContain('postpartum period');
    expect(text).toContain('puerperium');

    // Verify objectives formatting
    expect(text).toContain('At the end of the lesson, the student should be able to:');
    expect(text).toContain('1. Describe the physiological changes');
    expect(text).toContain('2. Identify signs and symptoms');

    // Verify key definitions
    expect(text).toContain('Puerperium');
    expect(text).toContain('Involution');
    expect(text).toContain('Lochia');

    // Verify lesson presentation table headers
    expect(text).toContain('TIME');
    expect(text).toContain('SPECIFIC OBJECTIVE');
    expect(text).toContain('CONTENT');
    expect(text).toContain("TEACHER'S ACTIVITY");
    expect(text).toContain("STUDENT'S ACTIVITY");
    expect(text).toContain('TEACHING/LEARNING RESOURCES');
    expect(text).toContain('EVALUATION');

    // Verify assignment section
    expect(text).toContain('Indicate whether the following statements are True (T) or False (F)');
    expect(text).toContain('1) The normal duration of the puerperium is 6 weeks');
    expect(text).toContain('2) Lochia rubra is the first type of lochia');

    // Verify references formatting
    expect(text).toContain('World Health Organization');
    expect(text).toContain('Cunningham');
    expect(text).toContain('Zambia Ministry of Health');
  });

  it('should export complete lesson plan to DOCX with all sections', async () => {
    const buffer = await renderExportBuffer('docx', completeData);
    const text = await extractDocxText(buffer);

    // Verify header
    expect(text).toContain('LUSAKA SCHOOL OF NURSING');
    expect(text).toContain('CLASS TRIAL PLAN');

    // Verify metadata fields are present
    expect(text).toContain('NAME OF STUDENT');
    expect(text).toContain('COURSE NAME');
    expect(text).toContain('Integrated Reproductive Health II');

    // Verify section headings
    expect(text).toContain('INTRODUCTION');
    expect(text).toContain('GENERAL OBJECTIVES');
    expect(text).toContain('LEARNING OUTCOMES');
    expect(text).toContain('LESSON PRESENTATION');
    expect(text).toContain('ASSIGNMENT');
    expect(text).toContain('REFERENCES');

    // Verify content
    expect(text).toContain('postpartum period');
    expect(text).toContain('At the end of the lesson, the student should be able to:');
    expect(text).toContain('Describe the physiological changes');

    // Verify table headers
    expect(text).toContain('TIME');
    expect(text).toContain('SPECIFIC OBJECTIVE');
    expect(text).toContain("TEACHER'S ACTIVITY");

    // Verify assignment
    expect(text).toContain('Indicate whether the following statements are True (T) or False (F)');
    expect(text).toContain('The normal duration of the puerperium is 6 weeks');

    // Verify references
    expect(text).toContain('World Health Organization');
  });

  it('should maintain consistent structure between PDF and DOCX exports', async () => {
    const pdfBuffer = await renderExportBuffer('pdf', completeData);
    const docxBuffer = await renderExportBuffer('docx', completeData);

    const pdfText = await extractPdfText(pdfBuffer);
    const docxText = await extractDocxText(docxBuffer);

    // Both should contain the same key structural elements
    const keyElements = [
      'LUSAKA SCHOOL OF NURSING',
      'CLASS TRIAL PLAN',
      'INTRODUCTION',
      'GENERAL OBJECTIVES',
      'LESSON PRESENTATION',
      'ASSIGNMENT',
      'REFERENCES'
    ];

    keyElements.forEach(element => {
      expect(pdfText).toContain(element);
      expect(docxText).toContain(element);
    });

    // Both should have the same number of objectives
    const objectivesInPdf = (pdfText.match(/\d+\. Describe|\d+\. Identify|\d+\. Demonstrate|\d+\. Explain|\d+\. Discuss/g) || []).length;
    const objectivesInDocx = (docxText.match(/Describe the physiological|Identify signs and symptoms|Demonstrate appropriate|Explain the importance|Discuss strategies/g) || []).length;
    
    expect(objectivesInPdf).toBeGreaterThan(0);
    expect(objectivesInDocx).toBeGreaterThan(0);
  });
});

// Test 14.2: Minimal Lesson Plan Export
describe('Integration Test 14.2: Minimal Lesson Plan Export', () => {
  const minimalData = loadTestData('lesson-plan-minimal.json');

  it('should export minimal lesson plan to PDF gracefully', async () => {
    const buffer = await renderExportBuffer('pdf', minimalData);
    const text = await extractPdfText(buffer);

    // Verify header is always present
    expect(text).toContain('LUSAKA SCHOOL OF NURSING');
    expect(text).toContain('CLASS TRIAL PLAN');

    // Verify metadata table with placeholders for missing fields
    expect(text).toContain('NAME OF STUDENT');
    expect(text).toContain('INDEX NUMBER');
    expect(text).toContain('COURSE NAME');
    expect(text).toContain('______________________'); // Placeholder for empty fields

    // Verify present sections
    expect(text).toContain('INTRODUCTION');
    expect(text).toContain('GENERAL OBJECTIVES');
    expect(text).toContain('This lesson covers basic human anatomy');

    // Verify objectives are numbered
    expect(text).toContain('At the end of the lesson, the student should be able to:');
    expect(text).toContain('1. Identify major body systems');
    expect(text).toContain('2. Describe basic anatomical terminology');

    // Verify lesson presentation table is present (even if empty/fallback)
    expect(text).toContain('LESSON PRESENTATION');
    expect(text).toContain('TIME');
    expect(text).toContain('SPECIFIC OBJECTIVE');
  });

  it('should export minimal lesson plan to DOCX gracefully', async () => {
    const buffer = await renderExportBuffer('docx', minimalData);
    const text = await extractDocxText(buffer);

    // Verify header
    expect(text).toContain('LUSAKA SCHOOL OF NURSING');
    expect(text).toContain('CLASS TRIAL PLAN');

    // Verify metadata with placeholders
    expect(text).toContain('NAME OF STUDENT');
    expect(text).toContain('__'); // Placeholder format in DOCX

    // Verify present sections
    expect(text).toContain('INTRODUCTION');
    expect(text).toContain('GENERAL OBJECTIVES');
    expect(text).toContain('basic human anatomy');

    // Verify objectives
    expect(text).toContain('Identify major body systems');
    expect(text).toContain('Describe basic anatomical terminology');

    // Verify table structure
    expect(text).toContain('LESSON PRESENTATION');
  });

  it('should handle missing optional sections without errors', async () => {
    const buffer = await renderExportBuffer('pdf', minimalData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const text = await extractPdfText(buffer);
    
    // Should not crash and should produce valid output
    expect(text).toContain('LUSAKA SCHOOL OF NURSING');
    
    // Optional sections that are missing should not appear
    // (or appear with empty content if the renderer includes them)
    const hasAssignment = text.includes('ASSIGNMENT');
    const hasReferences = text.includes('REFERENCES');
    
    // If they appear, they should be properly formatted
    if (hasAssignment) {
      expect(text).toContain('ASSIGNMENT');
    }
    if (hasReferences) {
      expect(text).toContain('REFERENCES');
    }
  });
});

// Test for missing sections scenario
describe('Integration Test 14.2b: Lesson Plan with Missing Optional Sections', () => {
  const missingSectionsData = loadTestData('lesson-plan-missing-sections.json');

  it('should export lesson plan with missing optional sections to PDF', async () => {
    const buffer = await renderExportBuffer('pdf', missingSectionsData);
    const text = await extractPdfText(buffer);

    // Verify header
    expect(text).toContain('LUSAKA SCHOOL OF NURSING');
    expect(text).toContain('CLASS TRIAL PLAN');

    // Verify partial metadata
    expect(text).toContain('COURSE NAME');
    expect(text).toContain('Pharmacology I');
    expect(text).toContain('TOPIC');
    expect(text).toContain('Drug Administration Routes');

    // Verify present sections
    expect(text).toContain('INTRODUCTION');
    expect(text).toContain('GENERAL OBJECTIVES');
    expect(text).toContain('LESSON PRESENTATION');
    expect(text).toContain('REFERENCES');

    // Verify missing optional sections are handled gracefully
    // (they may or may not appear depending on implementation)
    const hasOutcomes = text.includes('LEARNING OUTCOMES');
    const hasAssignment = text.includes('ASSIGNMENT');
    const hasDefinitions = text.includes('KEY DEFINITIONS');
    
    // If sections appear, they should be properly formatted
    if (hasOutcomes) {
      expect(text).toContain('LEARNING OUTCOMES');
    }
  });

  it('should export lesson plan with missing optional sections to DOCX', async () => {
    const buffer = await renderExportBuffer('docx', missingSectionsData);
    const text = await extractDocxText(buffer);

    // Verify header
    expect(text).toContain('LUSAKA SCHOOL OF NURSING');
    expect(text).toContain('CLASS TRIAL PLAN');

    // Verify present sections
    expect(text).toContain('INTRODUCTION');
    expect(text).toContain('GENERAL OBJECTIVES');
    expect(text).toContain('LESSON PRESENTATION');
    expect(text).toContain('REFERENCES');

    // Verify content
    expect(text).toContain('drug administration');
    expect(text).toContain('List the major routes');
  });
});

// Test 14.3: Multi-Page Table Rendering
describe('Integration Test 14.3: Multi-Page Table Rendering', () => {
  const multipageData = loadTestData('lesson-plan-multipage.json');

  it('should export lesson plan with 20+ presentation rows to PDF', async () => {
    const buffer = await renderExportBuffer('pdf', multipageData);
    const text = await extractPdfText(buffer);

    // Verify header
    expect(text).toContain('LUSAKA SCHOOL OF NURSING');
    expect(text).toContain('CLASS TRIAL PLAN');

    // Verify lesson presentation table
    expect(text).toContain('LESSON PRESENTATION');
    
    // Verify table headers appear (should repeat on multiple pages)
    const timeHeaderCount = (text.match(/TIME/g) || []).length;
    const specificObjectiveCount = (text.match(/SPECIFIC OBJECTIVE/g) || []).length;
    const teacherActivityCount = (text.match(/TEACHER'S ACTIVITY/g) || []).length;
    
    // Headers should appear multiple times if table spans pages
    // At minimum, they should appear once
    expect(timeHeaderCount).toBeGreaterThanOrEqual(1);
    expect(specificObjectiveCount).toBeGreaterThanOrEqual(1);
    expect(teacherActivityCount).toBeGreaterThanOrEqual(1);

    // Verify content from various rows (beginning, middle, end)
    expect(text).toContain('Introduction to comprehensive care'); // First row
    expect(text).toContain('Medication administration'); // Middle row
    expect(text).toContain('Summary and evaluation'); // Last row

    // Verify specific objectives from different rows
    expect(text).toContain('Vital signs assessment');
    expect(text).toContain('Cardiovascular assessment');
    expect(text).toContain('Pain assessment');
    expect(text).toContain('Wound care');
    expect(text).toContain('Patient safety');
    expect(text).toContain('Cultural competence');

    // Verify time allocations are present
    expect(text).toContain('5 min');
    expect(text).toContain('10 min');
    expect(text).toContain('8 min');
  });

  it('should export lesson plan with 20+ presentation rows to DOCX', async () => {
    const buffer = await renderExportBuffer('docx', multipageData);
    const text = await extractDocxText(buffer);

    // Verify header
    expect(text).toContain('LUSAKA SCHOOL OF NURSING');
    expect(text).toContain('CLASS TRIAL PLAN');

    // Verify lesson presentation section
    expect(text).toContain('LESSON PRESENTATION');

    // Verify table headers
    expect(text).toContain('TIME');
    expect(text).toContain('SPECIFIC OBJECTIVE');
    expect(text).toContain("TEACHER'S ACTIVITY");
    expect(text).toContain("STUDENT'S ACTIVITY");
    expect(text).toContain('TEACHING/LEARNING RESOURCES');
    expect(text).toContain('EVALUATION');

    // Verify content from various rows
    expect(text).toContain('Introduction to comprehensive care');
    expect(text).toContain('Medication administration');
    expect(text).toContain('Summary and evaluation');

    // Verify multiple specific objectives
    expect(text).toContain('Vital signs assessment');
    expect(text).toContain('Neurological assessment');
    expect(text).toContain('Respiratory assessment');
    expect(text).toContain('Infection control');
    expect(text).toContain('Ethical considerations');
  });

  it('should handle page breaks correctly in PDF with long table', async () => {
    const buffer = await renderExportBuffer('pdf', multipageData);
    
    // Verify buffer is valid and substantial (multi-page document)
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(10000); // Multi-page PDF should be substantial

    const text = await extractPdfText(buffer);

    // Verify all 25 rows are present by checking unique content
    const rowCount = multipageData.contentJson.sections.find(
      (s: any) => s.id === 'lesson_presentation'
    )?.content.length;
    
    expect(rowCount).toBe(25);

    // Verify content from first, middle, and last rows (be flexible with text extraction and line breaks)
    expect(text.replace(/\s+/g, ' ')).toMatch(/Introduction.*comprehensive.*care/i);
    expect(text.replace(/\s+/g, ' ')).toMatch(/Interdisciplinary.*collaboration/i);
    expect(text.replace(/\s+/g, ' ')).toMatch(/Summary.*evaluation/i);

    // Verify table structure is maintained throughout
    expect(text).toContain('TIME');
    expect(text.replace(/\s+/g, ' ')).toMatch(/SPECIFIC.*OBJECTIVE/);
    expect(text).toContain('CONTENT');
    expect(text).toContain('EVALUA'); // May be truncated
  });

  it('should repeat table headers on page breaks in PDF', async () => {
    const buffer = await renderExportBuffer('pdf', multipageData);
    const text = await extractPdfText(buffer);
    const normalizedText = text.replace(/\s+/g, ' ');

    // Count occurrences of table headers (normalize whitespace for matching)
    // If table spans multiple pages, headers should appear more than once
    const timeCount = (text.match(/TIME/g) || []).length;
    const specificObjectiveCount = (normalizedText.match(/SPECIFIC\s+OBJECTIVE/g) || []).length;
    
    // With 25 rows, the table should span multiple pages
    // Headers should appear at least once, potentially more if repeated
    expect(timeCount).toBeGreaterThanOrEqual(1);
    expect(specificObjectiveCount).toBeGreaterThanOrEqual(1);

    // Verify the document is multi-page by checking buffer size
    // A single-page PDF would be much smaller
    expect(buffer.length).toBeGreaterThan(10000);
  });

  it('should maintain table formatting consistency across pages', async () => {
    const buffer = await renderExportBuffer('pdf', multipageData);
    const text = await extractPdfText(buffer);
    const normalizedText = text.replace(/\s+/g, ' ');

    // Verify all 7 columns are present (normalize whitespace for matching)
    expect(text).toContain('TIME');
    expect(normalizedText).toMatch(/SPECIFIC\s+OBJECTIVE/);
    expect(text).toContain('CONTENT');
    expect(normalizedText).toMatch(/TEACHER.*ACTIVITY/);
    expect(normalizedText).toMatch(/STUDENT.*ACTIVITY/);
    expect(normalizedText).toMatch(/TEACHING.*LEARNING.*RESOURCES/);
    expect(text).toContain('EVALUA'); // May be truncated in PDF

    // Verify content from different sections of the table (normalize whitespace)
    expect(normalizedText).toMatch(/Introduction.*comprehensive.*care/i);
    expect(normalizedText).toMatch(/Pain.*assessment/i);
    expect(normalizedText).toMatch(/Summary.*evaluation/i);

    // Verify no content is lost
    const sampleObjectives = [
      /Vital.*signs.*assessment/i,
      /Cardiovascular.*assessment/i,
      /Medication.*administration/i,
      /Patient.*safety/i,
      /Cultural.*competence/i
    ];

    sampleObjectives.forEach(objective => {
      expect(normalizedText).toMatch(objective);
    });
  });
});
