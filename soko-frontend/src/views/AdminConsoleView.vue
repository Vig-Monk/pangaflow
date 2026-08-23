<script setup lang="ts">
// =============================================================================
// KauntaOS-frontend/src/views/AdminConsoleView.vue
// KauntaOS Owner Console — Platform KPIs, Account Management, Tier Actions & Demo Purge.
// =============================================================================

import { onMounted, ref, computed } from 'vue';
import axios from 'axios';
import { useToast } from '@/composables/useToast';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable.vue';
import Button from '@/components/ui/Button.vue';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import {
  Key,
  Crown,
  Trash2,
  Edit3,
  Search,
  RefreshCw,
  LogOut,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-vue-next';

interface PlatformStats {
  total_orgs: number;
  free_count: number;
  pro_count: number;
  business_count: number;
  lifetime_count: number;
  total_products: number;
  total_orders: number;
  total_customers: number;
}

interface OrganizationAdminRow {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  plan: 'free' | 'pro' | 'business' | 'lifetime';
  plan_expires_at: string | null;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  product_count: number;
  customer_count: number;
  order_count: number;
}

type FilterTier = 'all' | 'free' | 'pro' | 'business' | 'lifetime';

const { push: pushToast } = useToast();

const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

const ADMIN_STORAGE_KEY = 'KauntaOS_admin_secret';

// Authentication State
const adminSecret = ref<string>(sessionStorage.getItem(ADMIN_STORAGE_KEY) || '');
const secretInput = ref('');
const isAuthenticated = ref(false);
const isAuthenticating = ref(false);
const authError = ref<string | null>(null);

// Dashboard State
const stats = ref<PlatformStats | null>(null);
const organizations = ref<OrganizationAdminRow[]>([]);
const loadingData = ref(false);
const searchQuery = ref('');
const activeTierFilter = ref<FilterTier>('all');

// Tier Promotion/Update Modal State
const showTierModal = ref(false);
const targetOrg = ref<OrganizationAdminRow | null>(null);
const selectedPlan = ref<'free' | 'pro' | 'business' | 'lifetime'>('pro');
const selectedDurationMonths = ref<number>(1);
const isUpdatingTier = ref(false);

// Purge Modal State
const showPurgeModal = ref(false);
const orgToPurge = ref<OrganizationAdminRow | null>(null);
const isPurging = ref(false);

function getAdminConfig() {
  return {
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': adminSecret.value.trim(),
    },
  };
}

async function verifyAndAuthenticate(keyToTry: string): Promise<boolean> {
  isAuthenticating.value = true;
  authError.value = null;

  try {
    const res = await axios.get<{ success: boolean; data: PlatformStats }>(
      `${API_BASE_URL}/admin/stats`,
      { headers: { 'x-admin-secret': keyToTry.trim() } }
    );

    if (res.data?.success) {
      adminSecret.value = keyToTry.trim();
      sessionStorage.setItem(ADMIN_STORAGE_KEY, keyToTry.trim());
      stats.value = res.data.data;
      isAuthenticated.value = true;
      await fetchOrganizations();
      return true;
    }
    return false;
  } catch (err: any) {
    authError.value = err.response?.status === 403
      ? 'Invalid Admin Secret Key.'
      : 'Authentication failed. Ensure backend server is running.';
    return false;
  } finally {
    isAuthenticating.value = false;
  }
}

async function handleLoginSubmit(): Promise<void> {
  if (!secretInput.value.trim()) {
    authError.value = 'Please enter your ADMIN_SECRET key';
    return;
  }
  await verifyAndAuthenticate(secretInput.value);
}

function handleLogout(): void {
  adminSecret.value = '';
  secretInput.value = '';
  sessionStorage.removeItem(ADMIN_STORAGE_KEY);
  isAuthenticated.value = false;
  stats.value = null;
  organizations.value = [];
}

