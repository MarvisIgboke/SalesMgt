import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SellableProduct } from '@/lib/api/endpoints/pos'

interface PosState {
  cartReference: string | null
  cartCustomerId: number | null
  lastProduct: SellableProduct | null
  scanMode: boolean
  setCartReference: (reference: string | null) => void
  setCartCustomerId: (customerId: number | null) => void
  setLastProduct: (product: SellableProduct | null) => void
  setScanMode: (scanMode: boolean) => void
  reset: () => void
}

export const usePosStore = create<PosState>()(
  persist(
    (set) => ({
      cartReference: null,
      cartCustomerId: null,
      lastProduct: null,
      scanMode: false,
      setCartReference: (reference) => set({ cartReference: reference }),
      setCartCustomerId: (customerId) => set({ cartCustomerId: customerId }),
      setLastProduct: (product) => set({ lastProduct: product }),
      setScanMode: (scanMode) => set({ scanMode }),
      reset: () => set({ cartReference: null, cartCustomerId: null, lastProduct: null }),
    }),
    {
      name: 'salesmgt.pos',
      partialize: (state) => ({ cartReference: state.cartReference, cartCustomerId: state.cartCustomerId }),
    },
  ),
)