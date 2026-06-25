# Fumi — マーケティングプラン

作成日: 2026-06-26。
入力（証拠ベース）: [`MARKET-RESEARCH.md`](MARKET-RESEARCH.md)（GO 判定・ニッチ・3空白・競合表・地域機会）/ [`GO-TO-MARKET.md`](GO-TO-MARKET.md)（直販 MoR・$39 買い切り・100ユーザー上限ローンチ）/ [`../landing/index.html`](../landing/index.html)（現行 LP ドラフト）。

このドキュメントは iOS 向け apple-marketer フレームワークを **デスクトップ × 直販（将来 Mac App Store）** 製品に適応させたもの。iOS の「ASO」は本製品では **LP の SEO ＋ ストア／Product Hunt リスティングのキーワード**を指す（iOS App Store のみではない）。顧客向けコピー（英語）は貼り付けてそのまま使える形にしてある。

> 文中の数値・主張はすべて [`MARKET-RESEARCH.md`](MARKET-RESEARCH.md) の出典に紐づく。新たな指標は捏造していない。需要の裏付けが「取得済み」か「想定」かを区別して明記する。

---

## 1. ポジショニングステートメント（1文）

> **サブスクとクラウドAIに疲れた、プライバシー重視の Gmail パワーユーザー（とくに Windows/Linux ユーザー）にとって、Fumi は「買い切りで、メールを端末内に保ったまま、自分の API キーで AI を使える、高速・キーボードファーストのネイティブメールクライアント」である。Mac 専用で買い切りの無い Mimestream、月 $30 のサブスクである Superhuman、資格情報・メールをサーバに置く Spark/Shortwave とは違い、Fumi は買い切り（$39・裏切らない）× 真のローカル × Windows 対応 × BYO-key AI を同時に満たす。**

根拠: ニッチ定義（[`MARKET-RESEARCH.md` L19](MARKET-RESEARCH.md)）と「誰も埋めていない3空白」（同 L21-25, L90-94）。Pain スコア最高 11 が「Win/Linux ネイティブ Gmail 不在」「サードパーティのサーバ保存」の2点（同 L41-42）。

**英語（LP ヒーロー／Product Hunt tagline 用、貼り付け可）:**

> A fast, keyboard-first native email client for Gmail & IMAP — that keeps your mail on your own device, runs AI with **your own API key**, and is a **one-time $39 purchase**. On macOS, Windows, and Linux.

---

## 2. ターゲットセグメント（3つ）

研究はこの3層を名指ししている。各層に「名前 / 痛み（出典）/ 一行フック」を割り当てる。

### セグメント A — 「Mimestream が欲しい Windows/Linux ユーザー」

- **痛み**: Gmail ネイティブ最良の Mimestream が **Mac 専用**。新 Outlook(Windows) は Web ラッパー化・低速・機能削除で大量の不満。Pain スコア **11**（最高）。([`MARKET-RESEARCH.md` L41, L45](MARKET-RESEARCH.md) / HN 引用 *"I would love to have an app like this that used IMAP and was multiplatform!"* L51)
- **一行フック（EN）**: *"The native Gmail client Windows and Linux never got."*
- **一行フック（JA）**: 「Mimestream が欲しかった、Windows / Linux ユーザーへ。」

### セグメント B — 「Superhuman のサブスクに疲れた人」

- **痛み**: Superhuman は月 $30–40 のサブスクのみ・買い切り無し。*"Superhuman costs $30/month … both a Netflix and a Spotify subscription"*。買い切り志向 *"I would much prefer that over a subscription model."* Pain スコア **10**。([`MARKET-RESEARCH.md` L44, L53, L67](MARKET-RESEARCH.md))
- **一行フック（EN）**: *"Pay once. $39. Not $30 every month, forever."*
- **一行フック（JA）**: 「月 $30 のサブスクは、もういらない。$39、一度きり。」

### セグメント C — 「Spark/Shortwave のクラウド保存・クラウドAIが不安なプライバシー重視層」

