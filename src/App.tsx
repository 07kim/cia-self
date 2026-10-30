import { useCallback, useEffect, useRef, useState } from 'react'
import { useAudio } from './audio'
import {
  scannerErrorState,
  startBarcodeScanner,
  type ScannerSession,
  type ScannerState,
} from './barcode-scanner'
import { findProduct, type Product } from './catalog'
import { searchTransactions, total, type Transaction } from './data'

type Screen = 'home' | 'checkout' | 'lock' | 'history'
type Corner = 'tl' | 'tr' | 'br' | 'bl'
type HomeDialog = 'manual' | 'guide' | 'staff' | 'language' | null
type CartLine = Product & { qty: number }
type Feedback = { tone: 'success' | 'error'; title: string; detail: string } | null

const corners: Corner[] = ['tl', 'tr', 'bl', 'br']
const Z_SEQUENCE_LIMIT_MS = 1_500

export function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [sequence, setSequence] = useState(0)
  const [answer, setAnswer] = useState('')
  const [denied, setDenied] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [scannerState, setScannerState] = useState<ScannerState>('idle')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [dialog, setDialog] = useState<HomeDialog>(null)
  const [manualCode, setManualCode] = useState('')
  const [largeText, setLargeText] = useState(false)
  const timer = useRef<number>(0)
  const feedbackTimer = useRef<number>(0)
  const sequenceTimer = useRef<number>(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanner = useRef<ScannerSession | null>(null)
  const lastRead = useRef({ code: '', at: 0 })
  const lastCornerInput = useRef<{ corner: Corner | null; at: number }>({ corner: null, at: Number.NEGATIVE_INFINITY })
  const sequenceRef = useRef(0)
  const { muted, play, toggleMuted, unlock } = useAudio()

  const goHome = useCallback(() => {
    scanner.current?.stop()
    scanner.current = null
    setScreen('home')
    setSequence(0)
    setAnswer('')
    setDenied(false)
    setQuery('')
    setSelected(null)
    setCart([])
    setScannerState('idle')
    setFeedback(null)
    setDialog(null)
    setManualCode('')
    window.clearTimeout(sequenceTimer.current)
    sequenceRef.current = 0
    lastCornerInput.current = { corner: null, at: Number.NEGATIVE_INFINITY }
  }, [])

  useEffect(() => {
    if (screen === 'home') return
    const reset = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(goHome, screen === 'checkout' ? 60_000 : 10_000)
    }
    reset()
    const events = ['pointerdown', 'keydown', 'input']
    events.forEach((event) => window.addEventListener(event, reset))
    return () => {
      window.clearTimeout(timer.current)
      events.forEach((event) => window.removeEventListener(event, reset))
    }
  }, [goHome, screen])

  useEffect(() => () => {
    scanner.current?.stop()
    window.clearTimeout(feedbackTimer.current)
    window.clearTimeout(sequenceTimer.current)
  }, [])

  const announce = useCallback((next: Exclude<Feedback, null>) => {
    setFeedback(next)
    window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 2_400)
  }, [])

  const onBarcode = useCallback((rawCode: string) => {
    const code = rawCode.trim()
    const now = Date.now()
    if (lastRead.current.code === code && now - lastRead.current.at < 1_800) return
    lastRead.current = { code, at: now }
    const product = findProduct(code)
    if (!product) {
      play('unknown')
      announce({ tone: 'error', title: '商品が登録されていません', detail: `コード ${code}` })
      return
    }
    setCart((current) => {
      const existing = current.find((line) => line.barcode === product.barcode)
      return existing
        ? current.map((line) => line.barcode === product.barcode ? { ...line, qty: line.qty + 1 } : line)
        : [...current, { ...product, qty: 1 }]
    })
    play('scan')
    announce({ tone: 'success', title: '商品を追加しました', detail: product.name })
  }, [announce, play])

  const startScanner = useCallback(async () => {
    if (!videoRef.current || scanner.current) return
    try {
      scanner.current = await startBarcodeScanner(videoRef.current, onBarcode)
      setScannerState('scanning')
    } catch (error) {
      setScannerState(scannerErrorState(error))
    }
  }, [onBarcode])

  useEffect(() => {
    if (screen !== 'checkout') return
    const startTimer = window.setTimeout(() => void startScanner(), 0)
    return () => {
      window.clearTimeout(startTimer)
      scanner.current?.stop()
      scanner.current = null
    }
  }, [screen, startScanner])

  const touchCorner = (corner: Corner) => {
    const current = sequenceRef.current
    const next = corner === corners[current] ? current + 1 : corner === 'tl' ? 1 : 0
    sequenceRef.current = next
    setSequence(next)
    if (next === 4) {
      window.clearTimeout(sequenceTimer.current)
      scanner.current?.stop()
      scanner.current = null
      setSequence(0)
      sequenceRef.current = 0
      setScreen('lock')
    } else if (next > 0) {
      window.clearTimeout(sequenceTimer.current)
      sequenceTimer.current = window.setTimeout(() => {
        sequenceRef.current = 0
        setSequence(0)
      }, Z_SEQUENCE_LIMIT_MS)
    } else if (next === 0) {
      window.clearTimeout(sequenceTimer.current)
    }
  }

  const handleCornerInput = (corner: Corner, now: number) => {
    const previous = lastCornerInput.current
    if (previous.corner === corner && now - previous.at < 500) return
    lastCornerInput.current = { corner, at: now }
    touchCorner(corner)
  }

  const beginCheckout = () => {
    void unlock().then(() => play('tap'))
    setScannerState('requesting-permission')
    setDialog(null)
    setScreen('checkout')
  }

  const submitManualCode = () => {
    const code = manualCode.normalize('NFKC').replace(/\s/g, '')
    if (!code) return
    beginCheckout()
    onBarcode(code)
    setManualCode('')
  }

  const authenticate = () => {
    if (answer.normalize('NFKC').trim() === 'ばいてん') {
      play('granted')
      setScreen('history')
      setAnswer('')
      setDenied(false)
    } else {
      play('denied')
      setDenied(true)
      window.setTimeout(goHome, 1_200)
    }
  }

  const updateQty = (barcode: string, delta: number) => {
    play('tap')
    setCart((current) => current
      .map((line) => line.barcode === barcode ? { ...line, qty: line.qty + delta } : line)
      .filter((line) => line.qty > 0))
  }

  const cartTotal = cart.reduce((sum, line) => sum + line.price * line.qty, 0)
  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0)
  const results = searchTransactions(query)

  return (
    <main className={`app ${screen}${largeText ? ' largeText' : ''}`}>
      {(screen === 'home' || screen === 'checkout') ? (
        <>
          {screen === 'home' ? (
            <section className="homeScreen">
              <div className="homeCopy">
                <div className="compactBrand"><i /><b>CIA MART</b><small>SELF CHECKOUT</small></div>
                <h1>いらっしゃいませ</h1>
                <p>商品のバーコードをカメラにかざして<br />お買い物を始めてください。</p>
                <div className="homeVisual" aria-hidden="true">
                  <div className="productShape"><i /><i /><i /></div>
                  <div className="scanBeam" />
                  <div className="barcode"><i /><i /><i /><i /><i /><i /><i /><i /></div>
                  <b>バーコードをカメラで読み取ります</b>
                </div>
              </div>
              <div className="homeMenu">
                <button className="startButton" onClick={beginCheckout} type="button">
                  <span><small>画面をタッチ</small>お買い物を始める</span>
                  <b aria-hidden="true">→</b>
                </button>
                <button className="menuButton code" onClick={() => setDialog('manual')} type="button">
                  <i aria-hidden="true">▥</i><span><b>商品コードを入力</b><small>カメラを使わずに登録</small></span>
                </button>
                <button className="menuButton guide" onClick={() => setDialog('guide')} type="button">
                  <i aria-hidden="true">?</i><span><b>使い方を見る</b><small>お買い物の手順</small></span>
                </button>
                <button className="menuButton staff" onClick={() => setDialog('staff')} type="button">
                  <i aria-hidden="true">●</i><span><b>係員を呼ぶ</b><small>お困りのとき</small></span>
                </button>
                <button className="menuButton language" onClick={() => setDialog('language')} type="button">
                  <i aria-hidden="true">文</i><span><b>日本語</b><small>LANGUAGE</small></span>
                </button>
                <button className="menuButton display" onClick={() => setLargeText((value) => !value)} type="button">
                  <i aria-hidden="true">Aa</i><span><b>{largeText ? '標準表示に戻す' : '文字を大きくする'}</b><small>画面表示</small></span>
                </button>
                <button
                  className="menuButton sound"
                  onClick={() => { void unlock(); toggleMuted() }}
                  type="button"
                >
                  <i aria-hidden="true">♪</i><span><b>{muted ? '効果音をオンにする' : '効果音をオフにする'}</b><small>{muted ? 'SOUND OFF' : 'SOUND ON'}</small></span>
                </button>
              </div>
              <div className="homeGuide">
                <div><b>1</b><span><small>SCAN</small>バーコードをかざす</span></div>
                <div><b>2</b><span><small>CHECK</small>商品・点数を確認</span></div>
                <div><b>3</b><span><small>PAY</small>内容を確認して次へ</span></div>
              </div>
            </section>
          ) : (
            <section className="checkoutGrid">
              <section className="scanPanel">
                <header>
                  <span><small>STEP 1</small>商品を読み取る</span>
                  <div className="panelActions"><b>SCAN ITEM</b><button onClick={() => { void unlock(); toggleMuted() }} type="button">{muted ? '音声 OFF' : '音声 ON'}</button></div>
                </header>
                <div className={`cameraFrame ${scannerState}`}>
                  <video aria-label="バーコード読取カメラ" muted playsInline ref={videoRef} />
                  <div className="scanGuide" aria-hidden="true"><i /><span>バーコードを枠内に合わせてください</span></div>
                  {scannerState !== 'scanning' ? (
                    <div className="cameraState">
                      {scannerState === 'requesting-permission' ? <><b>カメラを準備しています</b><span>CAMERA STARTING</span></> : null}
                      {scannerState === 'permission-denied' ? <><b>カメラの使用が許可されていません</b><span>ブラウザの設定からカメラを許可してください</span><button onClick={() => { setScannerState('requesting-permission'); void startScanner() }}>もう一度試す</button></> : null}
                      {scannerState === 'unavailable' ? <><b>カメラを起動できませんでした</b><span>対応端末またはカメラ設定をご確認ください</span><button onClick={() => { setScannerState('requesting-permission'); void startScanner() }}>再接続</button></> : null}
                    </div>
                  ) : null}
                  <div className="cameraStatus"><i />{scannerState === 'scanning' ? '読取待機中' : 'カメラ確認中'}</div>
                </div>
                <p>商品のJANコード、またはCIA MARTの商品コードをカメラへ向けてください。</p>
              </section>

              <section className="cartPanel">
                <header>
                  <div><span><small>STEP 2</small>お買い物かご</span><b>SHOPPING CART</b></div>
                  <strong>{cartCount}<small>点</small></strong>
                </header>
                <div className="cartLines">
                  {cart.length ? cart.map((line) => (
                    <article className="cartLine" key={line.barcode}>
                      <span className={`categoryIcon ${line.category}`}>{line.name.slice(0, 1)}</span>
                      <div><b>{line.name}</b><small>{line.barcode} / 税率 {line.taxRate}%</small></div>
                      <div className="quantity">
                        <button aria-label={`${line.name}を1点減らす`} onClick={() => updateQty(line.barcode, -1)} type="button">−</button>
                        <b>{line.qty}</b>
                        <button aria-label={`${line.name}を1点増やす`} onClick={() => updateQty(line.barcode, 1)} type="button">＋</button>
                      </div>
                      <strong>¥{(line.price * line.qty).toLocaleString()}</strong>
                    </article>
                  )) : (
                    <div className="emptyCart"><i /><b>商品はまだありません</b><span>左側のカメラでバーコードを読み取ってください</span></div>
                  )}
                </div>
                <footer>
                  <div><span>合計（税込）</span><strong>¥{cartTotal.toLocaleString()}</strong></div>
                  <button disabled={!cart.length} onClick={() => play('complete')} type="button">内容を確認する</button>
                </footer>
              </section>

              <footer className="checkoutFooter">
                <button onClick={goHome} type="button">はじめに戻る</button>
                <span>お困りの場合は係員をお呼びください</span>
                <button onClick={() => setDialog('staff')} type="button">係員を呼ぶ</button>
              </footer>

              {feedback ? (
                <div aria-live="polite" className={`feedback ${feedback.tone}`} role="status">
                  <i>{feedback.tone === 'success' ? '✓' : '!'}</i>
                  <span><b>{feedback.title}</b><small>{feedback.detail}</small></span>
                </div>
              ) : null}
            </section>
          )}

          {corners.map((corner) => (
            <button
              aria-label={`hidden-${corner}`}
              className={`corner ${corner}${sequence === corners.indexOf(corner) + 1 ? ' touched' : ''}`}
              key={corner}
              onPointerDown={(event) => {
                event.preventDefault()
                handleCornerInput(corner, event.timeStamp)
              }}
              onTouchStart={(event) => {
                event.preventDefault()
                handleCornerInput(corner, event.timeStamp)
              }}
              type="button"
            ><i /></button>
          ))}

          {dialog ? (
            <div className="dialogBackdrop" onPointerDown={(event) => {
              if (event.currentTarget === event.target) setDialog(null)
            }}>
              <section aria-modal="true" className="homeDialog" role="dialog">
                <button aria-label="閉じる" className="dialogClose" onClick={() => setDialog(null)} type="button">×</button>
                {dialog === 'manual' ? (
                  <>
                    <span>MANUAL ENTRY</span><h2>商品コードを入力</h2>
                    <p>バーコードの下にある数字を入力してください。</p>
                    <input aria-label="商品コード" inputMode="numeric" onChange={(event) => setManualCode(event.target.value)} placeholder="13桁または8桁の商品コード" value={manualCode} />
                    <button className="dialogPrimary" disabled={!manualCode.trim()} onClick={submitManualCode} type="button">商品を登録する</button>
                  </>
                ) : null}
                {dialog === 'guide' ? (
                  <>
                    <span>HOW TO USE</span><h2>セルフレジの使い方</h2>
                    <ol><li><b>1</b>「お買い物を始める」をタッチ</li><li><b>2</b>商品のバーコードをカメラにかざす</li><li><b>3</b>商品と点数を確認して次へ進む</li></ol>
                    <button className="dialogPrimary" onClick={beginCheckout} type="button">お買い物を始める</button>
                  </>
                ) : null}
                {dialog === 'staff' ? (
                  <>
                    <span>ASSISTANCE</span><div className="staffSignal"><i /><i /><i /></div><h2>係員を呼び出しました</h2>
                    <p>そのまま画面の前でお待ちください。</p>
                    <button className="dialogPrimary" onClick={() => setDialog(null)} type="button">画面に戻る</button>
                  </>
                ) : null}
                {dialog === 'language' ? (
                  <>
                    <span>LANGUAGE</span><h2>表示言語</h2>
                    <button className="languageChoice selected" onClick={() => setDialog(null)} type="button"><b>日本語</b><small>選択中</small></button>
                    <p>現在、この端末は日本語でご利用いただけます。</p>
                  </>
                ) : null}
              </section>
            </div>
          ) : null}
        </>
      ) : null}

      {screen === 'lock' ? (
        <section className="lock">
          <div className="lockcard">
            <span>管理機能認証</span>
            <div className="puzzle">謎画像をここへ差し替え</div>
            <h1>システムパスワード</h1>
            <input aria-label="システムパスワード" autoFocus onChange={(event) => setAnswer(event.target.value)} placeholder="回答を入力" value={answer} />
            <button disabled={!answer.trim()} onClick={authenticate}>認証</button>
            {denied ? <p className="error">認証に失敗しました</p> : null}
          </div>
        </section>
      ) : null}

      {screen === 'history' ? (
        <section className="admin">
          <header><div><span>CIA MART / BACK OFFICE</span><h1>購入履歴</h1></div><button onClick={goHome}>セルフレジへ戻る</button></header>
          <div className="toolbar"><input aria-label="履歴検索" onChange={(event) => setQuery(event.target.value)} placeholder="氏名または社員IDで検索" value={query} /><b>{results.length}件</b></div>
          <div className="history">
            <div className="table">
              <div className="thead"><span>時刻</span><span>取引番号</span><span>利用者</span><span>社員ID</span><span>合計</span></div>
              {results.map((transaction) => (
                <button className={selected?.id === transaction.id ? 'active' : ''} key={transaction.id} onClick={() => setSelected(transaction)}>
                  <span>{transaction.time}</span><span>{transaction.id}</span><span>{transaction.name}</span><span>{transaction.employeeId}</span><strong>¥{total(transaction).toLocaleString()}</strong>
                </button>
              ))}
              {!results.length ? <p className="empty">該当する履歴はありません</p> : null}
            </div>
            <aside className="detail">
              {selected ? <><span>TRANSACTION DETAIL</span><h2>{selected.id}</h2><dl><div><dt>日時</dt><dd>2026/11/20 {selected.time}</dd></div><div><dt>利用者</dt><dd>{selected.name} / {selected.employeeId}</dd></div><div><dt>端末</dt><dd>{selected.register}</dd></div><div><dt>支払</dt><dd>{selected.payment}</dd></div></dl><h3>商品明細</h3>{selected.items.map((item) => <div className="item" key={item.barcode}><span><b>{item.name}</b><small>{item.barcode}</small></span><span>{item.qty}点</span><strong>¥{(item.price * item.qty).toLocaleString()}</strong></div>)}<div className="sum"><span>合計（税込）</span><strong>¥{total(selected).toLocaleString()}</strong></div></> : <p>履歴を選択すると商品明細を表示します</p>}
            </aside>
          </div>
        </section>
      ) : null}
    </main>
  )
}
