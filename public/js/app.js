/**
 * 「さかなへん」クイズ
 *
 * @author    熊谷
 * @copyright 2011 Team-Grasshopper, Inc.
 * @link      http://team-grasshopper.info/
 */

/**
 * コンストラクタ
 *
 * @param canvas_id キャンバスID
 */
function SakanaHen(canvas_id) {
  this.init(canvas_id);
}

//======================
// 設定関連
//======================
/** フレームレート */
SakanaHen.prototype.FRAME_RATE = 60;
/** 寿司移動時間(mS) */
SakanaHen.prototype.SUSI_MOVE_TIME = 5000;
/** 当たりはずれウェイト(mS) */
SakanaHen.prototype.HIT_WAIT_TIME = 1000;

/** キャンバス幅 */
SakanaHen.prototype.CANVAS_WIDTH = 400;
/** キャンバス高さ */
SakanaHen.prototype.CANVAS_HEIGHT = 400;

/** 汎用フォント */
SakanaHen.prototype.FONT_COMMON = "'ヒラギノ角ゴ Pro W3','Hiragino Kaku Gothic Pro','メイリオ',Meiryo,'ＭＳ Ｐゴシック',sans-serif";
/** 寿司フォント */
SakanaHen.prototype.FONT_SUSHI = "'平成明朝','Hiragino Kaku Gothic Pro','ＭＳ 明朝',serif";

/** 問題数 */
SakanaHen.prototype.MAX_QUIZ_NO = 10;
/** 解答選択数 */
SakanaHen.prototype.MAX_ANSWER_NO = 3;

/**
 * 結果
 * x<=正解数,メッセージ,サウンド
 */
SakanaHen.prototype.RESULT_INFO = [
  [10, "大変よくできました", "s_fanfare"],
  [7, "よくできました", "s_fanfare"],
  [4, "もう少しです", "s_gameover"],
  [0, "がんばりましょう", "s_gameover"],
];


/** 画像リスト */
SakanaHen.prototype.LST_IMAGES = [
  ["img_kuman", "image/ku_man.svg"],
  ["img_kuman_ok", "image/ku_man_ok.svg"],
  ["img_kuman_ng", "image/ku_man_ng.svg"],
  ["img_boushi", "image/boushi.svg"],
  ["img_table", "image/table.svg"],
  ["img_btn_0", "image/btn_0.svg"],
  ["img_btn_1", "image/btn_1.svg"],
  ["img_ans_ok", "image/ans_ok.svg"],
  ["img_ans_ng", "image/ans_ng.svg"],
  ["img_sara", "image/sara.svg"],
  ["img_yunomi", "image/yunomi.png"]
];

/** 音声リスト */
SakanaHen.prototype.LST_AUDIOS = [
  ["s_start", "sound/bgm_coinin_2"],
  ["s_gameover", "sound/bgm_gameover_1"],
  ["s_fanfare", "sound/bgm_fanfare_1"],
  ["s_seikai", "sound/se_quizright_1"],
  ["s_miss", "sound/se_quizmistake_1"]
];

/** デバッグ処理 */
SakanaHen.prototype.debug = false;


//======================
// 変数
//======================
/** キャンバスID名 */
SakanaHen.prototype.canvas_id;
/** キャンバス関連 */
SakanaHen.prototype.canvas;
/** キャンバス関連コンテキスト */
SakanaHen.prototype.ctx;

/**
 * 仮想キャンバスの高さ
 * 拡大縮小時のマウスクリック座標補正に使用
 */
SakanaHen.prototype.vHeight;

/** 読み込み成功フラグ */
SakanaHen.prototype.load_success;
/** 読み込み中数 */
SakanaHen.prototype.load_count;
/** 読み込み最大数 */
SakanaHen.prototype.load_max_count;

/** タイマーID */
SakanaHen.prototype.timerId;
/** タイマーカウント */
SakanaHen.prototype.timer_count;

/** クリック処理無名関数退避 */
SakanaHen.prototype.onClickAnswer;

/** 魚偏問題リスト */
SakanaHen.prototype.listQuiz;
/** 問題番号 */
SakanaHen.prototype.quizNo;

