import { describe, expect, it } from 'vitest'
import { calculateEan13CheckDigit, findProduct, isValidEan13, products } from './catalog'

describe('product catalog', () => {
  it('contains only valid EAN-13 codes', () => {
    expect(products.every((product) => isValidEan13(product.barcode))).toBe(true)
  })

  it('finds registered active products', () => {
    expect(findProduct('2000000000091')?.name).toBe('梅おにぎり')
    expect(findProduct('9999999999999')).toBeNull()
  })

  it('calculates check digits', () => {
    expect(calculateEan13CheckDigit('200000000001')).toBe('5')
    expect(calculateEan13CheckDigit('not-a-code')).toBeNull()
  })
})
