/**
 * 「さかなへん」クイズ
 *
 * @author    熊谷
 * @copyright 2011-2024 Team-Grasshopper, Inc.
 * @link      https://team-grasshopper.info/
 */
import { Log } from './libs/log.ts'
import { LST_SAKANA_HEN } from './consts/dakana_data.ts'
import { Rectangle } from './types/rectangle.ts'
import { FONT_COMMON, FONT_SUSHI, LST_AUDIOS, LST_IMAGES, RESULT_INFO } from './consts/def_data.ts'

/**
 * 難易度情報
 */
const LEVEL_INFO = [
  { name: '初級', sushiMoveTime: 5000, maxQuizNo: 10, maxAnswerNo: 2 },
  { name: '中級', sushiMoveTime: 4000, maxQuizNo: 10, maxAnswerNo: 3 },
  { name: '上級', sushiMoveTime: 3000, maxQuizNo: 20, maxAnswerNo: 4 },
]

export class SakanaHen {
  /** キャンバス幅 */
  CANVAS_WIDTH = 400
  /** キャンバス高さ */
  CANVAS_HEIGHT = 400

  /** フレームレート */
  FRAME_RATE = 90
  /** 当たりはずれウェイト(mS) */
  HIT_WAIT_TIME = 1000

  /** デバッグ処理 */
  debug = false

  /** レベル */
  level = -1
  /** 寿司移動時間(mS) */
  sushiMoveTime = 5000
  /** 問題数 */
  maxQuizNo = 10
  /** 解答選択数 */
  maxAnswerNo = 3

  /** キャンバスID名 */
  canvasId: string | undefined
  /** キャンバス関連 */
  canvas: HTMLCanvasElement | undefined
  /** キャンバス関連コンテキスト */
  ctx: CanvasRenderingContext2D | undefined

  /**
   * 仮想キャンバスの高さ
   * 拡大縮小時のマウスクリック座標補正に使用
   */
  vHeight: number = 0

  /** 画像リスト */
  image: {
    [key: string]: HTMLImageElement
  } = {}
  /** 読み込み成功フラグ */
  loadSuccess: boolean = false
  /** 読み込み中数 */
  loadCount: number = 0
  /** 読み込み最大数 */
  loadMaxCount: number = 0

  /** サウンドリスト */
  sound: {
    [key: string]: HTMLAudioElement
  } = {}

  /** タイマーID */
  timerId: number | undefined
  /** タイマーカウント */
  timerCount: number = 0
  /** 解答選択位置 */
  rectAnswers: Rectangle[] = []

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
   * コンストラクタ
   *
   * @param canvasId キャンバスID
   * @param options
   */
  constructor(canvasId: string, options: any) {
    this.debug = import.meta.env.DEV
    // 設定値コピー
    if (options) {
      Object.assign(this, options)
    }
    Log.debug = this.debug
    this.init(canvasId)
  }

