<script setup lang="ts">
// =============================================================================
// src/components/ui/Modal.vue
// Slot-based body + footer. Focus-trapped. Escape closes (unless
// persistent). Backdrop click closes (unless persistent).
// =============================================================================

import { nextTick, ref, watch } from 'vue';

interface Props {
  open: boolean;
  title: string;
  persistent?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  persistent: false,
});

const emit = defineEmits<{ close: [] }>();

const modalRef = ref<HTMLElement | null>(null);
let previouslyFocusedElement: HTMLElement | null = null;

// ---------------------------------------------------------------------------
// Focus trap — real, not decorative.
//
// On open: remember what was focused before the modal (so focus can
// return there on close, which matters for keyboard/screen-reader users
// who'd otherwise lose their place in the page), then move focus into
// the modal itself.
//
// While open: Tab/Shift+Tab cycle only among the modal's own focusable
// elements, so focus can never silently escape to something behind the
// backdrop.
// ---------------------------------------------------------------------------

function getFocusableElements(): HTMLElement[] {
  if (!modalRef.value) return [];
  const selector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(modalRef.value.querySelectorAll<HTMLElement>(selector));
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && !props.persistent) {
    emit('close');
    return;
  }

  if (event.key !== 'Tab') return;

  const focusable = getFocusableElements();
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function handleBackdropClick(): void {
  if (!props.persistent) {
    emit('close');
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocusedElement = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', handleKeydown);
      await nextTick();
      const focusable = getFocusableElements();
      (focusable[0] ?? modalRef.value)?.focus();
    } else {
      document.removeEventListener('keydown', handleKeydown);
      previouslyFocusedElement?.focus();
    }
  }
);
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="modal-backdrop" @click.self="handleBackdropClick">
        <div
          ref="modalRef"
          class="modal"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
        >
          <header class="modal__header">
            <h2 class="modal__title">{{ title }}</h2>
            <button
              v-if="!persistent"
              class="modal__close"
              type="button"
              aria-label="Close"
              @click="emit('close')"
            >
              ×
            </button>
          </header>

          <div class="modal__body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 61, 62, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 100;
}

.modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  outline: none;
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.modal__title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
}

.modal__close {
  background: transparent;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}
.modal__close:hover { background: var(--color-bg); color: var(--color-text); }

.modal__body {
  padding: var(--space-6);
  overflow-y: auto;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-top: 1px solid var(--color-border);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard);
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .modal-fade-enter-active,
  .modal-fade-leave-active {
    transition: none;
  }
}
</style>