/**
 * 「さかなへん」クイズ
 *
 * @author    熊谷
 * @copyright 2011-2024 Team-Grasshopper, Inc.
 * @link      https://team-grasshopper.info/
 */
import { Log } from './log'
import { LST_SAKANA_HEN } from './dakana_data'
export class SakanaHen {
  /** フレームレート */
  FRAME_RATE = 90
  /** 寿司移動時間(mS) */
  SUSI_MOVE_TIME = 5000
  /** 当たりはずれウェイト(mS) */
  HIT_WAIT_TIME = 1000

  /** キャンバス幅 */
  CANVAS_WIDTH = 400
  /** キャンバス高さ */
  CANVAS_HEIGHT = 400

  /** 汎用フォント */
  FONT_COMMON = "'Helvetica Neue', 'Helvetica', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Arial', 'Yu Gothic', 'Meiryo', sans-serif"
  /** 寿司フォント */
  FONT_SUSHI = "'Times New Roman', 'YuMincho', 'Hiragino Mincho ProN', 'Yu Mincho', 'MS PMincho', serif"

  /** 問題数 */
  MAX_QUIZ_NO = 10
  /** 解答選択数 */
  MAX_ANSWER_NO = 3

  /**
   * 結果
   * x<=正解数,メッセージ,サウンド
   */
  RESULT_INFO: [number, string, string][] = [
    [10, '大変よくできました', 's_fanfare'],
    [7, 'よくできました', 's_fanfare'],
    [4, 'もう少しです', 's_gameover'],
    [0, 'がんばりましょう', 's_gameover'],
  ]

  /** 画像リスト */
  LST_IMAGES = [
    ['img_kuman', 'ku_man.svg'],
    ['img_kuman_ok', 'ku_man_ok.svg'],
    ['img_kuman_ng', 'ku_man_ng.svg'],
    ['img_boushi', 'boushi.svg'],
    ['img_table', 'table.svg'],
    ['img_btn_0', 'btn_0.svg'],
    ['img_btn_1', 'btn_1.svg'],
    ['img_ans_ok', 'ans_ok.svg'],
    ['img_ans_ng', 'ans_ng.svg'],
    ['img_sara', 'sara.svg'],
    ['img_yunomi', 'yunomi.png'],
  ]

  /** 音声リスト */
  LST_AUDIOS = [
    ['s_start', 'bgm_coinin_2'],
    ['s_gameover', 'bgm_gameover_1'],
    ['s_fanfare', 'bgm_fanfare_1'],
    ['s_seikai', 'se_quizright_1'],
    ['s_miss', 'se_quizmistake_1'],
  ]

  /** デバッグ処理 */
  debug = false

  /** キャンバスID名 */
  canvas_id: string | undefined
  /** キャンバス関連 */
  canvas: HTMLCanvasElement | undefined
  /** キャンバス関連コンテキスト */
  ctx: CanvasRenderingContext2D | undefined

  /**
   * 仮想キャンバスの高さ
   * 拡大縮小時のマウスクリック座標補正に使用
   */
  vHeight: number = 0

  image: {
    [key: string]: HTMLImageElement
  } = {}
  /** 読み込み成功フラグ */
  load_success: boolean = false
  /** 読み込み中数 */
  load_count: number = 0
  /** 読み込み最大数 */
  load_max_count: number = 0

  sound: {
    [key: string]: HTMLAudioElement
  } = {}

  /** タイマーID */
  timerId: number | undefined
  /** タイマーカウント */
  timer_count: number = 0

  /** クリック処理無名関数退避 */
  onClickAnswerFunc?: any
  /** マウスオーバー処理無名関数退避 */
  onMouseMoveAnswerFunc?: any

  /** 魚偏問題リスト */
  listQuiz: any[] = []
  /** 問題番号 */
  quizNo: number = 0

  /** 寿司移動待ち値(オリジナル) */
  moveCountSushi_org: number = 0
  /** 寿司移動待ち値 */
  moveCountSushi: number = 0

