// =============================================================================
// src/tests/unit-math-crypto.test.ts
// Unit tests for Haversine distance, fee calculation, confirmation code & encryption.
// Run via: npx tsx src/tests/unit-math-crypto.test.ts
// =============================================================================

import { computeHaversineDistanceKm, calculateDeliveryFee } from '../utils/geo';
import {
  generateDeliveryConfirmationCode,
  normalizeDeliveryConfirmationCode,
  encrypt,
  decrypt,
} from '../utils/crypto';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

export async function runUnitMathCryptoTests(): Promise<void> {
  console.log('🧪 Starting Unit Math, Crypto & Boundary Test Suite...\n');

  // ---------------------------------------------------------------------------
  // 1. Haversine Distance Formula Tests
  // ---------------------------------------------------------------------------
  console.log('1. Testing Haversine Distance Formula...');

  // Test A: Real Nairobi Coordinates: Westlands (-1.2683, 36.8111) -> Kilimani (-1.2908, 36.7828)
  const distWestlandsToKilimani = computeHaversineDistanceKm(-1.2683, 36.8111, -1.2908, 36.7828);
  assert(
    distWestlandsToKilimani >= 3.9 && distWestlandsToKilimani <= 4.3,
    `Westlands to Kilimani should be ~4.1km, got ${distWestlandsToKilimani}km`
  );
  console.log(`   ✓ Westlands to Kilimani distance accurate: ${distWestlandsToKilimani} km`);

  // Test B: Identical coordinates must be exactly 0
  const distZero = computeHaversineDistanceKm(-1.2908, 36.7828, -1.2908, 36.7828);
  assert(distZero === 0, `Identical coordinates must yield 0km, got ${distZero}`);
  console.log('   ✓ Identical coordinates yield 0.00 km');

  // Test C: Invalid / NaN Coordinates guard
  const distNaN = computeHaversineDistanceKm(NaN, 36.7828, -1.2908, NaN);
  assert(distNaN === 0, `NaN coordinates should gracefully return 0km, got ${distNaN}`);
  console.log('   ✓ NaN/invalid coordinates handled safely');

  // ---------------------------------------------------------------------------
  // 2. Delivery Fee Calculation Engine Tests
  // ---------------------------------------------------------------------------
  console.log('\n2. Testing Tiered Delivery Fee Calculation...');

  // Test A: Short distance (<= 3km) charged base fee only
  const shortTrip = calculateDeliveryFee(2.5, { baseFee: 100, feePerKm: 25, baseThresholdKm: 3, maxDeliveryRadiusKm: 15 });
  assert(shortTrip.fee === 100 && shortTrip.status === 'known', `2.5km should be base fee 100 KES, got ${shortTrip.fee}`);
  console.log(`   ✓ Short trip (2.5 km) = KES ${shortTrip.fee} (status: ${shortTrip.status})`);

  // Test B: Mid distance (7.0km) = 100 base + (7-3)*25 = 200 KES
  const midTrip = calculateDeliveryFee(7.0, { baseFee: 100, feePerKm: 25, baseThresholdKm: 3, maxDeliveryRadiusKm: 15 });
  assert(midTrip.fee === 200 && midTrip.status === 'known', `7.0km should be 200 KES, got ${midTrip.fee}`);
  console.log(`   ✓ Mid trip (7.0 km) = KES ${midTrip.fee} (status: ${midTrip.status})`);

  // Test C: Out-of-radius trip (16km > 15km cutoff)
  const farTrip = calculateDeliveryFee(16.0, { baseFee: 100, feePerKm: 25, baseThresholdKm: 3, maxDeliveryRadiusKm: 15 });
  assert(
    farTrip.status === 'needs_merchant_confirmation' && farTrip.fee === 0,
    `Trip beyond max radius should require merchant confirmation, got ${farTrip.status}`
  );
  console.log(`   ✓ Out-of-radius trip (16.0 km) properly flagged: ${farTrip.status}`);

  // ---------------------------------------------------------------------------
  // 3. Delivery Confirmation Code Generation (10,000 Iteration Audit)
  // ---------------------------------------------------------------------------
  console.log('\n3. Testing 4-Digit Delivery Verification Code Generator (10,000 iterations)...');

  const ambiguousChars = ['0', 'O', '1', 'I', '8', 'B'];
  const generatedCodes = new Set<string>();

  for (let i = 0; i < 10000; i++) {
    const code = generateDeliveryConfirmationCode();

    assert(code.length === 4, `Code must be exactly 4 characters, got ${code}`);

    for (const char of ambiguousChars) {
      assert(
        !code.includes(char),
        `Code '${code}' contains prohibited ambiguous character '${char}'`
      );
    }
    generatedCodes.add(code);
  }

  assert(generatedCodes.size > 5000, `High entropy test: expected >5,000 unique codes in 10,000 samples, got ${generatedCodes.size}`);
  console.log(`   ✓ 10,000 codes verified: zero ambiguous characters, ${generatedCodes.size} unique variations`);

  // Test Code Normalization
  const rawInput = ' 7-k 9m ';
  const normalized = normalizeDeliveryConfirmationCode(rawInput);
  assert(normalized === '7K9M', `Normalization of '${rawInput}' failed, got '${normalized}'`);
  console.log(`   ✓ Code normalization: '${rawInput}' -> '${normalized}'`);

  // ---------------------------------------------------------------------------
  // 4. AES-256-GCM Encryption / Decryption Tests
  // ---------------------------------------------------------------------------
  console.log('\n4. Testing AES-256-GCM Secret Encryption...');

  const secretPasskey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
  const encrypted = encrypt(secretPasskey);

  assert(encrypted.split(':').length === 3, `Encrypted payload should have iv:tag:data structure, got ${encrypted}`);
  const decrypted = decrypt(encrypted);
  assert(decrypted === secretPasskey, `Decrypted secret does not match original: ${decrypted}`);
  console.log('   ✓ Encryption and decryption authenticated successfully');

  console.log('\n🎉 Unit Math & Crypto Suite: ALL TESTS PASSED (100% SUCCESS)\n');
}

if (require.main === module) {
  runUnitMathCryptoTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}