/** 寿司移動待ち値(オリジナル) */
SakanaHen.prototype.susi_move_count_org;
/** 寿司移動待ち値 */
SakanaHen.prototype.susi_move_count;


/** 選択クリック番号 */
SakanaHen.prototype.selecsionClickNo;

/** 当たり/はずれ */
SakanaHen.prototype.bHit;
/** 当たりはずれ待ち値(オリジナル) */
SakanaHen.prototype.hit_wait_org;
/** 当たりはずれ待ち値 */
SakanaHen.prototype.hitWait;

/** 正解数 */
SakanaHen.prototype.hitCount;


//======================
// メソッド群
//======================
/**
 * クイズ初期化
 *
 * @param canvas_id キャンバスID
 */
SakanaHen.prototype.init = function (canvas_id) {
  console.log('初期化処理');

  this.canvas_id = canvas_id;

  // canvas要素が無い場合、未対応ブラウザ
  this.canvas = document.getElementById(canvas_id);
  if (!this.canvas || !this.canvas.getContext) {
    alert("本ページの閲覧はHTML5対応ブラウザで行ってください");
    return;
		// return false;
  }

  // キャンバスサイズ設定
  this.canvas.width = this.CANVAS_WIDTH;
  this.canvas.height = this.CANVAS_HEIGHT;

  this.ctx = this.canvas.getContext('2d');

  // 仮想座標保持
  this.vHeight = this.canvas.height;

  //----------
  // 画像ファイルロード
  //----------
  this.load_success = true;
  this.load_count = 0;
  this.load_max_count = this.LST_IMAGES.length;
  this.ctx.font = "12px " + this.FONT_COMMON;
  this.ctx.fillText("ロード中:0/" + this.load_max_count, 0, 20);

  // 画像ファイルロード
  this.LST_IMAGES.forEach((item) => {
    const image = new Image();
    image.onload = (event) => this.onload(event);
    image.onerror = (event) => this.onerror(event);
    image.src = item[1];
    this[item[0]] = image;
  })

  //----------
  // 音声ファイル設定
  //----------
  // サポート拡張子確定
  const audio = new Audio();
  let ext;
  if (audio.canPlayType("audio/ogg")) {
    ext = ".ogg";
  } else if (audio.canPlayType("audio/mpeg")) {
    ext = ".mp3";
  }
  // console.log("音声拡張子:"+ext);

  if (ext) {
    this.LST_AUDIOS.forEach((item) => {
      this[item[0]] = new Audio(item[1] + ext);
    })
  }
};

/**
 * ロード完了処理
 */
SakanaHen.prototype.onload = function (event) {
  ++this.load_count;

  const strMessage = "ロード成功:" + this.load_count + "/" + this.load_max_count + "[" + event.target.getAttribute("src") + "]";
  console.log(strMessage);
  this.ctx.font = "12px " + this.FONT_COMMON;
  this.ctx.fillText(strMessage, 0, 20 + (this.load_count * 12));

  // 全ファイルロード成功の時はタイトルへ
  if (this.load_max_count <= this.load_count && this.load_success) {
    this.title();
  }
}

/**
 * ロード失敗処理
 */
SakanaHen.prototype.onerror = function (event) {
  ++this.load_count;
  this.load_success = false;

  const strMessage = "ロード失敗:" + this.load_count + "/" + this.load_max_count + "[" + event.target.getAttribute("src") + "]";
  console.log(strMessage);
  this.ctx.font = "12px " + this.FONT_COMMON;
  this.ctx.fillText(strMessage, 0, 20 + (this.load_count * 12));
}

/**
 * タイトル処理
 */
