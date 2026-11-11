# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## コマンド

パッケージマネージャーは **npm**（`package-lock.json` と CI の `npm ci` が前提）。

```bash
npm install                    # 依存パッケージのインストール
npm run dev                    # 開発サーバー起動 (http://localhost:5173/)
npm run build                  # dist/ へビルド
npm run build -- --mode ghp    # GitHub Pages 向けビルド (.env.ghp を使用)
npm run preview                # ビルド結果のプレビュー
npm run dev:host               # LAN 内に公開して起動 (同じ Wi-Fi のスマホ実機で確認用)
npm run preview:host           # ビルド結果を LAN 内に公開
npx prettier --write src/js    # 整形 (.prettierrc: セミコロンなし・シングルクォート・printWidth 200)
```

- Windows では画像最適化用の `sharp` のために `npm install @img/sharp-win32-x64` が別途必要な場合がある。
- 自動テスト・lint は存在しない。`src/test/audio_latency.html`（効果音の再生方式ごとの遅延計測）は開発サーバー経由で開いて確認する（実機では `npm run dev:host` で起動し `http://<PCのIP>:5173/test/...` を開く）。
- `.env.sample` をコピーして `.env` を作成し、`VITE_SITE_URL`（デプロイ先 URL）を設定する。

## アーキテクチャ

「さかなへんクイズ」。2011 年の HTML5+JavaScript 版を TypeScript でリファクタリングしたもの。HTML Canvas のシングルページアプリで、ゲームロジックはほぼすべて `src/js/sakana.ts` の `SakanaHen` クラスにある。`src/index.html` が `<canvas id="id_canvas">` を用意し `SakanaHen` をインスタンス化する（`src/js/index.ts` は re-export のみ）。

ゲームの状態遷移: タイトル画面 → `startGame(level)` → クイズ進行（`requestAnimationFrame` で `frame()` → `update(delta)` → `draw()`） → `endGame()` → 結果画面 → タイトルへ戻る

### Vite 構成 (`vite.config.mjs`)

- `root: 'src'`、`envDir: '../'`（`.env*` はリポジトリ直下）、出力は `dist/`、`base: './'`（相対パスでどこにでも設置可能）。
- `src/public/` はそのままコピーされる静的ファイル（OG 画像 `images/thumbnail.png`、SVG の Content-Type 用 `.htaccess`）。
- `index.html` 内の `%VITE_SITE_URL%` は Vite 標準の HTML 環境変数置換で展開される（og:image 用）。
- カスタムプラグイン `html-version-inject` が `id="version"` 要素の中身を `package.json` の `version` に置き換える。バージョン表示を変えるときは `package.json` を更新する。
- `vite-plugin-image-optimizer` でビルド時に画像を最適化する。

### 重要な設計ポイント