  /**
   * クイズ初期化
   *
   * @param canvasId キャンバスID
   */
  async init(canvasId: string) {
    Log.info('初期化処理')

    this.canvasId = canvasId

    // canvas要素が無い場合、未対応ブラウザ
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement
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
    this.loadSuccess = true
    this.loadCount = 0
    this.loadMaxCount = LST_IMAGES.length
    this.ctx!.font = '12px ' + FONT_COMMON
    this.ctx!.fillText('ロード中:0/' + this.loadMaxCount, 0, 20)

    // 画像ファイルロード
    this.image = {}
    const printLoadMessage = (event: Event, success: boolean) => {
      ++this.loadCount

      const strMessage = 'ロード' + (success ? '成功' : '失敗') + ':' + this.loadCount + '/' + this.loadMaxCount + '[' + (event.target as HTMLImageElement).getAttribute('src') + ']'
      Log.info(strMessage)
      this.ctx!.font = '12px ' + FONT_COMMON
      this.ctx!.fillText(strMessage, 0, 20 + this.loadCount * 12)
    }
    const promises = LST_IMAGES.map((item) => {
      return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = (event: Event) => {
          printLoadMessage(event, true)
          resolve(true)
        }
        image.onerror = (event) => {
          printLoadMessage(event as Event, false)
          reject()
        }
        image.src = 'images/' + item[1]
        this.image[item[0]] = image
      })
    })
    await Promise.all(promises)

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

    // サウンドファイルロード
    // todo: ロード確定処理実装
    // addEventListener("loadeddata", () => {})
    if (ext) {
      LST_AUDIOS.map((item) => {
        this.sound[item[0]] = new Audio('sounds/' + item[1] + ext)
      })
    }
    // 全ロードしたらタイトルへ
    this.title()
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
    this.ctx!.drawImage(this.image.yunomi, (this.canvas!.width - this.image.yunomi.width) / 2, (this.canvas!.height - this.image.yunomi.height) / 2)

    // 文字
    this.ctx!.font = '30px ' + FONT_SUSHI
    const strTitle = '『さかなへん』クイズ'
    const tmTitle = this.ctx!.measureText(strTitle)
    const titleWidth = tmTitle.width + 20
    const titleHeight = 150
    const posX = (this.canvas!.width - titleWidth) / 2
    const posY = (this.canvas!.height - titleHeight) / 2 - 10

    this.ctx!.fillStyle = 'rgba(0,255,0,0.6)'
    this.ctx!.fillRect(posX, posY, titleWidth, titleHeight)
    this.ctx!.fillStyle = 'rgb(255,255,255)'
    this.ctx!.beginPath()
    this.ctx!.strokeStyle = 'rgb(255,255,0)'
    this.ctx!.rect(posX, posY, titleWidth, titleHeight)
    this.ctx!.stroke()
    this.ctx!.fillStyle = 'rgb(255,0,0)'
    this.ctx!.fillText(strTitle, posX, posY + 30)

    const drawLevel = (level?: number) => {
      this.ctx!.font = '30px ' + FONT_COMMON
      this.ctx!.shadowColor = '#555'
      this.ctx!.shadowOffsetX = 1
      this.ctx!.shadowOffsetY = 1
      LEVEL_INFO.forEach((item, idx) => {
        this.ctx!.fillStyle = level != idx ? 'rgb(255,255,255)' : 'rgb(255,0,0)'
        const strStart = item.name
        const tmStart = this.ctx!.measureText(strStart)
        this.ctx!.fillText(strStart, (this.canvas!.width - tmStart.width) / 2, posY + 40 + 32 * (idx + 1))
      })
      this.ctx!.shadowColor = ''
      this.ctx!.shadowOffsetX = 0
      this.ctx!.shadowOffsetY = 0
    }
    drawLevel()

    //======================
    // スタートボタン領域作成
    //======================
    const rectStart = LEVEL_INFO.map((_, index) => {
      return {
        x: posX,
        y: posY + 40 + 32 * index,
        width: titleWidth,
        height: 32,
      }
    })

    //======================
    // スタートボタン処理
    //======================
    const onClickStart = (event: MouseEvent) => {
      Log.info('開始')
      event.preventDefault()

      const rect = (event.target as HTMLCanvasElement).getBoundingClientRect()
      // 仮想座標に補正
      const { x, y } = this.getVPos(event.clientX - rect.left, event.clientY - rect.top)

      const level = this.hitNo(rectStart, x, y)
      if (level >= 0) {
        Log.info('level:' + level)
        this.canvas!.removeEventListener('click', onClickStart)
        this.canvas!.removeEventListener('mousemove', onMouseMoveStart)

        // 音再生
        this.playSound('start', () => this.startGame(level))
      }
    }
    // マウス移動イベント
    const onMouseMoveStart = (event: MouseEvent) => {
      event.preventDefault()

      const rect = (event.target as HTMLCanvasElement).getBoundingClientRect()
      // 仮想座標に補正
      const { x, y } = this.getVPos(event.clientX - rect.left, event.clientY - rect.top)

      const level = this.hitNo(rectStart, x, y)
      drawLevel(level)
      this.canvas!.style.cursor = level < 0 ? 'default' : 'pointer'
    }
    this.canvas!.addEventListener('click', onClickStart, false)
    this.canvas!.addEventListener('mousemove', onMouseMoveStart, false)
  }

  /**
   * ゲーム開始処理
   */
  startGame(level = 1) {
    //==============
    // 初期化処理
    //==============
    // レベル設定
    const levelInfo = LEVEL_INFO[level]
    this.sushiMoveTime = levelInfo.sushiMoveTime
    this.maxQuizNo = levelInfo.maxQuizNo
    this.maxAnswerNo = levelInfo.maxAnswerNo

    this.quizNo = 0
    this.hitCount = 0

    //----------
    // 解答選択位置確定
    //----------
    this.rectAnswers = []
    const btnHeight = this.image.btn_0.height
    const btnWidth = this.image.btn_0.width
    const lineHeight = btnHeight

    const maxCol = 2
    const maxRow = Math.ceil(this.maxAnswerNo / maxCol)
    const startY = this.canvas!.height - maxRow * lineHeight
    let answerNo = 0
    for (let row = 0; row < maxRow; row++) {
      for (let col = 0; col < maxCol; col++) {
        if (answerNo++ >= this.maxAnswerNo) {
          break
        }
        this.rectAnswers.push({
          x: col * btnWidth,
          y: startY + lineHeight * row,
          width: btnWidth,
          height: btnHeight,
        })
      }
    }
    Log.info('rectAnswers', this.rectAnswers)

    //==============
    // 問題生成
    //==============
    // データ転記
    let lst_sakana_hen = LST_SAKANA_HEN.concat()
    // 問題/回答生成
    this.listQuiz = []
    for (let quizNo = 0; quizNo < this.maxQuizNo; quizNo++) {
      const answerNo = Math.floor(Math.random() * this.maxAnswerNo)
      // Log.info("問題" + quizNo + ":" + answerNo);
      const selection: string[] = []
      const item = lst_sakana_hen[Math.floor(Math.random() * lst_sakana_hen.length)]
      const [quiz, answer] = item
      lst_sakana_hen = lst_sakana_hen.filter((_item: any) => _item !== item)
      for (let selectNo = 0; selectNo < this.maxAnswerNo; selectNo++) {
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

    //==============
    // 初期処理
    //==============
    // タイマー値計算
    const interval_time = 1000 / this.FRAME_RATE

    // ウェイト値計算/設定
    this.moveCountSushi_org = this.sushiMoveTime / interval_time
    this.hitWait_org = this.HIT_WAIT_TIME / interval_time

    // 初期ウェイト値設定
    this.moveCountSushi = this.moveCountSushi_org
    this.hitWait = 0

    // タイマー設定
    this.timerId = setInterval(() => this.timer(), 1000 / this.FRAME_RATE)

    //--------------
    // 回答クリック
    //--------------
    this.canvas!.addEventListener('click', this.onClickAnswer, false)
    this.canvas!.addEventListener('mousemove', this.onMouseMoveAnswer, false)

    // 初期描画
    this.draw()
  }

  /**
   * 回答クリック
   */
  onClickAnswer = (event: MouseEvent) => {
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    this.checkAnswer(x, y)
  }

  /**
   * 回答クリック
   */
  onMouseMoveAnswer = (event: MouseEvent) => {
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect()
    // 仮想座標に補正
    const { x, y } = this.getVPos(event.clientX - rect.left, event.clientY - rect.top)
    // 回答判定
    this.canvas!.style.cursor = this.hitNo(this.rectAnswers, x, y) < 0 ? 'default' : 'pointer'
  }

  getVPos(x: number, y: number) {
    const rete = this.canvas!.height / this.vHeight
    return { x: x * rete, y: y * rete }
  }

  /**
   * 回答チェック
   *
   * @param _x X座標
   * @param _y Y座標
   */
  checkAnswer(_x: number, _y: number) {
    // 当たり/はずれエフェクト中は何も回答判定しない
    if (0 < this.hitWait) {
      return
    }

    // 仮想座標に補正
    const { x, y } = this.getVPos(_x, _y)

    // 回答判定
    const hitNo = this.hitNo(this.rectAnswers, x, y)
    if (0 <= hitNo) {
      this.clickSelectionNo = hitNo
      // Log.info("選択=" + this.clickSelectionNo);
      const itemQuiz = this.listQuiz[this.quizNo]
      // あたり/はずれ処理
      this.setHit(this.clickSelectionNo === itemQuiz.answerNo)
    }
  }

  /**
   * あたり判定
   * @param rects
   * @param x
   * @param y
   */
  hitNo(rects: Rectangle[], x: number, y: number): number {
    return rects.findIndex((rect) => {
      return rect.x <= x && x <= rect.x + rect.width && rect.y <= y && y <= rect.y + rect.height
    })
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
      this.playSound('seikai')
    } else {
      this.playSound('miss')
    }
    // エフェクト時間設定
    this.hitWait = this.hitWait_org
  }

  /**
   * タイマー処理
   */
  timer() {
    // タイマーカウント++
    this.timerCount++

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
    this.ctx!.fillRect(0, 0, this.canvas!.width, this.canvas!.height)

    //----------
    // くーまん描画処理
    //----------
    let imgKuman: HTMLImageElement
    if (0 < this.hitWait) {
      imgKuman = this.bHit ? this.image.kuman_ok : this.image.kuman_ng
    } else {
      imgKuman = this.image.kuman
    }
    this.ctx!.drawImage(imgKuman, (this.canvas!.width - imgKuman.width) / 2, 48)

    // 帽子
    this.ctx!.drawImage(this.image.boushi, (this.canvas!.width - this.image.boushi.width) / 2, 35)

    //----------
    // テーブル
    //----------
    this.ctx!.drawImage(this.image.table, 0, 180)

    //----------
    // 寿司＋さかなへん
    //----------

    //----------
    // 背景色
    //----------
    const marginX = 84
    const posX = ((this.canvas!.width + marginX * 2) / this.moveCountSushi_org) * this.moveCountSushi - marginX
    const posY = 176
    // 皿
    this.ctx!.drawImage(this.image.sara, posX - 24, posY)

    // クイズ
    const itemQuiz = this.listQuiz[this.quizNo]
    const strQuiz = itemQuiz.quiz
    this.ctx!.font = '60px ' + FONT_SUSHI
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
    this.ctx!.fillRect(this.rectAnswers[0].x, this.rectAnswers[0].y, this.canvas!.width, this.canvas!.height)
    for (let answerNo = 0; answerNo < this.maxAnswerNo; answerNo++) {
      const posY = this.rectAnswers[answerNo].y
      const posX = this.rectAnswers[answerNo].x
      // ボタン描画
      const btn = this.clickSelectionNo === answerNo ? this.image.btn_1 : this.image.btn_0
      this.ctx!.drawImage(btn, posX, posY)

      // 回答文字列
      this.ctx!.font = '40px ' + FONT_SUSHI
      this.ctx!.fillStyle = 'rgb(0,0,0)'
      this.ctx!.fillText(itemQuiz.selection[answerNo], posX + 4, posY + 40)
    }

    //----------
    // 当たり/はずれ
    //----------
    if (0 < this.hitWait) {
      this.ctx!.font = 'bold 80px ' + FONT_SUSHI
      const imgAnswer = this.bHit ? this.image.ans_ok : this.image.ans_ng
      const posY = 120 + (this.hitWait / this.hitWait_org) * 40
      this.ctx!.drawImage(imgAnswer, (this.canvas!.width - imgAnswer.width) / 2, posY)
    }

    //----------
    // ステータス
    //----------
    // 問題
    const strQuizNo = '問題:' + (this.quizNo + 1) + '/' + this.listQuiz.length
    this.ctx!.font = '30px ' + FONT_COMMON
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
    this.canvas!.removeEventListener('click', this.onClickAnswer)
    this.canvas!.removeEventListener('mousemove', this.onMouseMoveAnswer)
    // マウスカーソルリセット
    this.canvas!.style.cursor = 'default'

    //======================
    // 結果データ
    //======================
    const result = Math.round((this.hitCount / this.listQuiz.length) * 100)
    // @ts-ignore
    const [_percent, strResult, aResult]: [number, string, string] = RESULT_INFO.find((item) => item[0] <= result)

    // サウンド
    this.playSound(aResult)

    //======================
    // ゲームオーバー画面描画
    //======================
    // 背景クリア
    this.ctx!.clearRect(0, 0, this.canvas!.width, this.canvas!.height)

    const posY = 100

    // 文字
    this.ctx!.font = '30px ' + FONT_COMMON
    const strTitle = 'ゲームオーバー'
    let tm = this.ctx!.measureText(strTitle)
    let posX = (this.canvas!.width - tm.width) / 2
    this.ctx!.fillStyle = 'rgb(255,0,0)'
    this.ctx!.fillText(strTitle, posX, posY)

    // 正解数
    // const strScore = '正解:' + this.hitCount + '/' + this.listQuiz.length
    const strScore = `正解: ${result}点`
    tm = this.ctx!.measureText(strScore)
    posX = (this.canvas!.width - tm.width) / 2
    this.ctx!.fillText(strScore, posX, posY + 30)

    // 結果
    tm = this.ctx!.measureText(strResult)
    posX = (this.canvas!.width - tm.width) / 2
    this.ctx!.fillStyle = 'rgb(0,60,0)'
    this.ctx!.fillText(strResult, posX, posY + 64)

    // クリック
    this.ctx!.font = '20px ' + FONT_COMMON
    this.ctx!.fillStyle = 'rgb(0,0,0)'
    const strStart = '画面' + (this.isSmartPhone() ? 'タップ' : 'クリック') + 'でタイトルへ'
    tm = this.ctx!.measureText(strStart)
    this.ctx!.fillText(strStart, (this.canvas!.width - tm.width) / 2, posY + 108)

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
   * @param endFunc 再生終了時のコールバック関数
   */
  playSound(id: string, endFunc?: Function) {
    const sound = this.sound[id]
    // 再生中でも最初から再生しなおすおまじない
    sound.pause()
    sound.currentTime = 0
    sound.play()
    if (endFunc) {
      sound.addEventListener("ended", () => endFunc(), { once: true })
    }
  }

  /**
   * スマホ判断
   */
  isSmartPhone() {
    return navigator.userAgent.indexOf('iPhone') > 0 || navigator.userAgent.indexOf('iPod') > 0 || navigator.userAgent.indexOf('iPad') > 0 || navigator.userAgent.indexOf('Android') > 0
  }
}
