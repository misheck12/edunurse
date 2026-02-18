/**
 * Manual Test Script for Lesson Plan Export Renderer
 * 
 * This script generates PDF and DOCX exports for three test scenarios:
 * 1. Complete lesson plan with all sections populated
 * 2. Minimal lesson plan with only required fields
 * 3. Lesson plan with missing optional sections
 * 
 * Run with: npx tsx backend/test-export-renderer.ts
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderExportBuffer } from "./src/services/export-renderer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestCase {
  name: string;
  inputFile: string;
  description: string;
}

const testCases: TestCase[] = [
  {
    name: "complete",
    inputFile: "lesson-plan-complete.json",
    description: "Complete lesson plan with all sections populated"
  },
  {
    name: "minimal",
    inputFile: "lesson-plan-minimal.json",
    description: "Minimal lesson plan with only required fields"
  },
  {
    name: "missing-sections",
    inputFile: "lesson-plan-missing-sections.json",
    description: "Lesson plan with missing optional sections"
  }
];

async function runTests() {
  console.log("=".repeat(80));
  console.log("LESSON PLAN EXPORT RENDERER - MANUAL TEST");
  console.log("=".repeat(80));
  console.log();

  // Create output directory
  const outputDir = join(__dirname, "test-output");
  try {
    await mkdir(outputDir, { recursive: true });
    console.log(`✓ Output directory created: ${outputDir}`);
  } catch (error) {
    console.log(`✓ Output directory exists: ${outputDir}`);
  }
  console.log();

  let successCount = 0;
  let failureCount = 0;

  for (const testCase of testCases) {
    console.log("-".repeat(80));
    console.log(`TEST CASE: ${testCase.name}`);
    console.log(`Description: ${testCase.description}`);
    console.log("-".repeat(80));

    try {
      // Read input file
      const inputPath = join(__dirname, "test-data", testCase.inputFile);
      const inputData = await readFile(inputPath, "utf-8");
      const input = JSON.parse(inputData);

      console.log(`✓ Loaded input: ${testCase.inputFile}`);

      // Generate PDF
      console.log("  Generating PDF...");
      const pdfStartTime = Date.now();
      const pdfBuffer = await renderExportBuffer("pdf", input);
      const pdfDuration = Date.now() - pdfStartTime;
      
      const pdfOutputPath = join(outputDir, `${testCase.name}.pdf`);
      await writeFile(pdfOutputPath, pdfBuffer);
      
      console.log(`  ✓ PDF generated in ${pdfDuration}ms (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
      console.log(`    Output: ${pdfOutputPath}`);

      // Generate DOCX
      console.log("  Generating DOCX...");
      const docxStartTime = Date.now();
      const docxBuffer = await renderExportBuffer("docx", input);
      const docxDuration = Date.now() - docxStartTime;
      
      const docxOutputPath = join(outputDir, `${testCase.name}.docx`);
      await writeFile(docxOutputPath, docxBuffer);
      
      console.log(`  ✓ DOCX generated in ${docxDuration}ms (${(docxBuffer.length / 1024).toFixed(2)} KB)`);
      console.log(`    Output: ${docxOutputPath}`);

      console.log(`✓ Test case "${testCase.name}" completed successfully`);
      successCount++;

    } catch (error) {
      console.error(`✗ Test case "${testCase.name}" failed:`);
      console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(`  Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
      failureCount++;
    }

    console.log();
  }

  console.log("=".repeat(80));
  console.log("TEST SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total test cases: ${testCases.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  console.log();

  if (failureCount === 0) {
    console.log("✓ All tests passed!");
    console.log();
    console.log("NEXT STEPS:");
    console.log("1. Open the generated PDF and DOCX files in backend/test-output/");
    console.log("2. Compare outputs with the institutional template visually");
    console.log("3. Verify the following for each export:");
    console.log("   - Header format (LUSAKA SCHOOL OF NURSING, CLASS TRIAL PLAN)");
    console.log("   - Metadata table with all 14 fields");
    console.log("   - Underscores for empty values");
    console.log("   - Section headings (centered, bold)");
    console.log("   - Objectives with introductory text and numbering");
    console.log("   - Lesson presentation table with 7 columns");
    console.log("   - Assignment section with instructions and clean numbering");
    console.log("   - References in italic format");
    console.log("   - Page layout (A4, proper margins)");
    console.log();
  } else {
    console.log("✗ Some tests failed. Please review the errors above.");
    process.exit(1);
  }
}

// Run the tests
runTests().catch((error) => {
  console.error("Fatal error running tests:");
  console.error(error);
  process.exit(1);
});
