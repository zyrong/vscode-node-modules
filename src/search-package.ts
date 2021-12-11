import { window, workspace, Uri } from "vscode";
import { stat, readdir, access } from "fs/promises";
import { basename, join } from "path";
import { promiseAny, getFileInProjectRootDir, error } from "./utils";
import t from "./utils/localize";
import { NODE_MODULES, PACKAGE_JSON } from "./types";

export default async function (uri: Uri) {
  // package.json中menus已经限定目录名为node_modules才触发该命令，所以uri.path存在必定是node_modulesPath
  let node_modulesPath = uri ? uri.path : "";

  if (!node_modulesPath) {
    const workspaceFolders = workspace.workspaceFolders;

    if (!workspaceFolders?.length) {
      window.showErrorMessage(t('tip.workspaceNoOpenProject'));
      return;
    }

    if (workspaceFolders.length === 1) {
      node_modulesPath = join(workspaceFolders[0].uri.path, NODE_MODULES);
    } else {
      const pickResult = await window.showQuickPick(
        workspaceFolders!.map((item) => {
          return {
            label: item.name,
            projectRootPath: item.uri.path,
          };
        }),
        {
          placeHolder: t("tip.selectSearchProject"),
        }
      );

      if (pickResult) {
        node_modulesPath = join(pickResult.projectRootPath, NODE_MODULES);
      }
    }
  }

  node_modulesPath && searchNodeModules(node_modulesPath);
}

function searchNodeModules(node_modulesPath: string) {
  readdir(node_modulesPath).then(
    async (files) => {
      // 处理 @开头的package
      const organizePkgList: string[] = [],
        pkgList: string[] = [];
      files.forEach((filename) => {
        if (filename.startsWith("@")) {
          organizePkgList.push(filename);
        } else {
          pkgList.push(filename);
        }
      });

      const resultList = await promiseAny(
        organizePkgList.map((filename) => {
          return readdir(join(node_modulesPath, filename));
        })
      );

      let fullOrganizePkgList: string[] = [];
      resultList.forEach((_files, idx) => {
        if (Array.isArray(_files)) {
          const organizeName = organizePkgList[idx];
          const fullOrganizePkgNameList = _files.map((filename) => {
            return `${organizeName}/${filename}`;
          });
          fullOrganizePkgList = fullOrganizePkgList.concat(
            fullOrganizePkgNameList
          );
        }
      });

      // node_modules完整packageName列表
      const fullPkgNameList = fullOrganizePkgList.concat(pkgList);
      const projectRootDir = getFileInProjectRootDir(node_modulesPath);
      const projectName = basename(projectRootDir!);
      // 用户选择结果
      const pickResult = await window.showQuickPick(fullPkgNameList, {
        placeHolder: join(projectName, NODE_MODULES),
      });
      if (pickResult) {
        const userPickPath = join(node_modulesPath, pickResult);
        const pkgJsonPath = join(userPickPath, PACKAGE_JSON);
        let isPkg = false;
        try {
          await access(pkgJsonPath);
          isPkg = true;
        } catch (error) {}

        let destPath = "";
        if (!isPkg) {
          // 不是package, 是类似: .bin文件夹或普通文件
          const _stat = await stat(userPickPath);
          if (_stat.isFile()) {
            destPath = userPickPath;
          } else {
            // 遍历文件列表，打开最前面的文件
            const files = await readdir(userPickPath);
            let i = 0;
            while (i < files.length) {
              // 判断防止全是文件夹的情况
              const filePath = join(userPickPath, files[i++]);
              const _stat = await stat(filePath);
              if (_stat.isFile()) {
                destPath = filePath;
                break;
              }
            }
          }
        } else {
          destPath = pkgJsonPath;
        }
        destPath &&
          workspace.openTextDocument(destPath).then(window.showTextDocument);
      }
    },
    (err) => {
      error(`读取${node_modulesPath}目录失败`, err);
    }
  );
}
