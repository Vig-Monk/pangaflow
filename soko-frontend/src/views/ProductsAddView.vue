<script setup lang="ts">
// =============================================================================
// soko-frontend/src/views/ProductsAddView.vue
// =============================================================================

import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useProductsStore, type CreateProductInput } from '@/stores/products';
import { useToast } from '@/composables/useToast';
import { apiPost } from '@/services/apiClient';
import Button from '@/components/ui/Button.vue';
import { Camera, Plus, Trash2, RefreshCw, Layers } from 'lucide-vue-next';

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
const globalCategoryId = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

const newCategoryName = ref('');
const isAddingCategory = ref(false);

onMounted(() => {
  productsStore.fetchCategories();
});

const uploadCount = computed(() => drafts.value.filter(d => d.uploading).length);
const canSave = computed(() => {
  if (drafts.value.length === 0 || uploadCount.value > 0) return false;
  return drafts.value.every(d => d.name.trim().length > 0 && d.price >= 0 && d.stock >= 0);
});

async function handleAddCategory(): Promise<void> {
  const name = newCategoryName.value.trim();
  if (!name) return;

  isAddingCategory.value = true;
  try {
    const result = await apiPost<{ id: string; name: string }>('/products/categories', { name });
    await productsStore.fetchCategories();
    
    globalCategoryId.value = result.id;
    newCategoryName.value = '';
    pushToast({ message: `Category "${result.name}" created`, variant: 'success' });
  } catch (err) {
    pushToast({ message: err instanceof Error ? err.message : 'Failed to create category', variant: 'error' });
  } finally {
    isAddingCategory.value = false;
  }
}

function applyGlobalCategory(): void {
  if (!globalCategoryId.value) return;
  drafts.value.forEach(d => {
    d.category_id = globalCategoryId.value;
  });
  pushToast({ message: 'Applied category to all active drafts', variant: 'info' });
}

