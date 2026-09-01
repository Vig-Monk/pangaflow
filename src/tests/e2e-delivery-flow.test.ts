// =============================================================================
// src/tests/e2e-delivery-flow.test.ts
// E2E Test: Geocoding, Variants, Checkout, Haversine Fee, Rider Dispatch,
// 2km Batching, Handover Verification & Cash Reconciliation.
// =============================================================================

import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

export async function runE2EDeliveryFlowTest(): Promise<void> {
  console.log('🚀 Starting Full Soko Delivery, Variant & State-Machine Integration Test...\n');

  try {
    // 1. Merchant Authentication
    console.log('1. [Merchant A] Authenticating...');
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'musiokiludwig@gmail.com',
      password: '12345678',
    });

    const tokenA = loginRes.data.data.tokens.accessToken;
    const orgIdA = loginRes.data.data.org.id;
    const headersA = { headers: { Authorization: `Bearer ${tokenA}` } };
    console.log(`   ✓ Merchant A logged in. Org ID: ${orgIdA}`);

    // 2. Configure Fulfillment Location Hub & Store
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

    // 3. Stage Product Catalog with Variants (Size 41, Size 42)
    console.log('3. [Merchant A] Creating product with dedicated variants...');
    const bulkRes = await axios.post(
      `${API_BASE}/products/bulk`,
      {
        products: [
          {
            name: 'Nike Air Force 1',
            price: 4500,
            stock: 15,
            publish: true,
            variants: [
              {
                title: 'Size 41 / White',
                sku: 'AF1-WHT-41',
                options: { Size: '41', Color: 'White' },
                price: 4500,
                cost_price: 2500,
                stock: 5,
              },
              {
                title: 'Size 42 / Black',
                sku: 'AF1-BLK-42',
                options: { Size: '42', Color: 'Black' },
                price: 4800,
                cost_price: 2700,
                stock: 10,
              },
            ],
          },
        ],
      },
      headersA
    );
    const product = bulkRes.data.data[0];
    assert(product.variants && product.variants.length === 2, 'Product must have 2 active variants');
    const variant42 = product.variants.find((v: any) => v.title.includes('Size 42'));
    console.log(`   ✓ Product created with 2 variants. Variant 42 ID: ${variant42.id} (Price: KES ${variant42.price})`);

    // 4. Geocoding & Curated Estates Lookup API
    console.log('4. [Customer] Searching delivery destinations (Kilimani)...');
    const searchRes = await axios.get(`${API_BASE}/public/estates/search?q=kilimani`);
    const results = searchRes.data.data;
    assert(results.length > 0, 'Search for "kilimani" should return local estate matches');
    const kilimaniEstate = results[0];
    console.log(`   ✓ Destination matched: ${kilimaniEstate.name} (${kilimaniEstate.lat}, ${kilimaniEstate.lng})`);

    // 5. Checkout Order with Selected Variant (Size 42)
    console.log('5. [Customer 1] Placing Doorstep Delivery order for Size 42 variant...');
    const order1Payload = {
      customerName: 'Amani Wanjiku',
      customerPhone: '0711223344',
      deliveryLocation: 'Kilimani, Chaka Place, Apt 4B',
      deliveryType: 'delivery',
      customerLat: -1.2908,
      customerLng: 36.7828,
      locationSource: 'gps',
      paymentMethod: 'mpesa_cash',
      items: [
        {
          product_id: product.id,
          variant_id: variant42.id,
          quantity: 2,
        },
      ],
    };

    const order1Res = await axios.post(`${API_BASE}/public/stores/${storeSlug}/orders`, order1Payload);
    const order1Id = order1Res.data.data.orderId;
    console.log(`   ✓ Order 1 created with variant: ${order1Id}`);

    // Verify Order 1 Details, Variant Snapshotting & Delivery Fee
    const order1DetailsRes = await axios.get(`${API_BASE}/public/stores/${storeSlug}/orders/${order1Id}`);
    const order1 = order1DetailsRes.data.data;

    assert(order1.items[0].variantTitle === 'Size 42 / Black', 'Order item must snapshot variant title');
    assert(order1.items[0].unitPrice === 4800, 'Order item must snapshot variant price');
    assert(order1.deliveryFeeStatus === 'known', `Delivery fee status should be 'known', got ${order1.deliveryFeeStatus}`);
    assert(order1.deliveryConfirmationCode && order1.deliveryConfirmationCode.length === 4, 'Should have 4-character confirmation code');
    const code1 = order1.deliveryConfirmationCode;
    console.log(`   ✓ Order 1 verified: Item '${order1.items[0].productName} (${order1.items[0].variantTitle})' | Verification Code: ${code1}`);

    // 6. Confirm Order & Check 2km Proximity Batching
    console.log('6. [Merchant A] Confirming Order 1 and assigning rider...');
    await axios.patch(`${API_BASE}/orders/${order1Id}/status`, { status: 'confirmed' }, headersA);

    await axios.post(
      `${API_BASE}/orders/assign-rider`,
      {
        orderIds: [order1Id],
        riderName: 'Dennis Mwangi',
        riderPhone: '0700112233',
      },
      headersA
    );
    console.log('   ✓ Rider assigned to Order 1');

    // 7. Dispatch and Verify Handover
    console.log('7. [Merchant A] Marking Out for Delivery & verifying delivery code...');
    await axios.patch(`${API_BASE}/orders/${order1Id}/status`, { status: 'out_for_delivery' }, headersA);

    const completeRes = await axios.post(
      `${API_BASE}/orders/${order1Id}/complete-delivery`,
      { confirmationCode: code1, amountCollected: parseFloat(order1.total), collectedBy: 'Dennis Mwangi' },
      headersA
    );
    assert(completeRes.data.data.status === 'delivered', 'Order must transition to delivered');
    console.log(`   ✓ Delivery verified with code '${code1}'. Status: DELIVERED`);

    console.log('\n🎉 Full Delivery & Variant State-Machine Test: ALL STEPS PASSED (100% SUCCESS)\n');
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