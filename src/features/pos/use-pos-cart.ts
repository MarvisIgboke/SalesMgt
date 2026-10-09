import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  posApi,
  type AddItemInput,
  type CartResponse,
} from '@/lib/api/endpoints/pos'
import type { ApiEnvelope } from '@/lib/api/types'
import { ApiError } from '@/lib/api/errors'
import { usePosStore } from './pos-store'

export function cartQueryKey(reference: string | null) {
  return ['pos-cart', reference ?? 'new'] as const
}

/**
 * POS controller.
 *
 * The cart lives on the backend. Every mutation is submitted to Laravel,
 * which returns the authoritative cart (pricing, discounts, tax, approval
 * flags, stock and expiry warnings). The UI never computes totals.
 */
export function usePosCart() {
  const queryClient = useQueryClient()
  const cartReference = usePosStore((s) => s.cartReference)
  const setCartReference = usePosStore((s) => s.setCartReference)
  const customerId = usePosStore((s) => s.cartCustomerId)

  const query = useQuery({
    queryKey: cartQueryKey(cartReference),
    queryFn: () => posApi.getCart(cartReference ?? undefined),
    enabled: !!cartReference,
    placeholderData: (prev) => prev,
  })

  const applyCart = useCallback(
    (cart: CartResponse) => {
      setCartReference(cart.reference)
      queryClient.setQueryData<ApiEnvelope<CartResponse>>(
        cartQueryKey(cart.reference),
        { data: cart },
      )
    },
    [queryClient, setCartReference],
  )

  const addItem = useMutation({
    mutationFn: (input: AddItemInput) => posApi.addItem(input, cartReference ?? undefined),
    onSuccess: ({ data }) => applyCart(data),
  })

  const updateItem = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: number; quantity: number }) =>
      posApi.updateItem({ line_id: lineId, quantity }, cartReference ?? undefined),
    onSuccess: ({ data }) => applyCart(data),
  })

  const removeItem = useMutation({
    mutationFn: (lineId: number) => posApi.removeItem(lineId, cartReference ?? undefined),
    onSuccess: ({ data }) => applyCart(data),
  })

  const setCustomer = useMutation({
    mutationFn: (customerId: number | null) =>
      posApi.setCustomer(customerId, cartReference ?? undefined),
    onSuccess: ({ data }) => applyCart(data),
  })

  const clearCart = useCallback(() => {
    setCartReference(null)
    queryClient.removeQueries({ queryKey: ['pos-cart'] })
  }, [queryClient, setCartReference])

  return {
    cart: query.data?.data,
    cartLoading: query.isLoading,
    cartError: query.error,
    customerId,
    setCustomer,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    applyCart,
  }
}

export function getPosError(error: unknown): { message: string; code?: string } {
  const normalized = error instanceof ApiError ? error : new ApiError({ message: String(error) })
  return { message: normalized.message, code: normalized.code }
}