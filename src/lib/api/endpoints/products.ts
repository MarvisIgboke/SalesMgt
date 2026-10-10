import { http } from '../client'
import type { ApiEnvelope, Paginated } from '../types'

export interface Product {
  id: number
  name: string
  sku: string
  brand?: string | null
  category?: string | null
  unit?: string | null
  image_url?: string | null
  barcodes: string[]
  cost_price: number
  selling_price: number
  tax_rate?: number | null
  requires_expiry: boolean
  is_active: boolean
  has_variants: boolean
  variants?: ProductVariant[]
  created_at?: string
  updated_at?: string
}

export interface ProductVariant {
  id: number
  name: string
  sku: string
  barcodes: string[]
  cost_price: number
  selling_price: number
  is_active: boolean
}

export interface ProductInput {
  name: string
  sku?: string
  brand?: string
  category?: string
  unit?: string
  barcodes?: string[]
  cost_price?: number
  selling_price?: number
  tax_rate?: number | null
  requires_expiry?: boolean
  is_active?: boolean
  image?: File | null
}

export interface ProductBarcode {
  id: number
  barcode: string
}

export interface CatalogItem {
  id: number
  name: string
}

export const catalogApi = {
  categories: () => http.get<ApiEnvelope<CatalogItem[]>>('/product-categories'),
  createCategory: (name: string) =>
    http.post<ApiEnvelope<CatalogItem>>('/product-categories', { name }),
  updateCategory: (id: number, name: string) =>
    http.put<ApiEnvelope<CatalogItem>>(`/product-categories/${id}`, { name }),
  deleteCategory: (id: number) => http.delete<ApiEnvelope<null>>(`/product-categories/${id}`),

  brands: () => http.get<ApiEnvelope<CatalogItem[]>>('/product-brands'),
  createBrand: (name: string) => http.post<ApiEnvelope<CatalogItem>>('/product-brands', { name }),
  updateBrand: (id: number, name: string) =>
    http.put<ApiEnvelope<CatalogItem>>(`/product-brands/${id}`, { name }),
  deleteBrand: (id: number) => http.delete<ApiEnvelope<null>>(`/product-brands/${id}`),
}

export const productsApi = {
  list: (params?: {
    page?: number
    per_page?: number
    search?: string
    category?: string
    brand?: string
    branch_id?: number
  }) => http.get<Paginated<Product>>('/products', { params }),

  get: (id: number) => http.get<ApiEnvelope<Product>>(`/products/${id}`),

  create: (input: ProductInput) => http.post<ApiEnvelope<Product>>('/products', input),

  update: (id: number, input: Partial<ProductInput>) =>
    http.put<ApiEnvelope<Product>>(`/products/${id}`, input),

  remove: (id: number) => http.delete<ApiEnvelope<null>>(`/products/${id}`),

  addBarcode: (id: number, barcode: string) =>
    http.post<ApiEnvelope<ProductBarcode>>(`/products/${id}/barcodes`, { barcode }),

  removeBarcode: (id: number, barcode: string | number) =>
    http.delete<ApiEnvelope<null>>(`/products/${id}/barcodes/${barcode}`),

  categories: () => http.get<ApiEnvelope<Array<{ id: number; name: string }>>>('/product-categories'),

  brands: () => http.get<ApiEnvelope<Array<{ id: number; name: string }>>>('/product-brands'),
}