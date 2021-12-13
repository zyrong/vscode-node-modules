import { existsSync, readFileSync, statSync } from "fs";
import { window } from "vscode";

export function isFile(path: string): Boolean {
  try {
    const _stat = statSync(path);
    return _stat.isFile();
  } catch (error) {
    return false;
  }
}

export function existFile(path: string): Boolean {
  try {
    return existsSync(path);
  } catch (error) {
    return false;
  }
}

export const error = (function () {
  const output = window.createOutputChannel("vs-util");
  return function (msg: string, err?: any) {
    output.appendLine(`[Error]: ${msg}. \n${err}\n`);
    // console.error(`[node_modules extension]: ${msg}. \n${err}`);
  };
})();