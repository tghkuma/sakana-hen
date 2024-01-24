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
SakanaHen.prototype.frame_rate = 60;
/** 寿司移動時間(mS) */
SakanaHen.prototype.susi_move_time = 5000;
/** 当たりはずれウェイト(mS) */
SakanaHen.prototype.hit_wait_time = 1000;

/** キャンバス幅 */
SakanaHen.prototype.canvas_width = 400;
/** キャンバス高さ */
SakanaHen.prototype.canvas_height = 400;

/** 汎用フォント */
SakanaHen.prototype.font_common = "'ヒラギノ角ゴ Pro W3','Hiragino Kaku Gothic Pro','メイリオ',Meiryo,'ＭＳ Ｐゴシック',sans-serif";
/** 寿司フォント */
SakanaHen.prototype.font_sushi = "'平成明朝','Hiragino Kaku Gothic Pro','ＭＳ 明朝',serif";

/** 問題数 */
SakanaHen.prototype.max_quiz_no = 10;
/** 解答選択数 */
SakanaHen.prototype.max_answer_no = 3;

/**
 * 結果
 * x<=正解数,メッセージ,サウンド
 */
SakanaHen.prototype.result_info = [
  [10, "大変よくできました", "s_fanfare"],
  [7, "よくできました", "s_fanfare"],
  [4, "もう少しです", "s_gameover"],
  [0, "がんばりましょう", "s_gameover"],
];


