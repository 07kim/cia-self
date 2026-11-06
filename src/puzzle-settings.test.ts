import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PUZZLE_SETTINGS,
  loadPuzzleSettings,
  normalizePuzzlePassword,
  PUZZLE_SETTINGS_STORAGE_KEY,
  resetPuzzleSettings,
  savePuzzleSettings,
} from './puzzle-settings'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  }
}

describe('puzzle settings', () => {
  it('uses the current puzzle defaults when no setting exists', () => {
    const storage = memoryStorage()
    expect(loadPuzzleSettings(storage)).toEqual(DEFAULT_PUZZLE_SETTINGS)
  })

  it('normalizes and persists the configured password and image', () => {
    const storage = memoryStorage()
    const saved = savePuzzleSettings({
      password: '　バイテン　',
      imageDataUrl: 'data:image/png;base64,abc',
      imageName: 'puzzle.png',
    }, storage)

    expect(saved.password).toBe('バイテン')
    expect(loadPuzzleSettings(storage)).toEqual(saved)
    expect(storage.values.has(PUZZLE_SETTINGS_STORAGE_KEY)).toBe(true)
  })

  it('rejects an empty password and can restore defaults', () => {
    const storage = memoryStorage()
    expect(() => savePuzzleSettings({ ...DEFAULT_PUZZLE_SETTINGS, password: '  ' }, storage)).toThrow('正解パスワード')
    savePuzzleSettings({ ...DEFAULT_PUZZLE_SETTINGS, password: 'new' }, storage)
    expect(resetPuzzleSettings(storage)).toEqual(DEFAULT_PUZZLE_SETTINGS)
    expect(loadPuzzleSettings(storage)).toEqual(DEFAULT_PUZZLE_SETTINGS)
  })

  it('uses NFKC matching for participant answers', () => {
    expect(normalizePuzzlePassword('　バイテン　')).toBe('バイテン')
  })
})
