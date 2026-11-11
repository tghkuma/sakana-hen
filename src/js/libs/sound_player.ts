import { Log } from './log.ts'

/** iOS Safari 16.4+ の Audio Session API (型定義が無い環境向け) */
type NavigatorWithAudioSession = Navigator & { audioSession?: { type: string } }

/**
 * 効果音再生
 *
 * 基本は Web Audio API (デコード済みバッファを AudioContext で再生) を使う。
 * HTMLAudioElement は iOS (特に LINE 等のアプリ内ブラウザ) で、短い効果音の連続再生や
 * ユーザー操作外 (時間切れ・結果画面) からの再生が失敗することがあるため。
 *
 * ただし iOS では Web Audio は消音スイッチ(マナーモード)で消音される。
 * iOS 16.4 以降は navigator.audioSession で回避できるが、それより古い iOS には手段が無いため、
 * その場合と Web Audio 非対応環境では HTMLAudioElement で再生する (v0.3.0 と同じ方式)。
 * なお v0.4.0 で入れた「最初の操作時に全音声をミュート再生してアンロックする」処理は、
 * iPhone 6S (iOS 15) で消音スイッチ中に音が鳴らなくなったため行わない。
 */
export class SoundPlayer {
  /** HTMLAudio で再生時、長さが分からない場合の終了待ちタイムアウト(mS) */
  endTimeout: number
  /** オーディオコンテキスト (HTMLAudio で再生する場合は undefined) */
  private context?: AudioContext
  /** デコード済みの音声 (Web Audio 用) */
  private buffers: { [id: string]: AudioBuffer } = {}
  /**
   * HTMLAudio 用: 音声の URL と、次の再生用に用意した audio 要素
   * audio 要素は 1 回再生したら使い捨て、再生のたびに新しい要素を用意しておく。
   * iPhone 6S (iOS 15) では、同じ要素を頭出し (currentTime = 0) して再生し直すと
   * - 頭出しの完了待ちで再生が遅れる (約 280mS)
   * - 何回か再生すると音の頭が切れる (頭出し済みの要素を交互に使っても起きる)
   * ため。新しい要素はこれが起きず、事前に作っておけば遅れも少ない。
   */
  private audioUrls: { [id: string]: string } = {}
  private nextAudios: { [id: string]: HTMLAudioElement } = {}

  constructor(endTimeout = 3000) {
    this.endTimeout = endTimeout
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    const nav = navigator as NavigatorWithAudioSession
    if (nav.audioSession) {
      // iOS 16.4 以降: Web Audio も消音スイッチ中に鳴るようにする
      nav.audioSession.type = 'playback'
    } else if (isIOS()) {
      // iOS 16.3 以前: Web Audio だと消音スイッチ中に鳴らないため HTMLAudio を使う
      Log.info('古い iOS のため HTMLAudio で再生します')
      return
    }
    if (!AudioContextClass) {
      Log.warn('Web Audio API 非対応のため HTMLAudio で再生します')
      return
    }
    this.context = new AudioContextClass()
  }

  /**
   * 音声ファイルを読み込む
   * 失敗した音声は無音扱い (play() で即終了) とし、例外は投げない
   *
   * @param id サウンドID
   * @param urls 候補の URL (先頭から順に試す。HTMLAudio の場合は先頭のみ使う)
   */
  async load(id: string, urls: string[]) {
    if (!this.context) {
      if (urls[0]) {
        this.audioUrls[id] = urls[0]
        this.prepareAudio(id)
      }
      return
    }
    for (const url of urls) {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const data = await response.arrayBuffer()
        this.buffers[id] = await this.context.decodeAudioData(data)
        return
      } catch (error) {
        Log.warn(`サウンド読み込み失敗: ${url}`, error)
      }
    }
  }

  /**
   * 音声を再生可能にする
   * ユーザー操作 (click 等) のイベント処理中に呼ぶこと。
   * iOS では電話・他アプリ等で再生が中断 (interrupted) されることがあるため、操作のたびに呼んでよい。
   */
  unlock() {
    const context = this.context
    if (!context || context.state === 'running') {
      return
    }
    context.resume().catch((error) => Log.warn('AudioContext の再開に失敗', error))
    // 旧 iOS 向け: 操作中に無音を1つ再生するとアンロックされる
    const source = context.createBufferSource()
    source.buffer = context.createBuffer(1, 1, 22050)
    source.connect(context.destination)
    source.start(0)
  }

  /**
   * 再生
   *
   * @param id サウンドID
   * @param endFunc 「再生終了」「再生できない」「タイムアウト」のいずれかで必ず1回だけ呼ばれる
   */
  play(id: string, endFunc?: () => void) {
    let finished = false
    let timeoutId: number | undefined
    let cleanup: (() => void) | undefined
    const finish = () => {
      if (finished) {
        return
      }
      finished = true
      clearTimeout(timeoutId)
      cleanup?.()
      endFunc?.()
    }
    const startTimeout = (ms: number) => {
      timeoutId = window.setTimeout(finish, ms)
    }

    if (this.context) {
      this.playBuffer(this.context, id, finish, startTimeout)
    } else {
      cleanup = this.playAudio(id, finish, startTimeout)
    }
  }

  /**
   * Web Audio で再生
   */
  private playBuffer(context: AudioContext, id: string, finish: () => void, startTimeout: (ms: number) => void) {
    const buffer = this.buffers[id]
    if (!buffer) {
      finish()
      return
    }
    // 一時停止・中断中なら再開を試みる (一度アンロック済みなら操作外でも再開できる)
    if (context.state !== 'running') {
      context.resume().catch(() => {
        // 再開できなければ無音のまま (タイムアウトで終了扱いになる)
      })
    }
    try {
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.onended = finish
      source.start(0)
    } catch (error) {
      Log.warn(`サウンド再生失敗: ${id}`, error)
      finish()
      return
    }
    // ended が来ない場合 (コンテキストが止まったまま等) に備える
    startTimeout(buffer.duration * 1000 + 500)
  }

  /**
   * HTMLAudio で再生
   *
   * @returns 終了時に登録したイベントを外す関数
   */
  private playAudio(id: string, finish: () => void, startTimeout: (ms: number) => void) {
    const audio = this.nextAudios[id]
    if (!audio) {
      finish()
      return undefined
    }
    // 用意しておいた要素で再生し、次の再生用に新しい要素を用意する
    this.prepareAudio(id)

    audio.addEventListener('ended', finish, { once: true })
    audio.addEventListener('error', finish, { once: true })
    // 長さが分かればその少し後、分からなければ既定時間でタイムアウト
    startTimeout(Number.isFinite(audio.duration) ? audio.duration * 1000 + 500 : this.endTimeout)

    audio.play().catch((error) => {
      // 自動再生制限・読み込み失敗等
      Log.warn(`サウンド再生失敗: ${id}`, error)
      finish()
    })
    return () => {
      audio.removeEventListener('ended', finish)
      audio.removeEventListener('error', finish)
    }
  }

  /**
   * HTMLAudio 用: 次の再生用の audio 要素を作って読み込みを始めておく
   * (iOS では操作外の load() は無視されることがあるが、その場合も再生時に読み込まれる)
   *
   * @param id サウンドID
   */
  private prepareAudio(id: string) {
    const audio = new Audio(this.audioUrls[id])
    audio.preload = 'auto'
    audio.load()
    this.nextAudios[id] = audio
  }
}

/**
 * iOS (iPadOS を含む) か判定
 * iPadOS は Mac として名乗るため、タッチ対応かどうかで判別する
 */
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && 1 < navigator.maxTouchPoints)
