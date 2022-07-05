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
import validate from 'validate-npm-package-name';
import jsonParse from '@zyrong/json-parser';
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
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) { return; };
    const word = document.getText(wordRange);
    const json = document.getText();
    // const line = document.lineAt(position);
    // line.text // 光标行对应的那行文本内容

    const pkgName = word.slice(1, -1);

    if (!validate(pkgName).validForOldPackages) { return; };

    try {
      const visitor = jsonParse(json);
      if (!visitor) { return; };
      const isPkgName = ["peerDependencies", "dependencies", "devDependencies"].find(key => {
        const node = visitor.get(key);
        if (node && node.type === 'object') {
          const valueRange = node.valueRange;
          if (valueRange.start < document.offsetAt(wordRange.start) && valueRange.end > document.offsetAt(wordRange.end)) {
            return true;
          }
        }
      });
      if (!isPkgName) { return; };

    } catch (err) {
      console.error(error);
    }

    const rootDir = getFileInProjectRootDir(filepath);
    if (!rootDir) {
      error("寻找项目根目录失败");
      return;
    }

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
