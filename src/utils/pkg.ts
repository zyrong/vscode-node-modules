import { dirname, join } from "path";
import YAML from 'yaml';
import { existsSync, readFileSync } from "fs";
import { NODE_MODULES, PACKAGE_JSON, SUPPORT_PKGMANAGER_NAMES, T_SUPPORT_PKGMANAGER_NAMES } from "../types";
import { error, isFileSync, trimRightBackslash } from ".";
import { isFile, parseJsonFile } from '../vs-utils';

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
  const regex = /"(peerDependencies|dependencies|devDependencies)"\s*:\s*\{/g;
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



export async function detectCurrentUsePkgManager(projectRootDir: string) {
  const pkgjsonPath = join(projectRootDir, PACKAGE_JSON);
  const pkgJson = await parseJsonFile(pkgjsonPath);
  let result: 'npm' | 'yarn' | 'pnpm' | undefined;
  if (pkgJson) {
    if (typeof pkgJson.packageManager === 'string') {
      result = SUPPORT_PKGMANAGER_NAMES.find(pkgManagerName => {
        return pkgJson.packageManager.indexOf(pkgManagerName) !== -1;
      });
    } else if (pkgJson.engines) {
      result = SUPPORT_PKGMANAGER_NAMES.find(pkgManagerName => {
        return pkgJson.engines[pkgManagerName];
      });
    } else {
      function findLockFile(path: string, pkgManagerName: T_SUPPORT_PKGMANAGER_NAMES): Promise<T_SUPPORT_PKGMANAGER_NAMES> {
        return new Promise((resolve, reject) => {
          isFile(path).then(() => {
            resolve(pkgManagerName);
          }, reject);
        });
      }
      result = await Promise.race([
        findLockFile(join(projectRootDir, NODE_MODULES, '.package-lock.json'), 'npm'),
        findLockFile(join(projectRootDir, 'package-lock.json'), 'npm'),
        findLockFile(join(projectRootDir, 'yarn.lock'), 'yarn'),
        findLockFile(join(projectRootDir, 'pnpm-lock.yaml'), 'pnpm'),
        findLockFile(join(projectRootDir, 'npm-shrinkwrap.json'), 'npm'),
        findLockFile(join(projectRootDir, '.yarnrc.yml'), 'yarn'),
      ]);
    }
  }
  return result;
}

export function findPkgPath(pkgName: string, startPath: string, endPath: string) {
  const isOrganizePkg = pkgName.startsWith("@");
  const pkgNamePath = isOrganizePkg ? pkgName.split("/") : [pkgName];
  // 从package.json所在目录的node_modules寻找，直到根目录的node_modules停止。
  let currentDirPath = startPath;
  if (isFileSync(startPath)) {
    currentDirPath = dirname(currentDirPath);
  }
  if (/node_modules\/?$/.test(currentDirPath)) {
    currentDirPath = dirname(currentDirPath);
  }
  currentDirPath = trimRightBackslash(currentDirPath);
  endPath = trimRightBackslash(endPath);
  let end = false;
  let destPath: string = "";
  do {
    destPath = join(
      currentDirPath,
      NODE_MODULES,
      ...pkgNamePath
    );
    if (existsSync(destPath)) {
      return destPath;
    }
    end = endPath === currentDirPath || !currentDirPath;
    currentDirPath = dirname(currentDirPath);
  } while (!end);
  return undefined;
}