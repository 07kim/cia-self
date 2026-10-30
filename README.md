# cia-self

CIA MARTのイベント用セルフレジWebアプリです。iPad横向きの全画面利用を想定し、通常の商品読取画面と、隠し操作から開く購入履歴画面を同じ端末内で提供します。

## 主な機能

- カメラによるEAN-13 / EAN-8バーコード読取
- 端末内の商品台帳、買い物かご、数量・合計表示
- 読取成功・未登録・主要操作のオフライン効果音
- 四隅操作から開く管理認証と購入履歴検索
- 通信切断後も事前読込済み画面を使えるオフライン対応

## 開発確認

```sh
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

カメラはHTTPSまたはlocalhostでのみ利用できます。本番採用前に、実際に使用するiPadとChromeでカメラ許可、JAN読取、横画面、音量を確認してください。

製品仕様は `docs/PRODUCT_SPEC.md`、技術境界は `docs/ARCHITECTURE.md` を参照してください。
