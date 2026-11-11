/**
 * 「さかなへん」クイズ
 *
 * @author    熊谷
 * @copyright 2011-2024 Team-Grasshopper, Inc.
 * @link      https://team-grasshopper.info/
 */
import { Log } from './libs/log.ts'
import { SoundPlayer } from './libs/sound_player.ts'
import { LST_SAKANA_HEN } from './consts/sakana_data.ts'
import { Rectangle } from './types/rectangle.ts'
import { FONT_COMMON, FONT_SUSHI, LST_AUDIOS, LST_IMAGES, RESULT_INFO } from './consts/def_data.ts'
import { easeOutElastic } from './libs/easing.ts'
import { drawSushiPlate, drawVerticalText, drawWoodBoard, fitFontSize, roundRectPath, WOOD_DARK, WOOD_HOVER, WOOD_LIGHT, WOOD_SELECTED } from './libs/draw.ts'

/**
 * 難易度情報
 * grade: タイトル画面の木札に書く寿司の格
 */
const LEVEL_INFO = [
  { name: '初級', grade: '並', sushiMoveTime: 5000, maxQuizNo: 10, maxAnswerNo: 2 },
  { name: '中級', grade: '上', sushiMoveTime: 4000, maxQuizNo: 10, maxAnswerNo: 3 },
  { name: '上級', grade: '特上', sushiMoveTime: 3000, maxQuizNo: 20, maxAnswerNo: 4 },
]

/**
 * 壁に掛ける品書き (飾り)
 * 答えのヒントにならないよう魚偏以外の品にする
 */
const WALL_MENU = ['玉子', 'いなり', 'お茶']

