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

type Screen = 'home' | 'points' | 'pointScan' | 'bag' | 'payment' | 'checkout' | 'settlement' | 'lock' | 'employee' | 'history'
type Corner = 'tl' | 'tr' | 'br' | 'bl'
type HomeDialog = 'guide' | 'staffConfirm' | 'staffCalled' | null
type EmployeeView = 'menu' | 'catalog' | 'terminal' | 'settings'
type CartLine = Product & { qty: number }
type Feedback = { tone: 'success' | 'error'; title: string; detail: string } | null
type Locale = 'ja' | 'en'

const corners: Corner[] = ['tl', 'tr', 'bl', 'br']
const Z_SEQUENCE_LIMIT_MS = 1_500

function KioskProgress({ current, locale }: { current: 'points' | 'bag' | 'payment' | 'checkout' | 'settlement'; locale: Locale }) {
  const steps = [
    ['points', locale === 'ja' ? 'ポイント' : 'Points'],
    ['bag', locale === 'ja' ? 'レジ袋' : 'Bag'],
    ['payment', locale === 'ja' ? '支払方法' : 'Payment'],
    ['checkout', locale === 'ja' ? '商品登録' : 'Scan'],
    ['settlement', locale === 'ja' ? 'お支払い' : 'Pay'],
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
  const [largeText, setLargeText] = useState(false)
  const [locale, setLocale] = useState<Locale>('ja')
  const [pointChoice, setPointChoice] = useState('未選択')
  const [bagChoice, setBagChoice] = useState('未選択')
  const [paymentChoice, setPaymentChoice] = useState('未選択')
  const [employeeView, setEmployeeView] = useState<EmployeeView>('menu')
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
    setPointChoice('未選択')
    setBagChoice('未選択')
    setPaymentChoice('未選択')
    setEmployeeView('menu')
    window.clearTimeout(sequenceTimer.current)
    sequenceRef.current = 0
    lastCornerInput.current = { corner: null, at: Number.NEGATIVE_INFINITY }
  }, [])

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
      announce({ tone: 'error', title: locale === 'ja' ? '商品が登録されていません' : 'Item not registered', detail: `${locale === 'ja' ? 'コード' : 'Code'} ${code}` })
      return
    }
    setCart((current) => {
      const existing = current.find((line) => line.barcode === product.barcode)
      return existing
        ? current.map((line) => line.barcode === product.barcode ? { ...line, qty: line.qty + 1 } : line)
        : [...current, { ...product, qty: 1 }]
    })
    play('scan')
    announce({ tone: 'success', title: locale === 'ja' ? '商品を追加しました' : 'Item added', detail: product.name })
  }, [announce, locale, play])

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
    setScreen(choice === '利用しない' ? 'bag' : 'pointScan')
  }

  const chooseBag = (choice: string, bagProduct?: Product) => {
    play('tap')
    setBagChoice(choice)
    setCart((current) => {
      const withoutBag = current.filter((line) => !line.barcode.startsWith('29000000000'))
      return bagProduct ? [...withoutBag, { ...bagProduct, qty: 1 }] : withoutBag
    })
    setScreen('payment')
  }

  const requestStaff = () => setDialog('staffConfirm')
  const callStaff = () => {
    play('tap')
    setDialog('staffCalled')
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
  const paymentInstruction = paymentChoice === 'クレジットカード'
    ? locale === 'ja' ? 'カードを決済端末に挿入してください' : 'Insert your card into the payment terminal'
    : paymentChoice === '交通系IC'
      ? locale === 'ja' ? 'カードまたは端末をタッチしてください' : 'Touch your card or device on the terminal'
      : paymentChoice === 'コード決済'
        ? locale === 'ja' ? '決済コードを読み取ってください' : 'Scan your payment code'
        : locale === 'ja' ? '現金を決済端末へ投入してください' : 'Insert cash into the payment terminal'
  const isJa = locale === 'ja'

  return (
    <main className={`app ${screen}${largeText ? ' largeText' : ''}`}>
      {(['home', 'points', 'pointScan', 'bag', 'payment', 'checkout', 'settlement'] as Screen[]).includes(screen) ? (
        <>
          <header className="kioskHeader">
            <div className="compactBrand"><i /><b>CIA MART</b><small>SELF CHECKOUT</small></div>
            <div className="homeUtilities">
              <button aria-label={isJa ? 'Switch to English' : '日本語に切り替える'} onClick={() => setLocale(isJa ? 'en' : 'ja')} type="button">文 <span>{isJa ? 'English' : '日本語'}</span></button>
              <button aria-label={largeText ? (isJa ? '標準表示に戻す' : 'Use standard text size') : (isJa ? '文字を大きくする' : 'Use larger text')} onClick={() => setLargeText((value) => !value)} type="button">Aa <span>{largeText ? (isJa ? '標準' : 'Standard') : (isJa ? '大きく' : 'Larger')}</span></button>
              <button aria-label={muted ? (isJa ? '効果音をオンにする' : 'Turn sound on') : (isJa ? '効果音をオフにする' : 'Turn sound off')} onClick={() => { void unlock(); toggleMuted() }} type="button">♪ <span>{muted ? 'OFF' : 'ON'}</span></button>
            </div>
          </header>
          {screen === 'home' ? (
            <section className="homeScreen">
              <h1 className="visuallyHidden">{isJa ? 'CIA MART 会計端末' : 'CIA MART Checkout'}</h1>
              <div className="homeLaunch">
                <button aria-label={isJa ? 'お会計を始める' : 'Start checkout'} className="startButton" onClick={beginCheckout} type="button">
                  <span className="startCopy"><small>{isJa ? 'CHECKOUT' : 'WELCOME'}</small><strong>{isJa ? 'お会計' : 'CHECKOUT'}</strong><b>{isJa ? '商品登録へ進む' : 'Start your purchase'}</b></span>
                  <span className="startVisual" aria-hidden="true">
                    <span className="productShape"><i /><i /><i /></span>
                    <span className="scanBeam" />
                    <span className="barcode"><i /><i /><i /><i /><i /><i /><i /><i /></span>
                  </span>
                  <span className="startArrow" aria-hidden="true">→</span>
                </button>
                <aside className="homeAssist" aria-label={isJa ? '補助メニュー' : 'Support menu'}>
                  <button aria-label={isJa ? '使い方を見る' : 'View instructions'} onClick={() => setDialog('guide')} type="button"><i aria-hidden="true">?</i><span><b>{isJa ? '使い方' : 'Help'}</b><small>{isJa ? '操作案内' : 'Instructions'}</small></span></button>
                  <button aria-label={isJa ? '係員を呼ぶ' : 'Call an attendant'} onClick={requestStaff} type="button"><i aria-hidden="true">●</i><span><b>{isJa ? '係員' : 'Attendant'}</b><small>{isJa ? '呼び出し' : 'Call for help'}</small></span></button>
                </aside>
              </div>
              <div className="homeGuide">
                <div><b>1</b><span><small>POINT</small>{isJa ? 'ポイント' : 'Points'}</span></div>
                <div><b>2</b><span><small>BAG</small>{isJa ? 'レジ袋' : 'Bag'}</span></div>
                <div><b>3</b><span><small>PAY</small>{isJa ? '支払方法' : 'Payment'}</span></div>
                <div><b>4</b><span><small>SCAN</small>{isJa ? '商品登録' : 'Scan items'}</span></div>
              </div>
            </section>
          ) : screen === 'pointScan' ? (
            <section className="pointScanScreen">
              <KioskProgress current="points" locale={locale} />
              <div className="pointScanPanel">
                <div className="pointReader" aria-hidden="true"><i /><i /></div>
                <small>POINT READER</small>
                <h1>{isJa ? 'ポイントカードを読み取ってください' : 'Scan your point card'}</h1>
                <p>{isJa ? `${pointChoice}のカードまたはアプリを、読み取り部へ近づけてください。` : `Hold your ${pointChoice} card or app near the reader.`}</p>
                <strong>{isJa ? '読み取りを待っています' : 'Waiting for card'}</strong>
              </div>
              <footer className="choiceFooter pointScanFooter">
                <button onClick={() => setScreen('points')} type="button">{isJa ? '戻る' : 'Back'}</button>
                <div><span>{isJa ? '選択中' : 'Selected'}</span><b>{pointChoice}</b></div>
                <button onClick={requestStaff} type="button">{isJa ? '係員' : 'Attendant'}</button>
              </footer>
            </section>
          ) : screen === 'checkout' ? (
            <section className="checkoutGrid">
              <KioskProgress current="checkout" locale={locale} />
              <section className="scanPanel">
                <header>
                  <span><small>STEP 1</small>{isJa ? '商品を読み取る' : 'Scan items'}</span>
                  <div className="panelActions"><b>SCAN ITEM</b><button onClick={() => { void unlock(); toggleMuted() }} type="button">{muted ? '音声 OFF' : '音声 ON'}</button></div>
                </header>
                <div className={`cameraFrame ${scannerState}`}>
                  <video aria-label="バーコード読取カメラ" muted playsInline ref={videoRef} />
                  <div className="scanGuide" aria-hidden="true"><i /><span>{isJa ? 'バーコードを枠内に合わせてください' : 'Place the barcode inside the frame'}</span></div>
                  {scannerState !== 'scanning' ? (
                    <div className="cameraState">
                      {scannerState === 'requesting-permission' ? <><b>{isJa ? 'カメラを準備しています' : 'Preparing camera'}</b><span>CAMERA STARTING</span></> : null}
                      {scannerState === 'permission-denied' ? <><b>{isJa ? 'カメラの使用が許可されていません' : 'Camera access is not allowed'}</b><span>{isJa ? 'ブラウザの設定からカメラを許可してください' : 'Allow camera access in your browser settings'}</span><button onClick={() => { setScannerState('requesting-permission'); void startScanner() }}>{isJa ? 'もう一度試す' : 'Try again'}</button></> : null}
                      {scannerState === 'unavailable' ? <><b>{isJa ? 'カメラを起動できませんでした' : 'Camera could not be started'}</b><span>{isJa ? '対応端末またはカメラ設定をご確認ください' : 'Check this device and its camera settings'}</span><button onClick={() => { setScannerState('requesting-permission'); void startScanner() }}>{isJa ? '再接続' : 'Reconnect'}</button></> : null}
                    </div>
                  ) : null}
                  <div className="cameraStatus"><i />{scannerState === 'scanning' ? (isJa ? '読取待機中' : 'Ready to scan') : (isJa ? 'カメラ確認中' : 'Checking camera')}</div>
                </div>
                <p>{isJa ? '商品のバーコードをカメラへ向けてください。画面から商品を選ぶことはできません。' : 'Hold the product barcode in front of the camera. Items cannot be selected on screen.'}</p>
              </section>

              <section className="cartPanel">
                <header>
                  <div><span><small>STEP 2</small>{isJa ? 'お買い物かご' : 'Basket'}</span><b>SHOPPING CART</b></div>
                  <strong>{cartCount}<small>{isJa ? '点' : ' items'}</small></strong>
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
                    <div className="emptyCart"><i /><b>{isJa ? '商品はまだありません' : 'No items scanned'}</b><span>{isJa ? '左側のカメラでバーコードを読み取ってください' : 'Scan a barcode using the camera'}</span></div>
                  )}
                </div>
                <footer>
                  <div><span>{isJa ? '合計（税込）' : 'Total'}</span><strong>¥{cartTotal.toLocaleString()}</strong></div>
                  <button disabled={!cart.length} onClick={() => { play('tap'); setScreen('settlement') }} type="button">{isJa ? '支払いへ' : 'Proceed to payment'}</button>
                </footer>
              </section>

              <footer className="checkoutFooter">
                <button onClick={goHome} type="button">{isJa ? 'はじめに戻る' : 'Start over'}</button>
                <span>{isJa ? `ポイント: ${pointChoice} / レジ袋: ${bagChoice} / 支払: ${paymentChoice}` : `Points: ${pointChoice} / Bag: ${bagChoice} / Payment: ${paymentChoice}`}</span>
                <button onClick={requestStaff} type="button">{isJa ? '係員を呼ぶ' : 'Call attendant'}</button>
              </footer>

              {feedback ? (
                <div aria-live="polite" className={`feedback ${feedback.tone}`} role="status">
                  <i>{feedback.tone === 'success' ? '✓' : '!'}</i>
                  <span><b>{feedback.title}</b><small>{feedback.detail}</small></span>
                </div>
              ) : null}
            </section>
          ) : screen === 'settlement' ? (
            <section className="settlementScreen">
              <KioskProgress current="settlement" locale={locale} />
              <div className="settlementLayout">
                <section className="settlementSummary">
                  <small>PAYMENT</small>
                  <h1>{isJa ? 'お支払い' : 'Payment'}</h1>
                  <dl>
                    <div><dt>{isJa ? '商品点数' : 'Items'}</dt><dd>{cartCount}{isJa ? '点' : ''}</dd></div>
                    <div><dt>{isJa ? 'レジ袋' : 'Bag'}</dt><dd>{bagChoice}</dd></div>
                    <div><dt>{isJa ? '支払方法' : 'Method'}</dt><dd>{paymentChoice}</dd></div>
                  </dl>
                  <div className="settlementTotal"><span>{isJa ? '合計（税込）' : 'Total'}</span><strong>¥{cartTotal.toLocaleString()}</strong></div>
                </section>
                <section aria-live="polite" className="paymentTerminal" role="status">
                  <div className="terminalPulse" aria-hidden="true"><i /><i /><i /></div>
                  <span>PAYMENT TERMINAL</span>
                  <h2>{paymentInstruction}</h2>
                  <p>{isJa ? '決済端末からの応答を待っています' : 'Waiting for the payment terminal'}</p>
                  <div className="waitingLine" aria-hidden="true"><i /></div>
                  <b>WAITING FOR PAYMENT</b>
                </section>
              </div>
              <footer className="settlementFooter">
                <button onClick={goHome} type="button">{isJa ? '取引を中止' : 'Cancel transaction'}</button>
                <span>{isJa ? '決済が完了するまで商品をお持ちにならないでください' : 'Please wait until payment is complete'}</span>
                <button onClick={requestStaff} type="button">{isJa ? '係員を呼ぶ' : 'Call attendant'}</button>
              </footer>
            </section>
          ) : (
            <section className="choiceScreen">
              <KioskProgress current={screen as 'points' | 'bag' | 'payment'} locale={locale} />
              <div className="choiceCard">
                <div className="choiceHeading">
                  <small>{screen === 'points' ? 'POINT CARD' : screen === 'bag' ? 'SHOPPING BAG' : 'PAYMENT'}</small>
                  <h1>{screen === 'points' ? (isJa ? 'ポイントカード' : 'Point card') : screen === 'bag' ? (isJa ? 'レジ袋' : 'Shopping bag') : (isJa ? 'お支払い' : 'Payment method')}</h1>
                  <p>{screen === 'points' ? (isJa ? 'お持ちのカードを選択' : 'Select your point card') : screen === 'bag' ? (isJa ? '必要なサイズを選択' : 'Select a bag') : (isJa ? '支払方法を選択' : 'Select a payment method')}</p>
                </div>
                <div className="choiceTiles" data-options={screen === 'payment' ? '4' : '3'}>
                  {screen === 'points' ? (
                    <>
                      <button onClick={() => choosePoint('CIA POINT')} type="button"><i>CP</i><b>CIA POINT</b><small>ポイントカード</small></button>
                      <button onClick={() => choosePoint('提携ポイント')} type="button"><i>＋P</i><b>提携ポイント</b><small>PARTNER POINT</small></button>
                      <button className="neutral" onClick={() => choosePoint('利用しない')} type="button"><i>—</i><b>{isJa ? '利用しない' : 'No point card'}</b><small>{isJa ? 'ポイントカードなし' : 'Continue without points'}</small></button>
                    </>
                  ) : screen === 'bag' ? (
                    <>
                      <button onClick={() => chooseBag('小 1枚', findProduct('2900000000032') ?? undefined)} type="button"><i>袋</i><b>{isJa ? '小' : 'Small'}</b><small>{isJa ? '1枚 / ¥3' : '1 bag / ¥3'}</small></button>
                      <button onClick={() => chooseBag('大 1枚', findProduct('2900000000056') ?? undefined)} type="button"><i>袋</i><b>{isJa ? '大' : 'Large'}</b><small>{isJa ? '1枚 / ¥5' : '1 bag / ¥5'}</small></button>
                      <button className="neutral" onClick={() => chooseBag('不要')} type="button"><i>×</i><b>{isJa ? '不要' : 'No bag'}</b><small>{isJa ? '袋なし' : 'Continue without a bag'}</small></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => choosePayment('クレジットカード')} type="button"><i>▣</i><b>{isJa ? 'クレジット' : 'Credit card'}</b><small>{isJa ? 'カード' : 'Insert card'}</small></button>
                      <button onClick={() => choosePayment('交通系IC')} type="button"><i>IC</i><b>{isJa ? '交通系IC' : 'Transit IC'}</b><small>{isJa ? 'タッチ決済' : 'Touch payment'}</small></button>
                      <button onClick={() => choosePayment('コード決済')} type="button"><i>▦</i><b>{isJa ? 'コード決済' : 'Code payment'}</b><small>{isJa ? 'QR・バーコード' : 'QR or barcode'}</small></button>
                      <button onClick={() => choosePayment('現金')} type="button"><i>¥</i><b>{isJa ? '現金' : 'Cash'}</b><small>{isJa ? '紙幣・硬貨' : 'Notes and coins'}</small></button>
                    </>
                  )}
                </div>
              </div>
              <footer className="choiceFooter">
                <button onClick={() => setScreen(screen === 'points' ? 'home' : screen === 'bag' ? 'points' : 'bag')} type="button">{isJa ? '戻る' : 'Back'}</button>
                <div><span>{isJa ? 'ポイント' : 'Points'}</span><b>{pointChoice}</b><span>{isJa ? 'レジ袋' : 'Bag'}</span><b>{bagChoice}</b></div>
                <button onClick={requestStaff} type="button">{isJa ? '係員' : 'Attendant'}</button>
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
                <button aria-label={isJa ? '閉じる' : 'Close'} className="dialogClose" onClick={() => setDialog(null)} type="button">×</button>
                {dialog === 'guide' ? (
                  <>
                    <span>HOW TO USE</span><h2>{isJa ? 'セルフレジの使い方' : 'How to use this checkout'}</h2>
                    <ol><li><b>1</b>{isJa ? 'ポイント・レジ袋・支払方法を選択' : 'Select points, bag and payment method'}</li><li><b>2</b>{isJa ? 'カメラで商品のバーコードを読み取る' : 'Scan each product barcode with the camera'}</li><li><b>3</b>{isJa ? '商品と点数を確認して支払いへ進む' : 'Check your items and proceed to payment'}</li></ol>
                    <button className="dialogPrimary" onClick={beginCheckout} type="button">{isJa ? 'お会計を始める' : 'Start checkout'}</button>
                  </>
                ) : null}
                {dialog === 'staffConfirm' ? (
                  <>
                    <span>ASSISTANCE</span><h2>{isJa ? '係員を呼びますか？' : 'Call an attendant?'}</h2>
                    <p>{isJa ? '操作方法がわからない場合や、お困りの際に係員を呼び出せます。' : 'Call an attendant if you need help with this checkout.'}</p>
                    <div className="dialogActions"><button onClick={() => setDialog(null)} type="button">{isJa ? '呼ばない' : 'Cancel'}</button><button className="dialogPrimary" onClick={callStaff} type="button">{isJa ? '係員を呼ぶ' : 'Call attendant'}</button></div>
                  </>
                ) : null}
                {dialog === 'staffCalled' ? (
                  <>
                    <span>ASSISTANCE</span><div className="staffSignal"><i /><i /><i /></div><h2>{isJa ? '係員を呼び出しました' : 'An attendant has been called'}</h2>
                    <p>{isJa ? 'そのままお待ちください。混雑状況により、お伺いまでお時間をいただく場合や、対応できない場合がございます。' : 'Please wait at this checkout. During busy periods, assistance may be delayed or unavailable.'}</p>
                    <button className="dialogPrimary" onClick={() => setDialog(null)} type="button">{isJa ? '画面に戻る' : 'Return to checkout'}</button>
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
                  <span data-label="時刻">{transaction.time}</span><span data-label="取引番号">{transaction.id}</span><span data-label="利用者">{transaction.name}</span><span data-label="社員ID">{transaction.employeeId}</span><strong data-label="合計">¥{total(transaction).toLocaleString()}</strong>
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
