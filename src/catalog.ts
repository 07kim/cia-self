export type Product = {
  barcode: string
  name: string
  price: number
  taxRate: 8 | 10
  category: 'food' | 'drink' | 'snack' | 'supply'
  active: boolean
  image?: string
}

export const products: Product[] = [
  { barcode: '2000000000015', name: '天然水 550ml', price: 110, taxRate: 8, category: 'drink', active: true },
  { barcode: '2000000000022', name: '鮭おにぎり', price: 190, taxRate: 8, category: 'food', active: true },
  { barcode: '2000000000039', name: '無糖コーヒー', price: 180, taxRate: 8, category: 'drink', active: true },
  { barcode: '2000000000046', name: 'ミックスサンド', price: 360, taxRate: 8, category: 'food', active: true },
  { barcode: '2000000000053', name: 'のり塩ポテトチップス', price: 170, taxRate: 8, category: 'snack', active: true },
  { barcode: '2000000000060', name: 'レモン炭酸水', price: 140, taxRate: 8, category: 'drink', active: true },
  { barcode: '2000000000077', name: 'チキン弁当', price: 640, taxRate: 8, category: 'food', active: true },
  { barcode: '2000000000084', name: '緑茶 600ml', price: 160, taxRate: 8, category: 'drink', active: true },
  { barcode: '2000000000091', name: '梅おにぎり', price: 160, taxRate: 8, category: 'food', active: true },
  { barcode: '2000000000107', name: 'カップみそ汁', price: 150, taxRate: 8, category: 'food', active: true },
  { barcode: '2000000000114', name: 'カフェラテ', price: 220, taxRate: 8, category: 'drink', active: true },
  { barcode: '2000000000121', name: 'ミックスナッツ', price: 200, taxRate: 8, category: 'snack', active: true },
  { barcode: '2000000000138', name: 'CIAクリアファイル', price: 280, taxRate: 10, category: 'supply', active: true },
  { barcode: '2000000000145', name: '記録メディアケース', price: 480, taxRate: 10, category: 'supply', active: true },
]

const catalog = new Map(products.map((product) => [product.barcode, product]))

export function findProduct(barcode: string) {
  const product = catalog.get(barcode)
  return product?.active ? product : null
}

export function calculateEan13CheckDigit(firstTwelveDigits: string) {
  if (!/^\d{12}$/.test(firstTwelveDigits)) return null
  const sum = [...firstTwelveDigits].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  )
  return String((10 - (sum % 10)) % 10)
}

export function isValidEan13(value: string) {
  return /^\d{13}$/.test(value)
    && calculateEan13CheckDigit(value.slice(0, 12)) === value.at(-1)
}