- **痛み**: Spark は資格情報・メールを自社サーバに保管（cloud-proxy）、Shortwave は AI 処理で全文を外部送信。*"Reading Spark's privacy document … That rules out Spark for me."* Pain スコア **11 / 10**。([`MARKET-RESEARCH.md` L42-43, L52, L69, L72](MARKET-RESEARCH.md))
- **一行フック（EN）**: *"Your mail and your AI key never leave your machine."*
- **一行フック（JA）**: 「メールも AI キーも、端末の外に出さない。」

---

## 3. メッセージング

各ヘッドラインは「真の買い切り / ローカル＆プライベート / BYO-key AI / Windows 対応」の3空白（[`MARKET-RESEARCH.md` L90-94](MARKET-RESEARCH.md)）を先頭に出す。**誇大表現（"blazingly fast" 等）は使わず、事実だけ。**

### ヘッドライン候補（EN・顧客向け・貼り付け可）

| # | ヘッドライン | サブヘッド | 主訴求の空白 |
|---|---|---|---|
| H1 | **The native Gmail client Windows and Linux never got.** | Fast, keyboard-first, and yours to keep — a one-time $39 purchase, on macOS, Windows, and Linux. | Windows 対応 ＋ 買い切り |
| H2 | **Pay once. Your mail stays on your machine.** | Gmail & IMAP, keyboard-driven, with optional AI that runs on your own API key. No subscription, no cloud middleman. | 買い切り ＋ ローカル |
| H3 | **Email AI without sending your inbox to anyone's cloud.** | Summaries and smart replies run with your own Anthropic, OpenAI, or Google key — your mail goes straight to the provider you chose, and nowhere else. | BYO-key AI ＋ ローカル |
| H4 | **A real one-time purchase. We won't take it back.** | $39, once. Free updates within your version. No lifetime-license bait-and-switch. | 真の買い切り |
| H5 | **Mimestream-fast, on Windows and Linux too.** | A native Gmail experience that doesn't lock you to a Mac — and doesn't lock you into a subscription. | Windows 対応 ＋ 買い切り |

> 推奨: LP ヒーローは **H1**（最大空白＝Pain 11 を直撃）、Product Hunt は **H4**（買い切り炎上の反作用を取りに行く）、プライバシー系コミュニティ（r/privacy・独）は **H3**。

### "なぜ [競合] でないのか" の比較アングル（各ヘッドラインに添える）

- **vs Superhuman**: *"Superhuman is $30/month — about $360 a year, forever. Fumi is $39 once. Same keyboard-first speed, none of the subscription."*（[`MARKET-RESEARCH.md` L44, L67](MARKET-RESEARCH.md)）
- **vs Mimestream**: *"Mimestream is excellent — on Mac only, Gmail only, and $49.99/year. Fumi runs on Windows and Linux too, speaks IMAP, and you buy it once for $39."*（同 L68）
- **vs Spark**: *"Spark routes your mail and stores your credentials on their servers. Fumi keeps your email, contacts, and tokens on your device — no servers of ours ever see them."*（同 L69 / privacy 引用 L52）
- **（補助）vs Shortwave**: *"Shortwave's AI sends your full message to its cloud. Fumi's AI uses your key and talks directly to your chosen provider — opt-in, on your terms."*（同 L72）
- **（補助）vs Mailbird/Kiwi**: *"They sold a 'lifetime' license, then walked it back. Fumi's one-time purchase is the deal — and it stays the deal."*（同 L23, L78）

---

## 4. 価格設計（推奨を1つに絞る）

### 推奨（決定事項）

