import { describe, expect, it } from 'vitest'
import { consumeRomaji } from './virtual-keyboard'

describe('romaji conversion', () => {
  it('supports common alternate spellings', () => {
    expect(consumeRomaji('hu')).toEqual({ output: 'フ', rest: '' })
    expect(consumeRomaji('shi')).toEqual({ output: 'シ', rest: '' })
    expect(consumeRomaji('zi')).toEqual({ output: 'ジ', rest: '' })
    expect(consumeRomaji('zyo')).toEqual({ output: 'ジョ', rest: '' })
    expect(consumeRomaji('xi')).toEqual({ output: 'ィ', rest: '' })
    expect(consumeRomaji('di')).toEqual({ output: 'ヂ', rest: '' })
  })

  it('supports doubled consonants and pending n', () => {
    expect(consumeRomaji('kko')).toEqual({ output: 'ッコ', rest: '' })
    expect(consumeRomaji('n')).toEqual({ output: '', rest: 'n' })
    expect(consumeRomaji('nn')).toEqual({ output: 'ン', rest: '' })
  })
})
