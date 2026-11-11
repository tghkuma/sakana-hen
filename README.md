# さかなへんクイズについて

## はじめに

「さかなへんクイズ」は2011年にHTML5+JavaScriptで作成したものを、TypeScriptでリファクタリングしたものです。  

<img width="400" alt="画面イメージ" src="docs/screenshot.png">

デモサイト [さかなへんクイズ](https://sakana-hen.t-gh.jp/)  

## ファイル構成

```
/
| README.md		      このファイル
| package.json		  パッケージ設定ファイル
| package-lock.json	  パッケージ設定lockファイル
| vite.config.mjs	  vite設定ファイル
| .env.sample         環境変数設定サンプルファイル
| .env.ghp            環境変数設定Github Pages向けファイル
|
+-- .github
| 　+-- workflows
|         gh-pages.yml GitHub Pages自動デプロイ設定ファイル
|
+-- src	            ソースコード
    | index.html		「さかなへんクイズ」設置サンプル
    +-- js				  TypeScriptファイル
    +-- public			Web配置用生ファイル群
    |     .htaccess	svg画像ファイルのContentType設定
    +-- assets			Web配置用アセットファイル群
    |   +-- images		画像ファイル群
    |   +-- sounds		サウンドファイル群
    +-- test			  検証用プログラム群
       audio_test.html		サウンド再生テスト
```

## 構築

### パッケージインストール

```
npm install
```

Windowsの場合は [@img/sharp-win32-x64](https://www.npmjs.com/package/@img/sharp-win32-x64) もインストールする必要があります。

```
npm install @img/sharp-win32-x64
```

### 環境変数設定

`.env.sample` をコピーして `.env` ファイルを作成してください。  
`VITE_SITE_URL` は、デプロイ先のURLを設定してください。  
index.html の og:image に設定されます。

### ローカルサーバー起動

```
npm run dev
```

ブラウザで `http://localhost:5173/` にアクセスしてください。

### スマホ・タブレット実機での確認

同じWi-Fiに接続したスマホ・タブレットからアクセスできるよう、LAN内に公開して起動します。

```
npm run dev:host
```

表示される `Network: http://192.168.x.x:5173/` を実機のブラウザで開いてください。
ビルド結果を確認する場合は以下を実行します（ポートは `4173`）。

```
npm run build
npm run preview:host
```

初回はWindowsファイアウォールの許可ダイアログが表示される場合があります。

### ビルド

```
npm run build
```

`dist` フォルダ以下にビルドされます。

GitHub Pages向け（`.env.ghp` を使用）にビルドする場合は以下を実行します。

```
npm run build -- --mode ghp
```

ビルド結果は以下で確認できます。

```
npm run preview
```

## 設置方法

生成後のdistフォルダ以下のファイルを任意のサーバーにアップしてください。  
svgファイルのContentTypeが、サーバーにより設定されていない場合がありますので、
`.htaccess` を参考に追加設定を行ってください。  
同様に、oggファイル、mp3ファイルで問題ある場合も、追加設定が必要です。

### Github Pagesへのデプロイ

`release/ghp` ブランチにプッシュするとデプロイされます。  
その他のブランチへのプッシュでは、ビルドの確認のみ行われます（デプロイはされません）。


## カスタマイズポイント

[sakana.ts](src/js/sakana.ts) の設定関連辺りの変更でカスタマイズできます。

- `LEVEL_INFO` : レベルごとの制限時間・問題数・選択肢数
- `HIT_WAIT_TIME` : 当たり/はずれ表示時間(mS)

描画は `requestAnimationFrame` で行い、進行は経過時間で計算するため、端末の性能によらず制限時間は一定です。

さかなへんデータ [sakana_data.ts](src/js/consts/sakana_data.ts) で問題データのカスタマイズができます。
