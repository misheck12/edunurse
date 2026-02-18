/**
 * Quick Test for Content Expansion Feature
 * 
 * This script tests the AI content expansion with your existing
 * Azure and Gemini configuration.
 */

import { expandLessonContentWithProviderFallback } from "./src/services/ai-layer.js";

async function quickTest() {
  console.log("🧪 Testing AI Content Expansion Feature");
  console.log("=" .repeat(60));
  console.log();

  const testInput = {
    topic: "Management of Sexually Transmitted Infections",
    subtopic: "Syndromic Management",
    contentBrief: "Syndromic management approach for STI presentations",
    specificObjective: "Demonstrate understanding of syndromic management when applied to common STI presentations",
    programme: "Diploma in Nursing",
    course: "Medical Surgical Nursing V",
    retrievalChunks: [
      {
        chunkId: "test-1",
        sourceId: "test-source",
        sourceName: "WHO STI Management Guidelines",
        page: 15,
        heading: "Syndromic Management",
        text: "Syndromic management is a clinical strategy for managing STIs based on identified symptom patterns. It is particularly useful in settings where immediate laboratory confirmation is limited. The approach involves identifying a group of symptoms and signs (syndrome) and providing treatment that covers the most common or serious organisms responsible for that syndrome.",
      },
    ],
  };

  console.log("📝 Input:");
  console.log(`   Topic: ${testInput.topic}`);
  console.log(`   Brief: ${testInput.contentBrief}`);
  console.log();

  try {
    console.log("⏳ Expanding content with AI...");
    const startTime = Date.now();
    
    const result = await expandLessonContentWithProviderFallback(testInput);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log();
    console.log("✅ SUCCESS!");
    console.log("=" .repeat(60));
    console.log(`Provider: ${result.provider}`);
    console.log(`Model: ${result.model}`);
    console.log(`Duration: ${duration}s`);
    console.log();
    console.log("📄 Expanded Content:");
    console.log("-".repeat(60));
    console.log(result.expandedContent);
    console.log("-".repeat(60));
    console.log();
    console.log(`✨ Content length: ${result.expandedContent.length} characters`);
    console.log(`✨ Word count: ~${result.expandedContent.split(/\s+/).length} words`);
    console.log();
    console.log("🎉 Content expansion feature is working correctly!");
    
  } catch (error) {
    console.error();
    console.error("❌ FAILED!");
    console.error("=" .repeat(60));
    console.error(error instanceof Error ? error.message : String(error));
    console.error();
    console.error("💡 Troubleshooting:");
    console.error("   1. Check that AZURE_OPENAI_* or GEMINI_API_KEY is set in .env");
    console.error("   2. Verify your API keys are valid");
    console.error("   3. Check your internet connection");
    process.exit(1);
  }
}

quickTest();