/** 画像リスト */
SakanaHen.prototype.lst_images = [
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
SakanaHen.prototype.lst_audios = [
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
SakanaHen.prototype.vheight;

/** 読み込み成功フラグ */
SakanaHen.prototype.load_success;
/** 読み込み中数 */
SakanaHen.prototype.load_count;
/** 読み込み最大数 */
SakanaHen.prototype.load_max_count;

/** タイマーID */
SakanaHen.prototype.timer_id;
/** タイマーカウント */
SakanaHen.prototype.timer_count;

/** クリック処理無名関数退避 */
SakanaHen.prototype.click_event_callee;

/** 魚偏問題リスト */
SakanaHen.prototype.arr_quiz;
/** 問題番号 */
SakanaHen.prototype.quiz_no;

/** 寿司移動待ち値(オリジナル) */
SakanaHen.prototype.susi_move_count_org;
/** 寿司移動待ち値 */
SakanaHen.prototype.susi_move_count;


/** 選択クリック番号 */
SakanaHen.prototype.selecsion_click_no;

/** 当たり/はずれ */
SakanaHen.prototype.bHit;
/** 当たりはずれ待ち値(オリジナル) */
SakanaHen.prototype.hit_wait_org;
/** 当たりはずれ待ち値 */
SakanaHen.prototype.hit_wait;

/** 正解数 */
SakanaHen.prototype.hit_count;


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
  this.canvas.width = this.canvas_width;
  this.canvas.height = this.canvas_height;

  this.ctx = this.canvas.getContext('2d');

  // 仮想座標保持
  this.vheight = this.canvas.height;

  //----------
  // 画像ファイルロード
  //----------
  const self = this;
  this.load_success = true;
  this.load_count = 0;
  this.load_max_count = this.lst_images.length;
  this.ctx.font = "12px " + this.font_common;
  this.ctx.fillText("ロード中:0/" + this.load_max_count, 0, 20);

  // 画像ファイルロード
  for (i = 0; i < this.lst_images.length; i++) {
    const image = new Image();
    image.onload = function (event) {
      self.onload(event)
    };
    image.onerror = function (event) {
      self.onerror(event)
    };
    image.src = this.lst_images[i][1];
    this[this.lst_images[i][0]] = image;
  }

  //----------
  // 音声ファイル設定
  //----------
  // サポート拡張子確定
  let audio = new Audio();
  let ext;
  if (audio.canPlayType("audio/ogg")) {
    ext = ".ogg";
  } else if (audio.canPlayType("audio/mpeg")) {
    ext = ".mp3";
  }
  audio = null;
  // console.log("音声拡張子:"+ext);

  if (ext) {
    for (i = 0; i < this.lst_audios.length; i++) {
      audio = new Audio();
      audio.src = this.lst_audios[i][1] + ext;
      this[this.lst_audios[i][0]] = audio;
    }
  }
};

/**
 * ロード完了処理
 */
SakanaHen.prototype.onload = function (event) {
  ++this.load_count;

  const strMessage = "ロード成功:" + this.load_count + "/" + this.load_max_count + "[" + event.target.getAttribute("src") + "]";
  console.log(strMessage);
  this.ctx.font = "12px " + this.font_common;
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
  this.ctx.font = "12px " + this.font_common;
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
  this.ctx.font = "30px " + this.font_sushi;
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

  this.ctx.font = "20px " + this.font_common;
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
  this.quiz_no = 0;
  this.hit_count = 0;

  //==============
  // 問題生成
  //==============
  const sakana_length = this.lst_sakana_hen.length;

  // データ転記
  let arr_sakana_hen_tmp = [];
  for (let i = 0; i < sakana_length; i++) {
    arr_sakana_hen_tmp.push([this.lst_sakana_hen[i][0], this.lst_sakana_hen[i][1]]);
  }
  // シャッフル
  for (let i = 0; i < 100; i++) {
    const item_no_0 = Math.floor(Math.random() * sakana_length);
    const item_no_1 = Math.floor(Math.random() * sakana_length);

    const item_tmp = [arr_sakana_hen_tmp[item_no_0][0], arr_sakana_hen_tmp[item_no_0][1]];
    arr_sakana_hen_tmp[item_no_0] =
      [arr_sakana_hen_tmp[item_no_1][0], arr_sakana_hen_tmp[item_no_1][1]];
    arr_sakana_hen_tmp[item_no_1] = [item_tmp[0], item_tmp[1]];
  }
  // 問題/回答生成
  this.arr_quiz = [];
  for (let i = 0; i < this.max_quiz_no; i++) {
    const answerNo = Math.floor(Math.random() * this.max_answer_no);
    console.log("問題" + i + ":" + answerNo);
    const selection = [];
    const quiz = arr_sakana_hen_tmp[i][0];
    const answer = arr_sakana_hen_tmp[i][1];
    for (let sel_no = 0; sel_no < this.max_answer_no; sel_no++) {
      // 当たり生成
      if (sel_no === answerNo) {
        selection.push(answer);
      }
      // はずれ生成
      else {
        let sel_tmp;
        let bAlready;
        do {
          bAlready = false;
          sel_tmp = this.lst_sakana_hen[Math.floor(Math.random() * sakana_length)][1];
          // 当たりに存在するかチェック
          if (sel_tmp === answer) {
            bAlready = true;
						// console.log("あたり発見:"+answer);
            continue;
          }
          // 問題の中に既に存在するかチェック
          for (let j = 0; j < selection.length; j++) {
            if (sel_tmp === selection[j]) {
              bAlready = true;
              break;
            }
          }
        } while (bAlready);
        selection.push(sel_tmp);
      }
    }

    // 問題と回答追加
    this.arr_quiz.push({
      quiz: quiz,
      answer: answer,
      answerNo: answerNo,
      selection: selection
    });
  }
  // リソース削除
  arr_sakana_hen_tmp = null;

  //==============
  // 初期処理
  //==============
  // タイマー値計算
  const interval_time = 1000 / this.frame_rate;

  // ウェイト値計算/設定
  this.susi_move_count_org = this.susi_move_time / interval_time;
  this.hit_wait_org = this.hit_wait_time / interval_time;

  // 初期ウェイト値設定
  this.susi_move_count = this.susi_move_count_org;
  this.hit_wait = 0;

  // タイマー設定
  const self = this;
  this.timer_id = setInterval(function () {
    self.timer()
  }, 1000 / this.frame_rate);

  //--------------
  // 回答クリック
  //--------------
  // スマホ以外
  if (!this.isSmartPhone()) {
    this.click_event_callee = function (event) {
      self.click(event)
    };
    this.canvas.addEventListener('click', this.click_event_callee, false);
  }
  // スマホ
  else {
    this.click_event_callee = function (event) {
      self.touchstart(event)
    };
    this.canvas.addEventListener('touchstart', this.click_event_callee, false);
  }

  // 初期描画
  this.draw();
};


/**
 * 回答クリック
 */
SakanaHen.prototype.click = function (event) {
  const rect = event.target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  console.log("x=" + x + ",y=" + y);

  this.checkAnswer(x, y);
}

/**
 * 回答クリック(スマホ版)
 */
SakanaHen.prototype.touchstart = function (event) {
  const rect = this.canvas.getBoundingClientRect();
  const x = event.touches[0].pageX - rect.left;
  const y = event.touches[0].pageY - rect.top;
  console.log("x=" + x + ",y=" + y);

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
  if (0 < this.hit_wait) {
    return;
  }

  // 仮想サイズに補正
  y = y * this.canvas.height / this.vheight;

  // 回答判定
  for (let i = 0; i < this.max_answer_no; i++) {
    const posY = 250 + 50 * i;
    if (posY <= y && y < posY + 50) {
      this.selecsion_click_no = i;
      console.log("選択=" + this.selecsion_click_no);

      const item_quiz = this.arr_quiz[this.quiz_no];
      // あたり/はずれ処理
      this.setHit(this.selecsion_click_no === item_quiz.answerNo);

      return;
    }
  }
}

/**
 * 次のクイズ
 */
SakanaHen.prototype.nextQuiz = function () {
  // 選択クリア
  this.selecsion_click_no = undefined;

  if (this.quiz_no < this.arr_quiz.length - 1) {
    this.susi_move_count = this.susi_move_count_org;
    this.quiz_no++;
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
    this.hit_count++;
    this.playSound('s_seikai');
  } else {
    this.playSound('s_miss');
  }
  // エフェクト時間設定
  this.hit_wait = this.hit_wait_org;
}


/**
 * タイマー処理
 */
SakanaHen.prototype.timer = function () {
  // タイマーカウント++
  this.timer_count++;

  if (this.hit_wait <= 0) {
    if (--this.susi_move_count <= 0) {
      // はずれ
      this.setHit(false);
    }
  }
  // あたり/はずれエフェクト終了
  else if (--this.hit_wait <= 0) {
    this.nextQuiz();
  }

  // 処理中にタイマー処理削除されていた場合終了
  if (this.timer_id == null) {
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
  if (0 < this.hit_wait) {
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
  let posX = this.canvas.width - (((this.canvas.width + 120) / this.susi_move_count_org) * this.susi_move_count) + 60;
  const posY = 146;
  // 皿
  this.ctx.drawImage(this.img_sara, posX - 24, posY);

  // クイズ
  const item_quiz = this.arr_quiz[this.quiz_no];
  let strQuiz = item_quiz.quiz;
  if (this.debug) {
    strQuiz += "(" + item_quiz.answer + ")";
  }
  this.ctx.font = "60px " + this.font_sushi;
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
  for (let i = 0; i < this.max_answer_no; i++) {
    const posY = 250 + 50 * i;

    // ボタン描画
    let img_btn;
    if (this.selecsion_click_no === i) {
      img_btn = this.img_btn_1;
    } else {
      img_btn = this.img_btn_0;
    }
    this.ctx.drawImage(img_btn, 1, posY);

    // 回答文字列
    this.ctx.font = "40px " + this.font_sushi;
    this.ctx.fillStyle = "rgb(0,0,0)";
    this.ctx.fillText(item_quiz.selection[i], 4, posY + 40);
  }

  //----------
  // 当たり/はずれ
  //----------
  if (0 < this.hit_wait) {
    this.ctx.font = "bold 80px " + this.font_sushi;
    const img_ans = this.bHit ? this.img_ans_ok : this.img_ans_ng;
    const posY = 120 + (this.hit_wait / this.hit_wait_org * 40);
    this.ctx.drawImage(img_ans, (this.canvas.width - img_ans.width) / 2, posY);
  }

  //----------
  // ステータス
  //----------
  // 問題
  const strQuizNo = "問題:" + (this.quiz_no + 1) + "/" + this.arr_quiz.length;
  this.ctx.font = "30px " + this.font_common;
  this.ctx.fillStyle = "rgb(0,0,0)";
  const tm = this.ctx.measureText(strQuizNo);
  posX = this.canvas.width - tm.width;
  this.ctx.fillText(strQuizNo, posX, 30);

  // 正解数
  const strScore = "正解:" + this.hit_count;
  this.ctx.fillText(strScore, posX, 60);

}


/**
 * ゲーム終了処理
 */
SakanaHen.prototype.endGame = function () {
  // タイマー削除
  if (this.timer_id) {
    clearInterval(this.timer_id);
    this.timer_id = null;
  }

  //--------------
  // 回答クリックイベント削除
  //--------------
  // スマホ以外
  if (!this.isSmartPhone()) {
    this.canvas.removeEventListener('click', this.click_event_callee);
  }
  // スマホ
  else {
    this.canvas.removeEventListener('click', this.click_event_callee);
  }

  //======================
  // 結果データ
  //======================
  let strResult;
  let aResult;
  for (let i = 0; i < this.result_info.length; i++) {
    const item = this.result_info[i];
    if (item[0] <= this.hit_count) {
      strResult = item[1];
      aResult = item[2];
      break;
    }
  }

  // サウンド
  this.playSound(aResult);

  //======================
  // ゲームオーバー画面描画
  //======================
  // 背景クリア
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

  const posY = 100;

  // 文字
  this.ctx.font = "30px " + this.font_common;
  const strTitle = "ゲームオーバー";
  let tm = this.ctx.measureText(strTitle);
  let posX = (this.canvas.width - tm.width) / 2;
  this.ctx.fillStyle = "rgb(255,0,0)";
  this.ctx.fillText(strTitle, posX, posY + 0);

  // 正解数
  const strScore = "正解:" + this.hit_count + "/" + this.arr_quiz.length;
  tm = this.ctx.measureText(strScore);
  posX = (this.canvas.width - tm.width) / 2;
  this.ctx.fillText(strScore, posX, posY + 30);

  // 結果
  tm = this.ctx.measureText(strResult);
  posX = (this.canvas.width - tm.width) / 2;
  this.ctx.fillStyle = "rgb(0,60,0)";
  this.ctx.fillText(strResult, posX, posY + 60);

  // クリック
  this.ctx.font = "20px " + this.font_common;
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
SakanaHen.prototype.lst_sakana_hen = [
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