/** 色 */
const COLOR = {
  /** 壁 (漆喰) */
  wallTop: '#f7f0e1',
  wallBottom: '#ecdfc4',
  /** 梁 */
  beam: '#5a3a1e',
  /** のれん (藍) */
  noren: '#22386b',
  norenDark: '#182a52',
  /** 朱色 */
  vermilion: '#c8381e',
  /** 墨 */
  ink: '#2a1a0c',
}

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
  /** 解答結果 (true:正解, false:不正解/時間切れ, undefined:未解答) */
  result?: boolean
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
  /**
   * キャンバス高さ
   * 変更する場合は index.html の --canvas-aspect (幅/高さ) も合わせること
   */
  CANVAS_HEIGHT = 500

  //----------
  // ゲーム画面レイアウト (論理座標)
  //----------
  /** くーまん表示位置(上端) */
  KUMAN_Y = 88
  /** テーブル(table.svg)表示位置(上端) */
  TABLE_Y = 220
  /** table.svg 内の寿司レーン(ベルト)の上端と高さ */
  LANE_OFFSET = 68
  LANE_HEIGHT = 30
  /** table.svg 内のヒノキのカウンター上端 */
  COUNTER_OFFSET = 114
  /** ベルトの継ぎ目の間隔 */
  BELT_SEGMENT = 26

  /** 回答ボタン(品書き板)の高さ */
  ANSWER_HEIGHT = 58
  /** 回答ボタンの間隔 (縦横) */
  ANSWER_GAP = 12
  /** 回答ボタン領域の左右余白 */
  ANSWER_SIDE_PADDING = 14

  /** 当たりはずれウェイト(mS) */
  HIT_WAIT_TIME = 1000
  /**
   * 1フレームで進める最大時間(mS)
   * タブ非表示等でフレームが止まった場合に、復帰時に時間が一気に進まないようにする
   */
  MAX_FRAME_DELTA = 100
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
  /** ゲーム画面でマウスが乗っている回答 (-1:なし) */
  hoverAnswer: number = -1

  //----------
  // 結果画面
  //----------
  /** 皿を1枚積む間隔(mS) */
  PLATE_INTERVAL = 110
  /** 皿を積み終わってから判子を押すまでの時間(mS) */
  STAMP_DELAY = 250
  /** 判子を押す演出時間(mS) */
  STAMP_DURATION = 350
  /** 結果画面の表示開始時刻 (performance.now()) */
  resultStartTime: number = 0
  /** 結果画面のサウンドを鳴らしたか (判子を押すタイミングで鳴らす) */
  resultSoundPlayed = false
  /** 結果画面のボタン領域 (0:おかわり, 1:ごちそうさま) */
  rectResultButtons: Rectangle[] = []
  /** 結果画面でマウスが乗っているボタン (-1:なし) */
  hoverResultButton: number = -1

  /** 画像リスト */
  image: {
    [key: string]: HTMLImageElement
  } = {}
  /** 読み込み中数 */
  loadCount: number = 0
  /** 読み込み最大数 */
  loadMaxCount: number = 0

  /** サウンド */
  soundPlayer = new SoundPlayer()

  /** 論理座標 1 あたりの内部解像度のピクセル数 (表示倍率 × devicePixelRatio。resize() で設定) */
  pixelScale = 1
  /**
   * 描画済みレイヤーのキャッシュ (種類ごとに 1 枚)
   * ゲーム画面で毎フレーム図形を描くと古いスマホでは間に合わずガタつくため、
   * 動かない部分や形の変わらない部分は事前に画像にしておき drawImage で貼るだけにする
   */
  layerCache = new Map<string, { key: string; canvas: HTMLCanvasElement }>()
  /** ゲーム番号 (おかわりで問題が変わったときに背景を描き直すため) */
  gameId = 0

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
    // (レイヤーのキャッシュは pixelScale をキーに含めているので、次の描画で作り直される)
    this.pixelScale = scale
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
   * キャンバスの表示幅が CSS で決まっているか判定する
   * 内部解像度(width属性)を変えて表示幅が変わらなければ CSS で指定されているとみなす
   * (CSS で高さを指定しない場合、高さは width/height 属性の比率に従って決まる)
   */
  isWidthSizedByCss() {
    this.canvas.width = this.CANVAS_WIDTH
    this.canvas.height = this.CANVAS_HEIGHT
    const before = this.canvas.getBoundingClientRect().width
    this.canvas.width = this.CANVAS_WIDTH + 1
    const after = this.canvas.getBoundingClientRect().width
    this.canvas.width = this.CANVAS_WIDTH
    return before === after
  }

  /**
   * クイズ初期化
   */
  async init() {
    Log.info('初期化処理')

    //----------
    // キャンバスサイズ設定
    //----------
    // CSS で表示幅が指定されていなければ論理サイズで表示する
    // (内部解像度を上げるため、CSS サイズを固定しないと devicePixelRatio 倍で表示されてしまう)
    if (!this.isWidthSizedByCss()) {
      this.canvas.style.width = `${this.CANVAS_WIDTH}px`
      this.canvas.style.height = `${this.CANVAS_HEIGHT}px`
    }
    this.resize()
    // 表示サイズ変更 (画面回転・ウィンドウサイズ変更等) に追従する
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
    // OGG 優先、非対応なら MP3。読み込めなかった音声は無音扱いで進行する
    const audio = new Audio()
    const exts = audio.canPlayType('audio/ogg') ? ['.ogg', '.mp3'] : ['.mp3']
    await Promise.all(
      LST_AUDIOS.map((item) =>
        this.soundPlayer.load(
          item[0],
          exts.map((ext) => new URL(`../assets/sounds/${item[1]}${ext}`, import.meta.url).href),
        ),
      ),
    )

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
    // ユーザー操作中に音声を再生可能にする (操作外の時間切れ・結果画面の音を鳴らすため)
    this.soundPlayer.unlock()
    const { x, y } = this.getCanvasPos(event)

    switch (this.state) {
      case 'title': {
        const level = this.hitNo(this.rectLevels, x, y)
        if (0 <= level) {
          this.requestStart(level)
        }
        break
      }
      case 'playing':
        this.checkAnswer(x, y)
        break
      case 'result': {
        const button = this.hitNo(this.rectResultButtons, x, y)
        if (button === 0) {
          // おかわり: 同じ難易度でもう一度
          this.requestStart(this.level)
        } else if (button === 1) {
          // ごちそうさま: タイトルへ
          this.title()
        } else {
          // ボタン以外: 皿積み・判子の演出を飛ばす
          this.resultStartTime = Math.min(this.resultStartTime, performance.now() - this.getResultAnimationTime())
        }
        break
      }
    }
  }

  /**
   * 開始サウンドを鳴らしてからゲームを開始する
   *
   * @param level レベル
   */
  requestStart(level: number) {
    Log.info('開始 level:' + level)
    this.stopAnimation()
    // 開始サウンド再生中の多重クリックを防ぐ
    this.state = 'starting'
    this.canvas.style.cursor = 'default'
    this.playSound('start', () => this.startGame(level))
  }

  /**
   * 実行中のアニメーション(フレームループ)を停止する
   */
  stopAnimation() {
    if (this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId)
      this.animationId = undefined
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
        // 描画は毎フレーム行われるので状態の更新のみ
        this.hoverAnswer = this.hitNo(rects, x, y)
        break
      case 'result': {
        rects = this.rectResultButtons
        const button = this.hitNo(rects, x, y)
        if (button !== this.hoverResultButton) {
          this.hoverResultButton = button
          // 演出中はフレームループで描画されるので、演出後のみ再描画
          if (this.animationId === undefined) {
            this.drawResult()
          }
        }
        break
      }
    }
    this.canvas.style.cursor = this.hitNo(rects, x, y) < 0 ? 'default' : 'pointer'
  }

  /**
   * タイトル処理
   */
  title() {
    this.stopAnimation()
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
    const ctx = this.ctx
    const W = this.CANVAS_WIDTH

    // 壁
    this.drawWall()

    //----------
    // のれん
    //----------
    const norenTop = 10
    const norenBottom = 172
    const norenGrad = ctx.createLinearGradient(0, norenTop, 0, norenBottom)
    norenGrad.addColorStop(0, COLOR.norenDark)
    norenGrad.addColorStop(0.15, COLOR.noren)
    norenGrad.addColorStop(1, COLOR.noren)
    ctx.fillStyle = norenGrad
    ctx.fillRect(12, norenTop, W - 24, norenBottom - norenTop)
    // 布の切れ目 (3枚のれん)
    ctx.fillStyle = COLOR.wallTop
    for (const sx of [W / 3, (W * 2) / 3]) {
      ctx.fillRect(sx - 1.5, 64, 3, norenBottom - 64)
    }
    // 竿
    ctx.fillStyle = COLOR.beam
    ctx.fillRect(0, 0, W, norenTop + 2)

    // 紋 (丸に魚)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(W / 2, 42, 17, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 20px ' + FONT_SUSHI
    ctx.fillText('魚', W / 2, 43)

    // 屋号
    ctx.font = 'bold 56px ' + FONT_SUSHI
    ctx.fillText('さかなへん', W / 2, 106)
    ctx.font = '22px ' + FONT_SUSHI
    ctx.fillText('ク　イ　ズ', W / 2, 150)

    //----------
    // 品書き (難易度の木札)
    //----------
    // 木札を吊るす桟
    const beamY = 204
    drawWoodBoard(ctx, 30, beamY, W - 60, 9, WOOD_DARK, { radius: 3, shadow: 3, borderWidth: 1 })

    const tagWidth = 84
    const tagHeight = 188
    const tagGap = 24
    const tagTop = beamY + 26
    const tagsLeft = (W - (tagWidth * LEVEL_INFO.length + tagGap * (LEVEL_INFO.length - 1))) / 2
    this.rectLevels = LEVEL_INFO.map((item, idx) => {
      const x = tagsLeft + (tagWidth + tagGap) * idx
      const cx = x + tagWidth / 2
      const active = this.hoverLevel === idx

      // 吊り紐
      ctx.strokeStyle = '#7a5a3a'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(cx - 14, beamY + 8)
      ctx.lineTo(cx, tagTop + 12)
      ctx.lineTo(cx + 14, beamY + 8)
      ctx.stroke()

      // 木札
      drawWoodBoard(ctx, x, tagTop, tagWidth, tagHeight, active ? WOOD_SELECTED : WOOD_LIGHT, {
        radius: 4,
        shadow: active ? 6 : 4,
        borderWidth: active ? 3 : 2,
        vertical: true,
      })
      // 紐を通す穴
      ctx.fillStyle = '#5a3a1e'
      ctx.beginPath()
      ctx.arc(cx, tagTop + 12, 3, 0, Math.PI * 2)
      ctx.fill()

      // 格 (並・上・特上)
      ctx.fillStyle = active ? COLOR.vermilion : COLOR.ink
      ctx.font = 'bold 46px ' + FONT_SUSHI
      drawVerticalText(ctx, item.grade, cx, tagTop + 28, 46)

      // 難易度名 (朱色の札)
      const labelW = 62
      const labelH = 24
      const labelY = tagTop + tagHeight - labelH - 14
      ctx.fillStyle = COLOR.vermilion
      ctx.fillRect(cx - labelW / 2, labelY, labelW, labelH)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 15px ' + FONT_COMMON
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(item.name, cx, labelY + labelH / 2 + 1)

      return { x, y: tagTop, width: tagWidth, height: tagHeight }
    })

    // 案内
    ctx.fillStyle = COLOR.ink
    ctx.globalAlpha = 0.75
    ctx.font = '17px ' + FONT_SUSHI
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('お好みの品をお選びください', W / 2, tagTop + tagHeight + 34)
    ctx.globalAlpha = 1

    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
  }

  /**
   * 壁 (背景) 描画
   */
  drawWall(ctx = this.ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.CANVAS_HEIGHT)
    grad.addColorStop(0, COLOR.wallTop)
    grad.addColorStop(1, COLOR.wallBottom)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT)
  }

  /**
   * ゲーム開始処理
   */
  startGame(level = 1) {
    //==============
    // 初期化処理
    //==============
    // レベル設定
    this.level = level
    const levelInfo = LEVEL_INFO[level]
    this.sushiMoveTime = levelInfo.sushiMoveTime
    this.maxQuizNo = levelInfo.maxQuizNo
    this.maxAnswerNo = levelInfo.maxAnswerNo

    this.quizNo = 0
    this.hitCount = 0
    this.gameId++

    //----------
    // 解答選択位置確定
    //----------
    // 回答ボタン(品書き板)は2列で、ヒノキのカウンター上の上下中央に配置する
    // 端数(3択の2行目など)は中央寄せ
    this.rectAnswers = []
    const maxCol = 2
    const maxRow = Math.ceil(this.maxAnswerNo / maxCol)
    const btnWidth = (this.CANVAS_WIDTH - this.ANSWER_SIDE_PADDING * 2 - this.ANSWER_GAP * (maxCol - 1)) / maxCol
    const btnHeight = this.ANSWER_HEIGHT
    const counterTop = this.TABLE_Y + this.COUNTER_OFFSET
    const blockHeight = maxRow * btnHeight + (maxRow - 1) * this.ANSWER_GAP
    const startY = counterTop + (this.CANVAS_HEIGHT - counterTop - blockHeight) / 2
    for (let answerNo = 0; answerNo < this.maxAnswerNo; answerNo++) {
      const row = Math.floor(answerNo / maxCol)
      const col = answerNo % maxCol
      const colsInRow = Math.min(maxCol, this.maxAnswerNo - row * maxCol)
      const rowWidth = colsInRow * btnWidth + (colsInRow - 1) * this.ANSWER_GAP
      const rowLeft = (this.CANVAS_WIDTH - rowWidth) / 2
      this.rectAnswers.push({
        x: rowLeft + col * (btnWidth + this.ANSWER_GAP),
        y: startY + row * (btnHeight + this.ANSWER_GAP),
        width: btnWidth,
        height: btnHeight,
      })
    }
    this.hoverAnswer = -1
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
    // 結果画面の伝票用に記録
    this.listQuiz[this.quizNo].result = bHit
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
    // (endGame() が結果画面の演出用に animationId を設定し直すため、animationId ではなく state で判定する)
    if (this.state !== 'playing') {
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
   * 描画処理 (毎フレーム)
   *
   * 古いスマホでも間に合うよう、毎フレームの処理は事前に描いたレイヤーを drawImage で貼るだけにする
   * (影・切り抜き・曲線などの図形を毎フレーム描くとガタつく)
   *   背景 (壁・くーまん・テーブル・回答の板・黒板) → ベルトの継ぎ目 → 皿と木札 → 当たり/はずれ
   * 皿と木札は回答の板・黒板と重ならないので、それらを背景に含めても重なり順は変わらない
   */
  draw() {
    const ctx = this.ctx

    //----------
    // 背景 (状態が変わったときだけ描き直す)
    //----------
    const background = this.getGameBackground()
    ctx.save()
    // 内部解像度と同じ大きさなので、拡大縮小せず等倍で貼る
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(background, 0, 0)
    ctx.restore()

    //----------
    // 寿司＋さかなへん
    //----------
    const marginX = 84
    // 残り時間の割合 (1:右端 → 0:左端)
    const remainRate = Math.max(0, 1 - this.sushiElapsed / this.sushiMoveTime)
    const posX = (this.CANVAS_WIDTH + marginX * 2) * remainRate - marginX

    // ベルトの継ぎ目 (皿と一緒に流れて見えるよう、皿の位置に合わせて継ぎ目 1 つ分の範囲でずらす)
    const seg = this.BELT_SEGMENT
    const offset = ((posX % seg) + seg) % seg
    this.drawLayer(this.getBeltLayer(), offset - seg - this.BELT_LAYER_PAD, this.TABLE_Y + this.LANE_OFFSET)

    // 皿 (皿の底がレーンに乗る位置) と、その上に立てた漢字の木札
    const plate = this.getQuizPlateLayer()
    this.drawLayer(plate, posX + 30 - this.PLATE_LAYER_CX, this.TABLE_Y + this.LANE_OFFSET + 22 - this.PLATE_LAYER_BOTTOM)

    //----------
    // 当たり/はずれ
    //----------
    if (this.isHitEffect) {
      const imgAnswer = this.bHit ? this.image.ans_ok : this.image.ans_ng
      const easing = easeOutElastic(Math.min(this.hitElapsed, this.HIT_WAIT_TIME), 0, 100, this.HIT_WAIT_TIME)
      const posY = this.TABLE_Y - 10 - (40 * easing) / 100
      ctx.globalAlpha = easing / 100
      this.drawLayer(this.getImageLayer(imgAnswer), (this.CANVAS_WIDTH - imgAnswer.width) / 2, posY)
      ctx.globalAlpha = 1
    }
  }

  //----------
  // 描画済みレイヤー
  //----------
  /** 皿と木札のレイヤーの大きさ */
  PLATE_LAYER_WIDTH = 124
  PLATE_LAYER_HEIGHT = 120
  /** 皿と木札のレイヤー内の、皿の中心X・皿の底Y */
  PLATE_LAYER_CX = 62
  PLATE_LAYER_BOTTOM = 112
  /** ベルトのレイヤーの左余白 (左端の継ぎ目の線が切れないように) */
  BELT_LAYER_PAD = 2

  /**
   * 現在の内部解像度でレイヤー(オフスクリーンキャンバス)を作り、論理座標で描画する
   *
   * @param width 幅 (論理座標)
   * @param height 高さ (論理座標)
   * @param drawFunc 描画処理
   */
  createLayer(width: number, height: number, drawFunc: (ctx: CanvasRenderingContext2D) => void) {
    const scale = this.pixelScale
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(width * scale))
    canvas.height = Math.max(1, Math.ceil(height * scale))
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      drawFunc(ctx)
    }
    return canvas
  }

  /**
   * キャッシュしたレイヤーを返す (キーが変わったときだけ作り直す)
   *
   * @param slot レイヤーの種類
   * @param key 内容を表すキー
   * @param create 作成処理
   */
  getLayer(slot: string, key: string, create: () => HTMLCanvasElement) {
    const fullKey = `${key}|${this.pixelScale}`
    const cached = this.layerCache.get(slot)
    if (cached && cached.key === fullKey) {
      return cached.canvas
    }
    const canvas = create()
    this.layerCache.set(slot, { key: fullKey, canvas })
    return canvas
  }

  /**
   * レイヤーを論理座標に等倍で貼る
   *
   * @param layer レイヤー
   * @param x X座標
   * @param y Y座標
   */
  drawLayer(layer: HTMLCanvasElement, x: number, y: number) {
    this.ctx.drawImage(layer, x, y, layer.width / this.pixelScale, layer.height / this.pixelScale)
  }

  /**
   * ゲーム画面の背景 (動かない部分) のレイヤー
   * くーまんの表情・問題番号・正解数・回答の板の状態が変わったときだけ描き直す
   */
  getGameBackground() {
    const imgKuman = this.isHitEffect ? (this.bHit ? this.image.kuman_ok : this.image.kuman_ng) : this.image.kuman
    const hover = this.isHitEffect ? -1 : this.hoverAnswer
    const key = [this.gameId, this.quizNo, this.hitCount, imgKuman.src, this.clickSelectionNo ?? -1, hover].join('|')
    return this.getLayer('background', key, () =>
      this.createLayer(this.CANVAS_WIDTH, this.CANVAS_HEIGHT, (ctx) => {
        // 壁と品書き
        this.drawWall(ctx)
        this.drawWallMenu(ctx)

        // くーまん
        ctx.drawImage(imgKuman, (this.CANVAS_WIDTH - imgKuman.width) / 2, this.KUMAN_Y)
        // 帽子
        // boushi.svg は枠線が切れないよう上下左右に 1px の余白があるため、その分上にずらす
        ctx.drawImage(this.image.boushi, (this.CANVAS_WIDTH - this.image.boushi.width) / 2, this.KUMAN_Y - 14)

        // テーブル (ネタケース・レーン・カウンター)
        ctx.drawImage(this.image.table, 0, this.TABLE_Y)

        // 回答 (品書き板)
        this.drawAnswers(ctx, hover)

        // ステータス (壁に掛けた黒板)
        this.drawStatusBoard(ctx)
      }),
    )
  }

  /**
   * ベルトの継ぎ目のレイヤー (画面幅 + 継ぎ目 1 つ分)
   * 継ぎ目 1 つ分の範囲でずらして貼ることで、流れているように見せる
   */
  getBeltLayer() {
    const seg = this.BELT_SEGMENT
    const pad = this.BELT_LAYER_PAD
    const width = this.CANVAS_WIDTH + seg * 2 + pad
    const h = this.LANE_HEIGHT
    return this.getLayer('belt', '', () =>
      this.createLayer(width, h, (ctx) => {
        for (let x = pad; x < width; x += seg) {
          // 三日月形のプレートの継ぎ目
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.quadraticCurveTo(x + 9, h / 2, x, h)
          ctx.strokeStyle = 'rgba(105, 55, 15, 0.55)'
          ctx.lineWidth = 2
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(x + 2.5, 0)
          ctx.quadraticCurveTo(x + 11.5, h / 2, x + 2.5, h)
          ctx.strokeStyle = 'rgba(255, 235, 200, 0.45)'
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
      }),
    )
  }

  /**
   * 問題の皿 (皿＋漢字の木札) のレイヤー
   * 左右に動くだけで形は変わらないので、問題が変わったときだけ描き直す
   */
  getQuizPlateLayer() {
    const quiz = this.listQuiz[this.quizNo].quiz
    return this.getLayer('plate', quiz, () =>
      this.createLayer(this.PLATE_LAYER_WIDTH, this.PLATE_LAYER_HEIGHT, (ctx) => {
        this.drawQuizPlate(this.PLATE_LAYER_CX, this.PLATE_LAYER_BOTTOM, quiz, ctx)
      }),
    )
  }

  /**
   * 画像 (SVG) を現在の内部解像度で画像にしたレイヤー
   * SVG を毎フレーム拡大して描くと、ブラウザによってはその都度ベクターから描き直されて重いため
   *
   * @param img 画像
   */
  getImageLayer(img: HTMLImageElement) {
    return this.getLayer(`image:${img.src}`, '', () => this.createLayer(img.width, img.height, (ctx) => ctx.drawImage(img, 0, 0)))
  }

  /**
   * 回答 (品書き板) 描画
   *
   * @param ctx コンテキスト
   * @param hoverAnswer マウスが乗っている回答 (-1:なし)
   */
  drawAnswers(ctx: CanvasRenderingContext2D, hoverAnswer: number) {
    const itemQuiz = this.listQuiz[this.quizNo]
    for (let answerNo = 0; answerNo < this.maxAnswerNo; answerNo++) {
      const rect = this.rectAnswers[answerNo]
      const selected = this.clickSelectionNo === answerNo
      const hover = !selected && hoverAnswer === answerNo
      // 選択中は押し込まれたように少し下げて影を小さくする
      const offsetY = selected ? 2 : 0
      drawWoodBoard(ctx, rect.x, rect.y + offsetY, rect.width, rect.height, selected ? WOOD_SELECTED : hover ? WOOD_HOVER : WOOD_LIGHT, {
        radius: 6,
        shadow: selected ? 1 : 4,
        borderWidth: selected ? 3 : 2.5,
      })

      // 回答文字列 (板の中央に。長い場合は縮小)
      const text = itemQuiz.selection[answerNo]
      const size = fitFontSize(ctx, text, rect.width - 24, 34, FONT_SUSHI, 'bold')
      ctx.font = `bold ${size}px ${FONT_SUSHI}`
      ctx.fillStyle = selected ? COLOR.vermilion : COLOR.ink
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, rect.x + rect.width / 2, rect.y + offsetY + rect.height / 2 + 2)
      ctx.textAlign = 'start'
      ctx.textBaseline = 'alphabetic'
    }
  }

  /**
   * 壁の品書き (飾り) 描画
   */
  drawWallMenu(ctx = this.ctx) {
    // 梁
    ctx.fillStyle = COLOR.beam
    ctx.fillRect(0, 0, this.CANVAS_WIDTH, 8)

    // 木札
    const tagWidth = 30
    const tagHeight = 76
    WALL_MENU.forEach((name, idx) => {
      const x = 14 + idx * (tagWidth + 8)
      const y = 16
      ctx.strokeStyle = '#8a6a4a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + tagWidth / 2, 8)
      ctx.lineTo(x + tagWidth / 2, y + 4)
      ctx.stroke()
      drawWoodBoard(ctx, x, y, tagWidth, tagHeight, WOOD_LIGHT, { radius: 2, shadow: 2, borderWidth: 1.5, vertical: true })
      ctx.fillStyle = COLOR.ink
      ctx.font = 'bold 15px ' + FONT_SUSHI
      drawVerticalText(ctx, name, x + tagWidth / 2, y + 8, 15)
    })
  }

  /**
   * ステータス (問題数・正解数) 描画
   */
  drawStatusBoard(ctx = this.ctx) {
    const w = 102
    const h = 60
    const x = this.CANVAS_WIDTH - w - 12
    const y = 16
    ctx.strokeStyle = '#8a6a4a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 18, 8)
    ctx.lineTo(x + 18, y + 2)
    ctx.moveTo(x + w - 18, 8)
    ctx.lineTo(x + w - 18, y + 2)
    ctx.stroke()
    drawWoodBoard(ctx, x, y, w, h, WOOD_DARK, { radius: 4, shadow: 3, borderWidth: 2 })

    ctx.fillStyle = '#f7eedb'
    ctx.textBaseline = 'middle'
    ctx.font = '15px ' + FONT_COMMON
    ctx.textAlign = 'left'
    ctx.fillText('問題', x + 10, y + 19)
    ctx.fillText('正解', x + 10, y + 42)
    ctx.font = 'bold 18px ' + FONT_COMMON
    ctx.textAlign = 'right'
    ctx.fillText(`${this.quizNo + 1}/${this.listQuiz.length}`, x + w - 10, y + 19)
    ctx.fillStyle = '#ffd36b'
    ctx.fillText(`${this.hitCount}`, x + w - 10, y + 42)
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
  }

  /**
   * ゲーム終了処理
   */
  endGame() {
    // フレームループ停止
    this.stopAnimation()
    this.isHitEffect = false

    // 結果画面へ (ボタンのクリック処理は onClick で行う)
    this.state = 'result'
    this.hoverResultButton = -1
    // マウスカーソルリセット
    this.canvas.style.cursor = 'default'

    // 皿積み・判子の演出開始 (サウンドは判子を押すときに resultFrame() で鳴らす)
    this.resultStartTime = performance.now()
    this.resultSoundPlayed = false
    this.resultFrame()
  }

  /**
   * 結果画面のフレーム処理 (演出が終わるまで描画を繰り返す)
   */
  resultFrame = () => {
    this.animationId = undefined
    if (this.state !== 'result') {
      return
    }
    this.drawResult()
    const elapsed = performance.now() - this.resultStartTime
    if (!this.resultSoundPlayed && this.getStampTime() <= elapsed) {
      this.resultSoundPlayed = true
      this.playSound(this.getResultInfo().sound)
    }
    if (elapsed < this.getResultAnimationTime()) {
      this.animationId = requestAnimationFrame(this.resultFrame)
    }
  }

  /**
   * 結果画面の演出全体の時間(mS)
   */
  getResultAnimationTime() {
    return this.getStampTime() + this.STAMP_DURATION
  }

  /**
   * 結果画面で判子を押し始める時間(mS)
   */
  getStampTime() {
    return this.hitCount * this.PLATE_INTERVAL + this.STAMP_DELAY
  }

  /**
   * 結果情報取得
   */
  getResultInfo() {
    const score = Math.round((this.hitCount / this.listQuiz.length) * 100)
    // RESULT_INFO は正解率の降順。末尾(0%)は必ず一致するが、念のため末尾をフォールバックにする
    const [, stamp, message, sound] = RESULT_INFO.find(([percent]) => percent <= score) ?? RESULT_INFO[RESULT_INFO.length - 1]
    return { score, stamp, message, sound }
  }

  /**
   * 結果画面描画 (お会計)
   * 左: 伝票 (間違えた品・皿の枚数・判子)、右: くーまん・積み上がる皿、下: ボタン
   */
  drawResult() {
    const ctx = this.ctx
    const W = this.CANVAS_WIDTH
    const info = this.getResultInfo()
    const elapsed = performance.now() - this.resultStartTime

    // 壁と梁
    this.drawWall()
    ctx.fillStyle = COLOR.beam
    ctx.fillRect(0, 0, W, 8)

    // カウンター (table.svg のカウンター部分だけを使う)
    const counterY = 400
    const srcY = this.COUNTER_OFFSET - 8
    ctx.drawImage(this.image.table, 0, srcY, W, this.CANVAS_HEIGHT - counterY, 0, counterY, W, this.CANVAS_HEIGHT - counterY)

    //----------
    // くーまん (成績で表情を変える)
    //----------
    const kumanImage = 70 <= info.score ? this.image.kuman_ok : info.score < 40 ? this.image.kuman_ng : this.image.kuman
    // ゲーム画面と同じく胸から上だけを見せ、小さな付け台越しに顔を出しているように描く
    const scale = 0.6
    const colCenter = 324
    const kumanY = 30
    const visibleHeight = this.TABLE_Y - this.KUMAN_Y
    ctx.drawImage(kumanImage, 0, 0, kumanImage.width, visibleHeight, colCenter - (kumanImage.width * scale) / 2, kumanY, kumanImage.width * scale, visibleHeight * scale)
    const hat = this.image.boushi
    ctx.drawImage(hat, colCenter - (hat.width * scale) / 2, kumanY - 14 * scale, hat.width * scale, hat.height * scale)
    const standY = kumanY + visibleHeight * scale - 4
    drawWoodBoard(ctx, colCenter - 70, standY, 140, 12, WOOD_LIGHT, { radius: 2, shadow: 3, borderWidth: 1.5 })
    this.drawSpeechBubble(info.message, colCenter, standY + 26)

    //----------
    // 積み上がる皿
    //----------
    const plateStep = 9
    const progress = elapsed / this.PLATE_INTERVAL
    const stacked = Math.min(this.hitCount, Math.floor(progress))
    for (let i = 0; i < stacked; i++) {
      this.drawPlate(colCenter, counterY + 4 - i * plateStep, i === 0)
    }
    // 落ちてくる途中の皿
    if (stacked < this.hitCount) {
      const t = progress - Math.floor(progress)
      ctx.globalAlpha = t
      this.drawPlate(colCenter, counterY + 4 - stacked * plateStep - (1 - t) * 26, stacked === 0)
      ctx.globalAlpha = 1
    }

    //----------
    // 伝票
    //----------
    this.drawReceipt(info, elapsed)

    //----------
    // ボタン (おかわり / ごちそうさま)
    //----------
    const labels = ['おかわり', 'ごちそうさま']
    const btnWidth = (W - this.ANSWER_SIDE_PADDING * 2 - this.ANSWER_GAP) / 2
    const btnHeight = 54
    const btnY = counterY + 8 + (this.CANVAS_HEIGHT - counterY - 8 - btnHeight) / 2
    this.rectResultButtons = labels.map((label, idx) => {
      const rect = { x: this.ANSWER_SIDE_PADDING + idx * (btnWidth + this.ANSWER_GAP), y: btnY, width: btnWidth, height: btnHeight }
      const hover = this.hoverResultButton === idx
      drawWoodBoard(ctx, rect.x, rect.y, rect.width, rect.height, hover ? WOOD_HOVER : WOOD_LIGHT, { radius: 6 })
      const size = fitFontSize(ctx, label, rect.width - 24, 28, FONT_SUSHI, 'bold')
      ctx.font = `bold ${size}px ${FONT_SUSHI}`
      ctx.fillStyle = COLOR.ink
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 2)
      return rect
    })
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
  }

  /**
   * 伝票 (お会計) 描画
   *
   * @param info 結果情報
   * @param elapsed 結果画面表示からの経過時間(mS)
   */
  drawReceipt(info: { score: number; stamp: string }, elapsed: number) {
    const ctx = this.ctx
    const x = 14
    const y = 18
    const w = 232
    const h = 368
    const left = x + 16
    const right = x + w - 16
    const center = x + w / 2

    // 紙
    ctx.save()
    ctx.shadowColor = 'rgba(70, 35, 5, 0.3)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 3
    ctx.fillStyle = '#fffdf6'
    ctx.fillRect(x, y, w, h)
    ctx.restore()

    ctx.textBaseline = 'middle'

    // 見出し
    ctx.fillStyle = COLOR.ink
    ctx.textAlign = 'center'
    ctx.font = 'bold 26px ' + FONT_SUSHI
    ctx.fillText('御 会 計', center, y + 32)
    ctx.fillStyle = COLOR.vermilion
    ctx.fillRect(left, y + 52, right - left, 2)
    ctx.fillRect(left, y + 57, right - left, 1)

    // コース (難易度)
    const level = LEVEL_INFO[this.level]
    ctx.fillStyle = COLOR.ink
    ctx.font = '15px ' + FONT_SUSHI
    ctx.fillText(`${level.grade}（${level.name}）　${this.listQuiz.length}品`, center, y + 76)

    //----------
    // 明細 (間違えた品だけ)
    //----------
    const misses = this.listQuiz.filter((item) => item.result !== true)
    const bodyTop = y + 98
    if (misses.length === 0) {
      ctx.fillStyle = COLOR.vermilion
      ctx.font = 'bold 34px ' + FONT_SUSHI
      ctx.fillText('全問正解', center, bodyTop + 72)
      ctx.fillStyle = COLOR.ink
      ctx.font = '16px ' + FONT_SUSHI
      ctx.fillText('おみごと！', center, bodyTop + 112)
    } else {
      // 何度も挑戦してもらうため、読み(正解)は出さずに漢字だけを並べる
      ctx.textAlign = 'left'
      ctx.fillStyle = COLOR.vermilion
      ctx.font = 'bold 13px ' + FONT_COMMON
      ctx.fillText('まちがえた品', left, bodyTop)

      // 6列 × 4行 (上級の最大20問が収まる)。入りきらない場合は最後のマスを「他n」にする
      const cols = 6
      const rows = 4
      const cell = (right - left) / cols
      const rowHeight = 32
      const maxItems = cols * rows
      const shown = misses.length <= maxItems ? misses : misses.slice(0, maxItems - 1)
      ctx.textAlign = 'center'
      shown.forEach((item, idx) => {
        const cx = left + (idx % cols) * cell + cell / 2
        const cy = bodyTop + 30 + Math.floor(idx / cols) * rowHeight
        ctx.fillStyle = COLOR.ink
        ctx.font = 'bold 24px ' + FONT_SUSHI
        ctx.fillText(item.quiz, cx, cy)
      })
      if (shown.length < misses.length) {
        const idx = maxItems - 1
        ctx.font = '13px ' + FONT_SUSHI
        ctx.fillText(`他${misses.length - shown.length}`, left + (idx % cols) * cell + cell / 2, bodyTop + 30 + Math.floor(idx / cols) * rowHeight)
      }

      // 再挑戦の案内 (並べた品のすぐ下)
      const usedRows = Math.ceil(Math.min(misses.length, maxItems) / cols)
      ctx.fillStyle = COLOR.ink
      ctx.globalAlpha = 0.7
      ctx.font = '13px ' + FONT_SUSHI
      ctx.fillText('読みは「おかわり」で確かめよう', center, bodyTop + 30 + usedRows * rowHeight + 4)
      ctx.globalAlpha = 1
    }

    //----------
    // 合計
    //----------
    const footerTop = y + h - 78
    ctx.strokeStyle = '#b9a88a'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(left, footerTop)
    ctx.lineTo(right, footerTop)
    ctx.stroke()
    ctx.setLineDash([])

    const valueLeft = left + 56
    ctx.fillStyle = COLOR.ink
    ctx.textAlign = 'left'
    ctx.font = '15px ' + FONT_SUSHI
    ctx.fillText('お皿', left, footerTop + 24)
    ctx.fillText('正解率', left, footerTop + 54)
    // 「6 / 10皿」: 枚数を大きく、分母と単位を小さく続けて書く
    ctx.font = 'bold 22px ' + FONT_COMMON
    const countText = `${this.hitCount}`
    ctx.fillText(countText, valueLeft, footerTop + 24)
    const countWidth = ctx.measureText(countText).width
    ctx.font = '14px ' + FONT_COMMON
    ctx.fillText(` / ${this.listQuiz.length}皿`, valueLeft + countWidth + 2, footerTop + 26)
    ctx.font = 'bold 18px ' + FONT_COMMON
    ctx.fillText(`${info.score}%`, valueLeft, footerTop + 54)

    //----------
    // 判子 (皿を積み終わったら押す)
    //----------
    const stampElapsed = elapsed - this.getStampTime()
    if (0 <= stampElapsed) {
      const p = Math.min(1, stampElapsed / this.STAMP_DURATION)
      // 大きく薄い状態から、押し付けたように縮んで濃くなる
      const scale = 1 + (1 - p) * (1 - p) * 1.5
      this.drawStamp(info.stamp, right - 30, footerTop + 40, 32 * scale, 0.9 * p)
    }

    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
  }

  /**
   * 判子 (朱色の丸印) 描画
   *
   * @param text 文字
   * @param cx 中心X
   * @param cy 中心Y
   * @param r 半径
   * @param alpha 不透明度
   */
  drawStamp(text: string, cx: number, cy: number, r: number, alpha: number) {
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(cx, cy)
    ctx.rotate(-0.2)
    ctx.strokeStyle = COLOR.vermilion
    ctx.lineWidth = r * 0.09
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = r * 0.04
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = COLOR.vermilion
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const size = fitFontSize(ctx, text, r * 1.45, r * 0.95, FONT_SUSHI, 'bold')
    ctx.font = `bold ${size}px ${FONT_SUSHI}`
    ctx.fillText(text, 0, r * 0.04)
    ctx.restore()
  }

  /**
   * 皿 (横から見た寿司皿) 描画
   *
   * @param cx 中心X
   * @param bottom 皿の底のY座標
   * @param shadow 落ち影を描くか (積み重ねた皿の2枚目以降は不要)
   */
  drawPlate(cx: number, bottom: number, shadow = true) {
    drawSushiPlate(this.ctx, cx, bottom, 46, shadow)
  }

  /**
   * 問題の皿 (皿＋漢字の木札) 描画
   *
   * @param cx 中心X座標
   * @param bottom 皿の底のY座標
   * @param quiz 問題の漢字
   * @param ctx コンテキスト
   */
  drawQuizPlate(cx: number, bottom: number, quiz: string, ctx = this.ctx) {
    const plateTop = drawSushiPlate(ctx, cx, bottom, 50)
    // 札立て (黒塗りの台)
    drawWoodBoard(ctx, cx - 20, plateTop - 9, 40, 9, WOOD_DARK, { radius: 2, shadow: 0, borderWidth: 1 })
    // 漢字の木札
    const w = 76
    const h = 72
    const top = plateTop - 6 - h
    drawWoodBoard(ctx, cx - w / 2, top, w, h, WOOD_LIGHT, { radius: 4, shadow: 3, borderWidth: 2, vertical: true })
    ctx.font = '58px ' + FONT_SUSHI
    ctx.fillStyle = COLOR.ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(quiz, cx, top + h / 2 + 2)
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
  }

  /**
   * 吹き出し描画 (上向きのしっぽ付き)
   *
   * @param text 文字
   * @param cx 中心X
   * @param top 上端Y
   */
  drawSpeechBubble(text: string, cx: number, top: number) {
    const ctx = this.ctx
    const w = 136
    const h = 30
    const x = Math.min(cx - w / 2, this.CANVAS_WIDTH - w - 4)
    ctx.save()
    ctx.shadowColor = 'rgba(70, 35, 5, 0.25)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetY = 2
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(cx - 8, top + 1)
    ctx.lineTo(cx, top - 9)
    ctx.lineTo(cx + 8, top + 1)
    ctx.closePath()
    ctx.fill()
    // ctx.roundRect は古い Safari に無いため自前のパスを使う
    roundRectPath(ctx, x, top, w, h, 10)
    ctx.fill()
    ctx.restore()

    ctx.fillStyle = COLOR.ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const size = fitFontSize(ctx, text, w - 14, 15, FONT_SUSHI, 'bold')
    ctx.font = `bold ${size}px ${FONT_SUSHI}`
    ctx.fillText(text, x + w / 2, top + h / 2 + 1)
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
  }

  /**
   * サウンド再生
   *
   * @param id サウンドID
   * @param endFunc 再生終了時のコールバック関数 (再生できない場合も必ず1回呼ばれる)
   */
  playSound(id: string, endFunc?: () => void) {
    this.soundPlayer.play(id, endFunc)
  }
}

/**
 * コンストラクタで上書き可能な設定値
 */
export type SakanaHenOptions = Partial<Pick<SakanaHen, 'CANVAS_WIDTH' | 'CANVAS_HEIGHT' | 'HIT_WAIT_TIME' | 'MAX_FRAME_DELTA' | 'debug'>>
