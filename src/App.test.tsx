import { act, fireEvent, render, screen, within } from '@testing-library/react'
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

  it('stops at payment after adding a registered item', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'CIA MART 会計端末' })).toBeInTheDocument()
    expect(screen.queryByText('セルフレジ')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'お会計を始める' }))
    expect(screen.getByRole('heading', { name: 'ポイントカード' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /CIA POINT/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /提携ポイント/ })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /利用しない/ }))
    fireEvent.click(screen.getByRole('button', { name: /不要/ }))
    fireEvent.click(screen.getByRole('button', { name: /クレジット/ }))

    expect(await screen.findAllByText('梅おにぎり')).toHaveLength(2)
    expect(screen.getAllByText((_, element) => element?.textContent === '¥160').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '支払いへ' }))
    expect(screen.getByRole('heading', { name: 'お支払い' })).toBeInTheDocument()
    expect(screen.getByText('決済端末からの応答を待っています')).toBeVisible()
    expect(screen.queryByRole('button', { name: /支払い完了/ })).not.toBeInTheDocument()
    expect(screen.queryByText('ありがとうございました')).not.toBeInTheDocument()
  })

  it('uses confirmation before calling an attendant and changes display mode', () => {
    render(<App />)

    expect(screen.queryByRole('button', { name: /商品コード/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /使い方を見る/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('セルフレジの使い方')
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

    fireEvent.click(screen.getByRole('button', { name: /係員を呼ぶ/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('係員を呼びますか？')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '係員を呼ぶ' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('混雑状況により、お伺いまでお時間をいただく場合や、対応できない場合がございます。')
    fireEvent.click(screen.getByRole('button', { name: '画面に戻る' }))

    fireEvent.click(screen.getByRole('button', { name: /文字を大きくする/ }))
    expect(screen.getByRole('button', { name: /標準表示に戻す/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /効果音をオフにする/ }))
    expect(screen.getByRole('button', { name: /効果音をオンにする/ })).toBeInTheDocument()
  })

  it('stops at point scanning when a point card is selected', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'お会計を始める' }))
    fireEvent.click(screen.getByRole('button', { name: /CIA POINT/ }))
    expect(screen.getByRole('heading', { name: 'ポイントカードを読み取ってください' })).toBeInTheDocument()
    expect(screen.getByText('読み取りを待っています')).toBeVisible()
    expect(screen.queryByRole('button', { name: /次へ/ })).not.toBeInTheDocument()
  })

  it('adds a selected shopping bag to the basket and has no item selection buttons', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'お会計を始める' }))
    fireEvent.click(screen.getByRole('button', { name: /利用しない/ }))
    fireEvent.click(screen.getByRole('button', { name: /小/ }))
    fireEvent.click(screen.getByRole('button', { name: /クレジット/ }))
    expect(await screen.findByText('レジ袋 小')).toBeVisible()
    expect(screen.queryByText('商品選択')).not.toBeInTheDocument()
  })

  it('switches the customer flow to English', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }))
    expect(screen.getByRole('button', { name: 'Start checkout' })).toBeVisible()
    expect(screen.getByRole('button', { name: '日本語に切り替える' })).toBeVisible()
  })

  it('does not return home automatically while the checkout is open', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'お会計を始める' }))
    act(() => vi.advanceTimersByTime(180_000))
    expect(screen.getByRole('heading', { name: 'ポイントカード' })).toBeInTheDocument()
    vi.useRealTimers()
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

  it('opens the employee mode before purchase history', () => {
    render(<App />)

    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      fireEvent.pointerDown(screen.getByRole('button', { name: `hidden-${corner}` }))
    }
    fireEvent.change(screen.getByRole('textbox', { name: 'システムパスワード' }), { target: { value: 'ばいてん' } })
    fireEvent.click(screen.getByRole('button', { name: '認証' }))

    expect(screen.getByRole('heading', { name: '従業員モード' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /商品台帳/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /購入履歴/ }))
    expect(screen.getByRole('heading', { name: '購入履歴' })).toBeInTheDocument()
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
