import { constants } from "fs";
import { access, stat } from "fs/promises";
import { window } from "vscode";

export async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    return false;
  }
}

export async function existFile(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
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