  /** 選択クリック番号 */
  clickSelectionNo: number | undefined

  /** 当たり/はずれ */
  bHit: boolean = false
  /** 当たりはずれ待ち値(オリジナル) */
  hitWait_org: number = 0
  /** 当たりはずれ待ち値 */
  hitWait: number = 0

  /** 正解数 */
  hitCount: number = 0

  /**
   */
  /**
   * コンストラクタ
   *
   * @param canvas_id キャンバスID
   * @param options
   */
  constructor(canvas_id: string, options: any) {
    if (options) {
      Object.assign(this, options)
    }
    Log.debug = this.debug
    this.init(canvas_id)
  }

  /**
   * クイズ初期化
   *
   * @param canvas_id キャンバスID
   */
  init(canvas_id: string) {
    Log.info('初期化処理')

    this.canvas_id = canvas_id

    // canvas要素が無い場合、未対応ブラウザ
    this.canvas = document.getElementById(canvas_id) as HTMLCanvasElement
    if (!this.canvas || !this.canvas!.getContext) {
      alert('本ページの閲覧はHTML5対応ブラウザで行ってください')
      return
    }

    // キャンバスサイズ設定
    this.canvas!.width = this.CANVAS_WIDTH
    this.canvas!.height = this.CANVAS_HEIGHT

    this.ctx = this.canvas!.getContext('2d')!

    // 仮想座標初期値設定
    this.vHeight = this.canvas!.height

    //----------
    // 画像ファイルロード
    //----------
    this.load_success = true
    this.load_count = 0
    this.load_max_count = this.LST_IMAGES.length
    this.ctx!.font = '12px ' + this.FONT_COMMON
    this.ctx!.fillText('ロード中:0/' + this.load_max_count, 0, 20)

    // 画像ファイルロード
    this.image = {}
    this.LST_IMAGES.forEach((item) => {
      const image = new Image()
      image.onload = (event) => this.onload(event)
      image.onerror = (event) => this.onerror(event as Event)
      image.src = 'images/' + item[1]
      this.image[item[0]] = image
    })

    //----------
    // 音声ファイル設定
    //----------
    // サポート拡張子確定
    const audio = new Audio()
    let ext: string | undefined
    if (audio.canPlayType('audio/ogg')) {
      ext = '.ogg'
    } else if (audio.canPlayType('audio/mpeg')) {
      ext = '.mp3'
    }
    // Log.log("音声拡張子:"+ext);

    if (ext) {
      this.LST_AUDIOS.forEach((item) => {
        this.sound[item[0]] = new Audio('sounds/' + item[1] + ext)
      })
    }
  }

  /**
   * ロード完了処理
   */
  onload(event: Event) {
    ++this.load_count

    const strMessage = 'ロード成功:' + this.load_count + '/' + this.load_max_count + '[' + (event.target as HTMLImageElement).getAttribute('src') + ']'
    Log.info(strMessage)
    this.ctx!.font = '12px ' + this.FONT_COMMON
    this.ctx!.fillText(strMessage, 0, 20 + this.load_count * 12)

    // 全ファイルロード成功の時はタイトルへ
    if (this.load_max_count <= this.load_count && this.load_success) {
      this.title()
    }
  }

  /**
   * ロード失敗処理
   */
  onerror(event: Event) {
    ++this.load_count
    this.load_success = false

    const strMessage = 'ロード失敗:' + this.load_count + '/' + this.load_max_count + '[' + (event.target as HTMLImageElement).getAttribute('src') + ']'
    Log.warn(strMessage)
    this.ctx!.font = '12px ' + this.FONT_COMMON
    this.ctx!.fillText(strMessage, 0, 20 + this.load_count * 12)
  }

