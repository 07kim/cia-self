import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const startBarcodeScanner = vi.fn()

vi.mock('./barcode-scanner', () => ({
  scannerErrorState: () => 'unavailable',
  startBarcodeScanner: (...args: unknown[]) => startBarcodeScanner(...args),
}))

import { App } from './App'

describe('self checkout', () => {
  beforeEach(() => {
    startBarcodeScanner.mockImplementation(async (_video, onCode: (value: string) => void) => {
      onCode('2000000000091')
      return { stop: vi.fn() }
    })
  })

  it('adds a registered barcode to the cart without inventing an item first', async () => {
    render(<App />)
    expect(screen.getByText('いらっしゃいませ')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /お買い物を始める/ }))

    expect(await screen.findAllByText('梅おにぎり')).toHaveLength(2)
    expect(screen.getAllByText((_, element) => element?.textContent === '¥160').length).toBeGreaterThan(0)
  })
})
