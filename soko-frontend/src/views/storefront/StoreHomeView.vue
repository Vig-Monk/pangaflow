<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/StoreHomeView.vue
// Instant client-side search, category count badges, and zero layout shift.
// =============================================================================

import { onMounted, ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useStoreSettingsStore } from '@/stores/store';
import { useCartStore } from '@/stores/cart';
import { useToast } from '@/composables/useToast';
import { apiGet } from '@/services/apiClient';
import StoreHero from '@/components/storefront/StoreHero.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import {
  ShoppingBag,
  Plus,
  ArrowUpDown,
  CheckSquare,
  Square,
  Search,
  X,
} from 'lucide-vue-next';

interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock?: number;
  images: string[];
  category: { name: string };
  availability: 'in_stock' | 'out_of_stock';
}

const route = useRoute();
const storeSettingsStore = useStoreSettingsStore();
const cartStore = useCartStore();
const { push: pushToast } = useToast();

const products = ref<PublicProduct[]>([]);
const selectedCategory = ref('');
const searchQuery = ref('');
const inStockOnly = ref(false);
const priceSort = ref<'default' | 'asc' | 'desc'>('default');

const loadingStore = ref(true);
const loadingProducts = ref(true);
const loadError = ref(false);

const storeSlug = computed(() => (route.params.storeSlug as string || '').toLowerCase().trim());

// Category tabs with real-time count badges
const categoryCounts = computed(() => {
  const counts: Record<string, number> = { All: products.value.length };
  for (const p of products.value) {
    const catName = p.category?.name || 'General';
    counts[catName] = (counts[catName] || 0) + 1;
  }
  return counts;
});

const categoryNames = computed(() => {
  const unique = Array.from(new Set(products.value.map((p) => p.category?.name).filter(Boolean)));
  return ['All', ...unique];
});

const productsByCategory = computed(() => {
  let result = [...products.value];

  // 1. Text Search Filter (instant, client-side across name, description, SKU)
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.category?.name && p.category.name.toLowerCase().includes(q))
    );
  }

  // 2. Category Tab Filter
  if (selectedCategory.value && selectedCategory.value !== 'All') {
    result = result.filter((p) => p.category?.name === selectedCategory.value);
  }

  // 3. In-Stock Filter
  if (inStockOnly.value) {
    result = result.filter((p) => p.availability === 'in_stock');
  }

  // 4. Price Sort
  if (priceSort.value === 'asc') {
    result.sort((a, b) => a.price - b.price);
  } else if (priceSort.value === 'desc') {
    result.sort((a, b) => b.price - a.price);
  }

  const map: Record<string, PublicProduct[]> = {};
  for (const prod of result) {
    const catName = prod.category?.name || 'General';
    if (!map[catName]) {
      map[catName] = [];
    }
    map[catName].push(prod);
  }
  return map;
});

async function loadStoreData(): Promise<void> {
  if (!storeSlug.value) return;

  loadError.value = false;
  loadingStore.value = true;
  loadingProducts.value = true;

  try {
    const settings = await apiGet<any>(`/public/stores/${storeSlug.value}`);
    storeSettingsStore.settings = settings;
    loadingStore.value = false;

    products.value = await apiGet<PublicProduct[]>(`/public/stores/${storeSlug.value}/products`);
    loadingProducts.value = false;
  } catch {
    loadError.value = true;
    loadingStore.value = false;
    loadingProducts.value = false;
  }
}

onMounted(() => {
  cartStore.initForStore(storeSlug.value);
  loadStoreData();
});

watch(
  () => route.params.storeSlug,
  (newSlug) => {
    if (newSlug) {
      cartStore.initForStore(String(newSlug).toLowerCase().trim());
      loadStoreData();
    }
  }
);

