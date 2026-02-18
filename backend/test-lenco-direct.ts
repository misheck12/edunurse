/**
 * Test Lenco API directly with different phone formats
 * Run with: npx tsx backend/test-lenco-direct.ts
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory
config({ path: resolve(__dirname, '.env') });

const LENCO_API_KEY = process.env.LENCO_API_KEY;
const LENCO_API_BASE = process.env.LENCO_API_BASE_URL || 'https://api.lenco.co/access/v2';

async function testLencoPayment(phone: string, description: string) {
  console.log(`\n=== Testing: ${description} ===`);
  console.log(`Phone number: ${phone}`);
  
  const payload = {
    amount: "1.00", // Test with K1
    currency: "ZMW",
    phone: phone,
    country: "ZM",
    reference: `TEST-${Date.now()}`,
    bearer: "customer",
    metadata: {
      test: true
    }
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(`${LENCO_API_BASE}/collections/mobile-money`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LENCO_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ FAILED');
      console.log('Status:', response.status);
      console.log('Error:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ ERROR');
    console.error(error);
  }
}

async function main() {
  if (!LENCO_API_KEY) {
    console.error('❌ LENCO_API_KEY not found in .env file');
    process.exit(1);
  }

  console.log('Lenco API Base:', LENCO_API_BASE);
  console.log('Testing different phone number formats...\n');

  // Test different formats
  await testLencoPayment('771234567', 'Airtel 077 (9 digits, no leading 0)');
  await testLencoPayment('0771234567', 'Airtel 077 (10 digits, with leading 0)');
  await testLencoPayment('+260771234567', 'Airtel 077 (with +260)');
  await testLencoPayment('260771234567', 'Airtel 077 (with 260)');
  
  // Try other operators
  await testLencoPayment('977123456', 'Airtel 097 (9 digits)');
  await testLencoPayment('967123456', 'MTN 096 (9 digits)');
  await testLencoPayment('957123456', 'Zamtel 095 (9 digits)');

  console.log('\n=== Testing Complete ===');
  console.log('\nNote: These are test requests with K1. No actual charge will occur.');
  console.log('Check which format Lenco accepts for your account.\n');
}

main().catch(console.error);
