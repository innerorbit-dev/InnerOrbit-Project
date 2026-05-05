// Last Updated: 2026-03-17
// Description: Development utility: verify-suggestions.js
// Project Role: Development and testing utility for unread highlights.
const { getSuggestions } = require('../innerorbit-universal/lib/suggestion-service');

/**
 * Verification script for Suggestion Service
 * Run with: node scripts/verify-suggestions.js
 */

const testCases = [
    { input: "Hello there!", expectedKeywords: ["hey", "hi"] },
    { input: "How are you doing today?", expectedKeywords: ["good", "well"] },
    { input: "What are your plans for the weekend?", expectedKeywords: ["busy", "free"] },
    { input: "I'll see you later.", expectedKeywords: ["see you", "later"] },
    { input: "Yes, that sounds like a great idea.", expectedKeywords: ["👍", "sure"] },
    { input: "No, I don't think I can make it.", expectedKeywords: ["sorry", "can't"] },
    { input: "Thanks for the gift!", expectedKeywords: ["welcome", "problem"] },
    { input: "This is a completely unrelated message.", expected: ["Cool", "Nice", "Ok", "👍"] }
];

console.log("🧪 Starting Suggestion Engine Verification...\n");

let passed = 0;
testCases.forEach((test, index) => {
    const results = getSuggestions(test.input);
    console.log(`Test #${index + 1}: "${test.input}"`);
    console.log(`  Suggestions: [${results.join(', ')}]`);
    
    let isMatch = false;
    if (test.expectedKeywords) {
        isMatch = test.expectedKeywords.every(kw => 
            results.some(res => res.toLowerCase().includes(kw))
        );
    } else {
        isMatch = JSON.stringify(results) === JSON.stringify(test.expected);
    }

    if (isMatch) {
        console.log("  ✅ PASS");
        passed++;
    } else {
        console.log("  ❌ FAIL");
    }
    console.log("");
});

console.log(`📊 Verification Complete: ${passed}/${testCases.length} tests passed.`);

if (passed === testCases.length) {
    console.log("\n🚀 Suggestion Engine is ready for deployment!");
} else {
    process.exit(1);
}
