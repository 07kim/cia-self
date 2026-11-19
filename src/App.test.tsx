import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { PUZZLE_SETTINGS_STORAGE_KEY } from './puzzle-settings'

describe('self checkout', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('stops at product scanning without requesting the camera', () => {
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

    expect(screen.getByRole('heading', { name: '商品のバーコードを読み取ってください' })).toBeInTheDocument()
    expect(screen.getByText('読み取りを待っています')).toBeVisible()
    expect(screen.queryByRole('video')).not.toBeInTheDocument()
    expect(screen.queryByText(/カメラ/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /次へ|支払いへ/ })).not.toBeInTheDocument()
  })

  it('uses confirmation before calling an attendant and changes display mode', () => {
    render(<App />)

    expect(screen.queryByRole('button', { name: /商品コード/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to English' }).querySelector('svg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'お会計を始める' }).querySelectorAll('svg')).toHaveLength(3)

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
    expect(document.querySelector('.pointReader svg')).toBeInTheDocument()
    expect(screen.getByText('読み取りを待っています')).toBeVisible()
    expect(screen.queryByRole('button', { name: /次へ/ })).not.toBeInTheDocument()
  })

  it('keeps the selected bag while waiting for a product scan', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'お会計を始める' }))
    fireEvent.click(screen.getByRole('button', { name: /利用しない/ }))
    fireEvent.click(screen.getByRole('button', { name: /小/ }))
    fireEvent.click(screen.getByRole('button', { name: /クレジット/ }))
    expect(screen.getByText('商品のバーコードを読み取ってください')).toBeVisible()
    expect(screen.queryByText('商品選択')).not.toBeInTheDocument()
  })

  it('switches the customer flow to English', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }))
    expect(screen.getByRole('button', { name: 'Start checkout' })).toBeVisible()
    expect(screen.getByRole('button', { name: '日本語に切り替える' })).toBeVisible()
  })

  it('shows an idle warning and returns home after the warning period', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'お会計を始める' }))
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.getByRole('status')).toHaveTextContent('まもなくホーム画面へ戻ります')
    act(() => vi.advanceTimersByTime(9_999))
    expect(screen.getByRole('heading', { name: 'ポイントカード' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('heading', { name: 'CIA MART 会計端末' })).toBeInTheDocument()
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
    expect(screen.queryByText('カタカナで入力してください')).not.toBeInTheDocument()
    const passwordInput = screen.getByRole('textbox', { name: 'システムパスワード' })
    expect(passwordInput).not.toHaveAttribute('placeholder')
    expect(passwordInput).not.toHaveFocus()
    fireEvent.change(passwordInput, { target: { value: 'セルフレジ' } })
    fireEvent.click(screen.getByRole('button', { name: '認証' }))

    expect(screen.getByRole('heading', { name: '従業員モード' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /商品台帳/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /購入履歴/ }))
    expect(screen.getByRole('heading', { name: '購入履歴' })).toBeInTheDocument()
  })

  it('shows a configured puzzle image with password authentication', () => {
    window.localStorage.setItem(PUZZLE_SETTINGS_STORAGE_KEY, JSON.stringify({
      password: 'ばいてん',
      imageDataUrl: 'data:image/png;base64,cHV6emxl',
      imageName: 'puzzle.png',
    }))
    render(<App />)

    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      fireEvent.pointerDown(screen.getByRole('button', { name: `hidden-${corner}` }))
    }

    expect(screen.getByRole('img', { name: '設定された謎画像' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'システムパスワード' }).closest('.lockAuth')).not.toBeNull()
  })

  it('keeps an unfinished romaji consonant when a symbol is pressed', () => {
    render(<App />)
    for (const corner of ['tl', 'tr', 'bl', 'br']) fireEvent.pointerDown(screen.getByRole('button', { name: `hidden-${corner}` }))
    fireEvent.click(screen.getByRole('textbox', { name: 'システムパスワード' }))
    fireEvent.click(screen.getByRole('button', { name: 'm' }))
    fireEvent.click(screen.getByRole('button', { name: '@' }))
    expect(screen.getByLabelText('入力内容')).toHaveTextContent('m@')
  })

  it('allows only the configured employee ID to open puzzle settings', () => {
    render(<App />)
    for (const corner of ['tl', 'tr', 'bl', 'br']) fireEvent.pointerDown(screen.getByRole('button', { name: `hidden-${corner}` }))
    fireEvent.change(screen.getByRole('textbox', { name: 'システムパスワード' }), { target: { value: 'セルフレジ' } })
    fireEvent.click(screen.getByRole('button', { name: '認証' }))
    fireEvent.click(screen.getByRole('button', { name: /従業員ID認証/ }))

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '従業員IDを照会' }))
    expect(screen.getByRole('alert')).toHaveTextContent('該当する従業員IDがありません')
    expect(screen.queryByRole('heading', { name: '謎設定' })).not.toBeInTheDocument()

    for (const digit of '20261107') fireEvent.click(screen.getByRole('button', { name: digit }))
    fireEvent.click(screen.getByRole('button', { name: '従業員IDを照会' }))
    expect(screen.getByRole('heading', { name: '謎設定' })).toBeInTheDocument()
  })

  it('uses a saved puzzle password for subsequent management authentication', () => {
    render(<App />)
    for (const corner of ['tl', 'tr', 'bl', 'br']) fireEvent.pointerDown(screen.getByRole('button', { name: `hidden-${corner}` }))
    fireEvent.change(screen.getByRole('textbox', { name: 'システムパスワード' }), { target: { value: 'セルフレジ' } })
    fireEvent.click(screen.getByRole('button', { name: '認証' }))
    fireEvent.click(screen.getByRole('button', { name: /従業員ID認証/ }))
    for (const digit of '20261107') fireEvent.click(screen.getByRole('button', { name: digit }))
    fireEvent.click(screen.getByRole('button', { name: '従業員IDを照会' }))
    fireEvent.change(screen.getByRole('textbox', { name: '正解パスワード' }), { target: { value: 'あたらしいこたえ' } })
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))
    expect(screen.getByRole('status')).toHaveTextContent('保存しました')

    fireEvent.click(screen.getByRole('button', { name: '従業員メニュー' }))
    fireEvent.click(screen.getByRole('button', { name: 'セルフレジへ戻る' }))
    for (const corner of ['tl', 'tr', 'bl', 'br']) fireEvent.pointerDown(screen.getByRole('button', { name: `hidden-${corner}` }))
    fireEvent.change(screen.getByRole('textbox', { name: 'システムパスワード' }), { target: { value: 'あたらしいこたえ' } })
    fireEvent.click(screen.getByRole('button', { name: '認証' }))
    expect(screen.getByRole('heading', { name: '従業員モード' })).toBeInTheDocument()
  })

  it('returns from management authentication to the home screen', () => {
    render(<App />)
    for (const corner of ['tl', 'tr', 'bl', 'br']) fireEvent.pointerDown(screen.getByRole('button', { name: `hidden-${corner}` }))
    fireEvent.change(screen.getByRole('textbox', { name: 'システムパスワード' }), { target: { value: 'セルフレジ' } })
    fireEvent.click(screen.getByRole('button', { name: '戻る' }))
    expect(screen.getByRole('heading', { name: 'CIA MART 会計端末' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'システムパスワード' })).not.toBeInTheDocument()
  })

  it('allows up to 2.5 seconds between each Z touch', () => {
    vi.useFakeTimers()
    render(<App />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'hidden-tl' }))
    act(() => vi.advanceTimersByTime(2_400))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'hidden-tr' }))
    act(() => vi.advanceTimersByTime(2_400))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'hidden-bl' }))
    act(() => vi.advanceTimersByTime(2_400))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'hidden-br' }))
    expect(screen.getByRole('heading', { name: 'システムパスワード' })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('resets the Z touch sequence when one interval exceeds 2.5 seconds', () => {
    vi.useFakeTimers()
    render(<App />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'hidden-tl' }))
    act(() => vi.advanceTimersByTime(2_501))
    for (const corner of ['tr', 'bl', 'br']) {
      fireEvent.pointerDown(screen.getByRole('button', { name: `hidden-${corner}` }))
    }
    expect(screen.queryByRole('heading', { name: 'システムパスワード' })).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