async function handleFileSelection(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const files = Array.from(target.files ?? []);

  if (files.length === 0) return;

  const maxFiles = 10 - drafts.value.length;
  if (files.length > maxFiles) {
    pushToast({ message: `You can only stage up to 10 products per batch. Skipping ${files.length - maxFiles} file(s).`, variant: 'error' });
  }

  const allowedFiles = files.slice(0, maxFiles);

  for (const file of allowedFiles) {
    const draftIndex = drafts.value.push({
      image_url: '',
      image_public_id: '',
      name: file.name.split('.')[0] || '',
      price: 0,
      stock: 0,
      category_id: globalCategoryId.value || '',
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
    const sigResult = await productsStore.getUploadSignature();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sigResult.apiKey);
    formData.append('timestamp', String(sigResult.timestamp));
    formData.append('signature', sigResult.signature);
    formData.append('folder', sigResult.folder);

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${sigResult.cloudName}/image/upload`;
    
    const response = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Cloudinary upload response failed');

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
}

async function submitDrafts(publish: boolean): Promise<void> {
  if (!canSave.value || isSaving.value) return;

  isSaving.value = true;
  try {
    const productsPayload: CreateProductInput[] = drafts.value.map(d => ({
      name: d.name.trim(),
      category_id: d.category_id || null,
      price: Number(d.price),
      stock: Number(d.stock),
      sku: d.sku.trim() || null,
      description: d.description.trim() || null,
      images: [{ image_url: d.image_url, image_public_id: d.image_public_id }],
      publish
    }));

    await productsStore.createBulk(productsPayload);
    pushToast({ message: `Successfully saved ${drafts.value.length} products`, variant: 'success' });
    
    drafts.value = [];
    globalCategoryId.value = '';
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
        <p class="page-subtitle">Upload and stage up to 10 products simultaneously with direct cloud image processing.</p>
      </div>
      <Button variant="ghost" @click="router.push({ name: 'products' })">Back to Catalog</Button>
    </header>

    <div class="category-pre-setup card" v-if="drafts.length === 0">
      <div class="card-heading">
        <Layers :size="20" class="card-icon" />
        <h3 class="setup-title">Prepare Catalog Categories First</h3>
      </div>
      <div class="category-adder-widget">
        <input
          v-model="newCategoryName"
          type="text"
          placeholder="New Category Name (e.g. Footwear)"
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
      <div class="global-bulk-card card">
        <div class="batch-status-info">
          <span class="batch-count-badge tabular-figure">{{ drafts.length }} products staged</span>
          <span v-if="uploadCount > 0" class="uploading-status-hint">
            <RefreshCw :size="14" class="spin-icon" /> Uploading {{ uploadCount }} image(s)...
          </span>
        </div>

        <div class="global-actions-group">
          <div class="bulk-field">
            <select v-model="globalCategoryId" class="bulk-field__select">
              <option value="">Apply Category to All...</option>
              <option v-for="cat in productsStore.categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
            <Button variant="secondary" size="sm" :disabled="!globalCategoryId" @click="applyGlobalCategory">Apply</Button>
          </div>

          <div class="bulk-add-more">
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
            <label for="bulk-photo-picker-more" class="add-more-label" :class="{ 'add-more-label--disabled': drafts.length >= 10 }">
              <Plus :size="16" /> Add More Photos
            </label>
          </div>
        </div>
      </div>

      <div class="draft-stack">
        <div v-for="(draft, idx) in drafts" :key="idx" class="draft-card card">
          <button class="draft-card__remove" type="button" title="Remove draft" @click="removeDraft(idx)">
            <Trash2 :size="16" />
          </button>
          
          <div class="draft-card__layout">
            <div class="draft-card__media">
              <div v-if="draft.uploading" class="draft-card__loader">
                <span class="spinner"></span>
                <span>Uploading...</span>
              </div>
              <div v-else-if="draft.error" class="draft-card__error-media">
                <span>⚠️ {{ draft.error }}</span>
                <button type="button" class="retry-btn" @click="productsStore.fetchCategories()">Retry</button>
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

      <footer class="form-actions-panel">
        <Button variant="ghost" @click="drafts = []">Clear Batch</Button>
        <div class="form-actions-panel__rights">
          <Button variant="secondary" :disabled="!canSave || isSaving" :loading="isSaving" @click="submitDrafts(false)">
            Save as Drafts
          </Button>
          <Button variant="primary" :disabled="!canSave || isSaving" :loading="isSaving" @click="submitDrafts(true)">
            Save &amp; Publish All
          </Button>
        </div>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.add-products-container {
  padding: var(--space-6);
  max-width: 900px;
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
  padding: var(--space-6);
  margin-bottom: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.card-heading { display: flex; align-items: center; gap: var(--space-2); }
.card-icon { color: var(--color-ink); }
.setup-title { font-size: var(--text-base); font-weight: 600; color: var(--color-text); }

.category-adder-widget {
  display: flex;
  gap: var(--space-3);
  max-width: 500px;
}

.category-selector-preview {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.preview-label { font-size: var(--text-xs); color: var(--color-text-muted); font-weight: 600; margin-right: var(--space-2); }

.category-tag {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 2px var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text);
}

.upload-trigger-area {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  transition: border-color var(--duration-fast) var(--ease-standard);
  cursor: pointer;
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
  width: 100%;
  gap: var(--space-3);
}

.picker-text { font-weight: 600; color: var(--color-text); font-size: var(--text-lg); }
.picker-subtext { font-size: var(--text-xs); color: var(--color-text-muted); }

.global-bulk-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-6);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  border: 1px solid var(--color-border);
}

.batch-status-info { display: flex; align-items: center; gap: var(--space-4); }

.batch-count-badge {
  background: color-mix(in srgb, var(--color-ink) 10%, transparent);
  color: var(--color-ink);
  font-size: var(--text-xs);
  font-weight: 700;
  padding: 4px var(--space-3);
  border-radius: var(--radius-full);
}

.uploading-status-hint {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-gold-hover);
  font-weight: 600;
}

.spin-icon { animation: draft-spin 1s linear infinite; }

.global-actions-group { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }

.bulk-field { display: flex; align-items: center; gap: var(--space-2); }
.bulk-field__select {
  min-height: 36px; padding: 0 var(--space-3);
  background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: var(--text-xs); color: var(--color-text); outline: none;
}

.add-more-label {
  display: inline-flex; align-items: center; gap: var(--space-2);
  background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); min-height: 36px; padding: 0 var(--space-4);
  font-size: var(--text-xs); font-weight: 600; cursor: pointer; color: var(--color-text);
}
.add-more-label--disabled { opacity: 0.5; cursor: not-allowed; }

.draft-stack { display: flex; flex-direction: column; gap: var(--space-4); }

.draft-card {
  position: relative;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-5);
}

.draft-card__remove {
  position: absolute; top: var(--space-3); right: var(--space-3);
  border: none; background: transparent; color: var(--color-text-muted);
  cursor: pointer; padding: 4px; border-radius: var(--radius-sm);
}
.draft-card__remove:hover { color: var(--color-market-clay); background: var(--color-bg); }

.draft-card__layout { display: flex; gap: var(--space-5); flex-direction: column; }
@media (min-width: 640px) { .draft-card__layout { flex-direction: row; } }

.draft-card__media {
  width: 100%; height: 130px; border-radius: var(--radius-md);
  background: var(--color-bg); overflow: hidden; display: flex;
  align-items: center; justify-content: center; border: 1px solid var(--color-border);
}
@media (min-width: 640px) { .draft-card__media { width: 130px; flex-shrink: 0; } }

.draft-card__img { width: 100%; height: 100%; object-fit: cover; }
.draft-card__loader { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); font-size: var(--text-xs); color: var(--color-text-muted); }

.spinner {
  width: 20px; height: 20px; border: 2px solid var(--color-border);
  border-top-color: var(--color-ink); border-radius: 50%; animation: draft-spin 0.8s linear infinite;
}

@keyframes draft-spin { to { transform: rotate(360deg); } }

.draft-card__form { flex: 1; display: flex; flex-direction: column; gap: var(--space-3); }

.form-row { display: flex; gap: var(--space-3); flex-direction: column; }
@media (min-width: 640px) { .form-row { flex-direction: row; } }

.form-group { flex: 1; display: flex; flex-direction: column; gap: var(--space-1); }
.flex-2 { flex: 2; }
.flex-1 { flex: 1; }

.form-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); }

.form-input, .form-select {
  min-height: 40px; padding: 0 var(--space-3);
  background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--color-text); outline: none;
}
.form-input:focus, .form-select:focus { border-color: var(--color-ink); }

.form-actions-panel {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: var(--space-8); flex-wrap: wrap; gap: var(--space-4);
}
.form-actions-panel__rights { display: flex; gap: var(--space-3); }
</style>