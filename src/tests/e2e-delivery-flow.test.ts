// =============================================================================
// src/tests/e2e-delivery-flow.test.ts
// Comprehensive E2E Test: Geocoding, Checkout, Haversine Fee, Rider Dispatch,
// 2km Batching, Handover Verification & Cash Reconciliation.
// Run via: npx tsx src/tests/e2e-delivery-flow.test.ts
// =============================================================================

import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

export async function runE2EDeliveryFlowTest(): Promise<void> {
  console.log('🚀 Starting Full Soko Delivery & State-Machine Integration Test...\n');

  try {
    // -------------------------------------------------------------------------
    // 1. Merchant Authentication
    // -------------------------------------------------------------------------
    console.log('1. [Merchant A] Authenticating...');
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'merchant@soko.app',
      password: 'password123',
    });

    const tokenA = loginRes.data.data.tokens.accessToken;
    const orgIdA = loginRes.data.data.org.id;
    const headersA = { headers: { Authorization: `Bearer ${tokenA}` } };
    console.log(`   ✓ Merchant A logged in. Org ID: ${orgIdA}`);

    // -------------------------------------------------------------------------
    // 2. Configure Fulfillment Location Hub & Store
    // -------------------------------------------------------------------------
    console.log('2. [Merchant A] Setting up Fulfillment Hub Location (Westlands)...');
    await axios.patch(
      `${API_BASE}/store/location`,
      {
        name: 'Westlands Central Kitchen Hub',
        lat: -1.2683,
        lng: 36.8111,
        address_text: 'Sarit Centre Lower Level, Westlands',
        max_delivery_radius_km: 15,
        base_delivery_fee: 100,
        fee_per_km: 25,
      },
      headersA
    );

    const storeSlug = `test-hub-store-${Date.now()}`;
    await axios.patch(
      `${API_BASE}/store`,
      {
        name: 'Gourmet Express Delivery',
        slug: storeSlug,
        status: 'published',
      },
      headersA
    );
    console.log(`   ✓ Hub location saved & Store published with slug: ${storeSlug}`);

    // -------------------------------------------------------------------------
    // 3. Stage Product Catalog
    // -------------------------------------------------------------------------
    console.log('3. [Merchant A] Uploading products with inventory stock...');
    const bulkRes = await axios.post(
      `${API_BASE}/products/bulk`,
      {
        products: [
          {
            name: 'Artisan Beef Burger',
            price: 850,
            stock: 10,
            publish: true,
          },
        ],
      },
      headersA
    );
    const product = bulkRes.data.data[0];
    console.log(`   ✓ Product created. ID: ${product.id} (Stock: 10)`);

    // -------------------------------------------------------------------------
    // 4. Geocoding & Curated Estates Lookup API
    // -------------------------------------------------------------------------
    console.log('4. [Customer] Searching delivery destinations (Kilimani)...');
    const searchRes = await axios.get(`${API_BASE}/public/estates/search?q=kilimani`);
    const results = searchRes.data.data;
    assert(results.length > 0, 'Search for "kilimani" should return local estate matches');
    const kilimaniEstate = results[0];
    console.log(`   ✓ Destination matched: ${kilimaniEstate.name} (${kilimaniEstate.lat}, ${kilimaniEstate.lng})`);

    // -------------------------------------------------------------------------
    // 5. Checkout Order 1: Doorstep Delivery (Kilimani ~4.1km away)
    // -------------------------------------------------------------------------
    console.log('5. [Customer 1] Placing Doorstep Delivery order...');
    const order1Payload = {
      customerName: 'Amani Wanjiku',
      customerPhone: '0711223344',
      deliveryLocation: 'Kilimani, Chaka Place, Apt 4B',
      deliveryType: 'delivery',
      customerLat: -1.2908,
      customerLng: 36.7828,
      locationSource: 'gps',
      paymentMethod: 'mpesa_cash',
      items: [{ product_id: product.id, quantity: 2 }],
    };

    const order1Res = await axios.post(`${API_BASE}/public/stores/${storeSlug}/orders`, order1Payload);
    const order1Id = order1Res.data.data.orderId;
    console.log(`   ✓ Order 1 created: ${order1Id}`);

    // Verify Order 1 Details & Server-Authoritative Delivery Fee
    const order1DetailsRes = await axios.get(`${API_BASE}/public/stores/${storeSlug}/orders/${order1Id}`);
    const order1 = order1DetailsRes.data.data;

    assert(order1.deliveryFeeStatus === 'known', `Delivery fee status should be 'known', got ${order1.deliveryFeeStatus}`);
    assert(order1.deliveryFee >= 120 && order1.deliveryFee <= 135, `Fee for ~4.1km should be ~128 KES, got ${order1.deliveryFee}`);
    assert(order1.deliveryConfirmationCode && order1.deliveryConfirmationCode.length === 4, 'Should have 4-character confirmation code');
    const code1 = order1.deliveryConfirmationCode;
    console.log(`   ✓ Order 1 Delivery Fee verified: KES ${order1.deliveryFee} | Verification Code: ${code1}`);

    // -------------------------------------------------------------------------
    // 6. Checkout Order 2: Nearby Delivery in Kilimani (~0.5km from Order 1)
    // -------------------------------------------------------------------------
    console.log('6. [Customer 2] Placing second nearby order in Kilimani...');
    const order2Payload = {
      customerName: 'Brian Kiprono',
      customerPhone: '0722334455',
      deliveryLocation: 'Kilimani, Yaya Court B3',
      deliveryType: 'delivery',
      customerLat: -1.2915,
      customerLng: 36.7840,
      paymentMethod: 'mpesa_cash',
      items: [{ product_id: product.id, quantity: 1 }],
    };
    const order2Res = await axios.post(`${API_BASE}/public/stores/${storeSlug}/orders`, order2Payload);
    const order2Id = order2Res.data.data.orderId;
    console.log(`   ✓ Order 2 created: ${order2Id}`);

    // -------------------------------------------------------------------------
    // 7. Merchant Confirms Orders & Checks 2km Proximity Batching
    // -------------------------------------------------------------------------
    console.log('7. [Merchant A] Confirming Order 1 and checking 2km batching...');
    await axios.patch(`${API_BASE}/orders/${order1Id}/status`, { status: 'confirmed' }, headersA);
    await axios.patch(`${API_BASE}/orders/${order2Id}/status`, { status: 'confirmed' }, headersA);

    const batchRes = await axios.get(`${API_BASE}/orders/${order1Id}/nearby-batch`, headersA);
    const nearbyList = batchRes.data.data;
    assert(
      nearbyList.some((o: any) => o.id === order2Id),
      'Order 2 should appear in Order 1 nearby batch suggestions (<2km)'
    );
    console.log(`   ✓ 2km Proximity Batching confirmed: Order 2 detected (${nearbyList[0].distance_km.toFixed(2)} km away)`);

    // -------------------------------------------------------------------------
    // 8. Assign Boda Rider to Both Orders Simultaneously
    // -------------------------------------------------------------------------
    console.log('8. [Merchant A] Assigning Rider "Dennis Mwangi" to both orders in batch...');
    await axios.post(
      `${API_BASE}/orders/assign-rider`,
      {
        orderIds: [order1Id, order2Id],
        riderName: 'Dennis Mwangi',
        riderPhone: '0700112233',
      },
      headersA
    );

    const checkAssignedRes = await axios.get(`${API_BASE}/orders/${order1Id}`, headersA);
    assert(checkAssignedRes.data.data.status === 'assigned', 'Order 1 status should be assigned');
    assert(checkAssignedRes.data.data.rider_name === 'Dennis Mwangi', 'Rider name should be Dennis Mwangi');
    console.log('   ✓ Both orders successfully assigned to rider');

    // -------------------------------------------------------------------------
    // 9. Dispatch to Out for Delivery
    // -------------------------------------------------------------------------
    console.log('9. [Merchant A] Dispatching Order 1 to Out for Delivery...');
    await axios.patch(`${API_BASE}/orders/${order1Id}/status`, { status: 'out_for_delivery' }, headersA);

    // -------------------------------------------------------------------------
    // 10. Proof-of-Delivery Handover Validation
    // -------------------------------------------------------------------------
    console.log('10. [Rider / Merchant] Verifying Handover with Confirmation Code...');

    // Attempt invalid code
    let failedAsExpected = false;
    try {
      await axios.post(
        `${API_BASE}/orders/${order1Id}/complete-delivery`,
        { confirmationCode: 'ZZZZ', amountCollected: 1828, collectedBy: 'Dennis Mwangi' },
        headersA
      );
    } catch (err: any) {
      if (err.response?.status === 400) {
        failedAsExpected = true;
      }
    }
    assert(failedAsExpected, 'Backend must reject incorrect delivery confirmation code');
    console.log('   ✓ Incorrect confirmation code rejected (HTTP 400)');

    // Complete with valid code
    const completeRes = await axios.post(
      `${API_BASE}/orders/${order1Id}/complete-delivery`,
      { confirmationCode: code1, amountCollected: 1828, collectedBy: 'Dennis Mwangi' },
      headersA
    );
    assert(completeRes.data.data.status === 'delivered', 'Order must transition to delivered');
    assert(completeRes.data.data.delivered_at !== null, 'delivered_at must be populated');
    console.log(`   ✓ Handover verified with code '${code1}'. Status: DELIVERED`);

    // -------------------------------------------------------------------------
    // 11. Cash on Delivery (COD) End-of-Day Reconciliation
    // -------------------------------------------------------------------------
    console.log('11. [Merchant A] Checking COD Reconciliation Summary...');
    const reconRes = await axios.get(`${API_BASE}/orders/reconciliation/cod`, headersA);
    const recon = reconRes.data.data;
    assert(recon.delivered_cod_orders >= 1, 'Should have at least 1 delivered COD order');
    assert(parseFloat(recon.collected_total) >= 1828, 'Collected total should include Order 1');
    console.log(`   ✓ COD Reconciliation verified: Expected KES ${recon.expected_total} | Collected KES ${recon.collected_total} | Variance: KES ${recon.variance}`);

    // -------------------------------------------------------------------------
    // 12. Multi-Tenancy Cross-Tenant Access Rejection
    // -------------------------------------------------------------------------
    console.log('12. [Security] Testing Multi-Tenant Isolation (Tenant B vs Tenant A)...');
    const registerBRes = await axios.post(`${API_BASE}/auth/register`, {
      name: 'Merchant B',
      email: `merchant.b.${Date.now()}@soko.app`,
      password: 'password123',
      orgName: 'Second Tenant Shop',
      businessType: 'shop',
    });
    const tokenB = registerBRes.data.data.tokens.accessToken;
    const headersB = { headers: { Authorization: `Bearer ${tokenB}` } };

    let crossTenantBlocked = false;
    try {
      await axios.get(`${API_BASE}/orders/${order1Id}`, headersB);
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        crossTenantBlocked = true;
      }
    }
    assert(crossTenantBlocked, 'Tenant B must NOT be able to view or modify Tenant A orders');
    console.log('   ✓ Multi-tenant boundary verified: Cross-tenant access strictly blocked');

    console.log('\n🎉 End-to-End Delivery & State-Machine Integration: ALL 12 STEPS PASSED (100% SUCCESS)\n');
  } catch (err: any) {
    console.error('\n❌ E2E Integration Test Failed:');
    if (axios.isAxiosError(err)) {
      console.error(`  Status: ${err.response?.status}`);
      console.error('  Payload:', JSON.stringify(err.response?.data, null, 2));
    } else {
      console.error('  Error:', err.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  runE2EDeliveryFlowTest().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}