  /**
   * タイトル処理
   */
  title() {
    //======================
    // スタート画面描画
    //======================
    // 背景消去
    this.ctx!.clearRect(0, 0, this.canvas!.width, this.canvas!.height)

    // 湯呑
    this.ctx!.drawImage(this.image.img_yunomi, (this.canvas!.width - this.image.img_yunomi.width) / 2, (this.canvas!.height - this.image.img_yunomi.height) / 2)

    // 文字
    this.ctx!.font = '30px ' + this.FONT_SUSHI
    const strTitle = '『さかなへん』クイズ'
    let tm = this.ctx!.measureText(strTitle)
    const posX = (this.canvas!.width - tm.width) / 2
    const posY = (this.canvas!.height - 60) / 2

    this.ctx!.fillStyle = 'rgba(0,255,0,0.6)'
    this.ctx!.fillRect(posX, posY, tm.width, 60)
    this.ctx!.fillStyle = 'rgb(255,255,255)'
    this.ctx!.beginPath()
    this.ctx!.strokeStyle = 'rgb(255,255,0)'
    this.ctx!.rect(posX, posY, tm.width, 60)
    this.ctx!.stroke()
    this.ctx!.fillStyle = 'rgb(255,0,0)'
    this.ctx!.fillText(strTitle, posX, posY + 30)

    this.ctx!.font = '20px ' + this.FONT_COMMON
    this.ctx!.fillStyle = 'rgb(255,255,255)'
    this.ctx!.shadowColor = '#555'
    this.ctx!.shadowOffsetX = 1
    this.ctx!.shadowOffsetY = 1
    const strStart = '画面' + (this.isSmartPhone() ? 'タップ' : 'クリック') + 'でスタート'
    tm = this.ctx!.measureText(strStart)
    this.ctx!.fillText(strStart, (this.canvas!.width - tm.width) / 2, posY + 52)
    this.ctx!.shadowColor = ''
    this.ctx!.shadowOffsetX = 0
    this.ctx!.shadowOffsetY = 0

    //======================
    // スタートボタン処理
    //======================
    this.canvas!.addEventListener(
      'click',
      () => {
        // alert("開始");
        this.startGame()
      },
      { once: true },
    )
  }

  /**
   * ゲーム開始処理
   */
  startGame() {
    // 音再生
    this.playSound('s_start')

    //==============
    // 初期化処理
    //==============
    this.quizNo = 0
    this.hitCount = 0

    //==============
    // 問題生成
    //==============
    // データ転記
    let lst_sakana_hen = JSON.parse(JSON.stringify(LST_SAKANA_HEN))
    // シャッフル
    for (let i = 0; i < 100; i++) {
      const itemNo0 = Math.floor(Math.random() * LST_SAKANA_HEN.length)
      const itemNo1 = Math.floor(Math.random() * LST_SAKANA_HEN.length)
      ;[lst_sakana_hen[itemNo0], lst_sakana_hen[itemNo1]] = [lst_sakana_hen[itemNo1], lst_sakana_hen[itemNo0]]
    }
    // 問題/回答生成
    this.listQuiz = []
    for (let quizNo = 0; quizNo < this.MAX_QUIZ_NO; quizNo++) {
      const answerNo = Math.floor(Math.random() * this.MAX_ANSWER_NO)
      // Log.info("問題" + quizNo + ":" + answerNo);
      const selection: string[] = []
      const [quiz, answer] = lst_sakana_hen.shift()
      for (let selectNo = 0; selectNo < this.MAX_ANSWER_NO; selectNo++) {
        // 当たり生成
        if (selectNo === answerNo) {
          selection.push(answer)
        }
        // はずれ生成
        else {
          const getMissItem = () => {
            while (true) {
              const missItem = LST_SAKANA_HEN[Math.floor(Math.random() * LST_SAKANA_HEN.length)][1]
              // 当たりに存在するかチェック
              if (missItem === answer) {
                continue
              }
              // 問題の中に既に存在するかチェック
              if (!selection.some((item) => missItem === item)) {
                return missItem
              }
            }
          }
          selection.push(getMissItem())
        }
      }

      // 問題と回答追加
      this.listQuiz.push({
        quiz: quiz,
        answer: answer,
        answerNo: answerNo,
        selection: selection,
      })
    }
    // リソース削除
    lst_sakana_hen = null

    //==============
    // 初期処理
    //==============
    // タイマー値計算
    const interval_time = 1000 / this.FRAME_RATE

    // ウェイト値計算/設定
    this.moveCountSushi_org = this.SUSI_MOVE_TIME / interval_time
    this.hitWait_org = this.HIT_WAIT_TIME / interval_time

    // 初期ウェイト値設定
    this.moveCountSushi = this.moveCountSushi_org
    this.hitWait = 0

    // タイマー設定
    this.timerId = setInterval(() => this.timer(), 1000 / this.FRAME_RATE)

    //--------------
    // 回答クリック
    //--------------
    // スマホ以外
    if (!this.isSmartPhone()) {
      this.onClickAnswerFunc = (event: MouseEvent) => this.onClickAnswerFuncClick(event)
      this.canvas!.addEventListener('click', this.onClickAnswerFunc, false)
      this.onMouseMoveAnswerFunc = (event: MouseEvent) => this.onMouseMoveAnswer(event)
      this.canvas!.addEventListener('mousemove', this.onMouseMoveAnswerFunc, false)
    }
    // スマホ
    else {
      this.onClickAnswerFunc = (event: TouchEvent) => this.onClickAnswerFuncTouch(event as TouchEvent)
      this.canvas!.addEventListener('touchstart', this.onClickAnswerFunc, false)
    }

    // 初期描画
    this.draw()
  }