SakanaHen.prototype.title = function () {
  //======================
  // スタート画面描画
  //======================
  // 背景消去
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

  // 湯呑
  this.ctx.drawImage(
    this.img_yunomi,
    (this.canvas.width - this.img_yunomi.width) / 2,
    (this.canvas.height - this.img_yunomi.height) / 2
  );

  // 文字
  this.ctx.font = "30px " + this.FONT_SUSHI;
  const strTitle = "『さかなへん』クイズ";
  let tm = this.ctx.measureText(strTitle);
  const posX = (this.canvas.width - tm.width) / 2;
  const posY = (this.canvas.height - 60) / 2;

  this.ctx.fillStyle = "rgba(0,255,0,0.6)";
  this.ctx.fillRect(posX, posY, tm.width, 60);
  this.ctx.fillStyle = "rgb(255,255,255)";
  this.ctx.beginPath();
  this.ctx.strokeStyle = "rgb(255,255,0)";
  this.ctx.rect(posX, posY, tm.width, 60);
  this.ctx.stroke();
  this.ctx.fillStyle = "rgb(255,0,0)";
  this.ctx.fillText(strTitle, posX, posY + 30);

  this.ctx.font = "20px " + this.FONT_COMMON;
  this.ctx.fillStyle = "rgb(255,255,255)";
  const strStart = "画面クリックでスタート";
  tm = this.ctx.measureText(strStart);
  this.ctx.fillText(strStart, (this.canvas.width - tm.width) / 2, posY + 52);

  //======================
  // スタートボタン処理
  //======================
  const self = this;
  this.canvas.addEventListener('click', function () {
    self.canvas.removeEventListener('click', arguments.callee, false);
		// alert("開始");
    self.startGame();
  }, false);
	// alert("タイトル");
}

/**
 * ゲーム開始処理
 */
SakanaHen.prototype.startGame = function () {
  // 音再生
  this.playSound('s_start');

  //==============
  // 初期化処理
  //==============
  this.quizNo = 0;
  this.hitCount = 0;

  //==============
  // 問題生成
  //==============
  const sakana_length = this.LST_SAKANA_HEN.length;

  // データ転記
  let lst_sakana_hen = JSON.parse(JSON.stringify(this.LST_SAKANA_HEN));
  // シャッフル
  for (let i = 0; i < 100; i++) {
    const itemNo0 = Math.floor(Math.random() * sakana_length);
    const itemNo1 = Math.floor(Math.random() * sakana_length);

    const item_tmp = [lst_sakana_hen[itemNo0][0], lst_sakana_hen[itemNo0][1]];
    lst_sakana_hen[itemNo0] =
      [lst_sakana_hen[itemNo1][0], lst_sakana_hen[itemNo1][1]];
    lst_sakana_hen[itemNo1] = [item_tmp[0], item_tmp[1]];
  }
  // 問題/回答生成
  this.listQuiz = [];
  for (let quizNo = 0; quizNo < this.MAX_QUIZ_NO; quizNo++) {
    const answerNo = Math.floor(Math.random() * this.MAX_ANSWER_NO);
    // console.log("問題" + quizNo + ":" + answerNo);
    const selection = [];
    const [quiz, answer] = lst_sakana_hen.shift();
    for (let selectNo = 0; selectNo < this.MAX_ANSWER_NO; selectNo++) {
      // 当たり生成
      if (selectNo === answerNo) {
        selection.push(answer);
      }
      // はずれ生成
      else {
        const getMissItem = () => {
          while (true) {
            const missItem = this.LST_SAKANA_HEN[Math.floor(Math.random() * sakana_length)][1];
            // 当たりに存在するかチェック
            if (missItem === answer) {
              continue;
            }
            // 問題の中に既に存在するかチェック
            if (!selection.some((item) => missItem === item)) {
              return missItem;
            }
          }
        }
        selection.push(getMissItem());
      }
    }

    // 問題と回答追加
    this.listQuiz.push({
      quiz: quiz,
      answer: answer,
      answerNo: answerNo,
      selection: selection
    });
  }
  // リソース削除
  lst_sakana_hen = null;

  //==============
  // 初期処理
  //==============
  // タイマー値計算
  const interval_time = 1000 / this.FRAME_RATE;

  // ウェイト値計算/設定
  this.susi_move_count_org = this.SUSI_MOVE_TIME / interval_time;
  this.hit_wait_org = this.HIT_WAIT_TIME / interval_time;

  // 初期ウェイト値設定
  this.susi_move_count = this.susi_move_count_org;
  this.hitWait = 0;

  // タイマー設定
  this.timerId = setInterval(() => this.timer(), 1000 / this.FRAME_RATE);

  //--------------
  // 回答クリック
  //--------------
  // スマホ以外
  if (!this.isSmartPhone()) {
    this.onClickAnswer = (event) => this.onClickAnswerClick(event);
    this.canvas.addEventListener('click', this.onClickAnswer, false);
  }
  // スマホ
  else {
    this.onClickAnswer = (event) => this.onClickAnswerTouch(event);
    this.canvas.addEventListener('onClickAnswerTouch', this.onClickAnswer, false);
  }

  // 初期描画
  this.draw();
};