async function fetchStats(): Promise<void> {
  try {
    const res = await axios.get<{ success: boolean; data: PlatformStats }>(
      `${API_BASE_URL}/admin/stats`,
      getAdminConfig()
    );
    stats.value = res.data.data;
  } catch {
    // Non-blocking
  }
}

async function fetchOrganizations(): Promise<void> {
  loadingData.value = true;
  try {
    const params: Record<string, string> = {};
    if (searchQuery.value.trim()) params.q = searchQuery.value.trim();
    if (activeTierFilter.value !== 'all') params.plan = activeTierFilter.value;

    const res = await axios.get<{ success: boolean; data: OrganizationAdminRow[] }>(
      `${API_BASE_URL}/admin/orgs`,
      {
        ...getAdminConfig(),
        params,
      }
    );
    organizations.value = res.data.data || [];
  } catch (err: any) {
    pushToast({ message: err.response?.data?.error?.message || 'Failed to load organizations', variant: 'error' });
  } finally {
    loadingData.value = false;
  }
}

onMounted(async () => {
  if (adminSecret.value) {
    await verifyAndAuthenticate(adminSecret.value);
  }
});

// Real-time filtered rows
const filteredOrgs = computed(() => {
  return organizations.value;
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// 1-Click Quick Grant Lifetime
async function handleQuickGrantLifetime(org: OrganizationAdminRow): Promise<void> {
  try {
    await axios.patch(
      `${API_BASE_URL}/admin/orgs/${org.id}/tier`,
      { plan: 'lifetime' },
      getAdminConfig()
    );
    pushToast({ message: `Granted Perpetual Lifetime Access to "${org.name}"!`, variant: 'success' });
    await Promise.all([fetchStats(), fetchOrganizations()]);
  } catch (err: any) {
    pushToast({ message: err.response?.data?.error?.message || 'Failed to grant lifetime', variant: 'error' });
  }
}

// 1-Click Demote to Free
async function handleDemoteToFree(org: OrganizationAdminRow): Promise<void> {
  try {
    await axios.patch(
      `${API_BASE_URL}/admin/orgs/${org.id}/tier`,
      { plan: 'free' },
      getAdminConfig()
    );
    pushToast({ message: `Demoted "${org.name}" back to Free tier`, variant: 'info' });
    await Promise.all([fetchStats(), fetchOrganizations()]);
  } catch (err: any) {
    pushToast({ message: err.response?.data?.error?.message || 'Failed to demote', variant: 'error' });
  }
}

// Open Tier Promotion Modal
function openTierModal(org: OrganizationAdminRow): void {
  targetOrg.value = org;
  selectedPlan.value = org.plan === 'free' ? 'pro' : org.plan;
  selectedDurationMonths.value = 1;
  showTierModal.value = true;
}

async function handleTierSubmit(): Promise<void> {
  if (!targetOrg.value) return;
  isUpdatingTier.value = true;

  try {
    await axios.patch(
      `${API_BASE_URL}/admin/orgs/${targetOrg.value.id}/tier`,
      {
        plan: selectedPlan.value,
        durationMonths: selectedPlan.value === 'lifetime' ? undefined : selectedDurationMonths.value,
      },
      getAdminConfig()
    );

    pushToast({ message: `Updated tier for "${targetOrg.value.name}" to ${selectedPlan.value.toUpperCase()}`, variant: 'success' });
    showTierModal.value = false;
    await Promise.all([fetchStats(), fetchOrganizations()]);
  } catch (err: any) {
    pushToast({ message: err.response?.data?.error?.message || 'Failed to update tier', variant: 'error' });
  } finally {
    isUpdatingTier.value = false;
  }
}

// Purge / Delete Demo Account
function openPurgeModal(org: OrganizationAdminRow): void {
  orgToPurge.value = org;
  showPurgeModal.value = true;
}

async function executePurge(): Promise<void> {
  if (!orgToPurge.value) return;
  isPurging.value = true;

  try {
    await axios.delete(
      `${API_BASE_URL}/admin/orgs/${orgToPurge.value.id}`,
      getAdminConfig()
    );
    pushToast({ message: `Purged demo account "${orgToPurge.value.name}" completely from database`, variant: 'success' });
    showPurgeModal.value = false;
    orgToPurge.value = null;
    await Promise.all([fetchStats(), fetchOrganizations()]);
  } catch (err: any) {
    pushToast({ message: err.response?.data?.error?.message || 'Failed to purge organization', variant: 'error' });
  } finally {
    isPurging.value = false;
  }
}

const columns: DataTableColumn<OrganizationAdminRow>[] = [
  { key: 'name', label: 'Store & Slug' },
  { key: 'owner', label: 'Owner & Email' },
  { key: 'plan', label: 'Tier / Access' },
  { key: 'counts', label: 'Data Footprint' },
  { key: 'created_at', label: 'Registered' },
  { key: 'actions', label: 'Operations', align: 'right' },
];
</script>

<template>
  <div class="admin-console-page">
    <!-- SCREEN 1: ADMIN SECRET PROMPT (If not authenticated) -->
    <div v-if="!isAuthenticated" class="auth-gate-container">
      <div class="auth-card card">
        <div class="auth-header">
          <div class="shield-badge">
            <Key :size="28" />
          </div>
          <h1 class="auth-title">KauntaOS Control Console</h1>
          <p class="auth-subtitle">Owner access to manage subscriptions, licenses, and accounts.</p>
        </div>

        <form class="auth-form" @submit.prevent="handleLoginSubmit">
          <div class="form-group">
            <label class="form-label" for="adminSecret">ADMIN_SECRET Key</label>
            <input
              id="adminSecret"
              v-model="secretInput"
              type="password"
              placeholder="Enter your administrative secret"
              class="form-input font-mono"
              :disabled="isAuthenticating"
              autofocus
            />
          </div>

          <div v-if="authError" class="auth-error-alert">
            <ShieldAlert :size="15" />
            <span>{{ authError }}</span>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            style="width: 100%"
            :loading="isAuthenticating"
          >
            Authenticate Console
          </Button>
        </form>
      </div>
    </div>

    <!-- SCREEN 2: ADMIN COMMERCIAL DASHBOARD (When authenticated) -->
    <div v-else class="console-workspace">
      <header class="console-header">
        <div class="brand-left">
          <div class="logo-mark">
            <Crown :size="18" />
          </div>
          <div>
            <h1 class="console-title">KauntaOS Platform Console</h1>
            <span class="access-tag">Superadmin • Full Access</span>
          </div>
        </div>

        <div class="header-actions">
          <Button variant="secondary" size="sm" @click="fetchOrganizations">
            <RefreshCw :size="14" /> Refresh
          </Button>
          <Button variant="ghost" size="sm" @click="handleLogout">
            <LogOut :size="14" /> Lock Console
          </Button>
        </div>
      </header>

      <!-- KPI Overview Cards -->
      <section v-if="stats" class="stats-grid">
        <div class="kpi-card card">
          <span class="kpi-label">Total Stores</span>
          <span class="kpi-val tabular-figure">{{ stats.total_orgs }}</span>
          <span class="kpi-meta">{{ stats.total_orders }} total orders processed</span>
        </div>

        <div class="kpi-card card">
          <span class="kpi-label">Free Demo Accounts</span>
          <span class="kpi-val tabular-figure text-muted">{{ stats.free_count }}</span>
          <span class="kpi-meta">Standard 10-customer limit</span>
        </div>

        <div class="kpi-card card">
          <span class="kpi-label">Pro Subscribers</span>
          <span class="kpi-val tabular-figure text-teal">{{ stats.pro_count }}</span>
          <span class="kpi-meta">KES 500 / month</span>
        </div>

        <div class="kpi-card card">
          <span class="kpi-label">Business Subscribers</span>
          <span class="kpi-val tabular-figure text-info">{{ stats.business_count }}</span>
          <span class="kpi-meta">KES 2,499 / month</span>
        </div>

        <div class="kpi-card card kpi-card--gold">
          <div class="gold-top">
            <span class="kpi-label">Lifetime Licenses</span>
            <Crown :size="15" class="text-gold" />
          </div>
          <span class="kpi-val tabular-figure text-gold">{{ stats.lifetime_count }}</span>
          <span class="kpi-meta">Perpetual unlocked access</span>
        </div>
      </section>

      <!-- Search & Tier Filter Toolbar -->
      <section class="toolbar-section">
        <div class="search-bar-wrap">
          <Search :size="16" class="search-icon text-muted" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search stores by name, slug, owner, or email..."
            class="search-input"
            @keyup.enter="fetchOrganizations"
          />
        </div>

        <div class="filter-tabs">
          <button
            v-for="tab in [
              { key: 'all', label: 'All Accounts' },
              { key: 'free', label: 'Free Demos' },
              { key: 'pro', label: 'Pro' },
              { key: 'business', label: 'Business' },
              { key: 'lifetime', label: 'Lifetime' },
            ]"
            :key="tab.key"
            type="button"
            class="filter-tab-btn"
            :class="{ 'filter-tab-btn--active': activeTierFilter === tab.key }"
            @click="() => { activeTierFilter = tab.key as FilterTier; fetchOrganizations(); }"
          >
            {{ tab.label }}
          </button>
        </div>
      </section>

      <!-- Merchant Directory Table -->
      <section class="table-section">
        <DataTable
          :columns="columns"
          :rows="filteredOrgs"
          :loading="loadingData"
          :row-key="(row) => row.id"
          empty-title="No organizations found"
          empty-description="No registered merchants match your search filters."
        >
          <!-- Store & Slug Cell -->
          <template #cell-name="{ row }">
            <div class="store-cell">
              <span class="store-name-text">{{ (row as OrganizationAdminRow).name }}</span>
              <a
                :href="`/store/${(row as OrganizationAdminRow).slug}`"
                target="_blank"
                class="store-slug-link font-mono"
              >
                /store/{{ (row as OrganizationAdminRow).slug }} <ArrowUpRight :size="11" />
              </a>
            </div>
          </template>

          <!-- Owner Cell -->
          <template #cell-owner="{ row }">
            <div class="owner-cell">
              <span class="owner-name">{{ (row as OrganizationAdminRow).owner_name || '—' }}</span>
              <span class="owner-email text-muted">{{ (row as OrganizationAdminRow).owner_email || '—' }}</span>
            </div>
          </template>

          <!-- Tier Cell -->
          <template #cell-plan="{ row }">
            <div class="tier-badge-cell">
              <span class="plan-pill" :class="`plan-pill--${(row as OrganizationAdminRow).plan}`">
                <Crown v-if="(row as OrganizationAdminRow).plan === 'lifetime'" :size="12" />
                {{ (row as OrganizationAdminRow).plan.toUpperCase() }}
              </span>
              <span class="expiry-subtext font-mono">
                {{
                  (row as OrganizationAdminRow).plan === 'lifetime'
                    ? 'Perpetual'
                    : (row as OrganizationAdminRow).plan_expires_at
                      ? `Exp: ${formatDate((row as OrganizationAdminRow).plan_expires_at!)}`
                      : 'No Expiry'
                }}
              </span>
            </div>
          </template>

          <!-- Footprint Counts Cell -->
          <template #cell-counts="{ row }">
            <div class="counts-cell tabular-figure">
              <span>{{ (row as OrganizationAdminRow).product_count }} prods</span> •
              <span>{{ (row as OrganizationAdminRow).order_count }} orders</span> •
              <span>{{ (row as OrganizationAdminRow).customer_count }} custs</span>
            </div>
          </template>

          <!-- Registered Date Cell -->
          <template #cell-created_at="{ row }">
            <span class="date-cell">{{ formatDate((row as OrganizationAdminRow).created_at) }}</span>
          </template>

          <!-- Operations Actions Cell -->
          <template #cell-actions="{ row }">
            <div class="actions-cell">
              <!-- 1-Click Grant Lifetime -->
              <button
                v-if="(row as OrganizationAdminRow).plan !== 'lifetime'"
                type="button"
                class="action-btn action-btn--gold"
                title="Grant Lifetime Access"
                @click="handleQuickGrantLifetime(row as OrganizationAdminRow)"
              >
                <Crown :size="14" />
              </button>

              <!-- Promote / Custom Tier Modal -->
              <button
                type="button"
                class="action-btn action-btn--promote"
                title="Change Tier / Duration"
                @click="openTierModal(row as OrganizationAdminRow)"
              >
                <Edit3 :size="14" />
              </button>

              <!-- Demote to Free -->
              <button
                v-if="(row as OrganizationAdminRow).plan !== 'free'"
                type="button"
                class="action-btn"
                title="Demote to Free"
                @click="handleDemoteToFree(row as OrganizationAdminRow)"
              >
                Demote
              </button>

              <!-- Purge Demo Account -->
              <button
                type="button"
                class="action-btn action-btn--danger"
                title="Purge Demo Account & All Records"
                @click="openPurgeModal(row as OrganizationAdminRow)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </template>
        </DataTable>
      </section>
    </div>

    <!-- MODAL 1: PROMOTION & TIER SELECTOR -->
    <Modal
      :open="showTierModal"
      :title="`Manage Tier: ${targetOrg?.name}`"
      @close="showTierModal = false"
    >
      <div class="tier-edit-form">
        <div class="form-group">
          <label class="form-label">Select Business Tier</label>
          <select v-model="selectedPlan" class="form-select">
            <option value="free">Free Tier (Demo Limits)</option>
            <option value="pro">Pro Monthly (KES 500/mo)</option>
            <option value="business">Business Monthly (KES 2,499/mo)</option>
            <option value="lifetime">Lifetime License (Perpetual Unlimited)</option>
          </select>
        </div>

        <div v-if="selectedPlan === 'pro' || selectedPlan === 'business'" class="form-group">
          <label class="form-label">Duration</label>
          <select v-model.number="selectedDurationMonths" class="form-select">
            <option :value="1">1 Month (+30 Days)</option>
            <option :value="3">3 Months (+90 Days)</option>
            <option :value="6">6 Months (+180 Days)</option>
            <option :value="12">1 Year (+365 Days)</option>
          </select>
        </div>

        <div v-if="selectedPlan === 'lifetime'" class="lifetime-note-card">
          <Crown :size="18" class="text-gold" />
          <p>Granting Lifetime Access permanently removes all customer/product caps and sets the expiry date to indefinite.</p>
        </div>
      </div>

      <template #footer>
        <Button variant="ghost" @click="showTierModal = false">Cancel</Button>
        <Button variant="primary" :loading="isUpdatingTier" @click="handleTierSubmit">
          Save Tier Updates
        </Button>
      </template>
    </Modal>

 <!-- MODAL 2: PURGE DEMO ACCOUNT CONFIRMATION -->
    <ConfirmDialog
      :open="showPurgeModal"
      title="Purge Account from Database"
      :message="`Are you sure you want to completely purge '${orgToPurge?.name}' (/store/${orgToPurge?.slug})? This will permanently delete all its products, orders, inventory, customers, ledger entries, and linked user records.`"
      confirm-label="Purge Account"
      danger
      @confirm="executePurge"
      @cancel="showPurgeModal = false"
    />
  </div>
</template>

<style scoped>
.admin-console-page {
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
}

/* Auth Gate Screen */
.auth-gate-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-4);
}

