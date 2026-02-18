/**
 * Manual Test Script for Lesson Content Expansion
 * 
 * This script tests the AI content expansion feature that adds
 * detailed notes, definitions, and key points to lesson content.
 */

import { expandLessonContentWithProviderFallback } from "./src/services/ai-layer.js";

async function testContentExpansion() {
  console.log("=".repeat(80));
  console.log("LESSON CONTENT EXPANSION - MANUAL TEST");
  console.log("=".repeat(80));
  console.log();

  const testCases = [
    {
      name: "STI Management - Syndromic Approach",
      input: {
        topic: "Management of Sexually Transmitted Infections",
        subtopic: "Syndromic Management",
        contentBrief: "Syndromic management approach for STI presentations",
        specificObjective: "Demonstrate understanding of syndromic management when applied to common STI presentations",
        programme: "Diploma in Nursing",
        course: "Medical Surgical Nursing V",
        retrievalChunks: [
          {
            chunkId: "test-chunk-1",
            sourceId: "test-source-1",
            sourceName: "WHO STI Management Guidelines",
            page: 15,
            heading: "Syndromic Management",
            text: "Syndromic management is a clinical strategy for managing STIs based on identified symptom patterns. It is particularly useful in settings where immediate laboratory confirmation is limited. The approach involves identifying a group of symptoms and signs (syndrome) and providing treatment that covers the most common or serious organisms responsible for that syndrome.",
          },
          {
            chunkId: "test-chunk-2",
            sourceId: "test-source-1",
            sourceName: "WHO STI Management Guidelines",
            page: 16,
            heading: "Benefits of Syndromic Approach",
            text: "The syndromic approach allows for immediate treatment at the first visit, reducing the risk of complications and further transmission. It does not require laboratory facilities or highly trained staff. However, it may lead to overtreatment in some cases and requires regular updates based on local resistance patterns.",
          },
        ],
      },
    },
    {
      name: "Postpartum Care - Uterine Involution",
      input: {
        topic: "Postpartum Care and Maternal Health",
        subtopic: "Immediate Postpartum Period",
        contentBrief: "Uterine involution, cardiovascular changes, hormonal shifts, lochia progression",
        specificObjective: "Describe physiological changes in immediate postpartum period",
        programme: "Diploma in Nursing",
        course: "Integrated Reproductive Health II",
        retrievalChunks: [
          {
            chunkId: "test-chunk-3",
            sourceId: "test-source-2",
            sourceName: "Maternal Health Nursing Textbook",
            page: 342,
            heading: "Postpartum Physiological Changes",
            text: "Uterine involution is the process by which the uterus returns to its pre-pregnancy size and position. Immediately after delivery, the fundus is at the level of the umbilicus. The uterus involutes at approximately 1 cm per day. By 10-14 days postpartum, the uterus should no longer be palpable abdominally.",
          },
          {
            chunkId: "test-chunk-4",
            sourceId: "test-source-2",
            sourceName: "Maternal Health Nursing Textbook",
            page: 343,
            heading: "Lochia",
            text: "Lochia is the vaginal discharge following childbirth. It progresses through three stages: lochia rubra (days 1-3, bright red), lochia serosa (days 4-10, pinkish-brown), and lochia alba (days 10-14+, yellowish-white). Heavy bleeding or foul-smelling lochia may indicate complications.",
          },
        ],
      },
    },
  ];

  for (const testCase of testCases) {
    console.log(`\nTest Case: ${testCase.name}`);
    console.log("-".repeat(80));
    console.log(`Topic: ${testCase.input.topic}`);
    console.log(`Subtopic: ${testCase.input.subtopic}`);
    console.log(`Brief Content: ${testCase.input.contentBrief}`);
    console.log(`Objective: ${testCase.input.specificObjective}`);
    console.log();

    try {
      const result = await expandLessonContentWithProviderFallback(testCase.input);
      
      console.log("✅ Content Expansion Successful");
      console.log(`Provider: ${result.provider}`);
      console.log(`Model: ${result.model}`);
      console.log();
      console.log("Expanded Content:");
      console.log("-".repeat(80));
      console.log(result.expandedContent);
      console.log("-".repeat(80));
      console.log();
    } catch (error) {
      console.error("❌ Content Expansion Failed");
      console.error(error instanceof Error ? error.message : String(error));
      console.log();
    }
  }

  console.log("=".repeat(80));
  console.log("TEST COMPLETE");
  console.log("=".repeat(80));
}

testContentExpansion().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
