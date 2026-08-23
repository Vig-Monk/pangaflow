<script setup lang="ts">
// =============================================================================
// KauntaOS-frontend/src/components/layout/AppShell.vue
// =============================================================================

import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useStoreSettingsStore } from '@/stores/store';
import { useTheme } from '@/composables/useTheme';
import NavItem from './NavItem.vue';
import {
  LayoutDashboard,
  Users,
  Tag,
  Package,
  Inbox,
  CreditCard,
  Key,
  Store,
  Settings,
  Moon,
  Sun,
  Menu,
  LogOut,
  ExternalLink
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const storeSettingsStore = useStoreSettingsStore();
const { theme, toggle } = useTheme();

const orgName = computed<string>(() => authStore.org?.name ?? 'KauntaOS');
const userInitial = computed<string>(() => (authStore.user?.name?.charAt(0) ?? '?').toUpperCase());

const showMobileMenu = ref(false);

onMounted(() => {
  storeSettingsStore.fetchSettings();
});

const storeSlug = computed(() => storeSettingsStore.settings?.slug);
const isStorePublished = computed(() => storeSettingsStore.settings?.status === 'published');
const publicStoreUrl = computed(() => storeSlug.value ? `/store/${storeSlug.value}` : '#');

async function handleLogout(): Promise<void> {
  await authStore.logout();
  showMobileMenu.value = false;
  router.push({ name: 'login' });
}

function closeMobileMenu(): void {
  showMobileMenu.value = false;
}
</script>

<template>
  <div class="app-shell">
    <!-- Desktop sidebar -->
    <aside class="sidebar">
      <div class="sidebar__brand">
        <span class="sidebar__brand-text">{{ orgName }}</span>
      </div>

      <nav class="sidebar__nav">
        <!-- GROUP 1: BUSINESS -->
        <div class="sidebar__group">
          <span class="sidebar__group-label">Business</span>
          <NavItem :to="{ name: 'dashboard' }" label="Dashboard" :icon="LayoutDashboard" />
          <NavItem :to="{ name: 'merchant-orders' }" label="Orders" :icon="Inbox" />
          <NavItem :to="{ name: 'products' }" label="Products" :icon="Tag" />
          <NavItem :to="{ name: 'inventory' }" label="Inventory" :icon="Package" />
          <NavItem :to="{ name: 'customers' }" label="Customers" :icon="Users" />
        </div>

        <!-- GROUP 2: FINANCE -->
        <div class="sidebar__group">
          <span class="sidebar__group-label">Finance</span>
          <NavItem :to="{ name: 'expenses' }" label="Expenses" :icon="CreditCard" />
          <NavItem :to="{ name: 'mpesa-setup' }" label="M-Pesa Setup" :icon="Key" />
        </div>

        <!-- GROUP 3: STOREFRONT -->
        <div class="sidebar__group">
          <span class="sidebar__group-label">Storefront</span>
          <NavItem :to="{ name: 'store-settings' }" label="Customize Store" :icon="Store" />
          
          <a
            v-if="storeSlug"
            :href="publicStoreUrl"
            target="_blank"
            class="persistent-view-store-link"
            :class="{ 'is-live': isStorePublished }"
          >
            <ExternalLink :size="16" />
            <span>View Live Store</span>
            <span class="live-dot" v-if="isStorePublished" title="Store is live"></span>
          </a>
        </div>

        <!-- GROUP 4: ACCOUNT -->
        <div class="sidebar__group">
          <span class="sidebar__group-label">Account</span>
          <NavItem :to="{ name: 'plan' }" label="Plan &amp; Settings" :icon="Settings" />
        </div>
      </nav>

      <div class="sidebar__footer">
        <button
          class="sidebar__theme-btn"
          type="button"
          @click="toggle"
          :aria-label="`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`"
        >
          <Sun v-if="theme === 'dark'" :size="18" />
          <Moon v-else :size="18" />
        </button>

        <div class="user-menu">
          <span class="user-menu__avatar">{{ userInitial }}</span>
          <button class="user-menu__logout" type="button" @click="handleLogout">Logout</button>
        </div>
      </div>
    </aside>

    <!-- Main view content wrapper: min-width: 0 prevents flex overflow -->
    <main class="main-content">
      <slot />
    </main>

    <!-- Mobile bottom tab bar -->
    <nav class="bottom-bar" aria-label="Primary">
      <RouterLink :to="{ name: 'dashboard' }" class="bottom-bar__item">
        <LayoutDashboard :size="20" />
        <span>Dashboard</span>
      </RouterLink>
      <RouterLink :to="{ name: 'products' }" class="bottom-bar__item">
        <Tag :size="20" />
        <span>Products</span>
      </RouterLink>
      <RouterLink :to="{ name: 'merchant-orders' }" class="bottom-bar__item">
        <Inbox :size="20" />
        <span>Orders</span>
      </RouterLink>
      <button class="bottom-bar__item bottom-bar__item--button" type="button" @click="showMobileMenu = true">
        <Menu :size="20" />
        <span>Menu</span>
      </button>
    </nav>

    <!-- Mobile Menu Drawer -->
    <Teleport to="body">
      <Transition name="sheet-fade">
        <div v-if="showMobileMenu" class="sheet-backdrop" @click.self="closeMobileMenu">
          <div class="sheet" role="dialog" aria-modal="true" aria-label="Menu">
            <span class="sheet__group-label">Operations</span>
            <RouterLink :to="{ name: 'inventory' }" class="sheet__item" @click="closeMobileMenu">
              <Package :size="18" /> Inventory
            </RouterLink>
            <RouterLink :to="{ name: 'customers' }" class="sheet__item" @click="closeMobileMenu">
              <Users :size="18" /> Customers
            </RouterLink>
            
            <span class="sheet__group-label">Finance &amp; Store</span>
            <RouterLink :to="{ name: 'expenses' }" class="sheet__item" @click="closeMobileMenu">
              <CreditCard :size="18" /> Expenses
            </RouterLink>
            <RouterLink :to="{ name: 'mpesa-setup' }" class="sheet__item" @click="closeMobileMenu">
              <Key :size="18" /> M-Pesa Setup
            </RouterLink>
            <RouterLink :to="{ name: 'store-settings' }" class="sheet__item" @click="closeMobileMenu">
              <Store :size="18" /> Customize Store
            </RouterLink>
            <a v-if="storeSlug" :href="publicStoreUrl" target="_blank" class="sheet__item sheet__item--external" @click="closeMobileMenu">
              <ExternalLink :size="18" /> View Live Storefront ↗
            </a>
            
            <span class="sheet__group-label">Account</span>
            <RouterLink :to="{ name: 'plan' }" class="sheet__item" @click="closeMobileMenu">
              <Settings :size="18" /> Plan &amp; Settings
            </RouterLink>
            <button class="sheet__item" type="button" @click="() => { toggle(); closeMobileMenu(); }">
              <Sun v-if="theme === 'light'" :size="18" />
              <Moon v-else :size="18" />
              {{ theme === 'light' ? 'Dark mode' : 'Light mode' }}
            </button>
            <button class="sheet__item sheet__item--danger" type="button" @click="handleLogout">
              <LogOut :size="18" /> Logout
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  min-width: 0; /* Prevents flex-child blowout */
  background: var(--color-bg);
}

