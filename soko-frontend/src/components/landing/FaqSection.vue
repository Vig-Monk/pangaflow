<script setup lang="ts">
// =============================================================================
// KauntaOS-frontend/src/components/landing/FaqSection.vue
// Accordion FAQ resolving Kenyan trust, M-Pesa, tax, and hardware questions.
// =============================================================================

import { ref } from 'vue';
import { ChevronDown, MessageSquare } from 'lucide-vue-next';

interface FaqItem {
  q: string;
  a: string;
}

const faqs: FaqItem[] = [
  {
    q: 'Does KauntaOS hold, deduct, or delay my money when customers pay?',
    a: 'No. Never. KauntaOS operates on a zero-custody model. Customer payments via M-Pesa STK Push route directly through Safaricom Daraja into your own Buy Goods Till or Paybill. 100% of the cash lands immediately in your till.',
  },
  {
    q: 'Can I use KauntaOS with a Buy Goods Till number or do I need a Paybill?',
    a: 'KauntaOS supports both standard Buy Goods (Till numbers) and Paybills. You can connect your Till by pasting your Consumer Key, Consumer Secret, and Passkey from the Safaricom Daraja developer portal.',
  },
  {
    q: 'How does the 4-digit Boda delivery handover code protect me?',
    a: 'When an order is placed, KauntaOS generates an unambiguous 4-digit verification code (e.g. 7K9M) sent only to the customer. When your rider arrives, they must obtain and enter this code in the app to mark the package delivered, preventing parcel theft and false delivery claims.',
  },
  {
    q: 'Can I run KauntaOS on an affordable Android phone?',
    a: 'Yes. KauntaOS is engineered specifically for mobile touch targets (48px+) and fast loading over Kenyan 3G and 4G networks. It runs smoothly on any smartphone with zero heavy app installation required.',
  },
  {
    q: 'What if a customer does not have smartphone or internet?',
    a: 'You can still use KauntaOS Smart POS to record their transaction as Cash or Credit (Madeni). KauntaOS will generate a pre-formatted SMS or WhatsApp statement that you can forward with one click.',
  },
];

const openIndices = ref<number[]>([0]);

function toggleFaq(index: number): void {
  const pos = openIndices.value.indexOf(index);
  if (pos >= 0) openIndices.value.splice(pos, 1);
  else openIndices.value.push(index);
}
</script>

<template>
  <section id="faq" class="faq-section">
    <div class="section-title-block" data-reveal="zoom">
      <span class="section-tag">Frequently Asked Questions</span>
      <h2 class="section-heading">Everything You Need to Know</h2>
      <p class="section-desc">Got questions about connecting your Till, tracking debt, or dispatching bodas?</p>
    </div>

    <div class="faq-accordion-stack" data-reveal>
      <div
        v-for="(faq, idx) in faqs"
        :key="idx"
        class="faq-item card"
        :class="{ open: openIndices.includes(idx) }"
      >
        <button type="button" class="faq-question-btn" @click="toggleFaq(idx)">
          <span>{{ faq.q }}</span>
          <ChevronDown :size="18" class="faq-chevron" />
        </button>
        <div v-if="openIndices.includes(idx)" class="faq-answer-body">
          <p>{{ faq.a }}</p>
        </div>
      </div>
    </div>

    <!-- 1-Tap WhatsApp Concierge Callout Banner -->
    <div class="whatsapp-support-banner card" data-reveal="zoom">
      <div class="wa-banner-left">
        <MessageSquare :size="24" class="text-teal" />
        <div>
          <h3>Prefer talking directly to a human?</h3>
          <p>Chat with our Nairobi team on WhatsApp for a 5-minute personalized store setup.</p>
        </div>
      </div>
      <a
        href="https://wa.me/254700000000?text=Hi%20KauntaOS%2C%20I%20need%20help%20setting%20up%20my%20store%20and%20till."
        target="_blank"
        rel="noopener"
        class="btn-wa-direct"
      >
        <MessageSquare :size="16" /> Chat on WhatsApp
      </a>
    </div>
  </section>
</template>

<style scoped>
.faq-section {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 20px 80px;
}

.section-title-block {
  text-align: center;
  margin-bottom: 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.section-tag { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--brand-primary, #D91E4E); }
.section-heading { font-family: var(--font-display); font-size: clamp(24px, 2.5vw, 32px); font-weight: 800; color: #F3F6F4; }
.section-desc { font-size: 13px; color: #94A3B8; }

.faq-accordion-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.faq-item {
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-md, 10px);
  overflow: hidden;
}

.faq-question-btn {
  width: 100%;
  padding: 16px 20px;
  background: transparent;
  border: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  font-size: 14px;
  font-weight: 700;
  color: #F3F6F4;
  text-align: left;
  cursor: pointer;
}

.faq-chevron {
  color: #94A3B8;
  transition: transform 150ms ease;
  flex-shrink: 0;
}

.faq-item.open .faq-chevron {
  transform: rotate(180deg);
  color: var(--brand-primary, #D91E4E);
}

.faq-answer-body {
  padding: 0 20px 18px;
  font-size: 13px;
  color: #94A3B8;
  line-height: 1.6;
}

.whatsapp-support-banner {
  margin-top: 36px;
  background: color-mix(in srgb, #1F9D55 12%, var(--surface-panel, #111816));
  border: 1px solid #1F9D55;
  border-radius: var(--radius-lg, 16px);
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.wa-banner-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.wa-banner-left h3 { font-size: 15px; font-weight: 700; color: #F3F6F4; }
.wa-banner-left p { font-size: 12px; color: #94A3B8; margin-top: 2px; }

.btn-wa-direct {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #1F9D55;
  color: #FFFFFF;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
  padding: 10px 18px;
  border-radius: 8px;
  transition: opacity 120ms ease;
}
.btn-wa-direct:hover { opacity: 0.92; }

.text-teal { color: #34D399; }
</style>