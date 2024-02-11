export class Log {
  static debug = false

  static info(...data: any[]) {
    if (this.debug) {
      console.log(...data)
    }
  }
  static warn(...data: any[]) {
    console.warn(...data)
  }
  static error(...data: any[]) {
    console.error(...data)
  }
}
