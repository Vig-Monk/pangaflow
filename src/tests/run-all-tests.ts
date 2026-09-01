// =============================================================================
// soko-api/src/tests/run-all-tests.ts
// Master test runner executing unit math/crypto, delivery flow, admin console,
// and full bookstore e2e verification.
// =============================================================================

import { runUnitMathCryptoTests } from './unit-math-crypto.test';
import { runAdminConsoleTests } from './admin-console.test';
import { runE2EDeliveryFlowTest } from './e2e-delivery-flow.test';
import { runBookstoreE2ETest } from './e2e-bookstore-flow.test';

async function main() {
  console.log('====================================================');
  console.log('    SOKO & FLEMELA FULL-STACK TEST VERIFICATION    ');
  console.log('====================================================\n');

  const startTime = Date.now();

  try {
    // 1. Pure math, boundary & cryptographic unit tests
    console.log('▶ [1/4] Running Unit Math & Crypto Suite...');
    await runUnitMathCryptoTests();

    // 2. Admin Console & Tenant Tier Lifecycle Tests
    console.log('▶ [2/4] Running Owner Admin Console Tests...');
    await runAdminConsoleTests();

    // 3. E2E Boda Delivery & State-Machine Integration Tests
    console.log('▶ [3/4] Running E2E Delivery Flow Tests...');
    await runE2EDeliveryFlowTest();

    // 4. Complete Bookstore Digital Fulfillment & Multi-Cloud Tests
    console.log('▶ [4/4] Running Complete Bookstore E2E Suite...');
    await runBookstoreE2ETest();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('====================================================');
    console.log(` ✅ ALL 4 TEST SUITES PASSED CLEANLY IN ${duration}s `);
    console.log('====================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n💥 Test run aborted due to failure:', err.message);
    process.exit(1);
  }
}

main();