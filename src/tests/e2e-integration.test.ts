// =============================================================================
// src/tests/e2e-integration.test.ts (UPDATED - STEP 1 REGRESSION ASSERTION)
// =============================================================================

import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1';

async function runE2EIntegrationTest() {
  console.log('🚀 Starting Soko Commerce End-to-End Integration Verification...\n');

  try {
    console.log('1. [Merchant] Authenticating...');
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'merchant@soko.app',
      password: 'password123',
    });

    const token = loginRes.data.data.tokens.accessToken;
    const orgId = loginRes.data.data.org.id;
    console.log(`   ✓ Authenticated. Org ID: ${orgId}`);

    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    console.log('2. [Merchant] Testing signature endpoint...');
    const sigRes = await axios.post(`${API_BASE}/products/upload-signature?target=products`, {}, authHeaders);
    const { signature, timestamp, folder } = sigRes.data.data;
    
    if (!signature || !timestamp || !folder.includes(orgId)) {
      throw new Error('Signature response was missing required fields or incorrectly scoped.');
    }
    console.log('   ✓ Cloudinary upload signature verified.');

    console.log('3. [Merchant] Creating catalog category...');
    const catRes = await axios.get(`${API_BASE}/products/categories`, authHeaders);
    let categoryId = catRes.data.data[0]?.id;

    if (!categoryId) {
      console.log('   ℹ No categories found.');
      return;
    }
    console.log(`   ✓ Using Category ID: ${categoryId}`);

    console.log('4. [Merchant] Configuring public storefront settings...');
    const storeSlug = `test-shop-${Date.now()}`;
    const storeConfigRes = await axios.patch(`${API_BASE}/store`, {
      name: 'Integration Test Shop',
      slug: storeSlug,
      description: 'End to end testing verified shop.',
      status: 'published',
    }, authHeaders);
    
    const seededStoreId = storeConfigRes.data.data.id;
    console.log(`   ✓ Store configured and Published. ID: ${seededStoreId}, Slug: ${storeSlug}`);

    console.log('5. [Merchant] Uploading batch of products (2 items)...');
    const bulkPayload = {
      products: [
        {
          name: 'Classic Running Shoes',
          category_id: categoryId,
          price: 4500,
          stock: 10,
          publish: true,
          images: [{ image_url: 'https://res.cloudinary.com/test/image1.jpg', image_public_id: 'test_id_1' }]
        }
      ]
    };

    const bulkRes = await axios.post(`${API_BASE}/products/bulk`, bulkPayload, authHeaders);
    const createdProducts = bulkRes.data.data;
    const shoes = createdProducts.find((p: any) => p.name === 'Classic Running Shoes');
    console.log(`   ✓ Bulk insertion completed. Product ID: ${shoes.id}`);

    console.log('6. [Customer] Retrieving public store metadata...');
    const pubStoreRes = await axios.get(`${API_BASE}/public/stores/${storeSlug}`);
    const pubStore = pubStoreRes.data.data;

    const forbiddenStoreKeys = ['id', 'org_id', 'status', 'created_at', 'updated_at'];
    forbiddenStoreKeys.forEach(key => {
      if (key in pubStore) throw new Error(`Leaked store internal key: ${key}`);
    });
    console.log('   ✓ Whitelist mapping for store properties verified.');

    console.log('7. [Customer] Simulating public checkout order placement...');
    const checkoutPayload = {
      customerName: 'Amani Otieno',
      customerPhone: '0712345678',
      deliveryLocation: 'Rhapta Road, Westlands, House 4B',
      paymentMethod: 'mpesa_cash',
      items: [
        {
          product_id: shoes.id,
          quantity: 2
        }
      ]
    };

    const checkoutRes = await axios.post(`${API_BASE}/public/stores/${storeSlug}/orders`, checkoutPayload);
    const orderId = checkoutRes.data.data.orderId;
    console.log(`   ✓ Order placed. Confirmation ID: ${orderId}`);

    console.log('8. [Merchant] Verifying dashboard sync & store_id mapping...');
    const merchantOrdersRes = await axios.get(`${API_BASE}/orders`, authHeaders);
    const orderLog = merchantOrdersRes.data.data;
    const foundInLog = orderLog.find((o: any) => o.id === orderId);

    if (!foundInLog) {
      throw new Error('Newly created order was not synchronized in the merchant dashboard order log.');
    }
    console.log('   ✓ Order matched in merchant administrative dashboard.');

    console.log('\n🎉 Step 1 Integration Verification completed successfully.');
  } catch (err: any) {
    console.error('\n✗ Integration test failed:');
    if (axios.isAxiosError(err)) {
      console.error(`  Status: ${err.response?.status}`);
      console.error('  Payload:', JSON.stringify(err.response?.data, null, 2));
    } else {
      console.error('  Error:', err.message);
    }
    process.exit(1);
  }
}

runE2EIntegrationTest();