- **本体: $39 買い切り 1 ライセンス（据え置き）。** サブスクにしない。
- **トライアル: 14 日間フル機能（実装済み）を維持。** デスクトップ生産性ツールは「実際の受信箱で日常運用してみて初めて価値が分かる」性質で、短すぎると体験前に切れる。14 日はワークフロー定着に十分かつ離脱前に決済を促せる長さ。（トライアル基盤は [`GO-TO-MARKET.md` L60](GO-TO-MARKET.md) で実装済み）
- **メジャーバージョンアップは有償（割引アップグレード）。** v2 で既存ユーザーに割引価格。買い切りの黒字構造（サーバAIコストゼロ＝[`GO-TO-MARKET.md` L26](GO-TO-MARKET.md)）を継続開発原資に変える。**「バージョン内アップデートは無料・メジャーは有償割引」を最初から明示**し、Mailbird/Kiwi 型の「無料を装って後から課金」炎上を避ける（[`MARKET-RESEARCH.md` L23](MARKET-RESEARCH.md)）。
- **PPP 割引: BR / IN を初手の対象に。** 価格感度の高い地域に限り MoR（Lemon Squeezy）の PPP 機能で後追い適用（[`MARKET-RESEARCH.md` L118](MARKET-RESEARCH.md) / [`GO-TO-MARKET.md` L28](GO-TO-MARKET.md)）。de/ja は購買力が近く割引不要。

### $39 を正当化する数字（研究の競合価格で）

| 競合 | 価格 | 1年コスト | 3年コスト | Fumi 比 |
|---|---|---|---|---|
| **Fumi** | **$39 買い切り** | **$39** | **$39** | — |
| Superhuman | $30/月 | $360 | $1,080 | 3年で Fumi の **約28倍** |
| Mimestream | $49.99/年 | $49.99 | $149.97 | 初年で既に高い・3年で **約3.8倍** |
| Mailbird | ≈€73.80 買い切り＋年額 | ≈€73.80+ | 増加 | 初期だけで **約2倍**（しかも買い切り空洞化） |
| eM Client | $59.95 買い切り＋年額 | $59.95+ | 増加 | 初期で **約1.5倍** |
| Spark | $59.99/年 | $59.99 | $179.97 | 3年で **約4.6倍** |

（出典: [`MARKET-RESEARCH.md` 競合表 L67-79](MARKET-RESEARCH.md)）

**結論メッセージ（EN・LP/Pricing 用）**: *"Superhuman is $360 a year. Mimestream is $49.99 a year. Fumi is $39 — once."*

> 研究の判定どおり **$39 は「妥当〜やや割安」**（[`MARKET-RESEARCH.md` L117](MARKET-RESEARCH.md)）。値上げ余地はあるが、ローンチ初期は転換率とレビュー獲得を優先し据え置きが妥当。

---

## 5. ASO / SEO キーワード（LP-SEO ＋ Product Hunt ＋ 将来 MAS）

iOS の ASO を本製品向けに読み替え: **LP の `<title>`/`<meta description>`/H1・H2 と本文、Product Hunt のリスティング、将来の Mac App Store サブタイトル**。意図別に整理し、**需要証拠が研究で取れているもの**と **想定（要 Product Hunt/検索で後追い検証）** を明示する。

### 比較意図（competition keyword）— 最優先・刺さる導線

| キーワード | 需要証拠 |
|---|---|
| `mimestream for windows` | **証拠あり** — Mimestream Mac 専用 ＋ HN の "make this multiplatform" 要望（[L41, L51](MARKET-RESEARCH.md)）。研究も "Mimestream の Windows 版が欲しい人へ" を導線指定（L124） |
| `mimestream for linux` | **証拠あり**（同上、Linux も明示 L51） |
| `superhuman alternative one time purchase` | **証拠あり** — サブスク疲れ・買い切り志向の verbatim（[L44, L53](MARKET-RESEARCH.md)） |
| `spark email privacy alternative` | **証拠あり** — Spark のサーバ保存懸念 verbatim（[L42, L52, L69](MARKET-RESEARCH.md)） |
| `shortwave alternative byo api key` | 想定（Shortwave 外部送信は事実だが BYO-key 検索需要は未検証 — [L72](MARKET-RESEARCH.md)） |
| `new outlook alternative windows` | 想定（新 Outlook 不満は大量＝[L45](MARKET-RESEARCH.md) だが検索ボリューム未取得） |
| `kiwi for gmail alternative` | 想定（買い切り廃止炎上＝[L78](MARKET-RESEARCH.md) の反作用、検索需要は想定） |

### カテゴリ意図（category keyword）

