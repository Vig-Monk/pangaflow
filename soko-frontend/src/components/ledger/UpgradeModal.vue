<script setup lang="ts">
// =============================================================================
// src/components/ledger/UpgradeModal.vue
// Built from LimitReachedDetails. Contact-instruction copy, no real
// billing action — matches org.ts's requestUpgrade() placeholder
// exactly (see the org.ts patch delivered alongside this file).
// =============================================================================

import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import type { LimitReachedDetails } from '@/stores/org';

interface Props {
  open: boolean;
  details: LimitReachedDetails | null;
}

defineProps<Props>();

const emit = defineEmits<{ close: [] }>();

function formatPrice(priceKes: number): string {
  return `KES ${priceKes.toLocaleString('en-KE')}/mo`;
}
</script>

<template>
  <Modal :open="open" title="You've reached your plan limit" @close="emit('close')">
    <div class="upgrade-content">
      <p v-if="details" class="upgrade-message">
        You're on the {{ details.currentPlan }} plan
        ({{ details.currentCount }}/{{ details.limit }} customers used).
        Upgrade to add more.
      </p>

      <div v-if="details" class="upgrade-options">
        <div v-for="opt in details.upgradeOptions" :key="opt.plan" class="upgrade-option">
          <span class="upgrade-option__label">{{ opt.label }}</span>
          <span class="upgrade-option__price tabular-figure">{{ formatPrice(opt.price_kes) }}</span>
        </div>
      </div>

      <p class="upgrade-contact">
        To upgrade, contact us — self-service billing is coming soon.
      </p>
    </div>

    <template #footer>
      <Button variant="ghost" @click="emit('close')">Maybe later</Button>
      <a href="mailto:hello@soko.app?subject=Plan%20upgrade" class="upgrade-contact-btn">
        <Button variant="primary">Contact Us</Button>
      </a>
    </template>
  </Modal>
</template>

<style scoped>
.upgrade-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.upgrade-message {
  color: var(--color-text);
  line-height: var(--leading-relaxed);
}

.upgrade-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.upgrade-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg);
  border-radius: var(--radius-md);
}

.upgrade-option__label {
  font-weight: 600;
  color: var(--color-text);
}

.upgrade-option__price {
  color: var(--color-gold-hover);
  font-weight: 600;
}

.upgrade-contact {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.upgrade-contact-btn {
  text-decoration: none;
}
</style>