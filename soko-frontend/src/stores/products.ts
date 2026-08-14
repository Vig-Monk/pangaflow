// =============================================================================
// soko-frontend/src/stores/products.ts
// =============================================================================

import { defineStore } from "pinia";
import {
    apiGet,
    apiPost,
    apiPatch,
    apiDelete,
    apiGetPaginated
} from "@/services/apiClient";

export interface ProductImage {
    image_url: string;
    image_public_id: string;
    sort_order: number;
}

export interface Product {
    id: string;
    org_id: string;
    category_id: string;
    category_name: string | null;
    name: string;
    slug: string;
    sku: string | null;
    description: string | null;
    cost_price: string | null;
    price: string;
    status: "draft" | "published" | "archived";
    created_at: string;
    updated_at: string;
    images: ProductImage[];
}

export interface InventoryItem {
    id: string;
    product_id: string;
    product_name: string;
    product_sku: string | null;
    stock: number;
    low_stock_at: number;
    updated_at: string;
}

export interface Category {
    id: string;
    name: string;
}

export interface CloudinarySignature {
    signature: string;
    timestamp: number;
    folder: string;
    apiKey: string;
    cloudName: string;
}

export interface CreateProductInput {
    name: string;
    category_id: string;
    price: number;
    stock: number;
    sku?: string | null;
    description?: string | null;
    cost_price?: number | null;
    images: Array<{ image_url: string; image_public_id: string }>;
    publish?: boolean;
}

function sortProducts(a: Product, b: Product): number {
    const aArchived = a.status === "archived" ? 1 : 0;
    const bArchived = b.status === "archived" ? 1 : 0;

    if (aArchived !== bArchived) {
        return aArchived - bArchived;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export const useProductsStore = defineStore("products", {
    state: () => ({
        list: [] as Product[],
        total: 0,
        page: 1,
        inventoryList: [] as InventoryItem[],
        inventoryTotal: 0,
        inventoryPage: 1,
        current: null as Product | null,
        categories: [] as Category[],
        isLoading: false,
        error: null as string | null
    }),

    actions: {
        async fetchList(
            params: {
                category_id?: string;
                q?: string;
                page?: number;
                limit?: number;
            } = {}
        ): Promise<void> {
            this.isLoading = true;
            this.error = null;
            try {
                const { data, meta } = await apiGetPaginated<Product[]>(
                    "/products",
                    params
                );
                this.list = data;
                this.page = meta.page;
                this.total = meta.totalItems;
            } catch (err) {
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to load products";
            } finally {
                this.isLoading = false;
            }
        },

        async fetchInventory(
            params: { low_stock?: boolean; page?: number; limit?: number } = {}
        ): Promise<void> {
            this.isLoading = true;
            this.error = null;
            try {
                const { data, meta } = await apiGetPaginated<InventoryItem[]>(
                    "/products/inventory",
                    params
                );
                this.inventoryList = data;
                this.inventoryPage = meta.page;
                this.inventoryTotal = meta.totalItems;
            } catch (err) {
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to load inventory";
            } finally {
                this.isLoading = false;
            }
        },

        async updateStock(productId: string, stock: number): Promise<void> {
            this.isLoading = true;
            this.error = null;
            try {
                await apiPatch(`/products/inventory/${productId}`, { stock });
            } catch (err) {
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to update stock";
                throw err;
            } finally {
                this.isLoading = false;
            }
        },

        async fetchCategories(): Promise<void> {
            try {
                this.categories = await apiGet<Category[]>(
                    "/products/categories"
                );
            } catch (err) {
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to load categories";
            }
        },

        async getUploadSignature(
            target: "products" | "store" = "products"
        ): Promise<CloudinarySignature> {
            return apiPost<CloudinarySignature>(
                `/products/upload-signature?target=${target}`
            );
        },

        async createBulk(products: CreateProductInput[]): Promise<Product[]> {
            this.isLoading = true;
            this.error = null;
            try {
                return await apiPost<Product[]>("/products/bulk", { products });
            } catch (err) {
                this.error =
                    err instanceof Error
                        ? err.message
                        : "Failed to create products";
                throw err;
            } finally {
                this.isLoading = false;
            }
        },

        async publishProduct(id: string): Promise<void> {
            await apiPost(`/products/${id}/publish`);
            this.list = this.list
                .map(p => (p.id === id ? { ...p, status: "published" } : p))
                .sort(sortProducts);
        },

        async unpublishProduct(id: string): Promise<void> {
            await apiPost(`/products/${id}/unpublish`);
            this.list = this.list
                .map(p => (p.id === id ? { ...p, status: "draft" } : p))
                .sort(sortProducts);
        },

        async archiveProduct(id: string): Promise<void> {
            await apiPost(`/products/${id}/archive`);
            this.list = this.list
                .map(p => (p.id === id ? { ...p, status: "archived" } : p))
                .sort(sortProducts);
        },

        async unarchiveProduct(id: string): Promise<void> {
            await apiPost(`/products/${id}/unarchive`);
            this.list = this.list
                .map(p => (p.id === id ? { ...p, status: "draft" } : p))
                .sort(sortProducts);
        },

        async deleteProduct(id: string): Promise<void> {
            await apiDelete(`/products/${id}`);
            this.list = this.list.filter(p => p.id !== id);
            this.total = Math.max(0, this.total - 1);
        }
    }
});
