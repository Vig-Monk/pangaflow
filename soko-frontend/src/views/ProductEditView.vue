<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/ProductEditView.vue (STEP 3)
// Edit view calling PATCH /products/:id.
// =============================================================================

import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProductsStore } from '@/stores/products';
import { useToast } from '@/composables/useToast';
import { apiGet, apiPatch } from '@/services/apiClient';
import Button from '@/components/ui/Button.vue';
import CurrencyInput from '@/components/ui/CurrencyInput.vue';

const route = useRoute();
const router = useRouter();
const productsStore = useProductsStore();
const { push: pushToast } = useToast();

const productId = route.params.id as string;

const name = ref('');
const price = ref(0);
const sku = ref('');
const description = ref('');
const categoryId = ref('');
const isSaving = ref(false);

onMounted(async () => {
  await productsStore.fetchCategories();
  try {
    const prod = await apiGet<any>(`/products/${productId}`);
    name.value = prod.name;
    price.value = parseFloat(prod.price);
    sku.value = prod.sku ?? '';
    description.value = prod.description ?? '';
    categoryId.value = prod.category_id;
  } catch {
    pushToast({ message: 'Failed to load product details', variant: 'error' });
    router.push({ name: 'products' });
  }
});

async function handleSave(): Promise<void> {
  if (!name.value.trim() || price.value <= 0) return;

  isSaving.value = true;
  try {
    await apiPatch(`/products/${productId}`, {
      name: name.value.trim(),
      price: Number(price.value),
      sku: sku.value.trim() || null,
      description: description.value.trim() || null,
      category_id: categoryId.value || undefined,
    });
    pushToast({ message: 'Product updated successfully', variant: 'success' });
    router.push({ name: 'products' });
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Update failed', variant: 'error' });
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="edit-product-container card">
    <header class="page-header">
      <h1 class="page-title">Edit Product</h1>
      <Button variant="ghost" @click="router.push({ name: 'products' })">Cancel</Button>
    </header>

    <div class="form-fields">
      <div class="form-group">
        <label class="form-label">Product Name *</label>
        <input v-model="name" type="text" class="form-input" placeholder="Product name" />
      </div>

      <div class="form-group-row">
        <div class="form-group flex-1">
          <label class="form-label">Price (KES) *</label>
          <CurrencyInput v-model="price" />
        </div>
        <div class="form-group flex-1">
          <label class="form-label">Category</label>
          <select v-model="categoryId" class="form-select">
            <option value="" disabled>Select category</option>
            <option v-for="cat in productsStore.categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">SKU (Optional)</label>
        <input v-model="sku" type="text" class="form-input" placeholder="SKU code" />
      </div>

      <div class="form-group">
        <label class="form-label">Description (Optional)</label>
        <textarea v-model="description" class="form-textarea" rows="3" placeholder="Product details..." />
      </div>

      <div class="form-actions">
        <Button variant="primary" size="lg" :loading="isSaving" @click="handleSave">Save Updates</Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-product-container {
  padding: var(--space-8);
  max-width: 640px;
  margin: var(--space-8) auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-3);
}

.page-title { font-size: var(--text-xl); }

.form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-group-row {
  display: flex;
  gap: var(--space-4);
  flex-direction: column;
}

@media (min-width: 640px) {
  .form-group-row { flex-direction: row; }
}

.flex-1 { flex: 1; }

.form-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.form-input,
.form-select,
.form-textarea {
  min-height: 44px;
  padding: 0 var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--color-text);
  outline: none;
}

.form-textarea {
  padding: var(--space-3) var(--space-4);
  resize: vertical;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-2);
}
</style>