/**
 * 回答クリック
 */
SakanaHen.prototype.onClickAnswerClick = function (event) {
  const rect = event.target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  // console.log("x=" + x + ",y=" + y);

  this.checkAnswer(x, y);
}

/**
 * 回答クリック(スマホ版)
 */
SakanaHen.prototype.onClickAnswerTouch = function (event) {
  const rect = this.canvas.getBoundingClientRect();
  const x = event.touches[0].pageX - rect.left;
  const y = event.touches[0].pageY - rect.top;
  // console.log("x=" + x + ",y=" + y);

  this.checkAnswer(x, y);
}

/**
 * 回答チェック
 *
 * @param x X座標
 * @param y Y座標
 */
SakanaHen.prototype.checkAnswer = function (x, y) {
  // 当たり/はずれエフェクト中は何も回答判定しない
  if (0 < this.hitWait) {
    return;
  }

  // 仮想サイズに補正
  y = y * this.canvas.height / this.vHeight;

  // 回答判定
  for (let answerNo = 0; answerNo < this.MAX_ANSWER_NO; answerNo++) {
    const posY = 250 + 50 * answerNo;
    if (posY <= y && y < posY + 50) {
      this.selecsionClickNo = answerNo;
      // console.log("選択=" + this.selecsionClickNo);

      const itemQuiz = this.listQuiz[this.quizNo];
      // あたり/はずれ処理
      this.setHit(this.selecsionClickNo === itemQuiz.answerNo);

      return;
    }
  }
}

/**
 * 次のクイズ
 */
SakanaHen.prototype.nextQuiz = function () {
  // 選択クリア
  this.selecsionClickNo = undefined;

  if (this.quizNo < this.listQuiz.length - 1) {
    this.susi_move_count = this.susi_move_count_org;
    this.quizNo++;
  } else {
    // ゲーム終了
    this.endGame();
  }
};

/**
 * あたり/はずれ処理
 *
 * @param bHit true:あたり, false:はずれ
 */
SakanaHen.prototype.setHit = function (bHit) {
  this.bHit = bHit;
  if (bHit) {
    this.hitCount++;
    this.playSound('s_seikai');
  } else {
    this.playSound('s_miss');
  }
  // エフェクト時間設定
  this.hitWait = this.hit_wait_org;
}


/**
 * タイマー処理
 */
SakanaHen.prototype.timer = function () {
  // タイマーカウント++
  this.timer_count++;

  if (this.hitWait <= 0) {
    if (--this.susi_move_count <= 0) {
      // はずれ
      this.setHit(false);
    }
  }
  // あたり/はずれエフェクト終了
  else if (--this.hitWait <= 0) {
    this.nextQuiz();
  }

  // 処理中にタイマー処理削除されていた場合終了
  if (this.timerId == null) {
    return;
  }
  // 描画処理
  this.draw();
};

/**
 * 描画処理
 */
