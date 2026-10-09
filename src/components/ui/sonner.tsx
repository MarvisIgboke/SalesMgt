import { Toaster as Sonner, toast } from 'sonner'

import { cn } from '@/lib/utils'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: cn(
            'group toast group-[.toaster]:border-border/80 group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:shadow-card',
          ),
          title: 'group-[.toast]:text-sm group-[.toast]:font-medium',
          description: 'group-[.toast]:text-xs group-[.toast]:text-muted-foreground',
          error: 'group-[.toaster]:border-destructive/40',
          success: 'group-[.toaster]:border-success/40',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }