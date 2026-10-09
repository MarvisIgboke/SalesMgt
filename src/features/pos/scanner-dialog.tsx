import { useEffect, useRef, useState } from 'react'
import { Loader2, ScanLine, Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { supportsCameraScan, scanWithCamera } from './barcode'

interface ScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBarcode: (barcode: string) => void
}

export function ScannerDialog({ open, onOpenChange, onBarcode }: ScannerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan barcode</DialogTitle>
            <DialogDescription>
              Point the camera at a product barcode, or use a USB/Bluetooth scanner. The barcode is
              sent to Laravel for an authoritative product lookup.
            </DialogDescription>
          </DialogHeader>

          <ScannerBody onBarcode={onBarcode} />

          <DialogFooter>
            <div className="flex w-full items-center justify-between gap-2">
              <Button variant="outline" className="ml-auto" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}

function ScannerBody({ onBarcode }: { onBarcode: (barcode: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const [cameraSupported] = useState(() => supportsCameraScan())
  const [running, setRunning] = useState(false)
  const [failed, setFailed] = useState(false)
  const starting = cameraSupported && !running && !failed

  useEffect(() => {
    if (!cameraSupported) return

    let cancelled = false

    ;(async () => {
      try {
        if (!videoRef.current) return
        const stop = await scanWithCamera(videoRef.current, (value) => {
          if (!cancelled) onBarcode(value)
        })
        if (cancelled) {
          stop()
          return
        }
        stopRef.current = stop
        setRunning(true)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()

    return () => {
      cancelled = true
      stopRef.current?.()
      stopRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraSupported])

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-border/70 bg-black">
      {cameraSupported ? (
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
      ) : (
        <div className="grid h-full w-full place-items-center text-sm text-muted-foreground">
          Camera scanning unsupported on this browser.
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-28 w-48 rounded-xl border-2 border-primary/60 [mask-image:linear-gradient(transparent_20%,black_20%,black_80%,transparent_80%)]" />
      </div>

      {starting && (
        <div className="absolute inset-0 grid place-items-center bg-black/50">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {running && (
        <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-[11px] text-success backdrop-blur">
          <ScanLine className="h-3.5 w-3.5 animate-pulse" /> Scanning…
        </span>
      )}

      {failed && (
        <div className="absolute bottom-3 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-center text-[11px] text-destructive backdrop-blur">
          Camera unavailable. Use a hardware scanner or type the barcode.
        </div>
      )}

      {!cameraSupported && (
        <div className="absolute bottom-3 left-1/2 flex w-max -translate-x-1/2 items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-[11px] text-foreground backdrop-blur">
          <Keyboard className="h-3.5 w-3.5" /> Use a hardware scanner
        </div>
      )}
    </div>
  )
}