- **カスタマイズ箇所**: `sakana.ts` 冒頭の `LEVEL_INFO`（レベルごとの制限時間・問題数・選択肢数）。コンストラクタの `options` は `Object.assign` でインスタンスに上書きされる。
- **時間管理**: 進行はフレーム数ではなく経過時間(mS)で計算する（`sushiElapsed` / `hitElapsed`）。1 フレームの経過時間は `MAX_FRAME_DELTA` で上限を設け、タブ非表示中はゲームが実質一時停止する。
- **サウンド**: `src/js/libs/sound_player.ts` の `SoundPlayer` が Web Audio API（`AudioContext` + デコード済みバッファ）で再生する。`HTMLAudioElement` は iOS（特に LINE 等のアプリ内ブラウザ）で効果音の連続再生やユーザー操作外からの再生が失敗することがあったため使わない。`playSound(id, endFunc)` の `endFunc` は「再生終了・再生できない・タイムアウト」のいずれかで必ず 1 回呼ばれ、音声が無い/再生できない環境でも進行が止まらない。キャンバスのクリックのたびに `soundPlayer.unlock()` で `AudioContext` を再開する（ユーザー操作外の時間切れ・結果画面の音を鳴らすため。iOS の中断状態からの復帰も兼ねる）。iOS では消音スイッチ（マナーモード）中も鳴らすため、iOS 16.4 以降は `navigator.audioSession.type = 'playback'`、それより古い iOS（`audioSession` が無い）と Web Audio 非対応環境では `HTMLAudioElement` で再生する（v0.3.0 と同じ方式）。HTMLAudio では audio 要素を 1 回再生したら使い捨て、次の再生用の新しい要素を事前に作っておく（`prepareAudio()`）。iPhone 6S（iOS 15）では同じ要素を頭出し（`currentTime = 0`）して再生し直すと、頭出しの完了待ちで効果音が遅れ（約 280mS）、何回か再生すると音の頭が切れるため（頭出しを再生終了時に済ませて要素 2 つを交互に使っても頭は切れた。WAV にしても切れ、無音のループ再生で音声出力を立ち上げたままにしても改善しなかった）。検証は `src/test/audio_latency.html` で行った。古い iOS では Web Audio が消音スイッチで必ず消音され、無音 `<audio>` をループ再生する回避策も効かなかったため。また v0.4.0 で入れた「全音声をミュート再生してアンロック」する処理は、iPhone 6S / iOS 15 で消音スイッチ中に鳴らなくなる原因と見られるため行わない。
- **読み込み失敗時**: 画像が 1 枚でも読めなければ `drawErrorMessage()` でエラー表示して停止する（壊れた画像は `drawImage` で例外になるため）。
- **クイズデータ**: `src/js/consts/sakana_data.ts`（`[漢字, 読み]` の配列）。画像・音声のファイルリスト、結果メッセージ、フォントは `src/js/consts/def_data.ts`。
- **アセット読み込み**: `new URL(\`../assets/...\`, import.meta.url)` で Vite のアセット解決を利用する。新しい画像・音声は `src/assets/` に置き `def_data.ts` のリストに追加する。音声は OGG 優先、非対応ブラウザでは MP3 にフォールバックするため両形式を用意する。
- **デザイン（回転寿司屋）**: タイトルは藍ののれん＋難易度の木札（並=初級 / 上=中級 / 特上=上級、`LEVEL_INFO.grade`）。ゲーム画面は壁（品書き木札・黒板のステータス）→ くーまん（板前）→ `table.svg`（上からネタケース / 寿司レーン / ヒノキのカウンター）→ 皿（問題の漢字は皿に立てた木札に書く）→ 回答の品書き板、の順に重ねる。皿は画像ではなく `draw.ts` の `drawSushiPlate()`（白磁に藍の二重線）で描き、ゲーム画面（`drawQuizPlate()`）と結果画面の皿積みで共通にしている。木札・板・縦書きは `src/js/libs/draw.ts` のヘルパーで描画し、配色は `sakana.ts` の `COLOR` と `draw.ts` の `WOOD_*`。壁の品書き（`WALL_MENU`）は答えのヒントにならないよう魚偏以外の品にする。
- **結果画面（お会計）**: 左に伝票（コース・まちがえた品・皿の枚数・正解率・判子）、右に付け台越しのくーまん（成績で表情が変わる）と吹き出し、正解数だけ積み上がる皿、下に「おかわり（同じ難易度で再挑戦）」「ごちそうさま（タイトルへ）」のボタン。伝票には**正解の読みを出さない**（何度も挑戦してもらうため。まちがえた漢字だけを並べる）。判子の格付けとメッセージは `def_data.ts` の `RESULT_INFO`。皿積み・判子の演出は `resultFrame()` が `performance.now()` 基準で描画し、演出中にボタン以外をクリックすると演出を飛ばす。結果のサウンド（ファンファーレ等）は画面切り替え時ではなく判子を押すタイミング（`getStampTime()`）で鳴らす。
- **ゲーム画面のレイアウト**: `KUMAN_Y` / `TABLE_Y` と、`table.svg` 内の位置 `LANE_OFFSET` / `COUNTER_OFFSET` で決まる。`table.svg` の構成を変えたらこれらも合わせる。レーンのベルトの継ぎ目は `getBeltLayer()`（画面幅＋継ぎ目 1 つ分の画像）を皿の位置に合わせて継ぎ目 1 つ分の範囲でずらして貼り、皿がベルトに乗って流れて見えるようにしている。回答ボタンは 2 列で、カウンター上の空きの上下中央に配置する（`ANSWER_HEIGHT` / `ANSWER_GAP` / `ANSWER_SIDE_PADDING`）。
- **ゲーム画面の描画コスト**: 毎フレームの `draw()` は事前に描いたレイヤー（オフスクリーンキャンバス）を `drawImage` で貼るだけにする。木の板の影（`shadowBlur`）・角丸の切り抜き・曲線などを毎フレーム描くと、古いスマホでレーンと皿の動きがガタつくため（v0.5.0 で発生）。背景（壁・品書き・くーまん・`table.svg`・回答の板・黒板）は `getGameBackground()` が状態をキーにして変わったときだけ描き直し、皿と木札は問題ごと（`getQuizPlateLayer()`）、SVG は内部解像度で画像化（`getImageLayer()`）する。キャッシュは `layerCache` に種類ごと 1 枚で、キーに `pixelScale` を含むので解像度変更時は自動で作り直される。ゲーム画面に描く要素を足すときは、動くものだけを `draw()` に、それ以外は背景のレイヤーに入れ、キーに描画内容を決める状態を含めること。
- **状態管理**: `state`（`loading` / `title` / `starting` / `playing` / `result` / `error`）で画面を管理する。canvas の `click` / `mousemove` リスナーは `init()` で 1 度だけ登録し、`onClick` / `onMouseMove` が `state` で処理を振り分ける。画面ごとにリスナーを付け外ししないこと。
- **論理座標と解像度**: 描画・当たり判定はすべて `CANVAS_WIDTH` x `CANVAS_HEIGHT`（400x500 の縦長）の論理座標で行う。`this.canvas.width/height` は表示サイズ × `devicePixelRatio` の内部解像度なので、描画コードで論理サイズとして使わないこと。`resize()` が `ResizeObserver` で表示サイズ変更に追従して内部解像度と `setTransform` を更新し、`redraw()` で現在の画面を描き直す。
- **表示サイズ**: `index.html` の CSS で、縦横比 `--canvas-aspect` を保ったまま画面幅・画面高さ（ノッチ等の安全領域を除く）・最大幅 600px に収まるよう伸縮させ、画面の上下左右中央に配置する。ページ自体はスクロール・拡大させない（`#container` を `position: fixed`、canvas は `touch-action: none`、viewport は `user-scalable=no`）。LINE のアプリ内ブラウザでプレイ中に画面が縮小して押せなくなる問題への対策。`--canvas-aspect` は `CANVAS_WIDTH / CANVAS_HEIGHT` と一致させること。CSS で幅が指定されていない埋め込み先では `isWidthSizedByCss()` が判定し、論理サイズのインラインスタイルを設定する。
- **座標補正**: `getCanvasPos()` が `getBoundingClientRect()` の表示サイズと論理サイズの比率からキャンバス座標に変換する。CSS でどう拡大縮小しても埋め込み側で補正値を設定する必要はない。
- **データ検証**: `init()` で `validateQuizData()` が `LEVEL_INFO` とクイズデータの整合（問題数 ≦ データ件数、選択肢数 ≦ 読みの種類数）をチェックし、不足ならエラー表示して停止する。
- **デバッグログ**: `debug` フラグは `import.meta.env.DEV` で初期化され、`Log.info()` は開発モード時のみ出力される。

### デプロイ

`.github/workflows/gh-pages.yml` は全ブランチへの push で `npm ci` → `npm run build -- --mode ghp` を実行するが、GitHub Pages へのデプロイは **`release/ghp` ブランチへの push 時のみ**（README の「main にプッシュでデプロイ」は古い記述）。
