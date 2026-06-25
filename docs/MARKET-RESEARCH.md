# Fumi — 市場調査レポート

調査日: 2026-06-26。対象: デスクトップメールクライアント市場（Fumi = Mac/Win/Linux ネイティブ、Gmail+IMAP、ローカルファースト、BYO-key AI、買い切り $39）。
手法: 課題発見・競合地図・地域機会の3軸を並列リサーチ。全主張に出典 URL、確認できないものは「未取得」と明記。

---

## Step 4: 統合判定

### 判定: **GO**

3つの Go 条件をすべて満たす:
1. **Pain スコア 9 以上の課題が複数**（最高11: Win/Linux ネイティブ Gmail 不在、サードパーティのサーバ保存プライバシー不安）
2. **空白マップの「チャンス」象限に明確な体験**（買い切り × 真のローカル × Windows × Gmail ネイティブ × BYO-key AI を全て満たす競合がゼロ）
3. **低競合で課金文化の合う市場が複数**（英語圏＝デフォルト、独＝プライバシー訴求が合致、日＝Gmail 1位だが約74%がネイティブ無し）

### 狙うべきニッチ（一文）

> **サブスクとクラウドAIに疲れたプライバシー重視のパワーユーザー（特に Windows/Linux で Gmail を使う層）が、買い切りで・メールを端末内に保ったまま・自分の API キーで AI を使える、高速キーボードファーストなネイティブメールクライアント。**

### なぜ勝てるか — 競合が誰も埋めていない3つの空白

1. **本物の買い切りを守る** — 買い切り提供側の Mailbird・Kiwi が相次いで買い切りを空洞化/廃止して炎上（Kiwi は 2026-01-01 に lifetime 終了しサブスク強制）。Mimestream/Spark/Shortwave/Newton/Superhuman は最初から買い切り無し。→ **$39 買い切り（裏切らない）は明確な差別化。**
2. **BYO-key × ローカル AI** — AI を持つ競合（Superhuman/Spark/Shortwave/Newton/eM Client/Mailbird/Canary）は全て自社バンドル方式でメールを外部送信。外部に出さない競合（Thunderbird/Mimestream/Mailspring）は AI 自体が無い。→ **「自分のキーで・端末内で完結する AI」は競合皆無。**
3. **Windows でローカル×Gmail ネイティブ×高速キーボード** — Gmail ネイティブ最良の Mimestream は Mac 専用。新 Outlook はメール・資格情報を MS クラウドへ強制送信。→ **Windows の Gmail パワーユーザーは決定打が無い。**

### 推定市場規模（正直ベース）

