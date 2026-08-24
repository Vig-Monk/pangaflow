<script setup lang="ts">
// =============================================================================
// soko-frontend/src/components/landing/FaqConcierge.vue
// Accordion FAQ resolving trust, M-Pesa, and hardware questions + WhatsApp Concierge.
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
    a: 'KauntaOS supports both standard Buy Goods (Till numbers) and Paybills. You can connect your Till in 3 minutes by pasting your Consumer Key, Consumer Secret, and Passkey from the Safaricom Daraja developer portal.',
  },
  {
    q: 'How does the 4-digit Boda delivery handover code protect me?',
    a: 'When an order is placed, KauntaOS generates an unambiguous 4-digit verification code (e.g. 7K9M) sent only to the customer. When your rider arrives, they must obtain and enter this code in the app to mark the package delivered, eliminating parcel theft and false delivery claims.',
  },
  {
    q: 'Can I run KauntaOS on an affordable Android smartphone?',
    a: 'Yes. KauntaOS is engineered specifically for mobile touch targets (48px+) and fast loading over Kenyan 3G and 4G networks. It runs smoothly on any smartphone with zero heavy app downloads required.',
  },
  {
    q: 'What if a customer does not have internet access?',
    a: 'You can still use KauntaOS Smart POS to record their transaction as Cash or Credit (Madeni). KauntaOS will generate a pre-formatted WhatsApp statement or SMS text that you can forward with one tap.',
  },
];

const openIndices = ref<number[]>([0]);

function toggleFaq(index: number): void {
  const pos = openIndices.value.indexOf(index);
  if (pos >= 0) openIndices.value.splice(pos, 1);
  else openIndices.value.push(index);
}

const whatsappHelpUrl =
  'https://wa.me/254700000000?text=' +
  encodeURIComponent("Hi KauntaOS Team, I run a shop in Kenya and would like help setting up my Till, online storefront, and Madeni ledger.");
</script>

<template>
  <section id="faq" class="faq-section">
    <!-- Title -->
    <div class="section-title-block" data-reveal="zoom">
      <span class="section-tag">Direct Answers</span>
      <h2 class="section-heading">Frequently Asked Questions</h2>
      <p class="section-desc">Got questions about connecting your Till, tracking debt, or dispatching bodas?</p>
    </div>

    <!-- Accordion Stack -->
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
        <div class="wa-icon-box">
          <MessageSquare :size="22" class="text-teal" />
        </div>
        <div>
          <h3 class="wa-banner-title">Prefer having our team set it up for you?</h3>
          <p class="wa-banner-desc">Chat directly with our Nairobi onboarding team on WhatsApp for a 5-minute guided setup.</p>
        </div>
      </div>
      <a
        :href="whatsappHelpUrl"
        target="_blank"
        rel="noopener"
        class="btn-wa-direct"
      >
        <MessageSquare :size="16" /> Chat on WhatsApp ↗
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

.section-tag {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--brand-primary, #D91E4E);
  letter-spacing: 0.05em;
}

.section-heading {
  font-family: var(--font-display);
  font-size: clamp(24px, 2.5vw, 34px);
  font-weight: 800;
  color: #F3F6F4;
  letter-spacing: -0.02em;
}

.section-desc {
  font-size: 13px;
  color: #94A3B8;
}

.faq-accordion-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.faq-item {
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-md, 10px);
  overflow: hidden;
  transition: border-color 150ms ease;
}

.faq-item.open {
  border-color: #2F453E;
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
  background: color-mix(in srgb, #1F9D55 10%, var(--surface-panel, #111816));
  border: 1px solid #1F9D55;
  border-radius: var(--radius-lg, 16px);
  padding: 22px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.wa-banner-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.wa-icon-box {
  width: 42px;
  height: 42px;
  background: color-mix(in srgb, #1F9D55 18%, transparent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wa-banner-title {
  font-size: 15px;
  font-weight: 700;
  color: #F3F6F4;
}

.wa-banner-desc {
  font-size: 12px;
  color: #94A3B8;
  margin-top: 2px;
}

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
  transition: opacity 120ms ease, transform 120ms ease;
}

.btn-wa-direct:hover {
  opacity: 0.95;
  transform: translateY(-1px);
}

.text-teal { color: #34D399; }
</style>