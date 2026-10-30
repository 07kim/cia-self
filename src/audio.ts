import { useCallback, useEffect, useRef, useState } from 'react'

export type SoundCue = 'tap' | 'scan' | 'unknown' | 'complete' | 'denied' | 'granted'

type WebkitWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }

class AudioController {
  private context: AudioContext | null = null
  private muted = false

  async unlock() {
    if (!this.context) {
      const Context = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
      if (!Context) return
      this.context = new Context()
    }
    if (this.context.state === 'suspended') await this.context.resume()
  }

  setMuted(muted: boolean) { this.muted = muted }

  play(cue: SoundCue) {
    const context = this.context
    if (!context || context.state !== 'running' || this.muted) return
    const patterns: Record<SoundCue, Array<[number, number, number, OscillatorType]>> = {
      tap: [[520, 0, 0.045, 'sine']],
      scan: [[880, 0, 0.07, 'sine'], [1320, 0.075, 0.09, 'sine']],
      unknown: [[260, 0, 0.09, 'square'], [190, 0.11, 0.12, 'square']],
      complete: [[660, 0, 0.1, 'sine'], [880, 0.1, 0.12, 'sine'], [1100, 0.22, 0.18, 'sine']],
      denied: [[210, 0, 0.12, 'sawtooth'], [145, 0.14, 0.18, 'sawtooth']],
      granted: [[440, 0, 0.09, 'sine'], [660, 0.1, 0.1, 'sine'], [990, 0.21, 0.18, 'sine']],
    }
    for (const [frequency, offset, duration, type] of patterns[cue]) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const start = context.currentTime + offset
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.11, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + duration + 0.02)
    }
  }
}
export function useAudio() {
  const controller = useRef(new AudioController())
  const [muted, setMuted] = useState(false)
  useEffect(() => controller.current.setMuted(muted), [muted])
  const unlock = useCallback(() => controller.current.unlock(), [])
  const play = useCallback((cue: SoundCue) => controller.current.play(cue), [])
  const toggleMuted = useCallback(() => setMuted((value) => !value), [])
  return { muted, play, toggleMuted, unlock }
}
