/**
 * 「さかなへん」クイズ
 *
 * @author    熊谷
 * @copyright 2011-2024 Team-Grasshopper, Inc.
 * @link      https://team-grasshopper.info/
 */
import { Log } from './libs/log.ts'
import { LST_SAKANA_HEN } from './consts/sakana_data.ts'
import { Rectangle } from './types/rectangle.ts'
import { FONT_COMMON, FONT_SUSHI, LST_AUDIOS, LST_IMAGES, RESULT_INFO } from './consts/def_data.ts'
import { easeOutElastic } from './libs/easing.ts'

/**
 * 難易度情報
 */
const LEVEL_INFO = [
  { name: '初級', sushiMoveTime: 5000, maxQuizNo: 10, maxAnswerNo: 2 },
  { name: '中級', sushiMoveTime: 4000, maxQuizNo: 10, maxAnswerNo: 3 },
  { name: '上級', sushiMoveTime: 3000, maxQuizNo: 20, maxAnswerNo: 4 },
]

/**
 * ゲーム状態
 * - loading:  初期化(画像読み込み)中
 * - title:    タイトル画面(レベル選択待ち)
 * - starting: レベル選択後、開始サウンド再生中
 * - playing:  クイズ進行中
 * - result:   結果画面
 * - error:    エラー表示中(以降の操作は受け付けない)
 */
type GameState = 'loading' | 'title' | 'starting' | 'playing' | 'result' | 'error'

/** 1問分のクイズ */
type QuizItem = {
  /** 問題(漢字) */
  quiz: string
  /** 正解(読み) */
  answer: string
  /** 正解の選択肢番号 */
  answerNo: number
  /** 選択肢 */
  selection: string[]
}

/**
 * 配列をシャッフルした新しい配列を返す (Fisher-Yates)
 *
 * @param list 元配列
 */