| キーワード | 需要証拠 |
|---|---|
| `native gmail client windows` | **証拠あり**（最大空白 Pain 11 — [L41](MARKET-RESEARCH.md)） |
| `native gmail client linux` | **証拠あり**（同上） |
| `local email client no subscription` | **証拠あり**（買い切り需要 ＋ ローカルファースト空白 — [L44, L92](MARKET-RESEARCH.md)） |
| `private desktop email client` | **証拠あり**（サーバ保存不安 Pain 11 — [L42](MARKET-RESEARCH.md)） |
| `keyboard email client gmail` | 想定（差別化軸だが検索需要は未検証） |
| `imap email client mac windows linux` | 想定（Sparrow 終了後の空白＝[L47](MARKET-RESEARCH.md)、検索需要は想定） |

### 機能意図（feature keyword）

| キーワード | 需要証拠 |
|---|---|
| `byo api key email ai` | 想定（競合皆無の空白＝[L24, L93](MARKET-RESEARCH.md) だが検索需要は新カテゴリで未検証） |
| `on-device email ai` / `local email ai` | 想定（クラウドAI不信＝[L43](MARKET-RESEARCH.md) のカウンター、検索需要は想定） |
| `email summaries own openai key` | 想定（具体機能だが long-tail で薄い可能性） |
| `email client undo send schedule send` | 想定（汎用機能・競合多数） |

### 日本語キーワード（ja・低競合の空白を即取り）

| キーワード | 需要証拠 |
|---|---|
| `Gmail デスクトップ アプリ Windows` | **証拠あり**（Gmail PC1位 45.8% だが約74%が webmail でネイティブ無し — [L30, L105](MARKET-RESEARCH.md)） |
| `買い切り メールソフト` | **証拠あり**（日本は買い切り文化が強い — [L105](MARKET-RESEARCH.md)） |
| `Becky 代替 / 後継` | **証拠あり**（Becky! が唯一の有料和製・老朽＝[L105](MARKET-RESEARCH.md)） |
| `Gmail クライアント ネイティブ Mac` | 想定（Mimestream 日本語UIありが競合、long-tail） |

> **LP への即時反映（推奨・要素のみ。LP 編集は本タスク対象外）**: 現行 `<title>` は "a fast, private desktop email client"（[`landing/index.html` L6](../landing/index.html)）でブランド+汎用語のみ。比較意図キーワード（"native Gmail client for Windows", "one-time purchase", "Mimestream alternative"）を `<title>`/`<meta description>`/H1 に織り込むと SEO で空白語を取れる。

---

## 6. ローンチチャネル（投稿先 × 角度 × 順序）

オーガニック主軸。各チャネルは「ニッチのユーザーが実在する場所」を選ぶ。**Reddit 等の自己宣伝ルールに注意。**

| 順序 | チャネル | 角度（1行） | 注意・エチケットリスク |
|---|---|---|---|
| 1 | **r/macapps** | "I built a native Gmail client that's a one-time $39 purchase, not a subscription." | self-promo は許容気味だが、Flair / 透明な「I'm the dev」開示が必須。週1回まで |
| 1 | **r/privacy** | "A desktop email client that keeps mail + AI key on-device — no cloud middleman." | **自己宣伝に厳格**。製品名連呼は削除対象。価値・設計を語り、リンクは控えめに。アカウント実績がないと弾かれやすい |
| 2 | **Show HN（Hacker News）** | "Show HN: Fumi – a native Gmail/IMAP client, one-time purchase, BYO-key AI" | Show HN ガイドライン厳守（自作・試せるもの）。買い切り×ローカル×BYO-key は HN 層に最も刺さる（[L44, L51, L53](MARKET-RESEARCH.md) は全て HN 由来）。**100ユーザー上限**前提なので、初日に殺到すると上限に当たる点を本文で正直に明記 |
| 2 | **r/windows** | "The native Gmail client Windows didn't have — not a web wrapper like new Outlook." | 新 Outlook 不満（[L45](MARKET-RESEARCH.md)）を角度に。比較は事実ベースで（煽らない） |
| 3 | **Product Hunt** | "A real one-time purchase email client. Local-first. BYO-key AI." | ローンチ日にハンター/初動コメントを準備。tagline は H4。買い切り×プライバシーで差別化 |
| 3 | **r/gmail** | "A faster, keyboard-first way to run Gmail on the desktop — yours to keep." | Gmail Web の重さ（[L46](MARKET-RESEARCH.md)）を角度に |
| 4 | **Indie maker 系**（Indie Hackers / r/SideProject） | "Shipped a buy-once desktop app with MoR (Lemon Squeezy) — here's the GTM." | 製品より「作り手の学び」を語ると伸びる。買い切り×MoR の運用知見を出す |

