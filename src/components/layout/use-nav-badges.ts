import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api/endpoints/dashboard'
import { useAppStore } from '@/stores/app'

export interface NavBadgeValue {
  count: number
  variant: 'destructive' | 'warning' | 'info' | 'primary'
}

export function useNavBadges(): Record<string, NavBadgeValue> {
  const context = useAppStore((s) => s.context)
  const branchId = context?.branch?.id

  const dashboard = useQuery({
    queryKey: ['dashboard-badges', branchId, 'today'],
    queryFn: () => dashboardApi.get({ period: 'today', branch_id: branchId }),
    enabled: !!context,
    refetchInterval: 300_000,
  })

  const kpis = dashboard.data?.data.kpis

  return {
    pendingInventory: {
      count: kpis?.pending_inventory_approvals ?? 0,
      variant: 'primary',
    },
    expiring: {
      count: (kpis?.expired_stock_count ?? 0) + (kpis?.expiring_stock_count ?? 0),
      variant: 'destructive',
    },
    lowStock: { count: kpis?.low_stock_count ?? 0, variant: 'warning' },
    pendingFinance: { count: kpis?.pending_payments ?? 0, variant: 'primary' },
  }
}