import {
  TextDocument,
  Position,
  CancellationToken,
  Definition,
  LocationLink,
  ExtensionContext,
  languages,
  window,
} from "vscode";
import { basename, dirname, join } from "path";
import { existsSync } from "fs";
import {
  getFileInProjectRootDir,
  genFileLocation,
  error,
  getDepsOffsetRange,
  getPkgPath,
} from "./utils/index";
import t from "./utils/localize";
import { NODE_MODULES, PACKAGE_JSON } from "./types";

async function provideDefinition(
  document: TextDocument,
  position: Position,
  token: CancellationToken
): Promise<Definition | LocationLink[] | null | undefined> {
  const filepath = document.uri.fsPath;
  const fileName = basename(filepath);
  if (/package\.json$/.test(fileName)) {
    const range = document.getWordRangeAtPosition(position);
    const word = document.getText(range);
    const json = document.getText();
    const offset = document.offsetAt(position);
    // const line = document.lineAt(position);
    // line.text // 光标行对应的那行文本内容

    const depsOffsetRange = getDepsOffsetRange(json);
    const pkgNameRegex = new RegExp(`${word}\\s*:`);
    let isHoverPkgName = false;
    for (const [key, value] of Object.entries(depsOffsetRange)) {
      const [sIdx, eIdx] = value;
      const depsText = json.slice(sIdx, eIdx);
      if (offset >= sIdx && offset <= eIdx) { // check点击范围
        if (pkgNameRegex.test(depsText)) { // check pkgName
          isHoverPkgName = true;
          break;
        }
      }
    }
    if (!isHoverPkgName) {
      return;
    }

    const rootDir = getFileInProjectRootDir(filepath);
    if (!rootDir) {
      error("寻找项目根目录失败");
      return;
    }

    const pkgName = word.replace(/"\s*/g, "");
    const pkgPath = getPkgPath(pkgName, filepath, rootDir);
    if (!pkgPath) {
      window.showInformationMessage(t("tip.notFoundPackage"));
      return;
    }
    return genFileLocation(join(pkgPath, PACKAGE_JSON)); // return location，字符串就会变成一个可以点击的链接
  }
}

export default function (context: ExtensionContext) {
  // 注册如何实现跳转到定义，第一个参数表示仅对json文件生效
  context.subscriptions.push(
    languages.registerDefinitionProvider(["json", "jsonc"], {
      provideDefinition, // 当按住Ctrl键时鼠标hover文本内容 或 右键转到定义时 就会触发该函数
    })
  );
}
