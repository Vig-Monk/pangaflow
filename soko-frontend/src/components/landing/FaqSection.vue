<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/FaqSection.vue
// Quiet single-column centered accordion (760px) without colorful banners.
// =============================================================================

import { ref } from 'vue';
import { ChevronDown } from 'lucide-vue-next';

interface FaqItem {
  q: string;
  a: string;
}

const faqs: FaqItem[] = [
  {
    q: 'Does Soko hold my money when customers pay?',
    a: 'No. Soko connects directly to your own M-Pesa Buy Goods Till or Paybill via Safaricom Daraja. Payments land 100% in your business till immediately.',
  },
  {
    q: 'Can I use Soko on an Android smartphone?',
    a: 'Yes. Soko is designed to work smoothly on mobile browsers over standard 3G and 4G connections with no heavy app downloads required.',
  },
  {
    q: 'How does delivery verification work?',
    a: 'When an online order is placed, Soko generates a unique 4-digit code given to the customer. When your rider arrives, they enter this code to verify handover.',
  },
  {
    q: 'What happens when customer debt is recorded?',
    a: 'Balances are updated in your digital ledger automatically. You can generate and send pre-filled WhatsApp statement reminders with one tap.',
  },
];

const openIndex = ref<number | null>(0);

function toggle(index: number): void {
  openIndex.value = openIndex.value === index ? null : index;
}
</script>

<template>
  <section id="faq" class="faq-section">
    <div class="faq-container">
      <div class="faq-header">
        <h2 class="faq-heading">Frequently asked questions.</h2>
      </div>

      <div class="faq-list">
        <div
          v-for="(faq, idx) in faqs"
          :key="idx"
          class="faq-item"
          :class="{ open: openIndex === idx }"
        >
          <button type="button" class="faq-question" @click="toggle(idx)">
            <span>{{ faq.q }}</span>
            <ChevronDown :size="18" class="chevron-icon" />
          </button>
          <div v-if="openIndex === idx" class="faq-answer">
            <p>{{ faq.a }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.faq-section {
  max-width: 800px;
  margin: 0 auto;
  padding: 80px 24px 100px;
}

.faq-container {
  display: flex;
  flex-direction: column;
  gap: 36px;
}

.faq-header {
  text-align: center;
}

.faq-heading {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: clamp(28px, 3.5vw, 38px);
  font-weight: 600;
  color: var(--landing-text, #171514);
}

.faq-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--landing-border, #E8E4E0);
}

.faq-item {
  border-bottom: 1px solid var(--landing-border, #E8E4E0);
}

.faq-question {
  width: 100%;
  padding: 20px 0;
  background: transparent;
  border: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 16px;
  font-weight: 600;
  color: var(--landing-text, #171514);
  text-align: left;
  cursor: pointer;
}

.chevron-icon {
  color: var(--landing-muted, #6F6A67);
  transition: transform 180ms ease;
  flex-shrink: 0;
}

.faq-item.open .chevron-icon {
  transform: rotate(180deg);
  color: var(--landing-text, #171514);
}

.faq-answer {
  padding: 0 0 20px;
  font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
  font-size: 14px;
  color: var(--landing-muted, #6F6A67);
  line-height: 1.6;
}
</style>