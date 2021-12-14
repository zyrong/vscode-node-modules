 import {
  TextDocument,
  Position,
  CancellationToken,
  Definition,
  LocationLink,
  ExtensionContext,
  languages,
  window
} from "vscode";
import { basename, dirname, join } from "path";
import { existsSync } from "fs";
import {
  getFileInProjectRootDir,
  genFileLocation,
  error,
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
    // const line = document.lineAt(position);
    // line.text // 光标行对应的那行文本内容

    const pkgNameRegex = new RegExp(
      `"(peerDependencies|dependencies|devDependencies)":\\s*?\\{[\\s\\S]*?${word}[\\s\\S]*?\\}`
    );
    const isDepPkgName = pkgNameRegex.test(json);
    if (isDepPkgName) {
      const rootDir = getFileInProjectRootDir(filepath);
      if (!rootDir) {
        error("寻找项目根目录失败");
        return;
      }
      let destPath: string = "";
      const pkgName = word.replace(/"/g, "");
      const isOrganizePkg = pkgName.startsWith("@");
      const pkgNamePath = isOrganizePkg ? pkgName.split("/") : [pkgName];
      // 从package.json所在目录的node_modules寻找，直到根目录的node_modules停止。
      let isRootDir = false;
      let currentDirPath = filepath;
      do {
        currentDirPath = dirname(currentDirPath);
        destPath = join(
          currentDirPath,
          NODE_MODULES,
          ...pkgNamePath,
          PACKAGE_JSON
        );
        if (existsSync(destPath)) {
          return genFileLocation(destPath); // return location，字符串就会变成一个可以点击的链接
        }
        isRootDir = rootDir === currentDirPath;
      } while (!isRootDir);

      window.showWarningMessage(t("tip.notFoundPackage"));
    }
  }
}

export default function (context: ExtensionContext) {
  // 注册如何实现跳转到定义，第一个参数表示仅对json文件生效
  context.subscriptions.push(
    languages.registerDefinitionProvider(["json"], {
      provideDefinition, // 当按住Ctrl键时鼠标hover文本内容就会触发该函数
    })
  );
}