function formatCurrency(value: number): string {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

function handleQuickAddToCart(prod: PublicProduct, event: Event): void {
  event.preventDefault();
  event.stopPropagation();

  if (prod.availability === 'out_of_stock') return;

  const firstImage = prod.images && prod.images.length > 0 ? prod.images[0] : null;

  cartStore.addItem(
    storeSlug.value,
    prod.id,
    prod.name,
    firstImage,
    prod.price,
    1,
    prod.stock
  );

  pushToast({ message: `Added ${prod.name} to cart`, variant: 'success' });
}

function clearFilters(): void {
  searchQuery.value = '';
  selectedCategory.value = '';
  inStockOnly.value = false;
  priceSort.value = 'default';
}
</script>

<template>
  <div class="store-homepage">
    <div v-if="loadError" class="error-container card">
      <EmptyState
        title="Storefront Offline"
        description="This store address does not exist or has been set to draft mode by the merchant."
        action-label="Try Again"
        :on-action="loadStoreData"
      />
    </div>

    <template v-else>
      <section class="store-hero-section">
        <div v-if="loadingStore" class="hero-skeleton">
          <Skeleton height="300px" radius="0" />
        </div>
        <StoreHero v-else :settings="storeSettingsStore.settings" />
      </section>

      <!-- Instant Catalog Filter & Search Toolbar -->
      <div class="promoted-categories-bar" v-if="!loadingProducts && products.length > 0">
        <div class="categories-bar-inner">
          <!-- Instant Search Input -->
          <div class="catalog-search-wrap">
            <Search :size="16" class="search-icon text-muted" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search products in catalog..."
              class="catalog-search-input"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="search-clear-btn"
              @click="searchQuery = ''"
            >
              <X :size="14" />
            </button>
          </div>

          <!-- Category Filter Pills with Item Count Badges -->
          <div class="filter-wrap">
            <button
              v-for="cat in categoryNames"
              :key="cat"
              class="filter-tab"
              :class="{
                'filter-tab--active': (cat === 'All' && !selectedCategory) || selectedCategory === cat,
              }"
              @click="selectedCategory = cat === 'All' ? '' : cat"
            >
              <span>{{ cat }}</span>
              <span class="tab-count-pill tabular-figure">
                {{ categoryCounts[cat] || 0 }}
              </span>
            </button>
          </div>

          <!-- Stock & Price Controls -->
          <div class="catalog-controls-toolbar">
            <button
              class="control-toggle-btn"
              :class="{ active: inStockOnly }"
              type="button"
              @click="inStockOnly = !inStockOnly"
              title="Filter items currently in stock"
            >
              <component :is="inStockOnly ? CheckSquare : Square" :size="15" />
              <span>In Stock</span>
            </button>

            <div class="sort-select-wrapper">
              <ArrowUpDown :size="13" class="sort-icon" />
              <select v-model="priceSort" class="sort-select">
                <option value="default">Featured</option>
                <option value="asc">Price: Low to High</option>
                <option value="desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="catalog-container">
        <!-- Structural Loading Skeleton -->
        <div v-if="loadingProducts" class="products-grid-skeleton">
          <div v-for="n in 6" :key="n" class="skeleton-card card">
            <Skeleton height="200px" radius="var(--radius-md)" />
            <Skeleton height="16px" width="40%" />
            <Skeleton height="20px" width="80%" />
            <Skeleton height="18px" width="50%" />
          </div>
        </div>

        <template v-else>
          <div v-if="products.length === 0" class="empty-catalog card">
            <EmptyState
              title="Welcome to our new store"
              description="Check back soon! Products are currently being prepared for catalog publication."
            />
          </div>

          <!-- Empty Search Filter State -->
          <div
            v-else-if="Object.keys(productsByCategory).length === 0"
            class="empty-catalog card"
          >
            <EmptyState
              title="No products match your search"
              description="Try adjusting your keyword search, category selection, or stock filters."
              action-label="Clear All Filters"
              :on-action="clearFilters"
            />
          </div>

          <!-- Catalog Grouped Sections -->
          <div v-else class="catalog-sections-stack">
            <div
              v-for="(catProducts, categoryName) in productsByCategory"
              :key="categoryName"
              class="category-section-group"
            >
              <div class="category-section-header">
                <h2 class="category-section-title font-display">{{ categoryName }}</h2>
                <span class="category-count tabular-figure">{{ catProducts.length }} items</span>
              </div>

              <div class="products-grid">
                <router-link
                  v-for="prod in catProducts"
                  :key="prod.id"
                  :to="{ name: 'storefront-product-detail', params: { storeSlug, productSlug: prod.slug } }"
                  class="product-card"
                >
                  <div class="product-card__media">
                    <img
                      v-if="prod.images && prod.images.length > 0"
                      :src="prod.images[0]"
                      :alt="prod.name"
                      class="product-card__img"
                      loading="lazy"
                    />
                    <div v-else class="product-card__img-placeholder">
                      <ShoppingBag :size="32" />
                    </div>

                    <span
                      v-if="prod.availability === 'out_of_stock'"
                      class="out-of-stock-badge"
                    >
                      Out of Stock
                    </span>

                    <button
                      v-if="prod.availability === 'in_stock'"
                      class="quick-add-btn"
                      type="button"
                      title="Quick add to cart"
                      @click="(e) => handleQuickAddToCart(prod, e)"
                    >
                      <Plus :size="18" />
                    </button>
                  </div>

                  <div class="product-card__info">
                    <p class="product-category">{{ prod.category?.name || 'General' }}</p>
                    <h3 class="product-name">{{ prod.name }}</h3>
                    <p class="product-price tabular-figure">{{ formatCurrency(prod.price) }}</p>
                  </div>
                </router-link>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.store-homepage {
  min-height: 80vh;
}

