import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import { Flashlight, X } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import readerWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { Button } from '@/components/ui/button'

prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? readerWasmUrl : prefix + path),
  },
})

const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'] as const

type Props = {
  onDetected: (code: string) => void
  onClose: () => void
}

function extractCode(raw: string) {
  const digits = raw.match(/\d{8,14}/)
  return digits ? digits[0] : raw.trim()
}

export function Scanner({ onDetected, onClose }: Props) {
  const { t } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<'noCamera' | 'failed' | null>(null)
  const [torch, setTorch] = useState<MediaStreamTrack | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const handleDetected = useEffectEvent((code: string) => onDetected(code))

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopped = false
    let frame = 0
    const detector = new BarcodeDetector({ formats: [...formats] })

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch {
        setError('noCamera')
        return
      }
      if (stopped || !video.current) return
      video.current.srcObject = stream
      await video.current.play().catch(() => undefined)

      const track = stream.getVideoTracks()[0]
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean }
      if (capabilities?.torch) setTorch(track)

      const tick = async () => {
        if (stopped || !video.current) return
        if (video.current.readyState >= 2) {
          try {
            const [found] = await detector.detect(video.current)
            if (found?.rawValue) {
              navigator.vibrate?.(60)
              handleDetected(extractCode(found.rawValue))
              return
            }
          } catch {
            setError('failed')
            return
          }
        }
        frame = window.setTimeout(() => void tick(), 120)
      }
      void tick()
    }

    void start()
    return () => {
      stopped = true
      window.clearTimeout(frame)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function toggleTorch() {
    if (!torch) return
    const next = !torchOn
    await torch.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] }).catch(() => undefined)
    setTorchOn(next)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="pt-safe flex items-center justify-between p-3">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label={t('foods.scanner.close')} onClick={onClose}>
          <X className="size-6" />
        </Button>
        <span className="text-sm font-medium">{t('foods.scanBarcode')}</span>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 disabled:opacity-30"
          aria-label={t('foods.scanner.torch')}
          disabled={!torch}
          onClick={() => void toggleTorch()}
        >
          <Flashlight className={torchOn ? 'size-5 fill-white' : 'size-5'} />
        </Button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} className="absolute inset-0 size-full object-cover" playsInline muted />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-72 rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && <p className="absolute inset-x-6 bottom-10 rounded-xl bg-black/70 p-4 text-center text-sm">{t(`foods.scanner.${error}`)}</p>}
      </div>
      <p className="pb-safe p-5 text-center text-sm text-white/70">{t('foods.scanner.hint')}</p>
    </div>
  )
}
