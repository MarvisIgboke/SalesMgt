import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="h-8 w-8" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">404</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This screen doesn't exist in the application. It may belong to another module or the
          route has changed.
        </p>
        <Button asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}