export class Log {
  static debug = false;

  /**
   * ログ出力
   *
   * @param message メッセージ
   */
  static info(message) {
    if (this.debug) {
      console.log(message);
    }
  }
  static warn(message) {
    console.warn(message);
  }
  static error(message) {
    console.error(message);
  }
}
