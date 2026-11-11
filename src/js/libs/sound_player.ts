import { Log } from './log.ts'

/** iOS Safari 16.4+ の Audio Session API (型定義が無い環境向け) */
type NavigatorWithAudioSession = Navigator & { audioSession?: { type: string } }

/**
 * Web Audio API による効果音再生
 *
 * HTMLAudioElement は iOS (特に LINE 等のアプリ内ブラウザ) で、短い効果音の連続再生や
 * ユーザー操作外 (時間切れ・結果画面) からの再生が失敗することがあるため、
 * 音声をデコード済みのバッファとして保持し、AudioContext 経由で再生する。
 * AudioContext はユーザー操作中に一度 resume() すれば以降は操作外からも再生できる。
 */
export class SoundPlayer {
  /** 再生終了が検出できない場合のタイムアウト(mS) */
  endTimeout: number
  /** オーディオコンテキスト (Web Audio 非対応環境では undefined) */
  private context?: AudioContext
  /** デコード済みの音声 */
  private buffers: { [id: string]: AudioBuffer } = {}

  constructor(endTimeout = 3000) {
    this.endTimeout = endTimeout
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) {
      Log.warn('Web Audio API 非対応のため無音で動作します')
      return
    }
    // iOS: Web Audio は既定ではマナーモードで消音される。HTMLAudio と同様に鳴るようにする
    const nav = navigator as NavigatorWithAudioSession
    if (nav.audioSession) {
      nav.audioSession.type = 'playback'
    }
    this.context = new AudioContextClass()
  }

  /**
   * 音声ファイルを読み込んでデコードする
   * 失敗した音声は無音扱い (play() で即終了) とし、例外は投げない
   *
   * @param id サウンドID
   * @param urls 候補の URL (先頭から順に試す)
   */
  async load(id: string, urls: string[]) {
    if (!this.context) {
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
    const finish = () => {
      if (finished) {
        return
      }
      finished = true
      clearTimeout(timeoutId)
      endFunc?.()
    }

    const context = this.context
    const buffer = this.buffers[id]
    if (!context || !buffer) {
      finish()
      return
    }
    // 一時停止・中断中なら再開を試みる (一度アンロック済みなら操作外でも再開できる)
    if (context.state !== 'running') {
      context.resume().catch(() => {
        // 再開できなければ無音のまま (タイムアウトで endFunc は呼ばれる)
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
    timeoutId = window.setTimeout(finish, buffer.duration * 1000 + 500)
  }
}