- **TAM（厳密値）: 未取得（公開データなし）** — 「有料デスクトップ Gmail クライアント」単体の市場規模を示す一次データは確認できず。
- **方向性のある根拠**: Mimestream（$49.99/年・Mac 専用）が黒字で活発に開発継続している事実が「Gmail 専用ネイティブクライアントに金を払う層」の実在を示す。日本は Gmail が PC クライアント1位 45.8% だが約74%が webmail でネイティブ未使用＝顕在化した空白（[GIGAZINE 2026](https://gigazine.net/news/20260414-gigazine-user-mail-client/)）。
- **SOM（初年度の現実解）**: ローンチ初期は Google 未確認アプリの **100ユーザー上限**が事実上の天井。$39 × 100 = 約 $3,900 を最初のマイルストーンとし、CASA 通過で上限解除後にスケール。精緻な売上予測は推測になるため出さない。

---

## Step 1: Pain Discovery（課題発見）

### 課題一覧（スコア順）

| # | 課題 | 深 | 頻 | 支払 | 競合不満 | 合計 | 根拠 |
|---|---|---|---|---|---|---|---|
| 1 | Windows/Linux に良質なネイティブ Gmail クライアントが無い（Mimestream は Mac 専用） | 2 | 3 | 3 | 3 | **11** | [Mimestream FAQ](https://mimestream.com/faqs) / [HN](https://news.ycombinator.com/item?id=24422432) |
| 2 | サードパーティ（Spark等）が資格情報/メールを自社サーバに保存・経由するプライバシー不安 | 3 | 2 | 3 | 3 | **11** | [MPU Talk](https://talk.macpowerusers.com/t/spark-stores-email-account-credentials-on-their-servers/20388) / [Michael Tsai](https://mjtsai.com/blog/2016/12/01/spark-mail-stores-credentials-in-cloud/) |
| 3 | AI クライアント（Shortwave等）がメール全文をクラウド処理することへの不信 | 3 | 2 | 2 | 3 | **10** | [Shortwave security](https://www.shortwave.com/docs/guides/security/) |
| 4 | サブスク疲れ — 買い切りのメールクライアントが欲しい（Superhuman $30/月が高い） | 2 | 3 | 3 | 2 | **10** | [HN](https://news.ycombinator.com/item?id=24422432) / [Nick Lafferty](https://nicklafferty.com/reviews/superhuman/) |
| 5 | 新 Outlook(Windows) の機能削除・低速化・Webラッパー化への大量の不満 | 2 | 3 | 2 | 3 | **10** | [Windows News](https://windowsnews.ai/article/microsofts-new-outlook-for-windows-faces-widespread-criticism-over-performance-issues-and-forced-mig.409767) |
| 6 | Gmail Web UI の重さ（複数タブで数GBメモリ）・アプリ切替の煩雑さ | 2 | 3 | 2 | 2 | **9** | [HN](https://news.ycombinator.com/item?id=24422432) |
| 7 | IMAP 対応マルチプラットフォーム・ネイティブの不在（Sparrow 終了後の空白） | 2 | 2 | 2 | 2 | **8** | [HN](https://news.ycombinator.com/item?id=24422432) |

### ユーザーの生の声（抜粋・原文ママ）

- **Win/Linux 不在**: *"Can you make this a competitor to Thunderbird rather than being locked into GMail? I would love to have an app like this that used IMAP and was multiplatform!"* — HN, 2020-09
- **Spark のサーバ保存**: *"Reading Spark's privacy document … That rules out Spark for me."* — MacPowerUsers Talk, 2020-11
- **買い切り志向**: *"I would much prefer that over a subscription model."* / *"Superhuman costs $30/month, which is expensive enough to get you both a Netflix and a Spotify subscription."* — HN / Nick Lafferty
- **新 Outlook**: *"As a web wrapper, it often feels sluggish."* — Windows News
- **Gmail Web の重さ**: *"Five tabs of Gmail probably used a couple gigs of memory…"*（対して Mimestream は5アカウントで350MB）— HN

データ取得状況: Reddit 個別スレッドの verbatim は未取得（検索に indexed されず）→ HN・MPU フォーラム・MS 公式 Q&A・レビュー記事で補完。AI クラウド処理への個人 verbatim 発言は未取得（記事/ドキュメント記述で代替）。

---

## Step 2: Competitive Landscape（競合地図）

### 直接競合一覧

| アプリ | 価格 | プラットフォーム | プライバシー | AI | 弱み（空白） | 出典 |
|---|---|---|---|---|---|---|
| **Superhuman** | サブスクのみ $30–40/月 | Mac/Win/iOS/Android/web（Linux無） | 端末側だが read-receipt 炎上歴 | バンドル(BYO不可) | 高額・買い切り無し | [pricing](https://help.superhuman.com/hc/en-us/articles/38456109456147-Pricing-Plans) |
| **Mimestream** | サブスクのみ $49.99/年 | **Mac専用** | local-only | **無し** | Mac専用・**Gmail専用(IMAP非対応)**・買い切り無し | [pricing](https://mimestream.com/pricing) |
| **Spark** | フリーミアム $59.99/年 | Mac/Win/iOS/Android | **cloud-proxy（資格情報をサーバ保管）** | バンドル(BYO不可) | プライバシー懸念・買い切り無し | [privacy](https://support.readdle.com/spark/privacy/privacy-explained) |
| **Canary** | 買い切りあり $100/$300 | Mac/Win/iOS/Android | 混在 | バンドル | 買い切りが高額 | [pricing](https://canarymail.io/pricing) |
| **Newton** | サブスクのみ $49.99/年 | Mac/Win/iOS/Android | cloud-proxy | バンドル | 買収・閉鎖の不安定歴 | [review](https://email-tools.me/posts/newton-mail-review/) |
| **Shortwave** | サブスクのみ $7–24/月 | Mac/Win/iOS/Android/web（Linux無） | **cloud-proxy（全文外部送信）** | バンドル(BYO不可) | **Gmail専用**・外部送信・買い切り無し | [pricing](https://www.shortwave.com/pricing/) |
| **Thunderbird** | **無料/OSS** | Win/Mac/Linux/Android | local-only | **無し** | UIが古い・AI無し | [thunderbird.net](https://www.thunderbird.net/) |
| **Mailspring** | フリーミアム $8/月 | Mac/Win/Linux | local-only | **無し** | 同期バグ・AI無し・買い切り無し | [/pro](https://www.getmailspring.com/pro) |
| **Mailbird** | 買い切り≈€73.80 + 年額 | **Win/Mac**（Linux無） | local-only | バンドル | **買い切り空洞化で炎上**・Linux無し | [pricing](https://www.getmailbird.com/pricing/) |
| **Postbox** | **販売終了** | Win/Mac/Linux | local-only | 無し | 製品終了(2024-12) | [買収FAQ](https://support.postbox-inc.com/hc/en-us/articles/26987964800023-eM-Client-Acquisition-FAQ) |
| **eM Client** | 買い切り $59.95 + 年額 | Win/Mac/iOS/Android（Linux無） | local-first（AIはクリック時OpenAI） | バンドル | **Linux無し**・IMAP検索バグ・UI重い | [pricing](https://www.emclient.com/pricing) |
| **Kiwi for Gmail** | **買い切り廃止→サブスク強制** | Win/Mac | Electronラッパー | 無し | **Gmail専用**・重い・買い切り廃止炎上 | [pricing](https://www.kiwiforgmail.com/pricing) |
| **Mailbutler** | サブスクのみ（アドオン） | Apple Mail(Mac)/Outlook/Gmail拡張 | cloud-proxy | バンドル | **単体クライアントでない** | [pricing](https://www.mailbutler.io/pricing/) |

### 隣接競合・代替手段

| 手段 | なぜ不十分か |
|---|---|
| **Gmail web** | ブラウザタブ・真の local-first でない・IMAP非対応 |
| **新 Outlook** | メール・資格情報を MS クラウドへ**強制同期（オプトアウト不可）** — local/privacy-first と正反対（[cybernews](https://cybernews.com/privacy/new-outlook-copies-user-emails-to-microsoft-cloud/)） |
| **Apple Mail** | **Mac専用**・Gmail シングルキーショートカット非対応・IMAP ラベルで不安定挙動 |
| **Gmail PWA** | OS グローバルショートカット登録不可・中身は Chromium の Gmail（IMAP非対応） |

### 競合が「やっていないこと」トップ3

1. **本物の買い切りを守らない**（Mailbird/Kiwi が買い切り空洞化・廃止）→ Fumi の買い切りは空白
2. **BYO-key × ローカル AI を提供しない**（AI 持ち competitor は全て外部送信）→ 空白
3. **Windows で ローカル×Gmail ネイティブ×高速キーボードを同時に満たさない** → 空白

---

## Step 3: Regional Opportunity（地域機会）

### 地域別の要点

| 地域 | 評価 | 根拠 |
|---|---|---|
| **US/UK/AU/CA (en)** | 第一ターゲット・デフォルト | 最大の支払層・サブスク疲れと買い切り需要の声が集中（HN/レビュー） |
| **日本 (ja)** | 低競合・実装済みの優位 | Gmail が PC クライアント1位 45.8% だが**約74%が webmail でネイティブ無し**＝空白。Becky!(Win専用・¥4,400・1996年)が唯一の有料和製で老朽。Mimestream は日本語UIありだが Mac 専用。買い切り文化が強い（[GIGAZINE 2026](https://gigazine.net/news/20260414-gigazine-user-mail-client/) / [Grand View(Japan SaaS)](https://www.grandviewresearch.com/horizon/outlook/software-as-a-service-saas-market/japan)） |
| **ドイツ (de)** | **次点の最有力ローカライズ** | ローカルファースト/ノーテレメトリが独のプライバシー需要に合致。GDPR 文化・Proton/Tuta 人気が傍証 |

### ローカライズ優先順位

1. **en**（デフォルト・US/UK 主戦場）
2. **ja**（実装済み — 低競合の空白を即取りに行ける優位）
3. **de**（次に作る最有力 — プライバシー訴求と最も相性が良い）
4. 以降 fr / es は需要次第

### 価格戦略

- **$39 買い切りは妥当〜やや割安**（Mimestream $49.99/年・Mailbird ≈€73.80 買い切り対比）。サブスクでない点自体が訴求。
- BR/IN 等の価格感度が高い地域のみ Lemon Squeezy/Paddle の **PPP 割引**を後追い適用。

---

## 次のアクション

1. **ポジショニングを「買い切り×ローカル×BYO-key AI×Win対応」に固定**してLP・ASO 文言へ反映（競合が埋めていない3空白を前面に）。特に「**Mimestream の Windows 版が欲しい人へ**」「**Superhuman のサブスクに疲れた人へ**」は刺さる導線。
2. **Windows ビルドを一級市民として打ち出す**（Mimestream/Apple Mail が取りこぼす最大の空白）。
3. **「本物の買い切り（裏切らない）」を明示メッセージ化**（Mailbird/Kiwi の炎上の反作用を取りに行く）。
4. **AI は "your key, your data, on-device" を明確に**（クラウド AI 不信層へのカウンター）。
5. **次ローカライズは独語（de）**。日本語は実装済みの優位を ASO で即活用。
6. 出典の弱い項目（Reddit 一次引用・一部 Trustpilot 原文）はローンチ前にブラウザ実取得で補強。

> 関連: 販路・価格・ローンチ手順は [`GO-TO-MARKET.md`](GO-TO-MARKET.md) / [`RELEASE.md`](RELEASE.md)。