**シーケンス方針**: まず **r/macapps + r/privacy（小さく検証・初動レビュー獲得）** → 反応を見て **Show HN + r/windows（最大流入）** → **Product Hunt + r/gmail（公式ローンチ）** → **Indie 系（メタ語り）**。**100ユーザー上限**（[`GO-TO-MARKET.md` L52-53](GO-TO-MARKET.md)）があるため、Show HN/PH の大流入は上限に当たる前提で「先着 N 名」「ウェイトリスト」を用意し、CASA 通過で解除する設計にする。

> Reddit 全般の共通リスク: 多くの sub が「self-promo は全投稿の10%以下」ルール。投稿前に各 sub のルールを読み、開発者であることを明示し、宣伝でなく議論として出す。複数 sub への同時 cross-post は spam 判定されやすいので時間差を空ける。

---

## 7. ローカライズ別マーケ

優先順位は研究どおり **en → ja（実装済み）→ de（次に作る最有力）**（[`MARKET-RESEARCH.md` L108-113](MARKET-RESEARCH.md)）。

### en（US/UK 主戦場・デフォルト）

- 最大の支払層、サブスク疲れ・買い切り需要の声が集中（[L104](MARKET-RESEARCH.md)）。
- 投稿先: Show HN / r/macapps / r/windows / r/privacy / Product Hunt（§6）。
- 角度: 買い切り（H4）＋ Windows 空白（H1）＋ BYO-key AI（H3）。

### ja（実装済みの優位・低競合の空白を即取り）

- **UI 日本語ローカライズ済み**（[`GO-TO-MARKET.md` L45](GO-TO-MARKET.md)）＝先行優位。Gmail PC1位 45.8% で約74%がネイティブ未使用の空白（[L30, L105](MARKET-RESEARCH.md)）。
- **日本での投稿先**: Zenn / Qiita（買い切り×ローカル×自前キー AI を技術記事で）、はてなブックマーク経由の技術系流入、X（日本の個人開発・Gmail パワーユーザー）。Becky! 老朽の文脈で「買い切りメールソフトの後継」を語ると刺さる。
- 角度: 「買い切り メールソフト」「Becky の後継」「Gmail を Windows でネイティブに」。

### de（次に作る最有力・プライバシー訴求）

- ローカルファースト/ノーテレメトリが独のプライバシー需要に合致。GDPR 文化・Proton/Tuta 人気が傍証（[L106](MARKET-RESEARCH.md)）。
- **投稿先**: r/de / r/datenschutz、独語の privacy 系コミュニティ、Heise/Golem 系の読者層（PR 寄せは慎重に）。
- 角度: H3（AI without sending your inbox to the cloud）＋ ローカルファースト＋ノーテレメトリ。**de ローカライズ完成を de 向けローンチの前提**にする（未訳で privacy 層に出すと信頼を損なう）。

---

## 8. 最初の30日プラン（週次チェックリスト）

前提: 決済（Lemon Squeezy 商品＋ライセンスキー）と OAuth クライアント本番公開が **未完**（[`GO-TO-MARKET.md` L58, L61](GO-TO-MARKET.md)）。最初の売上の前にこれらを閉じる。

### Week 1 — 売れる状態にする（ブロッカー解消）

