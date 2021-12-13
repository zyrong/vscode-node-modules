import * as path from "path";
import * as fs from "fs/promises";
import { Disposable, QuickPickItem, Uri, window } from "vscode";
import { isFile } from "./util";
import t from "./i18n";

class FileItem implements QuickPickItem {
  label: string; // filename
  fsPath: string;

  constructor(filename: string, fsPath: string) {
    this.label = filename;
    this.fsPath = fsPath;
  }
}

class MsgItem implements QuickPickItem {
  label: string;
  description?: string;
  alwaysShow = true;

  constructor(label: string, description?: string) {
    this.label = label;
    this.description = description;
  }
}

export default async function showQuickPickFile(
  baseDir: string,
  basePlaceholder: string = "",
  title: string = ""
) {
  const disposables: Disposable[] = [];
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      const input = window.createQuickPick<FileItem | MsgItem>();
      input.placeholder = basePlaceholder;
      input.title = title;

      // 表示当前是否在baseDir，如果不在，那么就要加入返回上一级和根目录的item
      let inBaseDir = true;
      let continueSearch = false;
      // 当前搜索的basePath
      let baseSearchPath: string = baseDir;

      function genBaseItems() {
        return inBaseDir
          ? []
          : [
              new FileItem("~", baseDir),
              new FileItem("..", path.resolve(baseSearchPath, "..")),
            ];
      }

      async function handleInputItems(value: string) {
        input.busy = true;

        const lastSlashIdx = value.lastIndexOf("/");
        // value的已知目录路径, 例子: value="a/b/cd" 那么a/b才是已知的目录路径，a/b/cd可能是文件或不存在的路径
        const knownDirPathSegment =
          lastSlashIdx > 0 ? value.slice(0, lastSlashIdx) : "";
        const searchDirPath = path.join(baseSearchPath, knownDirPathSegment);
        const cache: { [key: string]: FileItem[] } = {};
        try {
          if (!cache[searchDirPath]) {
            const files = await fs.readdir(searchDirPath, "utf8");
            const baseItems = genBaseItems();
            cache[searchDirPath] = baseItems.concat(
              files.map((filename) => {
                return new FileItem(
                  path.join(knownDirPathSegment, filename),
                  path.join(searchDirPath, filename)
                );
              })
            );
          }
          input.items = cache[searchDirPath];
        } catch (error) {
          input.items = [new MsgItem(t("tip.noSuchDir")), ...genBaseItems()];
        }
        input.busy = false;
      }
      handleInputItems(""); // 初始化当前所在路径列表

      disposables.push(
        input.onDidChangeValue(handleInputItems),
        input.onDidChangeSelection((items) => {
          const item = items[0];
          if (item instanceof FileItem) {
            if (isFile(item.fsPath)) {
              resolve(item.fsPath);
              input.hide();
            } else {
              continueSearch = true;
              input.hide();
              input.show();
              input.value = "";
              inBaseDir = item.fsPath === baseDir;
              baseSearchPath = item.fsPath;
              input.placeholder = baseSearchPath.slice(
                baseSearchPath.indexOf(basePlaceholder)
              );
              handleInputItems("");
            }
          }
        }),
        input.onDidHide(() => {
          // input隐藏后触发的事件， 用户取消选择也会触发。
          if (!continueSearch) {
            resolve(undefined);
            input.dispose();
          }
          continueSearch = false;
        })
      );
      input.show();
    });
  } finally {
    disposables.forEach((d) => d.dispose());
  }
}
