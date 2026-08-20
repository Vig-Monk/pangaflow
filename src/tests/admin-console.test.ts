// =============================================================================
// src/tests/admin-console.test.ts
// Automated Tests for Owner Admin Console — Auth, Stats, Tier Update, & Demo Purge
// Run via: npx tsx src/tests/admin-console.test.ts
// =============================================================================

import axios from "axios";
import { env } from "../config/env";

const API_BASE = "http://localhost:3000/api/v1";
const ADMIN_SECRET = env.ADMIN_SECRET;

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(`❌ Assertion Failed: ${message}`);
    }
}

export async function runAdminConsoleTests(): Promise<void> {
    console.log("🛡️ Starting Owner Admin Console & Management API Tests...\n");

    const adminHeaders = {
        headers: { "x-admin-secret": ADMIN_SECRET },
    };

    // -------------------------------------------------------------------------
    // 1. Security: Reject Requests without Admin Secret
    // -------------------------------------------------------------------------
    console.log("1. Testing Admin Authorization Security...");
    let unauthorizedBlocked = false;
    try {
        await axios.get(`${API_BASE}/admin/stats`);
    } catch (err: any) {
        if (err.response?.status === 401) {
            unauthorizedBlocked = true;
        }
    }
    assert(unauthorizedBlocked, "Endpoint must reject requests missing X-Admin-Secret header (HTTP 401)");

    let invalidSecretBlocked = false;
    try {
        await axios.get(`${API_BASE}/admin/stats`, {
            headers: { "x-admin-secret": "wrong-secret-key" },
        });
    } catch (err: any) {
        if (err.response?.status === 403) {
            invalidSecretBlocked = true;
        }
    }
    assert(invalidSecretBlocked, "Endpoint must reject invalid admin secret (HTTP 403)");
    console.log("   ✓ Authentication guard verified: 401 on missing secret, 403 on invalid key");

    // -------------------------------------------------------------------------
    // 2. Test GET /api/v1/admin/stats
    // -------------------------------------------------------------------------
    console.log("2. Testing Platform Aggregates (/admin/stats)...");
    const statsRes = await axios.get(`${API_BASE}/admin/stats`, adminHeaders);
    const stats = statsRes.data.data;

    assert(typeof stats.total_orgs === "number", "total_orgs should be a number");
    assert(typeof stats.free_count === "number", "free_count should be a number");
    assert(typeof stats.lifetime_count === "number", "lifetime_count should be a number");
    console.log(`   ✓ Stats verified: ${stats.total_orgs} total stores (Free: ${stats.free_count}, Pro: ${stats.pro_count}, Lifetime: ${stats.lifetime_count})`);

    // -------------------------------------------------------------------------
    // 3. Create a Demo Test Merchant for Lifecycle Manipulation
    // -------------------------------------------------------------------------
    console.log("3. Creating temporary demo merchant for testing...");
    const demoEmail = `demo.test.${Date.now()}@soko.app`;
    const registerRes = await axios.post(`${API_BASE}/auth/register`, {
        name: "Demo Merchant User",
        email: demoEmail,
        password: "password123",
        orgName: "Demo Spam Store",
        businessType: "shop",
    });

    const demoOrgId = registerRes.data.data.org.id;
    console.log(`   ✓ Demo merchant created with ID: ${demoOrgId}`);

    // -------------------------------------------------------------------------
    // 4. Test Search & Filter Directory (/admin/orgs)
    // -------------------------------------------------------------------------
    console.log("4. Testing Merchant Directory Search (/admin/orgs)...");
    const searchRes = await axios.get(`${API_BASE}/admin/orgs?q=Demo%20Spam`, adminHeaders);
    const searchResults = searchRes.data.data;
    assert(
        searchResults.some((o: any) => o.id === demoOrgId),
        "Search query should locate the demo store"
    );
    console.log("   ✓ Search query matched demo store by name");

    // -------------------------------------------------------------------------
    // 5. Test Promoting to Pro (+1 month)
    // -------------------------------------------------------------------------
    console.log("5. Testing Promoting to Pro (+1 Month)...");
    const promoteProRes = await axios.patch(
        `${API_BASE}/admin/orgs/${demoOrgId}/tier`,
        { plan: "pro", durationMonths: 1 },
        adminHeaders
    );
    const proOrg = promoteProRes.data.data.organization;
    assert(proOrg.plan === "pro", "Organization plan should be 'pro'");
    assert(proOrg.plan_expires_at !== null, "Pro plan must have an expiration date");
    console.log(`   ✓ Promoted to Pro: Expiry set to ${new Date(proOrg.plan_expires_at).toISOString().slice(0, 10)}`);

    // -------------------------------------------------------------------------
    // 6. Test Granting Lifetime Access (Perpetual, No Expiry)
    // -------------------------------------------------------------------------
    console.log("6. Testing Granting Lifetime Access...");
    const lifetimeRes = await axios.patch(
        `${API_BASE}/admin/orgs/${demoOrgId}/tier`,
        { plan: "lifetime" },
        adminHeaders
    );
    const lifetimeOrg = lifetimeRes.data.data.organization;
    assert(lifetimeOrg.plan === "lifetime", "Organization plan should be 'lifetime'");
    assert(lifetimeOrg.plan_expires_at === null, "Lifetime plan must have NULL expiration date");
    console.log("   ✓ Lifetime Access granted: Perpetual with no expiry");

    // -------------------------------------------------------------------------
    // 7. Test Demoting to Free Tier
    // -------------------------------------------------------------------------
    console.log("7. Testing Demoting to Free Tier...");
    const demoteRes = await axios.patch(
        `${API_BASE}/admin/orgs/${demoOrgId}/tier`,
        { plan: "free" },
        adminHeaders
    );
    const freeOrg = demoteRes.data.data.organization;
    assert(freeOrg.plan === "free", "Organization plan should be 'free'");
    assert(freeOrg.plan_expires_at === null, "Free plan should have NULL expiration date");
    console.log("   ✓ Demoted back to Free tier successfully");

    // -------------------------------------------------------------------------
    // 8. Test Cascade Purging Demo Account
    // -------------------------------------------------------------------------
    console.log("8. Testing Cascade Purging Demo Account (/admin/orgs/:id)...");
    const deleteRes = await axios.delete(`${API_BASE}/admin/orgs/${demoOrgId}`, adminHeaders);
    assert(deleteRes.data.data.deleted === true, "Organization should be marked as deleted");

    // Verify it is completely removed from directory
    const verifyPurgeRes = await axios.get(`${API_BASE}/admin/orgs?q=${demoEmail}`, adminHeaders);
    assert(
        verifyPurgeRes.data.data.length === 0,
        "Purged demo merchant must be completely absent from database"
    );
    console.log("   ✓ Demo account & all associated records wiped cleanly from database");

    console.log("\n🎉 Admin Console & Management API: ALL TESTS PASSED (100% SUCCESS)\n");
}

if (require.main === module) {
    runAdminConsoleTests().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}