import os from 'os'
import { OutputChannel, version, window } from 'vscode'

export enum BuiltInLevel {
  info = 'info',
  warn = 'warn',
  error = 'error',
  debug = 'debug',
}

type LoggerOptions = {
  max?: number
  levels?: Level[]
}
type Level = string | number

class Logger {
  private list: string[] = []
  private levels: Set<Level> = new Set()
  private outputChannel: OutputChannel
  private options: Required<LoggerOptions>
  constructor(outputChannelName: string, options?: LoggerOptions) {
    this.outputChannel = window.createOutputChannel(outputChannelName)
    this.options = Object.assign({ max: 1000, levels: ['*'] }, options)
    this.options.levels.forEach((level) => this.addLevel(level))
  }

  addLevel(level: Level) {
    this.removeLevel('*')
    this.levels.add(level)
  }
  removeLevel(level: Level) {
    this.levels.delete(level)
  }

  log(message: string) {
    this.addLog(message)
    this.print(message)
  }
  debug(message: string) {
    const msg = `[Debug]: ${message}`
    this.filter(msg, BuiltInLevel.debug)
    return this
  }
  info(message: string) {
    const msg = `[Info]: ${message}`
    this.filter(msg, BuiltInLevel.info)
    return this
  }
  warn(message: string) {
    const msg = `[Warning]: ${message}`
    this.filter(msg, BuiltInLevel.warn)
    return this
  }
  error(message: string, err?: any) {
    const msg = `[Error]: ${message}${err ? '\n' + err + '\n' : ''}`
    this.filter(msg, BuiltInLevel.error)
    return this
  }
  filter(message: string, level: string | number) {
    this.addLog(message)
    if (this.levels.has('*') || this.levels.has(level)) {
      this.print(message)
    }
    return this
  }

  private next = 0
  addLog(message: string) {
    this.list[this.next] = message
    this.next = this.next < this.options.max ? this.next + 1 : 0
    return this
  }
  clearLogs() {
    this.list = []
    this.next = 0
  }
  print(message: string, lineBreak = true) {
    this.outputChannel[lineBreak ? 'appendLine' : 'append'](message)
    return this
  }
  clearPrint() {
    this.outputChannel.clear()
  }

  system() {
    return `VSCode Version: ${version}
    OS Platform: ${os.platform()}
    CPU Architecture: ${os.arch()}`
  }
  time() {
    const date = new Date()
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const h = date.getHours()
    const m = date.getMinutes()
    const s = date.getSeconds()

    return `${year}-${month}-${day} ${h}:${m}:${s}`
  }

  generate() {
    const fristIdx =
      this.list[this.next + 1] === undefined ? this.next + 1 : this.list[0]
  }
}

export default Logger