.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 80;
}

.sidebar__brand {
  padding: var(--space-5) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.sidebar__brand-text {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--color-ink);
  font-weight: 700;
}

.sidebar__nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-3);
  overflow-y: auto;
}

.sidebar__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar__group-label {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  padding: 0 var(--space-3) var(--space-1);
}

.persistent-view-store-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: 500;
  border-left: 3px solid transparent;
  transition: background var(--duration-fast) var(--ease-standard),
              color var(--duration-fast) var(--ease-standard);
  min-height: 40px;
}

.persistent-view-store-link:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.persistent-view-store-link.is-live {
  color: var(--color-ledger-green);
}

.live-dot {
  width: 6px;
  height: 6px;
  background: var(--color-ledger-green);
  border-radius: 50%;
  margin-left: auto;
}

.sidebar__footer {
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  background: var(--color-surface);
}

.sidebar__theme-btn {
  align-self: flex-start;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
  cursor: pointer;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.user-menu__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--brand-primary);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: 700;
  flex-shrink: 0;
}

.user-menu__logout {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  cursor: pointer;
  padding: 0;
}
.user-menu__logout:hover { color: var(--color-market-clay); }

/* Main content container with min-width: 0 ensuring horizontal containment */
.main-content {
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  margin-left: 240px;
  background: var(--color-bg);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.bottom-bar { display: none; }

@media (max-width: 768px) {
  .sidebar { display: none; }
  .main-content {
    margin-left: 0;
    padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  }

  .bottom-bar {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: var(--color-surface);
    box-shadow: var(--shadow-lg);
    border-top: 1px solid var(--color-border);
    z-index: 90;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .bottom-bar__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-decoration: none;
    background: transparent;
    border: none;
    font-family: var(--font-body);
    cursor: pointer;
  }

  .bottom-bar__item.router-link-active {
    color: var(--brand-primary);
    font-weight: 700;
  }
}

.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  z-index: 100;
}

.sheet {
  width: 100%;
  background: var(--color-surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--space-4);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 85vh;
  overflow-y: auto;
}

.sheet__group-label {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  padding: var(--space-3) var(--space-4) var(--space-1);
}

.sheet__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 44px;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  color: var(--color-text);
  text-decoration: none;
  font-size: var(--text-base);
  background: transparent;
  border: none;
  font-family: var(--font-body);
  cursor: pointer;
  text-align: left;
}
.sheet__item:hover { background: var(--color-bg); }
.sheet__item--external { color: var(--color-ledger-green); font-weight: 600; }
.sheet__item--danger { color: var(--color-market-clay); }

.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard);
}
.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}
</style>