  /**
   * 回答クリック
   */
  onClickAnswerFuncClick(event: MouseEvent) {
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    this.checkAnswer(x, y)
  }

  /**
   * 回答クリック(スマホ版)
   */
  onClickAnswerFuncTouch(event: TouchEvent) {
    const rect = this.canvas!.getBoundingClientRect()
    const x = event.touches[0].pageX - rect.left
    const y = event.touches[0].pageY - rect.top
    this.checkAnswer(x, y)
  }

  /**
   * 回答クリック
   */
  onMouseMoveAnswer(event: MouseEvent) {
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect()
    const y = event.clientY - rect.top

    let cursor = 'default'
    const posY = 250
    if (this.hitWait <= 0 && posY <= y && y < posY + 50 * this.MAX_ANSWER_NO) {
      cursor = 'pointer'
    }
    this.canvas!.style.cursor = cursor
  }

  /**
   * 回答チェック
   *
   * @param _x X座標
   * @param y Y座標
   */
  checkAnswer(_x: number, y: number) {
    // 当たり/はずれエフェクト中は何も回答判定しない
    if (0 < this.hitWait) {
      return
    }

    // 仮想サイズに補正
    y = (y * this.canvas!.height) / this.vHeight

    // 回答判定
    for (let answerNo = 0; answerNo < this.MAX_ANSWER_NO; answerNo++) {
      const posY = 250 + 50 * answerNo
      if (posY <= y && y < posY + 50) {
        this.clickSelectionNo = answerNo
        // Log.info("選択=" + this.clickSelectionNo);

        const itemQuiz = this.listQuiz[this.quizNo]
        // あたり/はずれ処理
        this.setHit(this.clickSelectionNo === itemQuiz.answerNo)

        return
      }
    }
  }

  /**
   * 次のクイズ
   */
  nextQuiz() {
    // 選択クリア
    this.clickSelectionNo = undefined

    if (this.quizNo < this.listQuiz.length - 1) {
      this.moveCountSushi = this.moveCountSushi_org
      this.quizNo++
    } else {
      // ゲーム終了
      this.endGame()
    }
  }

  /**
   * あたり/はずれ処理
   *
   * @param bHit true:あたり, false:はずれ
   */
  setHit(bHit: boolean) {
    this.bHit = bHit
    if (bHit) {
      this.hitCount++
      this.playSound('s_seikai')
    } else {
      this.playSound('s_miss')
    }
    // エフェクト時間設定
    this.hitWait = this.hitWait_org
  }

