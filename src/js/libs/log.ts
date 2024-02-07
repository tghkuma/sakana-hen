export class Log {
  static debug = false

  /**
   * ログ出力
   *
   * @param message メッセージ
   */
  static info(message: string) {
    if (this.debug) {
      console.log(message)
    }
  }
  static warn(message: string) {
    console.warn(message)
  }
  static error(message: string) {
    console.error(message)
  }
}
