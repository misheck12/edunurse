/**
 * Test phone number validation
 * Run with: npx tsx backend/test-phone-validation.ts
 */

function validateAndFormatPhone(phone: string): string {
  // Remove spaces, dashes, and other non-numeric characters
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  console.log(`Input: ${phone}`);
  console.log(`After cleaning: ${cleaned}`);
  
  // Handle Zambian phone numbers
  if (cleaned.startsWith('+260')) {
    cleaned = cleaned.substring(4);
    console.log(`After removing +260: ${cleaned}`);
  } else if (cleaned.startsWith('260')) {
    cleaned = cleaned.substring(3);
    console.log(`After removing 260: ${cleaned}`);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
    console.log(`After removing leading 0: ${cleaned}`);
  }
  
  // Should now be 9 digits
  if (cleaned.length !== 9) {
    throw new Error(`Invalid Zambian phone number format. Expected 9 digits, got ${cleaned.length}`);
  }
  
  console.log(`Final format: ${cleaned}`);
  console.log('---');
  
  return cleaned;
}

// Test cases
const testNumbers = [
  '0771234567',      // Airtel with leading 0
  '+260771234567',   // Airtel with +260
  '260771234567',    // Airtel with 260
  '0977123456',      // Airtel 097
  '0967123456',      // MTN
  '0957123456',      // Zamtel
  '0771 234 567',    // With spaces
  '0771-234-567',    // With dashes
  '+260 771 234 567', // International with spaces
];

console.log('Testing Zambian Phone Number Validation\n');

for (const number of testNumbers) {
  try {
    validateAndFormatPhone(number);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.log('---');
  }
}

console.log('\n✅ All tests completed!');
