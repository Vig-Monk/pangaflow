// =============================================================================
// soko-frontend/src/composables/useScrollAnimation.ts
// Senior-grade, dependency-free scroll reveal, parallax, and 3D card tilt engine.
// Powered by native IntersectionObserver and requestAnimationFrame.
// =============================================================================

import { ref, onMounted, onUnmounted, type Ref } from 'vue';

export interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  staggerMs?: number;
}

export interface CardTiltOptions {
  maxRotationDeg?: number;
  perspectivePx?: number;
  scale?: number;
  disabled?: boolean;
}

/**
 * Checks if user has requested reduced motion at system level.
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 1. SCROLL REVEAL COMPOSABLE
 * Automatically observes elements carrying `[data-reveal]` or explicit ref containers.
 * Applies `.is-revealed` class with staggered hardware-accelerated transitions.
 */
export function useScrollReveal(options: ScrollRevealOptions = {}) {
  const {
    threshold = 0.15,
    rootMargin = '0px 0px -40px 0px',
    once = true,
    staggerMs = 80,
  } = options;

  const containerRef = ref<HTMLElement | null>(null);
  let observer: IntersectionObserver | null = null;

  function initObserver(rootElement?: HTMLElement | null): void {
    if (typeof window === 'undefined' || isReducedMotionPreferred()) {
      // If reduced motion is preferred or SSR, reveal immediately
      const scope = rootElement || containerRef.value || document;
      scope.querySelectorAll('[data-reveal]').forEach((el) => {
        el.classList.add('is-revealed');
      });
      return;
    }

    const scope = rootElement || containerRef.value || document;
    const elements = Array.from(scope.querySelectorAll<HTMLElement>('[data-reveal]'));

    if (elements.length === 0) return;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = el.dataset.revealDelay
              ? parseInt(el.dataset.revealDelay, 10)
              : 0;

            setTimeout(() => {
              el.classList.add('is-revealed');
            }, delay);

            if (once) {
              observer?.unobserve(el);
            }
          } else if (!once) {
            (entry.target as HTMLElement).classList.remove('is-revealed');
          }
        });
      },
      { threshold, rootMargin }
    );

    // Apply auto-stagger indices to groups if data-reveal-group is found
    const groups = new Map<string, HTMLElement[]>();
    elements.forEach((el) => {
      const groupName = el.dataset.revealGroup;
      if (groupName) {
        if (!groups.has(groupName)) groups.set(groupName, []);
        groups.get(groupName)!.push(el);
      } else {
        observer?.observe(el);
      }
    });

    groups.forEach((groupElements) => {
      groupElements.forEach((el, index) => {
        if (!el.dataset.revealDelay) {
          el.dataset.revealDelay = String(index * staggerMs);
        }
        observer?.observe(el);
      });
    });
  }

  function destroyObserver(): void {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  onMounted(() => {
    initObserver();
  });

  onUnmounted(() => {
    destroyObserver();
  });

  return {
    containerRef,
    initObserver,
    destroyObserver,
  };
}

/**
 * 2. 3D BENTO CARD TILT (Micro-Parallax on Cursor Hover)
 * Calculates smooth perspective rotation angles on mouse movements with spring damping.
 */
export function useCardTilt(cardRef: Ref<HTMLElement | null>, options: CardTiltOptions = {}) {
  const {
    maxRotationDeg = 6,
    perspectivePx = 1000,
    scale = 1.015,
    disabled = false,
  } = options;

  let isHovered = false;
  let rafId: number | null = null;

  // Target values
  let targetRotateX = 0;
  let targetRotateY = 0;
  let targetScale = 1;

  // Current interpolated values (smooth spring damping)
  let currentRotateX = 0;
  let currentRotateY = 0;
  let currentScale = 1;

  function lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  function updateTransform(): void {
    if (!cardRef.value) return;

    currentRotateX = lerp(currentRotateX, targetRotateX, 0.12);
    currentRotateY = lerp(currentRotateY, targetRotateY, 0.12);
    currentScale = lerp(currentScale, targetScale, 0.12);

    cardRef.value.style.transform = `perspective(${perspectivePx}px) rotateX(${currentRotateX.toFixed(2)}deg) rotateY(${currentRotateY.toFixed(2)}deg) scale3d(${currentScale.toFixed(3)}, ${currentScale.toFixed(3)}, 1)`;

    // Continue animating until settled
    if (isHovered || Math.abs(currentRotateX) > 0.05 || Math.abs(currentRotateY) > 0.05) {
      rafId = requestAnimationFrame(updateTransform);
    } else {
      cardRef.value.style.transform = '';
      rafId = null;
    }
  }

  function handleMouseMove(e: MouseEvent): void {
    if (disabled || isReducedMotionPreferred() || !cardRef.value) return;

    const rect = cardRef.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Normalised offset (-1 to 1)
    const normalizedX = (x - centerX) / centerX;
    const normalizedY = (y - centerY) / centerY;

    targetRotateX = -normalizedY * maxRotationDeg;
    targetRotateY = normalizedX * maxRotationDeg;
    targetScale = scale;

    if (!rafId) {
      rafId = requestAnimationFrame(updateTransform);
    }
  }

  function handleMouseEnter(): void {
    if (disabled || isReducedMotionPreferred()) return;
    isHovered = true;
  }

  function handleMouseLeave(): void {
    isHovered = false;
    targetRotateX = 0;
    targetRotateY = 0;
    targetScale = 1;
    if (!rafId) {
      rafId = requestAnimationFrame(updateTransform);
    }
  }

  onMounted(() => {
    if (!cardRef.value || disabled || isReducedMotionPreferred()) return;

    cardRef.value.style.willChange = 'transform';
    cardRef.value.style.transformStyle = 'preserve-3d';

    cardRef.value.addEventListener('mousemove', handleMouseMove);
    cardRef.value.addEventListener('mouseenter', handleMouseEnter);
    cardRef.value.addEventListener('mouseleave', handleMouseLeave);
  });

  onUnmounted(() => {
    if (rafId) cancelAnimationFrame(rafId);
    if (cardRef.value) {
      cardRef.value.removeEventListener('mousemove', handleMouseMove);
      cardRef.value.removeEventListener('mouseenter', handleMouseEnter);
      cardRef.value.removeEventListener('mouseleave', handleMouseLeave);
    }
  });

  return {};
}

/**
 * 3. SMOOTH SCROLL PARALLAX SPEED OFFSET
 * Moves background nodes or decorative badges at variable scroll speeds.
 */
export function useScrollParallax() {
  const scrollY = ref(0);
  let rafId: number | null = null;

  function onScroll(): void {
    if (isReducedMotionPreferred()) return;

    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        scrollY.value = window.scrollY || window.pageYOffset;
        rafId = null;
      });
    }
  }

  onMounted(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });

  onUnmounted(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('scroll', onScroll);
    if (rafId) cancelAnimationFrame(rafId);
  });

  return {
    scrollY,
  };
}