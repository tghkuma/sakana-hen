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
- 自動テスト・lint は存在しない。`src/test/audio_test.html`（サウンド再生テスト）は開発サーバー経由で開いて確認する。
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
- **サウンド**: `playSound(id, endFunc)` の `endFunc` は「再生終了・再生失敗・タイムアウト」のいずれかで必ず 1 回呼ばれる。音声が無い/再生できない環境でも進行が止まらないことを前提にしている。iOS Safari 対策として、最初のレベル選択タップ時に `unlockSounds()` で全サウンドをミュート再生してアンロックする（ユーザー操作外の時間切れ・結果画面の音を鳴らすため）。
- **読み込み失敗時**: 画像が 1 枚でも読めなければ `drawErrorMessage()` でエラー表示して停止する（壊れた画像は `drawImage` で例外になるため）。
- **クイズデータ**: `src/js/consts/sakana_data.ts`（`[漢字, 読み]` の配列）。画像・音声のファイルリスト、結果メッセージ、フォントは `src/js/consts/def_data.ts`。
- **アセット読み込み**: `new URL(\`../assets/...\`, import.meta.url)` で Vite のアセット解決を利用する。新しい画像・音声は `src/assets/` に置き `def_data.ts` のリストに追加する。音声は OGG 優先、非対応ブラウザでは MP3 にフォールバックするため両形式を用意する。
- **状態管理**: `state`（`loading` / `title` / `starting` / `playing` / `result` / `error`）で画面を管理する。canvas の `click` / `mousemove` リスナーは `init()` で 1 度だけ登録し、`onClick` / `onMouseMove` が `state` で処理を振り分ける。画面ごとにリスナーを付け外ししないこと。
- **論理座標と解像度**: 描画・当たり判定はすべて `CANVAS_WIDTH` x `CANVAS_HEIGHT`（400x500 の縦長）の論理座標で行う。回答ボタンは画面下部に寄せて配置する（`ANSWER_ROW_GAP` / `ANSWER_AREA_PADDING`）。`this.canvas.width/height` は表示サイズ × `devicePixelRatio` の内部解像度なので、描画コードで論理サイズとして使わないこと。`resize()` が `ResizeObserver` で表示サイズ変更に追従して内部解像度と `setTransform` を更新し、`redraw()` で現在の画面を描き直す。
- **表示サイズ**: `index.html` の CSS で、縦横比 `--canvas-aspect` を保ったまま画面幅・画面高さ（ノッチ等の安全領域を除く）・最大幅 600px に収まるよう伸縮させ、画面の上下左右中央に配置する。`--canvas-aspect` は `CANVAS_WIDTH / CANVAS_HEIGHT` と一致させること。CSS で幅が指定されていない埋め込み先では `isWidthSizedByCss()` が判定し、論理サイズのインラインスタイルを設定する。
- **座標補正**: `getCanvasPos()` が `getBoundingClientRect()` の表示サイズと論理サイズの比率からキャンバス座標に変換する。CSS でどう拡大縮小しても埋め込み側で補正値を設定する必要はない。
- **データ検証**: `init()` で `validateQuizData()` が `LEVEL_INFO` とクイズデータの整合（問題数 ≦ データ件数、選択肢数 ≦ 読みの種類数）をチェックし、不足ならエラー表示して停止する。
- **デバッグログ**: `debug` フラグは `import.meta.env.DEV` で初期化され、`Log.info()` は開発モード時のみ出力される。

### デプロイ

`.github/workflows/gh-pages.yml` は全ブランチへの push で `npm ci` → `npm run build -- --mode ghp` を実行するが、GitHub Pages へのデプロイは **`release/ghp` ブランチへの push 時のみ**（README の「main にプッシュでデプロイ」は古い記述）。