.auth-card {
  width: 100%;
  max-width: 440px;
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.auth-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-2);
}

.shield-badge {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
  color: var(--brand-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-2);
}

.auth-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
}

.auth-subtitle {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-normal);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-label {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text-muted);
}

.form-input, .form-select {
  min-height: 44px;
  padding: 0 var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text);
  outline: none;
}
.form-input:focus, .form-select:focus {
  border-color: var(--color-ink);
}

.auth-error-alert {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: color-mix(in srgb, var(--color-market-clay) 12%, transparent);
  color: var(--color-market-clay);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: 600;
}

/* Console Workspace */
.console-workspace {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-4);
}

.brand-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.logo-mark {
  width: 36px;
  height: 36px;
  background: var(--brand-primary);
  color: #FFFFFF;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.console-title {
  font-size: var(--text-xl);
  font-weight: 800;
}

.access-tag {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-ledger-green);
  letter-spacing: 0.05em;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}
/* KPI Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-3);
}

@media (max-width: 1080px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.kpi-card {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.kpi-card--gold {
  border-color: var(--color-gold);
  background: color-mix(in srgb, var(--color-gold) 6%, var(--color-surface));
}

.gold-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kpi-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.kpi-val {
  font-size: var(--text-2xl);
  font-weight: 800;
  line-height: 1.1;
}

.kpi-meta {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

/* Toolbar */
.toolbar-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.search-bar-wrap {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 280px;
  flex: 1;
  max-width: 480px;
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  pointer-events: none;
}

