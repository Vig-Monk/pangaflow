<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/ProductsAddView.vue
// Fast batch product creation with multi-select bulk category & price tools.
// =============================================================================

import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useProductsStore, type CreateProductInput } from '@/stores/products';
import { useToast } from '@/composables/useToast';
import { apiPost } from '@/services/apiClient';
import Button from '@/components/ui/Button.vue';
import {
  Camera,
  Plus,
  Trash2,
  RefreshCw,
  Layers,
  CheckSquare,
  Square,
} from 'lucide-vue-next';

interface ProductDraft {
  image_url: string;
  image_public_id: string;
  name: string;
  price: number;
  stock: number;
  category_id: string;
  sku: string;
  description: string;
  uploading: boolean;
  error: string | null;
}

const router = useRouter();
const productsStore = useProductsStore();
const { push: pushToast } = useToast();

const drafts = ref<ProductDraft[]>([]);
const isSaving = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const newCategoryName = ref('');
const isAddingCategory = ref(false);

// Multi-select bulk action state
const selectedIndexes = ref<number[]>([]);
const bulkCategoryId = ref('');
const bulkPrice = ref<number | null>(null);
//const bulkStock = ref<number | null>(null);

onMounted(() => {
  productsStore.fetchCategories();
});

const uploadCount = computed(() => drafts.value.filter((d) => d.uploading).length);
const canSave = computed(() => {
  if (drafts.value.length === 0 || uploadCount.value > 0) return false;
  return drafts.value.every((d) => d.name.trim().length > 0 && d.price >= 0 && d.stock >= 0);
});

const isAllSelected = computed(() => {
  return drafts.value.length > 0 && selectedIndexes.value.length === drafts.value.length;
});

function toggleSelectAll(): void {
  if (isAllSelected.value) {
    selectedIndexes.value = [];
  } else {
    selectedIndexes.value = drafts.value.map((_, i) => i);
  }
}

function toggleSelectIndex(index: number): void {
  const pos = selectedIndexes.value.indexOf(index);
  if (pos >= 0) {
    selectedIndexes.value.splice(pos, 1);
  } else {
    selectedIndexes.value.push(index);
  }
}

function applyBulkCategory(): void {
  if (!bulkCategoryId.value || selectedIndexes.value.length === 0) return;
  selectedIndexes.value.forEach((idx) => {
    if (drafts.value[idx]) {
      drafts.value[idx].category_id = bulkCategoryId.value;
    }
  });
  pushToast({ message: `Updated category for ${selectedIndexes.value.length} items`, variant: 'info' });
}

function applyBulkPrice(): void {
  if (bulkPrice.value === null || bulkPrice.value < 0 || selectedIndexes.value.length === 0) return;
  selectedIndexes.value.forEach((idx) => {
    if (drafts.value[idx]) {
      drafts.value[idx].price = Number(bulkPrice.value);
    }
  });
  pushToast({ message: `Updated price for ${selectedIndexes.value.length} items`, variant: 'info' });
}

/*function applyBulkStock(): void {
  if (bulkStock.value === null || bulkStock.value < 0 || selectedIndexes.value.length === 0) return;
  selectedIndexes.value.forEach((idx) => {
    if (drafts.value[idx]) {
      drafts.value[idx].stock = Number(bulkStock.value);
    }
  });
  pushToast({ message: `Updated stock for ${selectedIndexes.value.length} items`, variant: 'info' });
}*/

function removeSelectedDrafts(): void {
  if (selectedIndexes.value.length === 0) return;
  drafts.value = drafts.value.filter((_, idx) => !selectedIndexes.value.includes(idx));
  selectedIndexes.value = [];
}

async function handleAddCategory(): Promise<void> {
  const name = newCategoryName.value.trim();
  if (!name) return;

  isAddingCategory.value = true;
  try {
    const result = await apiPost<{ id: string; name: string }>('/products/categories', { name });
    await productsStore.fetchCategories();
    bulkCategoryId.value = result.id;
    newCategoryName.value = '';
    pushToast({ message: `Category "${result.name}" created`, variant: 'success' });
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to create category', variant: 'error' });
  } finally {
    isAddingCategory.value = false;
  }
}