.error-container {
  max-width: 600px;
  margin: var(--space-16) auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.promoted-categories-bar {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 61px;
  z-index: 90;
  box-shadow: var(--shadow-sm);
}

.categories-bar-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.catalog-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 220px;
  flex: 1;
}

@media (min-width: 768px) {
  .catalog-search-wrap {
    max-width: 260px;
  }
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  pointer-events: none;
}

.search-clear-btn {
  position: absolute;
  right: var(--space-2);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 2px;
}

.catalog-search-input {
  width: 100%;
  min-height: 36px;
  padding: 0 var(--space-7) 0 calc(var(--space-8) + 2px);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  color: var(--color-text);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-standard);
}
.catalog-search-input:focus {
  border-color: var(--color-ink);
}

.filter-wrap {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  flex: 1.5;
  padding-bottom: 2px;
}

.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 4px var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--duration-fast) var(--ease-standard);
}

.filter-tab:hover {
  border-color: var(--color-ink);
}

.filter-tab--active {
  background: var(--color-ink);
  color: var(--color-text-inverse);
  border-color: var(--color-ink);
}

.tab-count-pill {
  font-size: 10px;
  padding: 0 5px;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.08);
  font-weight: 700;
}

.filter-tab--active .tab-count-pill {
  background: rgba(255, 255, 255, 0.25);
  color: #FFFFFF;
}

.catalog-controls-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.control-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 4px var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.control-toggle-btn.active {
  background: color-mix(in srgb, var(--color-ink) 10%, transparent);
  color: var(--color-ink);
  border-color: var(--color-ink);
}

.sort-select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 0 var(--space-3);
  min-height: 32px;
}

.sort-icon {
  color: var(--color-text-muted);
  margin-right: 4px;
}

.sort-select {
  background: transparent;
  border: none;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text);
  outline: none;
  cursor: pointer;
}

.catalog-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.catalog-sections-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
}

.category-section-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.category-section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
}

.category-section-title {
  font-size: var(--text-xl);
  color: var(--color-text);
}

.category-count {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 700;
  text-transform: uppercase;
}

.products-grid-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
}

.skeleton-card {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.empty-catalog {
  max-width: 600px;
  margin: var(--space-12) auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
}

.product-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: var(--color-text);
  transition: transform var(--duration-fast) var(--ease-standard),
              box-shadow var(--duration-fast) var(--ease-standard);
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.product-card__media {
  height: 180px;
  background: var(--color-bg);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-card__img-placeholder {
  color: var(--color-text-muted);
}

.out-of-stock-badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  background: var(--color-market-clay);
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
}

.quick-add-btn {
  position: absolute;
  bottom: var(--space-2);
  right: var(--space-2);
  width: 32px;
  height: 32px;
  background: var(--brand-primary);
  color: #FFFFFF;
  border: none;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-fast) var(--ease-standard),
              background var(--duration-fast) var(--ease-standard);
}

.quick-add-btn:hover {
  background: var(--brand-primary-hover);
  transform: scale(1.08);
}

.product-card__info {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.product-category {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
  font-weight: 700;
}

.product-name {
  font-size: var(--text-sm);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-price {
  font-size: var(--text-xs);
  font-weight: 800;
  color: var(--color-ink);
  margin-top: 2px;
}
</style>