SakanaHen.prototype.draw = function () {
  /* グラデーション領域をセット */
  const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
  /* グラデーション終点のオフセットと色をセット */
  grad.addColorStop(0, 'rgb(255, 255, 0)');
  grad.addColorStop(0.5, 'rgb(255, 255, 255)');
  /* グラデーションをfillStyleプロパティにセット */
  this.ctx.fillStyle = grad;
	// this.ctx.fillStyle = "rgb(255,255,0)";
  this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

  //----------
  // くーまん描画処理
  //----------
  let img_kuman;
  if (0 < this.hitWait) {
    img_kuman = this.bHit ? this.img_kuman_ok : this.img_kuman_ng;
  } else {
    img_kuman = this.img_kuman;
  }
  this.ctx.drawImage(
    img_kuman,
    (this.canvas.width - img_kuman.width) / 2,
    290 - img_kuman.height
  );

  // 帽子
  this.ctx.drawImage(this.img_boushi, (this.canvas.width - this.img_boushi.width) / 2, 25);

  //----------
  // テーブル
  //----------
  this.ctx.drawImage(this.img_table, 0, 160);

  //----------
  // 寿司＋さかなへん
  //----------

  //----------
  // 背景色
  //----------
  const posX = this.canvas.width - (((this.canvas.width + 120) / this.susi_move_count_org) * this.susi_move_count) + 60;
  const posY = 146;
  // 皿
  this.ctx.drawImage(this.img_sara, posX - 24, posY);

  // クイズ
  const itemQuiz = this.listQuiz[this.quizNo];
  let strQuiz = itemQuiz.quiz;
  if (this.debug) {
    strQuiz += "(" + itemQuiz.answer + ")";
  }
  this.ctx.font = "60px " + this.FONT_SUSHI;
  this.ctx.strokeStyle = "rgb(255,255,255)";
  this.ctx.lineWidth = 4;
  this.ctx.strokeText(strQuiz, posX, posY + 55);
  this.ctx.lineWidth = 1;
  this.ctx.fillStyle = "rgb(0,0,0)";
  this.ctx.fillText(strQuiz, posX, posY + 55);

  //----------
  // 三択描画
  //----------
  this.ctx.fillStyle = "rgb(255,255,255)";
  this.ctx.fillRect(0, 250, this.canvas.width, this.canvas.height);
  for (let answerNo = 0; answerNo < this.MAX_ANSWER_NO; answerNo++) {
    const posY = 250 + 50 * answerNo;

    // ボタン描画
    const img_btn = (this.selecsionClickNo === answerNo) ? this.img_btn_1 : this.img_btn_0;
    this.ctx.drawImage(img_btn, 1, posY);

    // 回答文字列
    this.ctx.font = "40px " + this.FONT_SUSHI;
    this.ctx.fillStyle = "rgb(0,0,0)";
    this.ctx.fillText(itemQuiz.selection[answerNo], 4, posY + 40);
  }

  //----------
  // 当たり/はずれ
  //----------
  if (0 < this.hitWait) {
    this.ctx.font = "bold 80px " + this.FONT_SUSHI;
    const img_ans = this.bHit ? this.img_ans_ok : this.img_ans_ng;
    const posY = 120 + (this.hitWait / this.hit_wait_org * 40);
    this.ctx.drawImage(img_ans, (this.canvas.width - img_ans.width) / 2, posY);
  }

  //----------
  // ステータス
  //----------
  // 問題
  const strQuizNo = "問題:" + (this.quizNo + 1) + "/" + this.listQuiz.length;
  this.ctx.font = "30px " + this.FONT_COMMON;
  this.ctx.fillStyle = "rgb(0,0,0)";
  const tm = this.ctx.measureText(strQuizNo);
  const statusPosX = this.canvas.width - tm.width;
  this.ctx.fillText(strQuizNo, statusPosX, 30);

  // 正解数
  const strScore = "正解:" + this.hitCount;
  this.ctx.fillText(strScore, statusPosX, 60);
}


/**
 * ゲーム終了処理
 */
