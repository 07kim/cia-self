import { useCallback, useEffect, useRef, useState } from 'react'
import { useAudio } from './audio'
import {
  scannerErrorState,
  startBarcodeScanner,
  type ScannerSession,
  type ScannerState,
} from './barcode-scanner'
import { findProduct, products, type Product } from './catalog'
import { searchTransactions, total, type Transaction } from './data'

type Screen = 'home' | 'points' | 'bag' | 'payment' | 'checkout' | 'complete' | 'lock' | 'employee' | 'history'
type Corner = 'tl' | 'tr' | 'br' | 'bl'
type HomeDialog = 'manual' | 'guide' | 'staff' | 'language' | null
type EmployeeView = 'menu' | 'catalog' | 'terminal' | 'settings'
type CartLine = Product & { qty: number }
type Feedback = { tone: 'success' | 'error'; title: string; detail: string } | null

const corners: Corner[] = ['tl', 'tr', 'bl', 'br']
const Z_SEQUENCE_LIMIT_MS = 1_500

function KioskProgress({ current }: { current: 'points' | 'bag' | 'payment' | 'checkout' | 'complete' }) {
  const steps = [
    ['points', 'ポイント'],
    ['bag', 'レジ袋'],
    ['payment', '支払方法'],
    ['checkout', '商品登録'],
    ['complete', '完了'],
  ] as const
  const currentIndex = steps.findIndex(([id]) => id === current)
  return (
    <nav aria-label="お会計の進行" className="kioskProgress">
      {steps.map(([id, label], index) => (
        <span className={index === currentIndex ? 'current' : index < currentIndex ? 'done' : ''} key={id}>
          <i>{index < currentIndex ? '✓' : index + 1}</i>{label}
        </span>
      ))}
    </nav>
  )
}

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
  const [pointChoice, setPointChoice] = useState('未選択')
  const [bagChoice, setBagChoice] = useState('未選択')
  const [paymentChoice, setPaymentChoice] = useState('未選択')
  const [employeeView, setEmployeeView] = useState<EmployeeView>('menu')
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
    setPointChoice('未選択')
    setBagChoice('未選択')
    setPaymentChoice('未選択')
    setEmployeeView('menu')
    window.clearTimeout(sequenceTimer.current)
    sequenceRef.current = 0
    lastCornerInput.current = { corner: null, at: Number.NEGATIVE_INFINITY }
  }, [])

  useEffect(() => {
    if (screen === 'home') return
    const reset = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(
        goHome,
        ['points', 'bag', 'payment', 'checkout', 'complete'].includes(screen) ? 60_000 : 10_000,
      )
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
    setDialog(null)
    setScreen('points')
  }

  const submitManualCode = () => {
    const code = manualCode.normalize('NFKC').replace(/\s/g, '')
    if (!code) return
    void unlock().then(() => play('tap'))
    setDialog(null)
    setScreen('points')
    onBarcode(code)
    setManualCode('')
  }

  const authenticate = () => {
    if (answer.normalize('NFKC').trim() === 'ばいてん') {
      play('granted')
      setScreen('employee')
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

  const choosePoint = (choice: string) => {
    play('tap')
    setPointChoice(choice)
    setScreen('bag')
  }

  const chooseBag = (choice: string) => {
    play('tap')
    setBagChoice(choice)
    setScreen('payment')
  }

  const choosePayment = (choice: string) => {
    play('tap')
    setPaymentChoice(choice)
    setScannerState('requesting-permission')
    setScreen('checkout')
  }

  const cartTotal = cart.reduce((sum, line) => sum + line.price * line.qty, 0)
  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0)
  const results = searchTransactions(query)

  return (
    <main className={`app ${screen}${largeText ? ' largeText' : ''}`}>
      {(['home', 'points', 'bag', 'payment', 'checkout', 'complete'] as Screen[]).includes(screen) ? (
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
          ) : screen === 'checkout' ? (
            <section className="checkoutGrid">
              <KioskProgress current="checkout" />
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
                <div className="quickProducts">
                  <span>商品選択</span>
                  {products.slice(0, 4).map((product) => (
                    <button key={product.barcode} onClick={() => onBarcode(product.barcode)} type="button">
                      <i aria-hidden="true">{product.name.slice(0, 1)}</i><b>{product.name}</b><small>¥{product.price}</small>
                    </button>
                  ))}
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
                  <button disabled={!cart.length} onClick={() => { play('complete'); setScreen('complete') }} type="button">お会計を確定</button>
                </footer>
              </section>

              <footer className="checkoutFooter">
                <button onClick={goHome} type="button">はじめに戻る</button>
                <span>ポイント: {pointChoice} / レジ袋: {bagChoice} / 支払: {paymentChoice}</span>
                <button onClick={() => setDialog('staff')} type="button">係員を呼ぶ</button>
              </footer>

              {feedback ? (
                <div aria-live="polite" className={`feedback ${feedback.tone}`} role="status">
                  <i>{feedback.tone === 'success' ? '✓' : '!'}</i>
                  <span><b>{feedback.title}</b><small>{feedback.detail}</small></span>
                </div>
              ) : null}
            </section>
          ) : screen === 'complete' ? (
            <section className="completeScreen">
              <KioskProgress current="complete" />
              <div className="completeCard">
                <i aria-hidden="true">✓</i>
                <span>お会計完了</span>
                <h1>ありがとうございました</h1>
                <dl>
                  <div><dt>点数</dt><dd>{cartCount}点</dd></div>
                  <div><dt>レジ袋</dt><dd>{bagChoice}</dd></div>
                  <div><dt>支払</dt><dd>{paymentChoice}</dd></div>
                  <div><dt>合計</dt><dd>¥{cartTotal.toLocaleString()}</dd></div>
                </dl>
                <button onClick={goHome} type="button">はじめに戻る</button>
              </div>
            </section>
          ) : (
            <section className="choiceScreen">
              <KioskProgress current={screen as 'points' | 'bag' | 'payment'} />
              <div className="choiceCard">
                <div className="choiceHeading">
                  <span>CIA MART / SELF CHECKOUT</span>
                  <h1>{screen === 'points' ? 'ポイント' : screen === 'bag' ? 'レジ袋' : '支払方法'}</h1>
                  <p>{screen === 'points' ? 'ポイントカードを選択' : screen === 'bag' ? '必要なレジ袋を選択' : 'お支払い方法を選択'}</p>
                </div>
                <div className="choiceTiles">
                  {screen === 'points' ? (
                    <>
                      <button onClick={() => choosePoint('貯める')} type="button"><i>＋P</i><b>貯める</b><small>ポイント付与</small></button>
                      <button onClick={() => choosePoint('使う')} type="button"><i>−P</i><b>使う</b><small>ポイント利用</small></button>
                      <button className="neutral" onClick={() => choosePoint('利用しない')} type="button"><i>—</i><b>利用しない</b><small>次へ</small></button>
                    </>
                  ) : screen === 'bag' ? (
                    <>
                      <button onClick={() => chooseBag('小 1枚')} type="button"><i>袋</i><b>小</b><small>1枚 / ¥3</small></button>
                      <button onClick={() => chooseBag('大 1枚')} type="button"><i>袋</i><b>大</b><small>1枚 / ¥5</small></button>
                      <button className="neutral" onClick={() => chooseBag('不要')} type="button"><i>×</i><b>不要</b><small>袋なし</small></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => choosePayment('クレジットカード')} type="button"><i>▣</i><b>クレジット</b><small>カード</small></button>
                      <button onClick={() => choosePayment('交通系IC')} type="button"><i>IC</i><b>交通系IC</b><small>タッチ決済</small></button>
                      <button onClick={() => choosePayment('コード決済')} type="button"><i>▦</i><b>コード決済</b><small>QR・バーコード</small></button>
                      <button onClick={() => choosePayment('現金')} type="button"><i>¥</i><b>現金</b><small>紙幣・硬貨</small></button>
                    </>
                  )}
                </div>
              </div>
              <footer className="choiceFooter">
                <button onClick={() => setScreen(screen === 'points' ? 'home' : screen === 'bag' ? 'points' : 'bag')} type="button">戻る</button>
                <div><span>ポイント</span><b>{pointChoice}</b><span>レジ袋</span><b>{bagChoice}</b></div>
                <button onClick={() => setDialog('staff')} type="button">係員</button>
              </footer>
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
                    <ol><li><b>1</b>ポイント・レジ袋・支払方法を選択</li><li><b>2</b>カメラまたは商品ボタンで商品を登録</li><li><b>3</b>商品と点数を確認して会計を確定</li></ol>
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

      {screen === 'employee' ? (
        <section className="employeeMode">
          <header>
            <div><span>CIA MART / STAFF CONSOLE</span><h1>従業員モード</h1></div>
            <button onClick={goHome} type="button">セルフレジへ戻る</button>
          </header>
          {employeeView === 'menu' ? (
            <div className="employeeTiles">
              <button onClick={() => setScreen('history')} type="button"><i>履</i><b>購入履歴</b><small>取引・商品明細</small></button>
              <button onClick={() => setEmployeeView('catalog')} type="button"><i>品</i><b>商品台帳</b><small>価格・商品コード</small></button>
              <button onClick={() => setEmployeeView('terminal')} type="button"><i>端</i><b>端末状態</b><small>カメラ・通信・音声</small></button>
              <button onClick={() => setEmployeeView('settings')} type="button"><i>設</i><b>取引設定</b><small>会計フロー・税率</small></button>
            </div>
          ) : (
            <div className="employeePanel">
              <button className="employeeBack" onClick={() => setEmployeeView('menu')} type="button">← 従業員メニュー</button>
              {employeeView === 'catalog' ? (
                <><span>PRODUCT MASTER</span><h2>商品台帳</h2><div className="catalogList">{products.map((product) => <div key={product.barcode}><i className={product.category}>{product.name.slice(0, 1)}</i><span><b>{product.name}</b><small>{product.barcode}</small></span><strong>¥{product.price}</strong></div>)}</div></>
              ) : null}
              {employeeView === 'terminal' ? (
                <><span>TERMINAL STATUS</span><h2>端末状態</h2><div className="statusTiles"><div><b>カメラ</b><strong>READY</strong></div><div><b>商品台帳</b><strong>{products.length} ITEMS</strong></div><div><b>効果音</b><strong>{muted ? 'OFF' : 'ON'}</strong></div><div><b>データ</b><strong>LOCAL</strong></div></div></>
              ) : null}
              {employeeView === 'settings' ? (
                <><span>TRANSACTION SETTINGS</span><h2>取引設定</h2><div className="settingsList"><div><b>会計フロー</b><span>ポイント → レジ袋 → 支払方法 → 商品登録</span></div><div><b>消費税</b><span>軽減8% / 標準10%</span></div><div><b>履歴保存</b><span>イベント固定データ</span></div></div></>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {screen === 'history' ? (
        <section className="admin">
          <header><div><span>CIA MART / STAFF CONSOLE</span><h1>購入履歴</h1></div><button onClick={() => setScreen('employee')}>従業員メニュー</button></header>
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
