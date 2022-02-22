import { workspace, Location, Uri, Position, window } from "vscode";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

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

// 获取文件所在工作空间的根目录
export const getFileInProjectRootDir = function (
  filepath: string
): string | undefined {
  const project = workspace.workspaceFolders?.find((project) => {
    return filepath.startsWith(project.uri.path);
  });
  return project?.uri.path;
};

type DepsOffsetRange = {
  peerDependencies?: number[]
  dependencies?: number[]
  devDependencies?: number[]
};
// 获取deps字符范围
export const getDepsOffsetRange = function (
  packageJson: string
): DepsOffsetRange {
  // match deps range string
  // /(?<="(?:peerDependencies|dependencies|devDependencies)"[^\{]*?\{)[^\}]*([\s\S]*?)[^\}]*/g
  const regex = /"(peerDependencies|dependencies|devDependencies)"[^\{]*?\{/g;
  const result: DepsOffsetRange = {};
  for (let i = 0; i < 3; i++) {
    const match = regex.exec(packageJson);
    if (!match) {
      continue;
    }

    const startIdx = match.index + match[0].length;
    const endIdx = packageJson.indexOf("}", startIdx);
    const key = match[1];
    result[(key as keyof DepsOffsetRange)] = [startIdx, endIdx];
    regex.lastIndex = endIdx;
  }
  return result;
};

// 判断是否是monorepo项目
export const isMonorepoProject = (projectRootDir: string) => {
  // TODO: 暂时先这么判断
  const lernaJsonPath = join(projectRootDir, "lerna.json");
  let isLerna = existsSync(lernaJsonPath);
  let yarnworkspaces = false;
  const pkgjsonPath = join(projectRootDir, "package.json");
  if (existsSync(pkgjsonPath)) {
    const pkgBuffer = readFileSync(pkgjsonPath);
    try {
      const pkgJson = JSON.parse(pkgBuffer.toString());
      yarnworkspaces = Boolean(pkgJson.workspaces);
    } catch (err) {
      error("root package.json parse error", err);
    }
  }
  return isLerna || yarnworkspaces;
};

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

export function promiseAny<T>(promiseList: Promise<T>[]): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!(Array.isArray(promiseList) && promiseList.length > 0)) {
      resolve([]);
      return;
    }
    let count = 0;
    const result: T[] = new Array(promiseList.length);
    promiseList.forEach((promise, index) => {
      promise
        .then(
          (res) => {
            result[index] = res;
          },
          (err) => {
            result[index] = err;
          }
        )
        .finally(() => {
          if (++count === promiseList.length) {
            resolve(result);
          }
        });
    });
  });
}
