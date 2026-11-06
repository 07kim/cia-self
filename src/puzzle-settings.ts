export type PuzzleSettings = {
  password: string
  imageDataUrl: string | null
  imageName: string | null
}

export const DEFAULT_PUZZLE_SETTINGS: PuzzleSettings = {
  password: 'ばいてん',
  imageDataUrl: null,
  imageName: null,
}

export const PUZZLE_SETTINGS_STORAGE_KEY = 'cia-self:puzzle-settings:v1'
export const MAX_PUZZLE_IMAGE_BYTES = 1_500_000

export function normalizePuzzlePassword(value: string) {
  return value.normalize('NFKC').trim()
}

export function loadPuzzleSettings(storage: Pick<Storage, 'getItem'> | null = getBrowserStorage()): PuzzleSettings {
  if (!storage) return DEFAULT_PUZZLE_SETTINGS
  try {
    const raw = storage.getItem(PUZZLE_SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_PUZZLE_SETTINGS
    const parsed = JSON.parse(raw) as Partial<PuzzleSettings>
    const password = typeof parsed.password === 'string' ? normalizePuzzlePassword(parsed.password) : ''
    return {
      password: password || DEFAULT_PUZZLE_SETTINGS.password,
      imageDataUrl: typeof parsed.imageDataUrl === 'string' && parsed.imageDataUrl.startsWith('data:image/') ? parsed.imageDataUrl : null,
      imageName: typeof parsed.imageName === 'string' ? parsed.imageName : null,
    }
  } catch {
    return DEFAULT_PUZZLE_SETTINGS
  }
}

export function savePuzzleSettings(settings: PuzzleSettings, storage: Pick<Storage, 'setItem'> | null = getBrowserStorage()) {
  if (!storage) throw new Error('この端末では設定を保存できません。')
  const password = normalizePuzzlePassword(settings.password)
  if (!password) throw new Error('正解パスワードを入力してください。')
  const next = { ...settings, password }
  storage.setItem(PUZZLE_SETTINGS_STORAGE_KEY, JSON.stringify(next))
  return next
}

export function resetPuzzleSettings(storage: Pick<Storage, 'removeItem'> | null = getBrowserStorage()) {
  storage?.removeItem(PUZZLE_SETTINGS_STORAGE_KEY)
  return DEFAULT_PUZZLE_SETTINGS
}

function getBrowserStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}
