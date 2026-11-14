export type ScannerState =
  | 'idle'
  | 'requesting-permission'
  | 'scanning'
  | 'permission-denied'
  | 'unavailable'

export type ScannerSession = { stop: () => void }

type DetectedBarcode = { rawValue: string }
type Detector = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> }
type DetectorConstructor = new (options: { formats: string[] }) => Detector
type BarcodeWindow = Window & typeof globalThis & { BarcodeDetector?: DetectorConstructor }

export async function startBarcodeScanner(
  video: HTMLVideoElement,
  onCode: (value: string) => void,
  signal?: AbortSignal,
): Promise<ScannerSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('Camera access is unavailable', 'NotSupportedError')
  }

  let stream: MediaStream | null = null
  let controls: { stop: () => void } | null = null
  let active = true
  let frame = 0

  const stop = () => {
    active = false
    window.cancelAnimationFrame(frame)
    controls?.stop()
    controls = null
    stream?.getTracks().forEach((track) => track.stop())
    if (video.srcObject === stream) video.srcObject = null
  }
  const checkActive = () => {
    if (!active || signal?.aborted) throw new DOMException('Camera startup cancelled', 'AbortError')
  }

  signal?.addEventListener('abort', stop, { once: true })

  try {
    checkActive()
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 15 },
      },
    })
    checkActive()
    video.srcObject = stream
    await video.play()
    checkActive()

    const DetectorClass = (window as BarcodeWindow).BarcodeDetector
    if (!DetectorClass) {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library'),
      ])
      checkActive()
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8])
      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 350,
        delayBetweenScanSuccess: 450,
      })
      controls = await reader.decodeFromVideoElement(video, (result) => {
        if (active && result) onCode(result.getText())
      })
      checkActive()
      return { stop }
    }

    const detector = new DetectorClass({ formats: ['ean_13', 'ean_8'] })
    let detecting = false
    const scan = async () => {
      if (!active) return
      if (!detecting && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        detecting = true
        try {
          const [result] = await detector.detect(video)
          if (active && result?.rawValue) onCode(result.rawValue)
        } catch {
          // Individual frames may be unreadable while the camera is moving.
        } finally {
          detecting = false
        }
      }
      if (active) frame = window.requestAnimationFrame(() => void scan())
    }
    frame = window.requestAnimationFrame(() => void scan())
    return { stop }
  } catch (error) {
    stop()
    throw error
  } finally {
    signal?.removeEventListener('abort', stop)
  }
}

export function scannerErrorState(error: unknown): ScannerState {
  if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)) {
    return 'permission-denied'
  }
  return 'unavailable'
}
