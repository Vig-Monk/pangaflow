<script setup lang="ts">
// =============================================================================
// KauntaOS-frontend/src/components/landing/ArchitectureFlow.vue
// Animated Zero-Custody M-Pesa Pipeline proving KauntaOS never touches merchant money.
// =============================================================================

import { ref } from 'vue';
import {
  Smartphone,
  Server,
  Lock,
  Database,
  CheckCircle2,
  Zap,
} from 'lucide-vue-next';

const isPulseActive = ref(false);

function triggerPulse(): void {
  if (isPulseActive.value) return;
  isPulseActive.value = true;
  setTimeout(() => {
    isPulseActive.value = false;
  }, 2200);
}
</script>

<template>
  <div class="architecture-card card">
    <div class="arch-header">
      <div class="title-row">
        <Lock :size="18" class="text-teal" />
        <h3 class="arch-title">Zero-Custody M-Pesa Architecture</h3>
      </div>
      <button type="button" class="pulse-trigger-btn" @click="triggerPulse">
        <Zap :size="13" /> Simulate Money Flow
      </button>
    </div>

    <p class="arch-tagline">
      Customers pay <strong>directly into your own Till / Paybill</strong> via Safaricom Daraja. KauntaOS never holds, aggregates, or touches your money.
    </p>

    <!-- Visual 4-Node Pipeline -->
    <div class="pipeline-grid" :class="{ 'pulse-running': isPulseActive }">
      <!-- Node 1: Customer Phone -->
      <div class="pipe-node node-1">
        <div class="node-icon-box">
          <Smartphone :size="20" />
        </div>
        <span class="node-title">1. Shopper Phone</span>
        <span class="node-sub">Enters M-Pesa PIN</span>
      </div>

      <!-- Connector 1 -->
      <div class="pipe-connector connector-1">
        <div class="connector-line"></div>
        <div class="pulse-particle"></div>
      </div>

      <!-- Node 2: Safaricom Daraja Gateway -->
      <div class="pipe-node node-2">
        <div class="node-icon-box node-icon-box--safaricom">
          <Server :size="20" />
        </div>
        <span class="node-title">2. Safaricom Gateway</span>
        <span class="node-sub">Direct STK Settlement</span>
      </div>

      <!-- Connector 2 -->
      <div class="pipe-connector connector-2">
        <div class="connector-line"></div>
        <div class="pulse-particle"></div>
      </div>

      <!-- Node 3: Merchant's Own Till / Paybill -->
      <div class="pipe-node node-3 node-highlight">
        <div class="node-icon-box node-icon-box--till">
          <CheckCircle2 :size="20" />
        </div>
        <span class="node-title">3. Your Till (174379)</span>
        <span class="node-sub text-teal font-bold">100% Cash Lands Here</span>
      </div>

      <!-- Connector 3 -->
      <div class="pipe-connector connector-3">
        <div class="connector-line"></div>
        <div class="pulse-particle"></div>
      </div>

      <!-- Node 4: KauntaOS Cloud Operating System -->
      <div class="pipe-node node-4">
        <div class="node-icon-box">
          <Database :size="20" />
        </div>
        <span class="node-title">4. KauntaOS Cloud OS</span>
        <span class="node-sub">Only logs receipt &amp; stock</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.architecture-card {
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-lg, 16px);
  padding: var(--space-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.arch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.title-row { display: flex; align-items: center; gap: 8px; }
.arch-title { font-size: var(--text-base, 16px); font-weight: 700; color: var(--text-paper, #F3F6F4); }

.pulse-trigger-btn {
  background: color-mix(in srgb, #1F9D55 18%, transparent);
  border: 1px solid #1F9D55;
  color: #34D399;
  padding: 4px 10px;
  border-radius: var(--radius-full, 99px);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.arch-tagline {
  font-size: var(--text-xs, 12px);
  color: var(--color-text-muted, #869E96);
  max-width: 680px;
  line-height: 1.5;
}

.pipeline-grid {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 0;
  overflow-x: auto;
}

@media (max-width: 768px) {
  .pipeline-grid {
    flex-direction: column;
    align-items: stretch;
  }
}

.pipe-node {
  flex: 1;
  background: var(--color-bg, #090D0C);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: var(--radius-md, 10px);
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  min-width: 130px;
}

.node-highlight {
  border-color: #1F9D55;
  background: color-mix(in srgb, #1F9D55 10%, var(--color-bg, #090D0C));
}

.node-icon-box {
  width: 38px;
  height: 38px;
  background: var(--surface-panel, #111816);
  border: 1px solid var(--border-color, #1F2E29);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-paper, #F3F6F4);
  margin-bottom: 2px;
}

.node-icon-box--safaricom { color: #16A34A; }
.node-icon-box--till { background: #16A34A; color: #FFFFFF; border-color: #16A34A; }

.node-title { font-size: 11px; font-weight: 700; color: var(--text-paper, #F3F6F4); }
.node-sub { font-size: 10px; color: var(--color-text-muted, #869E96); }

.pipe-connector {
  flex: 0.6;
  position: relative;
  height: 2px;
  background: var(--border-color, #1F2E29);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
}

@media (max-width: 768px) {
  .pipe-connector {
    width: 2px;
    height: 20px;
    align-self: center;
  }
}

.pulse-particle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: #34D399;
  border-radius: 50%;
  opacity: 0;
}

.pulse-running .connector-1 .pulse-particle {
  animation: flow1 0.6s linear forwards;
}

.pulse-running .connector-2 .pulse-particle {
  animation: flow2 0.6s linear 0.6s forwards;
}

.pulse-running .connector-3 .pulse-particle {
  animation: flow3 0.6s linear 1.2s forwards;
}

@keyframes flow1 {
  0% { left: 0; opacity: 1; }
  100% { left: 100%; opacity: 0; }
}

@keyframes flow2 {
  0% { left: 0; opacity: 1; }
  100% { left: 100%; opacity: 0; }
}

@keyframes flow3 {
  0% { left: 0; opacity: 1; }
  100% { left: 100%; opacity: 0; }
}

.text-teal { color: #34D399; }
</style>