const shuffle = <T>(list: readonly T[]): T[] => {
  const result = [...list]
  for (let i = result.length - 1; 0 < i; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * クイズデータと難易度設定の整合性チェック
 *
 * @returns 問題があればエラーメッセージ、無ければ undefined
 */
const validateQuizData = (): string | undefined => {
  const readingCount = new Set(LST_SAKANA_HEN.map(([, reading]) => reading)).size
  for (const info of LEVEL_INFO) {
    if (LST_SAKANA_HEN.length < info.maxQuizNo) {
      return `${info.name}: 問題数(${info.maxQuizNo})が問題データ件数(${LST_SAKANA_HEN.length})を超えています`
    }
    if (readingCount < info.maxAnswerNo) {
      return `${info.name}: 選択肢数(${info.maxAnswerNo})が読みの種類数(${readingCount})を超えています`
    }
  }
  return undefined
}

export class SakanaHen {
  /** キャンバス幅 */
  CANVAS_WIDTH = 400
  /** キャンバス高さ */
  CANVAS_HEIGHT = 400

  /** 当たりはずれウェイト(mS) */
  HIT_WAIT_TIME = 1000
  /**
   * 1フレームで進める最大時間(mS)
   * タブ非表示等でフレームが止まった場合に、復帰時に時間が一気に進まないようにする
   */
  MAX_FRAME_DELTA = 100
  /**
   * 終了待ちサウンドの最大待ち時間(mS)
   * 長さが取得できない/再生できない場合でも処理を先に進めるため
   */
  SOUND_END_TIMEOUT = 3000

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
  readonly canvasId: string
  /** キャンバス関連 */
  readonly canvas: HTMLCanvasElement
  /** キャンバス関連コンテキスト */
  readonly ctx: CanvasRenderingContext2D

  /** エラー表示内容 (再描画用) */
  errorMessage: { message: string; hint: string } | undefined

  /** ゲーム状態 */
  state: GameState = 'loading'

  /** タイトル画面のレベル選択領域 */
  rectLevels: Rectangle[] = []
  /** タイトル画面でマウスが乗っているレベル (-1:なし) */
  hoverLevel: number = -1

  /** 画像リスト */
  image: {
    [key: string]: HTMLImageElement
  } = {}
  /** 読み込み中数 */
  loadCount: number = 0
  /** 読み込み最大数 */
  loadMaxCount: number = 0

  /** サウンドリスト */
  sound: {
    [key: string]: HTMLAudioElement
  } = {}

  /** requestAnimationFrame の ID (ゲーム進行中のみ設定) */
  animationId: number | undefined
  /** 前フレームのタイムスタンプ(mS) */
  lastFrameTime: number | undefined
  /** 解答選択位置 */
  rectAnswers: Rectangle[] = []

  /** 魚偏問題リスト */
  listQuiz: QuizItem[] = []
  /** 問題番号 */
  quizNo: number = 0

  /** 寿司移動経過時間(mS) */
  sushiElapsed: number = 0

  /** 選択クリック番号 */
  clickSelectionNo: number | undefined

  /** 当たり/はずれ */
  bHit: boolean = false
  /** 当たり/はずれエフェクト中 */
  isHitEffect: boolean = false
  /** 当たり/はずれエフェクト経過時間(mS) */
  hitElapsed: number = 0

  /** 正解数 */
  hitCount: number = 0

  /**
   * コンストラクタ
   *
   * @param canvasId キャンバスID
   * @param options 設定値の上書き
   */
  constructor(canvasId: string, options?: SakanaHenOptions) {
    this.debug = import.meta.env.DEV
    // 設定値コピー
    if (options) {
      Object.assign(this, options)
    }
    Log.debug = this.debug

    // canvas要素取得
    const canvas = document.getElementById(canvasId)
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error(`canvas要素が見つかりません: #${canvasId}`)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      alert('本ページの閲覧はHTML5対応ブラウザで行ってください')
      throw new Error('2Dコンテキストを取得できません')
    }
    this.canvasId = canvasId
    this.canvas = canvas
    this.ctx = ctx

    this.init().catch((error) => {
      Log.error('初期化失敗', error)
      this.drawErrorMessage('初期化に失敗しました。')
    })
  }

  /**
   * エラーメッセージ描画
   *
   * @param message メッセージ
   * @param hint 対処方法
   */
  drawErrorMessage(message: string, hint = 'ページを再読み込みしてください。') {
    this.state = 'error'
    this.errorMessage = { message, hint }
    this.canvas.style.cursor = 'default'
    this.redraw()
  }

  /**
   * キャンバスの表示サイズに合わせて内部解像度を設定する
   * 描画は常に CANVAS_WIDTH x CANVAS_HEIGHT の論理座標で行い、
   * 表示サイズ × devicePixelRatio の解像度で描くことで拡大表示や高解像度画面でもぼやけないようにする
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect()
    const displayWidth = rect.width || this.CANVAS_WIDTH
    const scale = (displayWidth / this.CANVAS_WIDTH) * (window.devicePixelRatio || 1)
    const width = Math.round(this.CANVAS_WIDTH * scale)
    const height = Math.round(this.CANVAS_HEIGHT * scale)
    if (this.canvas.width === width && this.canvas.height === height) {
      return
    }
    // サイズ変更でキャンバスはクリアされ、コンテキストの状態もリセットされる
    this.canvas.width = width
    this.canvas.height = height
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0)
    this.redraw()
  }

  /**
   * 現在の状態の画面を再描画する
   */
  redraw() {
    switch (this.state) {
      case 'title':
      case 'starting':
        this.drawTitle()
        break
      case 'playing':
        this.draw()
        break
      case 'result':
        this.drawResult()
        break
      case 'error':
        if (this.errorMessage) {
          const { message, hint } = this.errorMessage
          this.ctx.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT)
          this.ctx.font = '16px ' + FONT_COMMON
          this.ctx.fillStyle = 'rgb(255,0,0)'
          this.ctx.fillText(message, 10, this.CANVAS_HEIGHT / 2 - 12)
          this.ctx.fillText(hint, 10, this.CANVAS_HEIGHT / 2 + 12)
        }
        break
    }
  }

  /**
   * クイズ初期化
   */
  async init() {
    Log.info('初期化処理')

    //----------
    // キャンバスサイズ設定
    //----------
    // 表示サイズが指定されていなければ論理サイズで表示する
    // (内部解像度を上げるため、CSS サイズを固定しないと devicePixelRatio 倍で表示されてしまう)
    if (!this.canvas.style.width && !this.canvas.style.height) {
      this.canvas.style.width = `${this.CANVAS_WIDTH}px`
      this.canvas.style.height = `${this.CANVAS_HEIGHT}px`
    }
    this.resize()
    // 表示サイズ変更 (拡大ボタン・ウィンドウサイズ変更等) に追従する
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.resize()).observe(this.canvas)
    }
    // ブラウザのズーム等で devicePixelRatio だけ変わる場合
    window.addEventListener('resize', () => this.resize())

    // マウスイベントは1度だけ登録し、状態(state)に応じて処理を振り分ける
    this.canvas.addEventListener('click', this.onClick, false)
    this.canvas.addEventListener('mousemove', this.onMouseMove, false)

    //----------
    // 画像ファイルロード
    //----------
    this.loadCount = 0
    this.loadMaxCount = LST_IMAGES.length
    this.ctx.font = '12px ' + FONT_COMMON
    this.ctx.fillText('ロード中:0/' + this.loadMaxCount, 0, 20)

    // 画像ファイルロード
    this.image = {}
    const printLoadMessage = (event: Event, success: boolean) => {
      ++this.loadCount

      const strMessage = 'ロード' + (success ? '成功' : '失敗') + ':' + this.loadCount + '/' + this.loadMaxCount + '[' + (event.target as HTMLImageElement).getAttribute('src') + ']'
      Log.info(strMessage)
      this.ctx.font = '12px ' + FONT_COMMON
      this.ctx.fillText(strMessage, 0, 20 + this.loadCount * 12)
    }
    // 失敗しても全画像の結果が出るまで待ち、成否を集計する
    const promises = LST_IMAGES.map((item) => {
      return new Promise<boolean>((resolve) => {
        const image = new Image()
        image.onload = (event: Event) => {
          printLoadMessage(event, true)
          resolve(true)
        }
        image.onerror = (event) => {
          printLoadMessage(event as Event, false)
          resolve(false)
        }
        image.src = new URL(`../assets/images/${item[1]}`, import.meta.url).href
        this.image[item[0]] = image
      })
    })
    const results = await Promise.all(promises)
    const failedCount = results.filter((success) => !success).length
    if (0 < failedCount) {
      // 読み込めなかった画像は drawImage で例外になるため、ここで止めてエラー表示する
      Log.error(`画像読み込み失敗: ${failedCount}件`)
      this.drawErrorMessage(`画像の読み込みに失敗しました(${failedCount}件)。`)
      return
    }

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
    // サウンドファイル設定
    // 再生できない環境では this.sound は空のままとし、playSound() 側で無音として扱う
    if (ext) {
      LST_AUDIOS.forEach((item) => {
        this.sound[item[0]] = new Audio(new URL(`../assets/sounds/${item[1]}${ext}`, import.meta.url).href)
      })
    } else {
      Log.warn('再生可能な音声形式がありません')
    }

    //----------
    // クイズデータチェック
    //----------
    const dataError = validateQuizData()
    if (dataError) {
      Log.error(`クイズデータ不正: ${dataError}`)
      this.drawErrorMessage('問題データが不足しています。', '詳細はコンソールを確認してください。')
      return
    }

    // 全ロードしたらタイトルへ
    this.title()
  }

  /**
   * マウス座標をキャンバス座標に変換
   * CSS で拡大縮小されていても、表示サイズと内部解像度の比率から補正する
   *
   * @param event マウスイベント
   */
  getCanvasPos(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) * this.CANVAS_WIDTH) / rect.width,
      y: ((event.clientY - rect.top) * this.CANVAS_HEIGHT) / rect.height,
    }
  }

  /**
   * クリック処理 (状態ごとに振り分け)
   */
  onClick = (event: MouseEvent) => {
    event.preventDefault()
    const { x, y } = this.getCanvasPos(event)

    switch (this.state) {
      case 'title': {
        const level = this.hitNo(this.rectLevels, x, y)
        if (0 <= level) {
          Log.info('開始 level:' + level)
          // 開始サウンド再生中の多重クリックを防ぐ
          this.state = 'starting'
          this.canvas.style.cursor = 'default'
          this.playSound('start', () => this.startGame(level))
        }
        break
      }
      case 'playing':
        this.checkAnswer(x, y)
        break
      case 'result':
        this.title()
        break
    }
  }

  /**
   * マウス移動処理 (状態ごとに振り分け)
   */
  onMouseMove = (event: MouseEvent) => {
    const { x, y } = this.getCanvasPos(event)

    let rects: Rectangle[] = []
    switch (this.state) {
      case 'title': {
        rects = this.rectLevels
        const level = this.hitNo(rects, x, y)
        // 選択レベルが変わったときだけ再描画
        if (level !== this.hoverLevel) {
          this.hoverLevel = level
          this.drawTitle()
        }
        break
      }
      case 'playing':
        rects = this.rectAnswers
        break
    }
    this.canvas.style.cursor = this.hitNo(rects, x, y) < 0 ? 'default' : 'pointer'
  }

  /**
   * タイトル処理
   */
  title() {
    this.state = 'title'
    this.hoverLevel = -1
    this.canvas.style.cursor = 'default'
    this.drawTitle()
  }

  /**
   * タイトル画面描画
   * レベル選択領域 (rectLevels) もここで確定する
   */
  drawTitle() {
    // 背景消去
    this.ctx.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT)

    // 湯呑
    this.ctx.drawImage(this.image.yunomi, (this.CANVAS_WIDTH - this.image.yunomi.width) / 2, (this.CANVAS_HEIGHT - this.image.yunomi.height) / 2)

    // 文字
    this.ctx.font = '30px ' + FONT_SUSHI
    const strTitle = '『さかなへん』クイズ'
    const tmTitle = this.ctx.measureText(strTitle)
    const titleWidth = tmTitle.width + 20
    const titleHeight = 150
    const posX = (this.CANVAS_WIDTH - titleWidth) / 2
    const posY = (this.CANVAS_HEIGHT - titleHeight) / 2 - 10

    this.ctx.fillStyle = 'rgba(0,255,0,0.6)'
    this.ctx.fillRect(posX, posY, titleWidth, titleHeight)
    this.ctx.fillStyle = 'rgb(255,255,255)'
    this.ctx.beginPath()
    this.ctx.strokeStyle = 'rgb(255,255,0)'
    this.ctx.rect(posX, posY, titleWidth, titleHeight)
    this.ctx.stroke()
    this.ctx.fillStyle = 'rgb(255,0,0)'
    this.ctx.fillText(strTitle, posX, posY + 30)

    // レベル
    this.ctx.font = '30px ' + FONT_COMMON
    this.ctx.shadowColor = '#555'
    this.ctx.shadowOffsetX = 1
    this.ctx.shadowOffsetY = 1
    LEVEL_INFO.forEach((item, idx) => {
      this.ctx.fillStyle = this.hoverLevel !== idx ? 'rgb(255,255,255)' : 'rgb(255,0,0)'
      const strStart = item.name
      const tmStart = this.ctx.measureText(strStart)
      this.ctx.fillText(strStart, (this.CANVAS_WIDTH - tmStart.width) / 2, posY + 40 + 32 * (idx + 1))
    })
    this.ctx.shadowColor = 'transparent'
    this.ctx.shadowOffsetX = 0
    this.ctx.shadowOffsetY = 0

    // レベル選択領域
    this.rectLevels = LEVEL_INFO.map((_, index) => {
      return {
        x: posX,
        y: posY + 40 + 32 * index,
        width: titleWidth,
        height: 32,
      }
    })
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
    const startY = this.CANVAS_HEIGHT - maxRow * lineHeight
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
    // データ件数・読みの種類数は init() の validateQuizData() でチェック済み
    // 読みの一覧 (同じ読みの漢字が複数あっても選択肢が重複しないよう一意化)
    const readings = [...new Set(LST_SAKANA_HEN.map(([, reading]) => reading))]
    // 出題する問題をランダムに重複なく選ぶ
    this.listQuiz = shuffle(LST_SAKANA_HEN)
      .slice(0, this.maxQuizNo)
      .map(([quiz, answer]) => {
        // はずれ: 正解以外の読みからランダムに選ぶ
        const selection = shuffle(readings.filter((reading) => reading !== answer)).slice(0, this.maxAnswerNo - 1)
        // 正解をランダムな位置に挿入
        const answerNo = Math.floor(Math.random() * this.maxAnswerNo)
        selection.splice(answerNo, 0, answer)
        return { quiz, answer, answerNo, selection }
      })

    //==============
    // 初期処理
    //==============
    // 経過時間初期化
    this.sushiElapsed = 0
    this.isHitEffect = false
    this.hitElapsed = 0
    this.clickSelectionNo = undefined

    // フレームループ開始
    this.state = 'playing'
    this.lastFrameTime = undefined
    this.animationId = requestAnimationFrame(this.frame)

    // 初期描画
    this.draw()
  }

  /**
   * 回答チェック
   *
   * @param x X座標 (キャンバス座標)
   * @param y Y座標 (キャンバス座標)
   */
  checkAnswer(x: number, y: number) {
    // 当たり/はずれエフェクト中は何も回答判定しない
    if (this.isHitEffect) {
      return
    }

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
    this.isHitEffect = false

    if (this.quizNo < this.listQuiz.length - 1) {
      this.sushiElapsed = 0
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
    // エフェクト開始
    this.isHitEffect = true
    this.hitElapsed = 0
  }

  /**
   * フレーム処理 (requestAnimationFrame コールバック)
   *
   * @param timestamp フレームのタイムスタンプ(mS)
   */
  frame = (timestamp: number) => {
    // 前フレームからの経過時間 (タブ非表示からの復帰等で一気に進まないよう上限を設ける)
    const delta = this.lastFrameTime === undefined ? 0 : Math.min(timestamp - this.lastFrameTime, this.MAX_FRAME_DELTA)
    this.lastFrameTime = timestamp

    this.update(delta)

    // 更新中にゲーム終了した場合は描画・次フレーム予約をしない
    if (this.animationId === undefined) {
      return
    }
    this.draw()
    this.animationId = requestAnimationFrame(this.frame)
  }

  /**
   * 状態更新
   *
   * @param delta 経過時間(mS)
   */
  update(delta: number) {
    if (!this.isHitEffect) {
      this.sushiElapsed += delta
      if (this.sushiMoveTime <= this.sushiElapsed) {
        // 時間切れ: はずれ
        this.setHit(false)
      }
    } else {
      this.hitElapsed += delta
      if (this.HIT_WAIT_TIME <= this.hitElapsed) {
        // あたり/はずれエフェクト終了
        this.nextQuiz()
      }
    }
  }

  /**
   * 描画処理
   */
  draw() {
    /* グラデーション領域をセット */
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.CANVAS_HEIGHT)
    /* グラデーション終点のオフセットと色をセット */
    grad.addColorStop(0, '#fef9ed')
    grad.addColorStop(0.5, 'rgb(255, 255, 255)')
    /* グラデーションをfillStyleプロパティにセット */
    this.ctx.fillStyle = grad
    this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT)

    //----------
    // くーまん描画処理
    //----------
    let imgKuman: HTMLImageElement
    if (this.isHitEffect) {
      imgKuman = this.bHit ? this.image.kuman_ok : this.image.kuman_ng
    } else {
      imgKuman = this.image.kuman
    }
    this.ctx.drawImage(imgKuman, (this.CANVAS_WIDTH - imgKuman.width) / 2, 48)

    // 帽子
    this.ctx.drawImage(this.image.boushi, (this.CANVAS_WIDTH - this.image.boushi.width) / 2, 35)

    //----------
    // テーブル
    //----------
    this.ctx.drawImage(this.image.table, 0, 180)

    //----------
    // 寿司＋さかなへん
    //----------

    //----------
    // 背景色
    //----------
    const marginX = 84
    // 残り時間の割合 (1:右端 → 0:左端)
    const remainRate = Math.max(0, 1 - this.sushiElapsed / this.sushiMoveTime)
    const posX = (this.CANVAS_WIDTH + marginX * 2) * remainRate - marginX
    const posY = 176
    // 皿
    this.ctx.drawImage(this.image.sara, posX - 24, posY)

    // クイズ
    const itemQuiz = this.listQuiz[this.quizNo]
    const strQuiz = itemQuiz.quiz
    this.ctx.font = '60px ' + FONT_SUSHI
    this.ctx.strokeStyle = 'rgb(255,255,255)'
    this.ctx.lineWidth = 4
    this.ctx.strokeText(strQuiz, posX, posY + 55)
    this.ctx.lineWidth = 1
    this.ctx.fillStyle = 'rgb(0,0,0)'
    this.ctx.fillText(strQuiz, posX, posY + 55)

    //----------
    // 三択描画
    //----------
    this.ctx.fillStyle = 'rgb(255,255,255)'
    this.ctx.fillRect(this.rectAnswers[0].x, this.rectAnswers[0].y, this.CANVAS_WIDTH, this.CANVAS_HEIGHT)
    for (let answerNo = 0; answerNo < this.maxAnswerNo; answerNo++) {
      const posY = this.rectAnswers[answerNo].y
      const posX = this.rectAnswers[answerNo].x
      // ボタン描画
      const btn = this.clickSelectionNo === answerNo ? this.image.btn_1 : this.image.btn_0
      this.ctx.drawImage(btn, posX, posY)

      // 回答文字列
      this.ctx.font = '40px ' + FONT_SUSHI
      this.ctx.fillStyle = 'rgb(0,0,0)'
      this.ctx.fillText(itemQuiz.selection[answerNo], posX + 4, posY + 40)
    }

    //----------
    // 当たり/はずれ
    //----------
    if (this.isHitEffect) {
      this.ctx.font = 'bold 80px ' + FONT_SUSHI
      const imgAnswer = this.bHit ? this.image.ans_ok : this.image.ans_ng
      const easing = easeOutElastic(Math.min(this.hitElapsed, this.HIT_WAIT_TIME), 0, 100, this.HIT_WAIT_TIME)
      const posY = 170 - (40 * easing) / 100
      this.ctx.globalAlpha = easing / 100
      this.ctx.drawImage(imgAnswer, (this.CANVAS_WIDTH - imgAnswer.width) / 2, posY)
      this.ctx.globalAlpha = 1
    }

    //----------
    // ステータス
    //----------
    // 問題
    const strQuizNo = '問題:' + (this.quizNo + 1) + '/' + this.listQuiz.length
    this.ctx.font = '30px ' + FONT_COMMON
    this.ctx.fillStyle = 'rgb(0,0,0)'
    const tm = this.ctx.measureText(strQuizNo)
    const statusPosX = this.CANVAS_WIDTH - tm.width
    this.ctx.fillText(strQuizNo, statusPosX, 30)

    // 正解数
    const strScore = '正解:' + this.hitCount
    this.ctx.fillText(strScore, statusPosX, 60)
  }

  /**
   * ゲーム終了処理
   */
  endGame() {
    // フレームループ停止
    if (this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId)
      this.animationId = undefined
    }
    this.isHitEffect = false

    // 結果画面へ (クリックでタイトルへ戻る処理は onClick で行う)
    this.state = 'result'
    // マウスカーソルリセット
    this.canvas.style.cursor = 'default'

    // サウンド
    this.playSound(this.getResultInfo().sound)

    // ゲームオーバー画面描画
    this.drawResult()
  }

  /**
   * 結果情報取得
   */
  getResultInfo() {
    const score = Math.round((this.hitCount / this.listQuiz.length) * 100)
    // RESULT_INFO は正解率の降順。末尾(0%)は必ず一致するが、念のため末尾をフォールバックにする
    const [, message, sound] = RESULT_INFO.find(([percent]) => percent <= score) ?? RESULT_INFO[RESULT_INFO.length - 1]
    return { score, message, sound }
  }

  /**
   * 結果画面描画
   */
  drawResult() {
    const { score: result, message: strResult } = this.getResultInfo()

    // 背景クリア
    this.ctx.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT)

    const posY = 100

    // 文字
    this.ctx.font = '30px ' + FONT_COMMON
    const strTitle = 'ゲームオーバー'
    let tm = this.ctx.measureText(strTitle)
    let posX = (this.CANVAS_WIDTH - tm.width) / 2
    this.ctx.fillStyle = 'rgb(255,0,0)'
    this.ctx.fillText(strTitle, posX, posY)

    // 正解数
    // const strScore = '正解:' + this.hitCount + '/' + this.listQuiz.length
    const strScore = `正解: ${result}点`
    tm = this.ctx.measureText(strScore)
    posX = (this.CANVAS_WIDTH - tm.width) / 2
    this.ctx.fillText(strScore, posX, posY + 30)

    // 結果
    tm = this.ctx.measureText(strResult)
    posX = (this.CANVAS_WIDTH - tm.width) / 2
    this.ctx.fillStyle = 'rgb(0,60,0)'
    this.ctx.fillText(strResult, posX, posY + 64)

    // クリック
    this.ctx.font = '20px ' + FONT_COMMON
    this.ctx.fillStyle = 'rgb(0,0,0)'
    const strStart = '画面' + (this.isTouchDevice() ? 'タップ' : 'クリック') + 'でタイトルへ'
    tm = this.ctx.measureText(strStart)
    this.ctx.fillText(strStart, (this.CANVAS_WIDTH - tm.width) / 2, posY + 108)
  }

  /**
   * サウンド再生
   *
   * @param id サウンドID
   * @param endFunc 再生終了時のコールバック関数
   */
  playSound(id: string, endFunc?: () => void) {
    const sound: HTMLAudioElement | undefined = this.sound[id]

    // endFunc は「再生終了」「再生失敗」「タイムアウト」のいずれか最初の1回だけ呼ぶ
    let finished = false
    let timeoutId: number | undefined
    const finish = () => {
      if (finished) {
        return
      }
      finished = true
      clearTimeout(timeoutId)
      sound?.removeEventListener('ended', finish)
      sound?.removeEventListener('error', finish)
      endFunc?.()
    }

    // 音声が使えない環境では無音として即終了扱い
    if (!sound) {
      finish()
      return
    }

    // 再生中でも最初から再生しなおすおまじない
    sound.pause()
    sound.currentTime = 0

    if (endFunc) {
      sound.addEventListener('ended', finish, { once: true })
      sound.addEventListener('error', finish, { once: true })
      // 長さが分かればその少し後、分からなければ既定時間でタイムアウト
      const timeout = Number.isFinite(sound.duration) ? sound.duration * 1000 + 500 : this.SOUND_END_TIMEOUT
      timeoutId = window.setTimeout(finish, timeout)
    }

    sound.play().catch((error) => {
      // 自動再生制限・読み込み失敗等
      Log.warn(`サウンド再生失敗: ${id}`, error)
      finish()
    })
  }

  /**
   * タッチ操作が主の端末か判断
   * UA 判定では iPadOS (Mac として名乗る) を判別できないため、ポインターの種類で判断する
   */
  isTouchDevice() {
    return window.matchMedia?.('(pointer: coarse)').matches ?? false
  }
}

/**
 * コンストラクタで上書き可能な設定値
 */
export type SakanaHenOptions = Partial<Pick<SakanaHen, 'CANVAS_WIDTH' | 'CANVAS_HEIGHT' | 'HIT_WAIT_TIME' | 'MAX_FRAME_DELTA' | 'SOUND_END_TIMEOUT' | 'debug'>>