async function handleFileSelection(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const files = Array.from(target.files ?? []);

  if (files.length === 0) return;

  const maxFiles = 10 - drafts.value.length;
  if (files.length > maxFiles) {
    pushToast({
      message: `You can only stage up to 10 products per batch. Skipping ${files.length - maxFiles} file(s).`,
      variant: 'error',
    });
  }

  const allowedFiles = files.slice(0, maxFiles);

  for (const file of allowedFiles) {
    const draftIndex =
      drafts.value.push({
        image_url: '',
        image_public_id: '',
        name: file.name.split('.')[0] || '',
        price: 0,
        stock: 5,
        category_id: bulkCategoryId.value || '',
        sku: '',
        description: '',
        uploading: true,
        error: null,
      }) - 1;

    uploadSingleFile(file, draftIndex);
  }

  if (fileInputRef.value) fileInputRef.value.value = '';
}

async function uploadSingleFile(file: File, index: number): Promise<void> {
  try {
    const sigResult = await productsStore.getUploadSignature('products');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sigResult.apiKey);
    formData.append('timestamp', String(sigResult.timestamp));
    formData.append('signature', sigResult.signature);
    formData.append('folder', sigResult.folder);

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${sigResult.cloudName}/image/upload`;
    const response = await fetch(cloudinaryUrl, { method: 'POST', body: formData });

    if (!response.ok) throw new Error('Image upload failed');

    const data = await response.json();

    drafts.value[index].image_url = data.secure_url;
    drafts.value[index].image_public_id = data.public_id;
    drafts.value[index].uploading = false;
  } catch {
    drafts.value[index].uploading = false;
    drafts.value[index].error = 'Upload failed';
    pushToast({ message: `Image upload failed for ${file.name}`, variant: 'error' });
  }
}

function removeDraft(index: number): void {
  drafts.value.splice(index, 1);
  selectedIndexes.value = selectedIndexes.value
    .filter((i) => i !== index)
    .map((i) => (i > index ? i - 1 : i));
}

async function submitDrafts(publish: boolean): Promise<void> {
  if (!canSave.value || isSaving.value) return;

  isSaving.value = true;
  try {
    const productsPayload: CreateProductInput[] = drafts.value.map((d) => ({
      name: d.name.trim(),
      category_id: d.category_id || null,
      price: Number(d.price),
      stock: Number(d.stock),
      sku: d.sku.trim() || null,
      description: d.description.trim() || null,
      images: [{ image_url: d.image_url, image_public_id: d.image_public_id }],
      publish,
    }));

    await productsStore.createBulk(productsPayload);
    pushToast({ message: `Successfully created ${drafts.value.length} products`, variant: 'success' });

    drafts.value = [];
    selectedIndexes.value = [];
    router.push({ name: 'products' });
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Bulk product save failed', variant: 'error' });
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="add-products-container">
    <header class="page-header">
      <div>
        <h1 class="page-title">Add Products (Fast Batch)</h1>
        <p class="page-subtitle">Upload up to 10 products with direct cloud image processing and bulk edit tools.</p>
      </div>
      <Button variant="ghost" @click="router.push({ name: 'products' })">Back to Catalog</Button>
    </header>

    <!-- Category Pre-Setup -->
    <div class="category-pre-setup card" v-if="drafts.length === 0">
      <div class="card-heading">
        <Layers :size="20" class="card-icon" />
        <h3 class="setup-title">Prepare Catalog Categories First</h3>
      </div>
      <div class="category-adder-widget">
        <input
          v-model="newCategoryName"
          type="text"
          placeholder="New Category (e.g. Footwear)"
          class="form-input"
          @keyup.enter="handleAddCategory"
          :disabled="isAddingCategory"
        />
        <Button variant="secondary" :disabled="!newCategoryName || isAddingCategory" @click="handleAddCategory">
          + Add Category
        </Button>
      </div>
      <div class="category-selector-preview" v-if="productsStore.categories.length > 0">
        <span class="preview-label">Available Categories:</span>
        <span v-for="cat in productsStore.categories" :key="cat.id" class="category-tag">
          {{ cat.name }}
        </span>
      </div>
    </div>

    <!-- Upload Trigger Area -->
    <div class="upload-trigger-area" v-if="drafts.length === 0">
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept="image/*"
        class="hidden-file-input"
        id="bulk-photo-picker"
        @change="handleFileSelection"
      />
      <label for="bulk-photo-picker" class="picker-label">
        <Camera :size="48" class="picker-icon text-muted" />
        <span class="picker-text">Select product photos to begin batch entry</span>
        <span class="picker-subtext">Select multiple images at once to auto-generate draft rows</span>
      </label>
    </div>

    <template v-else>
      <!-- Multi-Select Bulk Actions Toolbar -->
      <div class="bulk-toolbar-card card">
        <div class="toolbar-left">
          <button type="button" class="select-all-btn" @click="toggleSelectAll">
            <component :is="isAllSelected ? CheckSquare : Square" :size="16" />
            <span>{{ isAllSelected ? 'Deselect All' : 'Select All' }} ({{ selectedIndexes.length }}/{{ drafts.length }})</span>
          </button>

          <span v-if="uploadCount > 0" class="uploading-hint">
            <RefreshCw :size="14" class="spin-icon" /> Uploading {{ uploadCount }} image(s)...
          </span>
        </div>

        <div v-if="selectedIndexes.length > 0" class="toolbar-actions-group">
          <!-- Bulk Category -->
          <div class="action-item">
            <select v-model="bulkCategoryId" class="toolbar-select">
              <option value="">Set Category...</option>
              <option v-for="cat in productsStore.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
            <Button variant="secondary" size="sm" :disabled="!bulkCategoryId" @click="applyBulkCategory">Apply</Button>
          </div>

          <!-- Bulk Price -->
          <div class="action-item">
            <input v-model.number="bulkPrice" type="number" min="0" placeholder="Price" class="toolbar-input" />
            <Button variant="secondary" size="sm" :disabled="bulkPrice === null" @click="applyBulkPrice">Set Price</Button>
          </div>

          <!-- Delete Selected -->
          <button type="button" class="delete-selected-btn" title="Remove selected" @click="removeSelectedDrafts">
            <Trash2 :size="15" />
          </button>
        </div>

        <!-- Add More Photos Trigger -->
        <div class="toolbar-right">
          <input
            ref="fileInputRef"
            type="file"
            multiple
            accept="image/*"
            class="hidden-file-input"
            id="bulk-photo-picker-more"
            @change="handleFileSelection"
            :disabled="drafts.length >= 10"
          />
          <label for="bulk-photo-picker-more" class="add-more-label" :class="{ disabled: drafts.length >= 10 }">
            <Plus :size="15" /> Add Photos
          </label>
        </div>
      </div>

      <!-- Draft Cards Stack -->
      <div class="draft-stack">
        <div
          v-for="(draft, idx) in drafts"
          :key="idx"
          class="draft-card card"
          :class="{ 'draft-card--selected': selectedIndexes.includes(idx) }"
        >
          <div class="card-selection-box" @click="toggleSelectIndex(idx)">
            <component :is="selectedIndexes.includes(idx) ? CheckSquare : Square" :size="16" class="select-checkbox" />
          </div>

          <button class="draft-card__remove" type="button" title="Remove draft" @click="removeDraft(idx)">
            <Trash2 :size="15" />
          </button>

          <div class="draft-card__layout">
            <div class="draft-card__media">
              <div v-if="draft.uploading" class="draft-card__loader">
                <span class="spinner"></span>
                <span>Uploading...</span>
              </div>
              <div v-else-if="draft.error" class="draft-card__error-media">
                <span>⚠️ {{ draft.error }}</span>
              </div>
              <img v-else :src="draft.image_url" class="draft-card__img" alt="Product thumbnail" />
            </div>

            <div class="draft-card__form">
              <div class="form-row">
                <div class="form-group flex-2">
                  <label class="form-label">Product Name *</label>
                  <input v-model="draft.name" type="text" placeholder="Name" class="form-input" :disabled="draft.uploading" />
                </div>
                <div class="form-group flex-1">
                  <label class="form-label">Category</label>
                  <select v-model="draft.category_id" class="form-select" :disabled="draft.uploading">
                    <option value="">Other (Default)</option>
                    <option v-for="cat in productsStore.categories" :key="cat.id" :value="cat.id">
                      {{ cat.name }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Price (KES) *</label>
                  <input v-model.number="draft.price" type="number" min="0" placeholder="0" class="form-input" :disabled="draft.uploading" />
                </div>
                <div class="form-group">
                  <label class="form-label">Stock Qty *</label>
                  <input v-model.number="draft.stock" type="number" min="0" placeholder="0" class="form-input" :disabled="draft.uploading" />
                </div>
                <div class="form-group">
                  <label class="form-label">SKU (Optional)</label>
                  <input v-model="draft.sku" type="text" placeholder="SKU" class="form-input" :disabled="draft.uploading" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Panel Footer -->
      <footer class="form-actions-panel">
        <Button variant="ghost" @click="drafts = []; selectedIndexes = []">Clear Batch</Button>
        <div class="form-actions-panel__rights">
          <Button variant="secondary" :disabled="!canSave || isSaving" :loading="isSaving" @click="submitDrafts(false)">
            Save as Drafts
          </Button>
          <Button variant="primary" :disabled="!canSave || isSaving" :loading="isSaving" @click="submitDrafts(true)">
            Save &amp; Publish All ({{ drafts.length }})
          </Button>
        </div>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.add-products-container {
  padding: var(--space-6);
  max-width: 960px;
  margin: 0 auto;
  padding-bottom: var(--space-16);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
  gap: var(--space-4);
}

.page-title { font-size: var(--text-2xl); }
.page-subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: 2px; }

.hidden-file-input { display: none; }

.category-pre-setup {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  margin-bottom: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.card-heading { display: flex; align-items: center; gap: var(--space-2); }
.card-icon { color: var(--color-ink); }
.setup-title { font-size: var(--text-base); font-weight: 700; }

.category-adder-widget {
  display: flex;
  gap: var(--space-2);
  max-width: 480px;
}

.category-selector-preview {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.preview-label { font-size: 11px; color: var(--color-text-muted); font-weight: 700; margin-right: var(--space-1); }

.category-tag {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
}

.upload-trigger-area {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-standard);
}
.upload-trigger-area:hover { border-color: var(--color-ink); }

.picker-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16) var(--space-4);
  text-align: center;
  cursor: pointer;
  gap: var(--space-2);
}

.picker-text { font-weight: 700; font-size: var(--text-base); color: var(--color-text); }
.picker-subtext { font-size: var(--text-xs); color: var(--color-text-muted); }

/* Bulk Toolbar */
.bulk-toolbar-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.select-all-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: transparent;
  border: none;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-text);
  cursor: pointer;
}

.uploading-hint {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 11px;
  color: var(--color-gold-hover);
  font-weight: 700;
}

.toolbar-actions-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-select, .toolbar-input {
  min-height: 32px;
  padding: 0 var(--space-2);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--color-text);
  outline: none;
}
.toolbar-input { width: 80px; }

.delete-selected-btn {
  background: color-mix(in srgb, var(--color-market-clay) 10%, transparent);
  color: var(--color-market-clay);
  border: 1px solid color-mix(in srgb, var(--color-market-clay) 30%, transparent);
  border-radius: var(--radius-sm);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.add-more-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 4px var(--space-3);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.add-more-label.disabled { opacity: 0.5; cursor: not-allowed; }

/* Draft Cards */
.draft-stack { display: flex; flex-direction: column; gap: var(--space-3); }


.draft-card {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.draft-card--selected {
  border-color: var(--brand-primary);
  background: color-mix(in srgb, var(--brand-primary) 3%, var(--color-surface));
}

.card-selection-box {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  cursor: pointer;
  z-index: 10;
}

.draft-card__remove {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 2px;
}
.draft-card__remove:hover { color: var(--color-market-clay); }

.draft-card__layout {
  display: flex;
  gap: var(--space-4);
  flex-direction: column;
  padding-left: var(--space-6);
}
@media (min-width: 640px) { .draft-card__layout { flex-direction: row; } }

.draft-card__media {
  width: 100px;
  height: 100px;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.draft-card__img { width: 100%; height: 100%; object-fit: cover; }

.draft-card__loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--color-text-muted);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-ink);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.draft-card__form { flex: 1; display: flex; flex-direction: column; gap: var(--space-2); }

.form-row { display: flex; gap: var(--space-3); flex-direction: column; }
@media (min-width: 640px) { .form-row { flex-direction: row; } }

.form-group { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.flex-2 { flex: 2; }

.form-label { font-size: 11px; font-weight: 600; color: var(--color-text-muted); }

.form-input, .form-select {
  min-height: 38px;
  padding: 0 var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--color-text);
  outline: none;
}
.form-input:focus, .form-select:focus { border-color: var(--color-ink); }

.form-actions-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-6);
  flex-wrap: wrap;
  gap: var(--space-3);
}
.form-actions-panel__rights { display: flex; gap: var(--space-2); }
</style>