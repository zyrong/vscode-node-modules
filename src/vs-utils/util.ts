import { existsSync } from "fs";
import * as fsAsync from 'fs/promises';
import { window } from "vscode";

export async function isFile(path: string): Promise<boolean> {
  try {
    const stat = await fsAsync.stat(path);
    return stat.isFile();
  } catch (error) {
    return false;
  }
}

export function existFile(path: string): boolean  {
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