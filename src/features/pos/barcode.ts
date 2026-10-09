import { useEffect, useRef, useState } from 'react'

const IGNORE = new Set([
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'BUTTON',
  'A',
])
const BUFFER_RESET_MS = 120

/**
 * Detects USB/Bluetooth hardware barcode scanners, which present
 * themselves as a keyboard that types the barcode followed by Enter.
 *
 * The scanned value is forwarded to the caller, which sends it to
 * Laravel for an authoritative lookup. The frontend never interprets
 * the barcode.
 */
export function useHardwareScanner(onScan: (barcode: string) => void, enabled = true) {
  const [buffer, setBuffer] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const flush = () => {
      if (buffer) {
        onScan(buffer)
        setBuffer('')
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && IGNORE.has(target.tagName)) return

      if (e.key === 'Enter') {
        e.preventDefault()
        flush()
        return
      }

      if (e.key.length === 1) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setBuffer((prev) => prev + e.key)
        timeoutRef.current = setTimeout(() => {
          setBuffer((prev) => {
            if (prev) onScan(prev)
            return ''
          })
        }, BUFFER_RESET_MS)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, onScan])

  return buffer
}

type BarcodeDetectorLike = {
  detect: (source: MediaStream | HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike
  }
}

export function supportsCameraScan(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.BarcodeDetector &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

export async function scanWithCamera(
  video: HTMLVideoElement,
  onBarcode: (value: string) => void,
): Promise<() => void> {
  const Detector = window.BarcodeDetector
  if (!Detector) {
    throw new Error('Barcode detector is not supported in this browser.')
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
  })
  video.srcObject = stream
  await video.play()

  const detector = new Detector({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'qr_code'] })
  let stopped = false

  const tick = async () => {
    if (stopped) return
    try {
      const codes = await detector.detect(video)
      if (codes && codes.length > 0) {
        const value = codes[0].rawValue
        if (value) {
          stop()
          onBarcode(value)
          return
        }
      }
    } catch {
      /* frame skipped */
    }
    requestAnimationFrame(tick)
  }
  void tick()

  const stop = () => {
    stopped = true
    stream.getTracks().forEach((track) => track.stop())
  }

  return stop
}