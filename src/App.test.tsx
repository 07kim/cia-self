import { act, fireEvent, render, screen } from '@testing-library/react'
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

  it('opens every home support menu and changes display mode', () => {
    render(<App />)

    expect(screen.queryByRole('banner')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /商品コードを入力/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('商品コードを入力')
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

    fireEvent.click(screen.getByRole('button', { name: /使い方を見る/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('セルフレジの使い方')
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

    fireEvent.click(screen.getByRole('button', { name: /係員を呼ぶ/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('係員を呼び出しました')
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

    fireEvent.click(screen.getByRole('button', { name: /日本語/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('表示言語')
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

    fireEvent.click(screen.getByRole('button', { name: /文字を大きくする/ }))
    expect(screen.getByRole('button', { name: /標準表示に戻す/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /効果音をオフにする/ }))
    expect(screen.getByRole('button', { name: /効果音をオンにする/ })).toBeInTheDocument()
  })

  it('opens management authentication with the four-point Z touch sequence', () => {
    render(<App />)

    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      fireEvent.pointerDown(screen.getByRole('button', { name: `hidden-${corner}` }))
    }

    expect(screen.getByRole('heading', { name: 'システムパスワード' })).toBeInTheDocument()
  })

  it('opens management authentication from iPad touch events', () => {
    render(<App />)

    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      fireEvent.touchStart(screen.getByRole('button', { name: `hidden-${corner}` }))
    }

    expect(screen.getByRole('heading', { name: 'システムパスワード' })).toBeInTheDocument()
  })

  it('counts a combined pointer and touch event as one corner input', () => {
    render(<App />)

    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      const target = screen.getByRole('button', { name: `hidden-${corner}` })
      fireEvent.pointerDown(target)
      fireEvent.touchStart(target)
    }

    expect(screen.getByRole('heading', { name: 'システムパスワード' })).toBeInTheDocument()
  })

  it('allows up to 1.5 seconds between each Z touch', () => {
    vi.useFakeTimers()
    render(<App />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'hidden-tl' }))
    act(() => vi.advanceTimersByTime(1_400))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'hidden-tr' }))
    act(() => vi.advanceTimersByTime(1_400))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'hidden-bl' }))
    act(() => vi.advanceTimersByTime(1_400))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'hidden-br' }))
    expect(screen.getByRole('heading', { name: 'システムパスワード' })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('resets the Z touch sequence when one interval exceeds 1.5 seconds', () => {
    vi.useFakeTimers()
    render(<App />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'hidden-tl' }))
    act(() => vi.advanceTimersByTime(1_501))
    for (const corner of ['tr', 'bl', 'br']) {
      fireEvent.pointerDown(screen.getByRole('button', { name: `hidden-${corner}` }))
    }
    expect(screen.queryByRole('heading', { name: 'システムパスワード' })).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
