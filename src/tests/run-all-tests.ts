// =============================================================================
// src/tests/run-all-tests.ts
// Master test runner executing both the Unit Math & Crypto suite and Full E2E Flow.
// Run via: npm test  OR  npx tsx src/tests/run-all-tests.ts
// =============================================================================

import { runUnitMathCryptoTests } from './unit-math-crypto.test';
import { runE2EDeliveryFlowTest } from './e2e-delivery-flow.test';

async function main() {
  console.log('====================================================');
  console.log('   SOKO E-COMMERCE & DELIVERY VERIFICATION ENGINE   ');
  console.log('====================================================\n');

  const startTime = Date.now();

  try {
    // 1. Run pure math, boundary & cryptographic unit tests
    await runUnitMathCryptoTests();

    // 2. Run full transactional API & state-machine integration tests
    await runE2EDeliveryFlowTest();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('====================================================');
    console.log(` ✅ ALL TEST SUITES PASSED CLEANLY IN ${duration}s `);
    console.log('====================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n💥 Test run aborted due to failure:', err.message);
    process.exit(1);
  }
}

main();