SakanaHen.prototype.endGame = function () {
  // タイマー削除
  if (this.timerId) {
    clearInterval(this.timerId);
    this.timerId = null;
  }

  //--------------
  // 回答クリックイベント削除
  //--------------
  this.canvas.removeEventListener('click', this.onClickAnswer);

  //======================
  // 結果データ
  //======================
  const [_point, strResult, aResult] = this.RESULT_INFO.find((item) => item[0] <= this.hitCount)

  // サウンド
  this.playSound(aResult);

  //======================
  // ゲームオーバー画面描画
  //======================
  // 背景クリア
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

  const posY = 100;

  // 文字
  this.ctx.font = "30px " + this.FONT_COMMON;
  const strTitle = "ゲームオーバー";
  let tm = this.ctx.measureText(strTitle);
  let posX = (this.canvas.width - tm.width) / 2;
  this.ctx.fillStyle = "rgb(255,0,0)";
  this.ctx.fillText(strTitle, posX, posY + 0);

  // 正解数
  const strScore = "正解:" + this.hitCount + "/" + this.listQuiz.length;
  tm = this.ctx.measureText(strScore);
  posX = (this.canvas.width - tm.width) / 2;
  this.ctx.fillText(strScore, posX, posY + 30);

  // 結果
  tm = this.ctx.measureText(strResult);
  posX = (this.canvas.width - tm.width) / 2;
  this.ctx.fillStyle = "rgb(0,60,0)";
  this.ctx.fillText(strResult, posX, posY + 60);

  // クリック
  this.ctx.font = "20px " + this.FONT_COMMON;
  this.ctx.fillStyle = "rgb(0,0,0)";
  const strStart = "画面クリックでタイトルへ";
  tm = this.ctx.measureText(strStart);
  this.ctx.fillText(strStart, (this.canvas.width - tm.width) / 2, posY + 100);

  //======================
  // タイトル遷移処理
  //======================
  const self = this;
  this.canvas.addEventListener('click', function () {
    self.canvas.removeEventListener('click', arguments.callee, false);
    // タイトルへ
    self.title();
  }, false);
}


/**
 * サウンド再生
 *
 * @param id サウンドID
 */
SakanaHen.prototype.playSound = function (id) {
  this[id].play();
}

/**
 * スマホ判断
 * @returns {boolean} true:スマートフォン
 */
SakanaHen.prototype.isSmartPhone = function () {
  return navigator.userAgent.indexOf('iPhone') > 0
    || navigator.userAgent.indexOf('iPod') > 0
    || navigator.userAgent.indexOf('iPad') > 0
    || navigator.userAgent.indexOf('Android') > 0;
}


/**
 * 魚偏データ
 */
SakanaHen.prototype.LST_SAKANA_HEN = [
  ["鯵", "あじ"],
  ["鮎", "あゆ"],
  ["鮑", "あわび"],
  ["鮟", "あんこう"],
  ["鰂", "いか"],
  ["鮸", "いしもち"],
  ["鰍", "いなだ"],
  ["鰯", "いわし"],
  ["鮇", "いわな"],
  ["鯏", "うぐい"],
  ["鱓", "うつぼ"],
  ["鰻", "うなぎ"],
  ["鱠", "えそ"],
  ["鰕", "えび"],
  ["鯑", "かずのこ"],
  ["鰹", "かつお"],
  ["魳", "かます"],
  ["鰈", "かれい"],
  ["鮍", "かわはぎ"],
  ["鱚", "きす"],
  ["鯨", "くじら"],
  ["鮓", "くらげ"],
  ["鯉", "こい"],
  ["鯒", "こち"],
  ["鮗", "このしろ"],
  ["鮴", "ごり"],
  ["鮭", "さけ"],
  ["鯖", "さば"],
  ["鮫", "さめ"],
  ["鰆", "さわら"],
  ["鯱", "しゃち"],
  ["鮩", "しらうお"],
  ["鱸", "すずき"],
  ["魭", "すっぽん"],
  ["鰑", "するめ"],
  ["鯛", "たい"],
  ["鮹", "たこ"],
  ["魛", "たちうお"],
  ["魴", "たなご"],
  ["鱈", "たら"],
  ["鰌", "どじょう"],
  ["鮠", "なまず"],
  ["鰊", "にしん"],
  ["魦", "はぜ"],
  ["鰰", "はたはた"],
  ["魬", "はまち"],
  ["鱧", "はも"],
  ["鰙", "はや"],
  ["鮠", "はや"],
  ["鮃", "ひらめ"],
  ["鰒", "ふぐ"],
  ["鮒", "ふな"],
  ["鰤", "ぶり"],
  ["鯔", "ぼら"],
  ["鮪", "まぐろ"],
  ["鱒", "ます"]
];
