// =============================================================================
// soko-frontend/src/router/index.ts
// =============================================================================

import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const routes: RouteRecordRaw[] = [
    {
        path: "/login",
        name: "login",
        component: () => import("@/views/LoginView.vue"),
        meta: { requiresAuth: false, layout: "auth" }
    },
    {
        path: "/register",
        name: "register",
        component: () => import("@/views/RegisterView.vue"),
        meta: { requiresAuth: false, layout: "auth" }
    },
    {
        path: "/",
        redirect: "/dashboard"
    },
    {
        path: "/dashboard",
        name: "dashboard",
        component: () => import("@/views/DashboardView.vue"),
        meta: { requiresAuth: true, layout: "merchant" }
    },
    {
        path: "/customers",
        name: "customers",
        component: () => import("@/views/CustomersView.vue"),
        meta: { requiresAuth: true, layout: "merchant" }
    },
    {
        path: "/customers/:id",
        name: "customer-detail",
        component: () => import("@/views/CustomerDetailView.vue"),
        meta: { requiresAuth: true, layout: "merchant" },
        props: true
    },
    {
        path: "/expenses",
        name: "expenses",
        component: () => import("@/views/ExpensesView.vue"),
        meta: { requiresAuth: true, layout: "merchant" }
    },
    {
        path: "/expenses/summary",
        name: "expenses-summary",
        component: () => import("@/views/ExpenseSummaryView.vue"),
        meta: { requiresAuth: true, layout: "merchant" }
    },
    {
        path: "/settings/plan",
        name: "plan",
        component: () => import("@/views/PlanView.vue"),
        meta: { requiresAuth: true, layout: "merchant" }
    },
    {
        path: "/settings/mpesa",
        name: "mpesa-setup",
        component: () => import("@/views/MpesaSetupView.vue"),
        meta: { requiresAuth: true, layout: "merchant" }
    },
    {
        path: "/products",
        name: "products",
        component: () => import("@/views/ProductsView.vue"),
        meta: { requiresAuth: true, layout: "merchant" }
    },
    {
        path: "/products/add",
        name: "products-add",
        component: () => import("@/views/ProductsAddView.vue"),
        meta: { requiresAuth: true, layout: "merchant" }
    },
    {
        path: "/products/:id/edit",
        name: "product-edit",
        component: () => import("@/views/ProductEditView.vue"),
        meta: { requiresAuth: true, layout: "merchant" },
        props: true
    },
    {
        path: "/inventory",
        name: "inventory",
        component: () => import("@/views/InventoryView.vue"),
        meta: { requiresAuth: true, layout: "merchant" }
    },
    {
        path: "/settings/store",
        name: "store-settings",
        component: () => import("@/views/StoreSettingsView.vue"),
        meta: { requiresAuth: true, layout: "merchant" }
    },
    {
        path: "/store/:storeSlug",
        name: "storefront-home",
        component: () => import("@/views/storefront/StoreHomeView.vue"),
        meta: { requiresAuth: false, layout: "storefront" },
        props: true
    },
    {
        path: "/store/:storeSlug/products/:productSlug",
        name: "storefront-product-detail",
        component: () => import("@/views/storefront/ProductDetailView.vue"),
        meta: { requiresAuth: false, layout: "storefront" },
        props: true
    },
    {
        path: "/store/:storeSlug/cart",
        name: "storefront-cart",
        component: () => import("@/views/storefront/CartView.vue"),
        meta: { requiresAuth: false, layout: "storefront" },
        props: true
    },
    {
        path: "/store/:storeSlug/checkout",
        name: "storefront-checkout",
        component: () => import("@/views/storefront/CheckoutView.vue"),
        meta: { requiresAuth: false, layout: "storefront" },
        props: true
    },
    {
        path: "/store/:storeSlug/order/:orderId",
        name: "storefront-order-confirmation",
        component: () => import("@/views/storefront/OrderConfirmationView.vue"),
        meta: { requiresAuth: false, layout: "storefront" },
        props: true
    },
    {
        path: "/orders",
        name: "merchant-orders",
        component: () => import("@/views/storefront/OrdersView.vue"),
        meta: { requiresAuth: true, layout: "merchant" }
    },
    {
        path: "/orders/:id",
        name: "merchant-order-detail",
        component: () => import("@/views/storefront/OrderDetailView.vue"),
        meta: { requiresAuth: true, layout: "merchant" },
        props: true
    },
    {
        path: "/:pathMatch(.*)*",
        redirect: "/dashboard"
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach(to => {
    const authStore = useAuthStore();
    const requiresAuth = to.meta.requiresAuth !== false;

    if (requiresAuth && !authStore.isAuthenticated) {
        return { name: "login", query: { redirect: to.fullPath } };
    }

    if (
        !requiresAuth &&
        authStore.isAuthenticated &&
        (to.name === "login" || to.name === "register")
    ) {
        return { name: "dashboard" };
    }

    return true;
});

export default router;