  /**
   * タイマー処理
   */
  timer() {
    // タイマーカウント++
    this.timer_count++

    if (this.hitWait <= 0) {
      if (--this.moveCountSushi <= 0) {
        // はずれ
        this.setHit(false)
      }
    }
    // あたり/はずれエフェクト終了
    else if (--this.hitWait <= 0) {
      this.nextQuiz()
    }

    // 処理中にタイマー処理削除されていた場合終了
    if (this.timerId == null) {
      return
    }
    // 描画処理
    this.draw()
  }

  /**
   * 描画処理
   */
  draw() {
    /* グラデーション領域をセット */
    const grad = this.ctx!.createLinearGradient(0, 0, 0, this.canvas!.height)
    /* グラデーション終点のオフセットと色をセット */
    grad.addColorStop(0, '#fef9ed')
    grad.addColorStop(0.5, 'rgb(255, 255, 255)')
    /* グラデーションをfillStyleプロパティにセット */
    this.ctx!.fillStyle = grad
    // this.ctx!.fillStyle = "rgb(255,255,0)";
    this.ctx!.fillRect(0, 0, this.canvas!.width, this.canvas!.height)

    //----------
    // くーまん描画処理
    //----------
    let img_kuman: HTMLImageElement
    if (0 < this.hitWait) {
      img_kuman = this.bHit ? this.image.img_kuman_ok : this.image.img_kuman_ng
    } else {
      img_kuman = this.image.img_kuman
    }
    this.ctx!.drawImage(img_kuman, (this.canvas!.width - img_kuman.width) / 2, 290 - img_kuman.height)

    // 帽子
    this.ctx!.drawImage(this.image.img_boushi, (this.canvas!.width - this.image.img_boushi.width) / 2, 25)

    //----------
    // テーブル
    //----------
    this.ctx!.drawImage(this.image.img_table, 0, 160)

    //----------
    // 寿司＋さかなへん
    //----------

    //----------
    // 背景色
    //----------
    const marginX = 84
    const posX = ((this.canvas!.width + marginX * 2) / this.moveCountSushi_org) * this.moveCountSushi - marginX
    const posY = 146
    // 皿
    this.ctx!.drawImage(this.image.img_sara, posX - 24, posY)

    // クイズ
    const itemQuiz = this.listQuiz[this.quizNo]
    let strQuiz = itemQuiz.quiz
    if (this.debug) {
      strQuiz += '(' + itemQuiz.answer + ')'
    }
    this.ctx!.font = '60px ' + this.FONT_SUSHI
    this.ctx!.strokeStyle = 'rgb(255,255,255)'
    this.ctx!.lineWidth = 4
    this.ctx!.strokeText(strQuiz, posX, posY + 55)
    this.ctx!.lineWidth = 1
    this.ctx!.fillStyle = 'rgb(0,0,0)'
    this.ctx!.fillText(strQuiz, posX, posY + 55)

    //----------
    // 三択描画
    //----------
    this.ctx!.fillStyle = 'rgb(255,255,255)'
    this.ctx!.fillRect(0, 250, this.canvas!.width, this.canvas!.height)
    for (let answerNo = 0; answerNo < this.MAX_ANSWER_NO; answerNo++) {
      const posY = 250 + 50 * answerNo

      // ボタン描画
      const img_btn = this.clickSelectionNo === answerNo ? this.image.img_btn_1 : this.image.img_btn_0
      this.ctx!.drawImage(img_btn, 1, posY)

      // 回答文字列
      this.ctx!.font = '40px ' + this.FONT_SUSHI
      this.ctx!.fillStyle = 'rgb(0,0,0)'
      this.ctx!.fillText(itemQuiz.selection[answerNo], 4, posY + 40)
    }

    //----------
    // 当たり/はずれ
    //----------
    if (0 < this.hitWait) {
      this.ctx!.font = 'bold 80px ' + this.FONT_SUSHI
      const img_ans = this.bHit ? this.image.img_ans_ok : this.image.img_ans_ng
      const posY = 120 + (this.hitWait / this.hitWait_org) * 40
      this.ctx!.drawImage(img_ans, (this.canvas!.width - img_ans.width) / 2, posY)
    }

    //----------
    // ステータス
    //----------
    // 問題
    const strQuizNo = '問題:' + (this.quizNo + 1) + '/' + this.listQuiz.length
    this.ctx!.font = '30px ' + this.FONT_COMMON
    this.ctx!.fillStyle = 'rgb(0,0,0)'
    const tm = this.ctx!.measureText(strQuizNo)
    const statusPosX = this.canvas!.width - tm.width
    this.ctx!.fillText(strQuizNo, statusPosX, 30)

    // 正解数
    const strScore = '正解:' + this.hitCount
    this.ctx!.fillText(strScore, statusPosX, 60)
  }