- [ ] Lemon Squeezy アカウント開設 → 商品作成・ライセンスキー発行を有効化 → Store/Product ID・Buy URL を Secrets 設定（[`GO-TO-MARKET.md` L61](GO-TO-MARKET.md)）
- [ ] Google Cloud で OAuth クライアント（Desktop app）作成 → `VITE_GOOGLE_CLIENT_ID` 設定 → 同意画面を **「本番」公開**（Testing にしない＝L51）
- [ ] LP（`landing/index.html`）の `[BUY_URL]`/`[DOWNLOAD_URL]`/スクショ/連絡先を埋めて公開。`<title>`/`<meta>`/H1 に §5 の比較意図キーワードを反映（H1 案を採用）
- [ ] プライバシーポリシー/利用規約に事業者名・連絡先を埋めて公開 URL にホスト（[`GO-TO-MARKET.md` L56](GO-TO-MARKET.md)）
- [ ] LP ヒーロー = **H1**、Pricing コピー = §4 結論メッセージに差し替え

### Week 2 — 静かに検証 ＆ 初動レビュー

- [ ] **r/macapps** に投稿（H1 角度・開発者開示）→ 反応・バグ・価格反応を収集
- [ ] **r/privacy** に「設計を語る」投稿（製品名控えめ・H3 角度）→ 弾かれないか観察
- [ ] 初期購入者/トライアルユーザーから **証言（testimonial）2–3件**を取得（後の LP/PH 用）
- [ ] LP の「Mimestream の Windows 版が欲しい人へ」「Superhuman のサブスクに疲れた人へ」導線を1ページずつ用意（研究の指定導線＝[L124](MARKET-RESEARCH.md)）

### Week 3 — 最大流入（en）

- [ ] **Show HN** を投稿（"Show HN: Fumi – native Gmail/IMAP client, one-time purchase, BYO-key AI"）。本文に100ユーザー上限を正直に明記＋ウェイトリスト
- [ ] **r/windows**（新 Outlook 比較・事実ベース）＋ **r/gmail**（Gmail Web の重さ角度）に時間差投稿
- [ ] HN/Reddit のコメントに即レス（初動の議論が順位を決める）。価格・プライバシー・Win 対応の質問に事実で回答

### Week 4 — 公式ローンチ ＆ 次の地域

- [ ] **Product Hunt** ローンチ（tagline = H4・スクショ・初動コメント準備・前夜にハンター確定）
- [ ] **ja**: Zenn/Qiita に技術記事1本（買い切り×ローカル×BYO-key AI）＋ X で告知。「Becky 後継/買い切りメールソフト」角度
- [ ] **Indie Hackers**: 「buy-once × MoR の GTM 学び」をメタ語りで投稿
- [ ] 振り返り: 流入元別の購入数・トライアル転換・上限到達状況を集計 → 100到達が近ければ **CASA 審査着手**（[`GO-TO-MARKET.md` L63-65](GO-TO-MARKET.md)）。次は **de ローカライズ**を着手し de 向けローンチへ

> マイルストーン: **$39 × 100 = 約 $3,900** が未確認アプリ上限下の現実的な最初の天井（[`MARKET-RESEARCH.md` L31](MARKET-RESEARCH.md)）。ここを CASA 通過のトリガーにする。

---

## 付録: 研究との対応（トレーサビリティ）

| 本書のセクション | 根拠（MARKET-RESEARCH.md） |
|---|---|
| ポジショニング | ニッチ L19 / 3空白 L21-25, L90-94 |
| セグメント A/B/C | Pain 表 L41-47 / verbatim L51-55 / 競合表 L67-79 |
| メッセージング | 3空白 L90-94 / 競合価格 L67-79 |
| 価格設計 | 競合価格 L67-79 / 価格妥当性 L117 / PPP L118 |
| ASO/SEO | Pain 表 L41-47 / 日本 L30, L105 / 導線指定 L124 |
| ローンチチャネル | verbatim 出典（HN）L51-55 / 上限 GTM L52-53 |
| ローカライズ | 地域表 L102-106 / 優先順位 L108-113 |
| 30日プラン | GTM 残作業 L55-65 / SOM L31 |
