# さかなへんクイズについて

## はじめに

「さかなへんクイズ」は2011年にHTML5+JavaScriptで作成したものを、TypeScriptでリファクタリングしたものです。  

<img width="400" alt="画面イメージ" src="src/public/images/thumbnail.png">

デモサイト [さかなへんクイズ](https://sakana-hen.t-gh.jp/)  

## ファイル構成

```
/
| README.md		      このファイル
| package.json		  パッケージ設定ファイル
| package-lock.json	  パッケージ設定lockファイル
| vite.config.js	  vite設定ファイル
| .env.sample         環境変数設定サンプルファイル
| .env.pgh            環境変数設定Github Pages向けファイル
|
+-- .github
| 　+-- workflows
|         gh-pages.yml GitHub Pages自動デプロイ設定ファイル
|
+-- src	            ソースコード
    | index.html		「さかなへんクイズ」設置サンプル
    +-- js				  JavaScriptファイル
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

### ビルド

```
npm run build
```

`dist` フォルダ以下にビルドされます。

## 設置方法

生成後のdistフォルダ以下のファイルを任意のサーバーにアップしてください。  
svgファイルのContentTypeが、サーバーにより設定されていない場合がありますので、
`.htaccess` を参考に追加設定を行ってください。  
同様に、oggファイル、mp3ファイルで問題ある場合も、追加設定が必要です。

### Github Pagesへのデプロイ

mainリポジトリにプッシュするとデプロイされます。


## カスタマイズポイント

[sakana.js](src/js/sakana.ts) の設定関連辺りの変更でカスタマイズできます。
スマホ向けには、 `FRAME_RATE` で動作の重さが変更できると思います。

さかなへんデータ [sakana_data.js](src/js/consts/sakana_data.ts) で問題データのカスタマイズができます。