  /**
   * ゲーム終了処理
   */
  endGame() {
    // タイマー削除
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = undefined
    }

    //--------------
    // 回答クリックイベント削除
    //--------------
    this.canvas!.removeEventListener('click', this.onClickAnswerFunc)
    // マウスカーソルリセット
    this.canvas!.removeEventListener('mousemove', this.onMouseMoveAnswerFunc)
    this.canvas!.style.cursor = 'default'

    //======================
    // 結果データ
    //======================
    // @ts-ignore
    const [_point, strResult, aResult]: [number, string, string] = this.RESULT_INFO.find((item) => item[0] <= this.hitCount)

    // サウンド
    this.playSound(aResult)

    //======================
    // ゲームオーバー画面描画
    //======================
    // 背景クリア
    this.ctx!.clearRect(0, 0, this.canvas!.width, this.canvas!.height)

    const posY = 100

    // 文字
    this.ctx!.font = '30px ' + this.FONT_COMMON
    const strTitle = 'ゲームオーバー'
    let tm = this.ctx!.measureText(strTitle)
    let posX = (this.canvas!.width - tm.width) / 2
    this.ctx!.fillStyle = 'rgb(255,0,0)'
    this.ctx!.fillText(strTitle, posX, posY)

    // 正解数
    const strScore = '正解:' + this.hitCount + '/' + this.listQuiz.length
    tm = this.ctx!.measureText(strScore)
    posX = (this.canvas!.width - tm.width) / 2
    this.ctx!.fillText(strScore, posX, posY + 30)

    // 結果
    tm = this.ctx!.measureText(strResult)
    posX = (this.canvas!.width - tm.width) / 2
    this.ctx!.fillStyle = 'rgb(0,60,0)'
    this.ctx!.fillText(strResult, posX, posY + 60)

    // クリック
    this.ctx!.font = '20px ' + this.FONT_COMMON
    this.ctx!.fillStyle = 'rgb(0,0,0)'
    const strStart = '画面' + (this.isSmartPhone() ? 'タップ' : 'クリック') + 'でタイトルへ'
    tm = this.ctx!.measureText(strStart)
    this.ctx!.fillText(strStart, (this.canvas!.width - tm.width) / 2, posY + 100)

    //======================
    // タイトル遷移処理
    //======================
    this.canvas!.addEventListener(
      'click',
      () => {
        this.title()
      },
      { once: true },
    )
  }

  /**
   * サウンド再生
   *
   * @param id サウンドID
   */
  playSound(id: string) {
    this.sound[id].play()
  }

  /**
   * スマホ判断
   */
  isSmartPhone() {
    return navigator.userAgent.indexOf('iPhone') > 0 || navigator.userAgent.indexOf('iPod') > 0 || navigator.userAgent.indexOf('iPad') > 0 || navigator.userAgent.indexOf('Android') > 0
  }
}
