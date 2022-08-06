import { window } from 'vscode'

export const error = (function () {
  const output = window.createOutputChannel('vs-util')
  return function (msg: string, err?: any) {
    output.appendLine(`[Error]: ${msg}. \n${err}\n`)
    // console.error(`[node_modules extension]: ${msg}. \n${err}`);
  }
})()
