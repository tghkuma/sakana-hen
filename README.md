# さかなへんクイズについて

## はじめに
このドキュメントは、「さかなへんクイズ」について解説しています。

## ファイル構成

```
/
| README.md		      このファイル
| package.json		  パッケージ設定ファイル
| vite.config.js	  vite設定ファイル
|
+-- src	            Web配置
    | index.html		「さかなへんクイズ」設置サンプル
    +-- js				  JavaScriptファイル
    +-- public			Web配置用ファイル群
    |   | .htaccess	svg画像ファイルのContentType設定
    |   +-- image		画像ファイル群
    |   +-- sound		サウンドファイル群
    +-- test			  検証用プログラム群
       audio_test.html		サウンド再生テスト
```

## 構築

### パッケージインストール

```
npm install
```

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
.htaccessを参考に追加設定を行ってください。
同様に、oggファイル、mp3ファイルで問題ある場合も、追加設定が必要です。

## カスタマイズポイント
`sakana.js` の設定関連辺りの変更でカスタマイズできます。
スマホ向けには、"frame_rate"で動作の重さが変更できると思います。

さかな偏データ `sakana_data.js` で問題データのカスタマイズができます。
