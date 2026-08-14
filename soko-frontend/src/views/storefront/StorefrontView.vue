<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/storefront/StoreHomeView.vue
// Public storefront listing - category filters and active product grid.
// =============================================================================

import { onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStoreSettingsStore } from '@/stores/store';
import { apiGet } from '@/services/apiClient';
import Skeleton from '@/components/ui/Skeleton.vue';

interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  images: string[];
  category: { name: string };
  availability: 'in_stock' | 'out_of_stock';
}

const route = useRoute();
const storeSettingsStore = useStoreSettingsStore();

const products = ref<PublicProduct[]>([]);
const selectedCategory = ref('');

const loadingStore = ref(true);
const loadingProducts = ref(true);
const loadError = ref(false);

const storeSlug = computed(() => route.params.storeSlug as string);

// Generate unique categories dynamically from the loaded products
const categories = computed(() => {
  const list = products.value.map(p => p.category.name);
  return ['All', ...Array.from(new Set(list))];
});

const filteredProducts = computed(() => {
  if (!selectedCategory.value || selectedCategory.value === 'All') {
    return products.value;
  }
  return products.value.filter(p => p.category.name === selectedCategory.value);
});

onMounted(async () => {
  try {
    // 1. Fetch unauthenticated storefront properties
    const settings = await apiGet<any>(`/public/stores/${storeSlug.value}`);
    storeSettingsStore.settings = settings;
    loadingStore.value = false;

    // 2. Fetch unauthenticated catalog products list
    products.value = await apiGet<PublicProduct[]>(`/public/stores/${storeSlug.value}/products`);
    loadingProducts.value = false;
  } catch (err) {
    loadError.value = true;
    loadingStore.value = false;
    loadingProducts.value = false;
  }
});

function formatCurrency(value: number): string {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}
</script>

<template>
  <div class="store-homepage">
    <!-- Handle Errors (Not Found or Unpublished status) -->
    <div v-if="loadError" class="error-container">
      <div class="error-box">
        <span class="error-icon">🔍</span>
        <h2 class="error-title">Storefront Offline</h2>
        <p class="error-desc">This store address does not exist or has been set to draft mode by the merchant.</p>
      </div>
    </div>

    <template v-else>
      <!-- Hero Header Section -->
      <section class="store-hero">
        <div v-if="loadingStore" class="hero-skeleton">
          <Skeleton height="200px" radius="0" />
        </div>
        <div v-else class="hero-banner-wrap">
          <div v-if="storeSettingsStore.settings?.cover_image_url" class="hero-banner" :style="{ backgroundImage: `url(${storeSettingsStore.settings.cover_image_url})` }" />
          <div v-else class="hero-banner hero-banner--default" />
          
          <div class="hero-branding">
            <h1 class="hero-store-name">{{ storeSettingsStore.settings?.name }}</h1>
            <p v-if="storeSettingsStore.settings?.description" class="hero-store-desc">{{ storeSettingsStore.settings.description }}</p>
          </div>
        </div>
      </section>

      <!-- Store Products Grid Section -->
      <div class="catalog-container">
        <!-- Category Filters -->
        <div class="filter-wrap" v-if="!loadingProducts && products.length > 0">
          <button
            v-for="cat in categories"
            :key="cat"
            class="filter-tab"
            :class="{ 'filter-tab--active': (cat === 'All' && !selectedCategory) || selectedCategory === cat }"
            @click="selectedCategory = cat === 'All' ? '' : cat"
          >
            {{ cat }}
          </button>
        </div>

        <div v-if="loadingProducts" class="products-grid-skeleton">
          <div v-for="n in 4" :key="n" class="skeleton-card">
            <Skeleton height="180px" />
            <Skeleton height="24px" width="70%" />
            <Skeleton height="20px" width="40%" />
          </div>
        </div>

        <template v-else>
          <div v-if="products.length === 0" class="empty-catalog">
            <span class="empty-icon">🛍️</span>
            <h3>No products available</h3>
            <p>Check back later! This merchant has not published any products to their store yet.</p>
          </div>

          <div v-else class="products-grid">
            <router-link
              v-for="prod in filteredProducts"
              :key="prod.id"
              :to="{ name: 'storefront-product-detail', params: { storeSlug, productSlug: prod.slug } }"
              class="product-card"
            >
              <div class="product-card__media">
                <img v-if="prod.images.length > 0" :src="prod.images[0]" :alt="prod.name" class="product-card__img" />
                <div v-else class="product-card__img-placeholder">📸</div>
                
                <span v-if="prod.availability === 'out_of_stock'" class="out-of-stock-badge">
                  Out of Stock
                </span>
              </div>
              <div class="product-card__info">
                <p class="product-category">{{ prod.category.name }}</p>
                <h3 class="product-name">{{ prod.name }}</h3>
                <p class="product-price tabular-figure">{{ formatCurrency(prod.price) }}</p>
              </div>
            </router-link>
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-16) var(--space-4);
}

.error-box {
  text-align: center;
  max-width: 420px;
}

.error-icon {
  font-size: var(--text-4xl);
  margin-bottom: var(--space-4);
  display: block;
}

.error-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  color: var(--color-text);
  margin-bottom: var(--space-2);
}

.error-desc {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
}

/* Hero Section */
.store-hero {
  position: relative;
}

.hero-banner-wrap {
  position: relative;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.hero-banner {
  height: 200px;
  background-size: cover;
  background-position: center;
}

.hero-banner--default {
  background: linear-gradient(135deg, var(--color-ink) 0%, var(--color-border) 100%);
  opacity: 0.25;
}

.hero-branding {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.hero-store-name {
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  color: var(--color-text);
}

.hero-store-desc {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-top: var(--space-2);
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

/* Catalog Grid Area */
.catalog-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.filter-wrap {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-8);
  overflow-x: auto;
  padding-bottom: var(--space-2);
}

.filter-tab {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: var(--space-2) var(--space-5);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.filter-tab--active {
  background: var(--color-ink);
  color: var(--color-text-inverse);
  border-color: var(--color-ink);
}

.products-grid-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-6);
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.empty-catalog {
  text-align: center;
  padding: var(--space-16) var(--space-4);
  color: var(--color-text-muted);
}

.empty-icon {
  font-size: var(--text-4xl);
  margin-bottom: var(--space-4);
  display: block;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-6);
}

.product-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: var(--color-text);
  transition: transform var(--duration-fast) var(--ease-standard);
}

.product-card:hover {
  transform: translateY(-2px);
}

.product-card__media {
  height: 220px;
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
  font-size: var(--text-3xl);
  color: var(--color-text-muted);
}

.out-of-stock-badge {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  background: var(--color-market-clay);
  color: var(--color-text-inverse);
  font-size: var(--text-xs);
  font-weight: 600;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
}

.product-card__info {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.product-category {
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
}

.product-name {
  font-size: var(--text-base);
  font-weight: 600;
}

.product-price {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-ink);
  margin-top: var(--space-1);
}
</style>