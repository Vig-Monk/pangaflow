// =============================================================================
// src/router/index.ts
// Vue Router — route table + auth guard.
// =============================================================================

import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/customers',
    name: 'customers',
    component: () => import('@/views/CustomersListView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/customers/:id',
    name: 'customer-detail',
    component: () => import('@/views/CustomerDetailView.vue'),
    meta: { requiresAuth: true },
    props: true,
  },
  {
    // Catch-all — redirect unknown paths to dashboard (or login, via guard)
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
{
  path: '/agent',
  name: 'agent-dashboard',
  component: () => import('@/views/AgentDashboardView.vue'),
  meta: { requiresAuth: true },
}
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  const requiresAuth = to.meta.requiresAuth !== false;

  if (requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (!requiresAuth && authStore.isAuthenticated && (to.name === 'login' || to.name === 'register')) {
    // Already logged in — no reason to show the login/register screen again
    return { name: 'dashboard' };
  }

  return true;
});

export default router;