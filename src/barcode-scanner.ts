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
): Promise<ScannerSession> {
  const DetectorClass = (window as BarcodeWindow).BarcodeDetector
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('Barcode detection is unavailable', 'NotSupportedError')
  }

  if (!DetectorClass) {
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ])
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8])
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })
    const controls = await reader.decodeFromConstraints(
      { audio: false, video: { facingMode: { ideal: 'environment' } } },
      video,
      (result) => {
        if (result) onCode(result.getText())
      },
    )
    return {
      stop: () => {
        controls.stop()
        video.srcObject = null
      },
    }
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' } },
  })
  const detector = new DetectorClass({ formats: ['ean_13', 'ean_8'] })
  let active = true
  let frame = 0
  let detecting = false

  video.srcObject = stream
  await video.play()

  const scan = async () => {
    if (!active) return
    if (!detecting && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      detecting = true
      try {
        const [result] = await detector.detect(video)
        if (result?.rawValue) onCode(result.rawValue)
      } catch {
        // Individual frames may be unreadable while the camera is moving.
      } finally {
        detecting = false
      }
    }
    frame = window.requestAnimationFrame(() => void scan())
  }
  frame = window.requestAnimationFrame(() => void scan())

  return {
    stop: () => {
      active = false
      window.cancelAnimationFrame(frame)
      stream.getTracks().forEach((track) => track.stop())
      video.srcObject = null
    },
  }
}
export function scannerErrorState(error: unknown): ScannerState {
  if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)) {
    return 'permission-denied'
  }
  return 'unavailable'
}
