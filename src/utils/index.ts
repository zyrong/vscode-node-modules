import { workspace, Location, Uri, Position, window } from "vscode";
import { existsSync, readFileSync, statSync } from "fs";


export function isFileSync(path: string): Boolean {
  try {
    const _stat = statSync(path);
    return _stat.isFile();
  } catch (error) {
    return false;
  }
}
export function isDirectorySync(path: string): Boolean {
  try {
    const _stat = statSync(path);
    return _stat.isDirectory();
  } catch (error) {
    return false;
  }
}

export function trimRightBackslash(str: string) {
  return str.replace(/\/*$/, '');
}



// 生成 vscode.location对象 用来让vscode跳转到指定文件的指定位置
export const genFileLocation = (
  destPath: string,
  line: number = 0,
  character: number = 0
) => {
  // new vscode.Position(0, 0) 表示跳转到某个文件的第一行第一列
  return new Location(Uri.file(destPath), new Position(line, character));
};

export const error = (function () {
  const output = window.createOutputChannel("node_modules");
  return function (msg: string, err?: any) {
    output.appendLine(`[Error]: ${msg}. \n${err}\n`);
    // console.error(`[node_modules extension]: ${msg}. \n${err}`);
  };
})();

export function isRecord(target: any): target is Record<string, any> {
  return target !== null && typeof target === 'object';
}