.search-input {
  width: 100%;
  min-height: 40px;
  padding: 0 var(--space-4) 0 calc(var(--space-8) + 2px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--color-text);
  outline: none;
}
.search-input:focus {
  border-color: var(--color-ink);
}

.filter-tabs {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
}

.filter-tab-btn {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--duration-fast) var(--ease-standard);
}

.filter-tab-btn--active {
  background: var(--color-ink);
  color: var(--color-text-inverse) !important;
  border-color: var(--color-ink);
}
/* Table Cells */
.store-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.store-name-text {
  font-weight: 700;
  color: var(--color-text);
}

.store-slug-link {
  font-size: 11px;
  color: var(--brand-primary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.owner-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.owner-name { font-weight: 600; font-size: var(--text-xs); }
.owner-email { font-size: 11px; }

.tier-badge-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.plan-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 800;
  width: fit-content;
}
.plan-pill--free { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-muted); }
.plan-pill--pro { background: color-mix(in srgb, var(--color-ledger-green) 15%, transparent); color: var(--color-ledger-green); }
.plan-pill--business { background: color-mix(in srgb, var(--color-info) 15%, transparent); color: var(--color-info); }
.plan-pill--lifetime { background: color-mix(in srgb, var(--color-gold) 18%, transparent); color: var(--color-gold-hover); border: 1px solid var(--color-gold); }

.expiry-subtext {
  font-size: 10px;
  color: var(--color-text-muted);
}

.counts-cell {
  font-size: 11px;
  color: var(--color-text-muted);
}

.date-cell {
  font-size: 11px;
  color: var(--color-text-muted);
}

.actions-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}
.action-btn:hover {
  border-color: var(--color-ink);
}

.action-btn--gold {
  color: var(--color-gold-hover);
  border-color: var(--color-gold);
}
.action-btn--gold:hover {
  background: var(--color-gold);
  color: #FFFFFF;
}

.action-btn--promote {
  color: var(--color-info);
}

.action-btn--danger {
  color: var(--color-market-clay);
}
.action-btn--danger:hover {
  background: var(--color-market-clay);
  color: #FFFFFF;
}

.tier-edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.lifetime-note-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: color-mix(in srgb, var(--color-gold) 10%, transparent);
  border: 1px solid var(--color-gold);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-xs);
  color: var(--color-text);
}

.text-teal { color: var(--color-ledger-green); }
.text-info { color: var(--color-info); }
.text-gold { color: var(--color-gold-hover); }
</style>