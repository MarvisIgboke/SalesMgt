export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  appName: import.meta.env.VITE_APP_NAME ?? 'SalesMgt',
  enablePwa: import.meta.env.VITE_ENABLE_PWA !== 'false',
  isDev: import.meta.env.DEV,
} as const
