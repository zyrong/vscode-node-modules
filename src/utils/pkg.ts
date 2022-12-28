import { dirname, join } from 'path'

import {
  NODE_MODULES,
  PACKAGE_JSON,
  SUPPORT_PKGMANAGER_NAMES,
  T_SUPPORT_PKGMANAGER_NAMES,
} from '../constant'
import { configs } from '../extension-configs'
import { exists, isFile, parseJsonFile, realpath } from '../vs-utils'
import { isObject, trimRightSlash } from './'

type DepsOffsetRange = {
  peerDependencies?: number[]
  dependencies?: number[]
  devDependencies?: number[]
}
// 获取deps字符范围
function getDepsOffsetRange(packageJson: string): DepsOffsetRange {
  // match deps range string
  // /(?<="(?:peerDependencies|dependencies|devDependencies)"[^\{]*?\{)[^\}]*([\s\S]*?)[^\}]*/g
  const regex = /"(peerDependencies|dependencies|devDependencies)"\s*:\s*\{/g
  const result: DepsOffsetRange = {}
  for (let i = 0; i < 3; i++) {
    const match = regex.exec(packageJson)
    if (!match) {
      continue
    }

    const startIdx = match.index + match[0].length
    const endIdx = packageJson.indexOf('}', startIdx)
    const key = match[1]
    result[key as keyof DepsOffsetRange] = [startIdx, endIdx]
    regex.lastIndex = endIdx
  }
  return result
}

async function detectCurrentUsePkgManager(projectRootDir: string) {
  const pkgjsonPath = join(projectRootDir, PACKAGE_JSON)
  const pkgJson = await parseJsonFile(pkgjsonPath)
  let result: 'npm' | 'yarn' | 'pnpm' | undefined
  if (pkgJson) {
    if (typeof pkgJson.packageManager === 'string') {
      result = SUPPORT_PKGMANAGER_NAMES.find((pkgManagerName) => {
        return pkgJson.packageManager.indexOf(pkgManagerName) !== -1
      })
    } else if (pkgJson.engines) {
      result = SUPPORT_PKGMANAGER_NAMES.find((pkgManagerName) => {
        return pkgJson.engines[pkgManagerName]
      })
    } else {
      function findLockFile(
        path: string,
        pkgManagerName: T_SUPPORT_PKGMANAGER_NAMES
      ): Promise<T_SUPPORT_PKGMANAGER_NAMES> {
        return new Promise((resolve, reject) => {
          isFile(path).then(() => {
            resolve(pkgManagerName)
          }, reject)
        })
      }
      result = await Promise.race([
        findLockFile(
          join(projectRootDir, NODE_MODULES, '.package-lock.json'),
          'npm'
        ),
        findLockFile(join(projectRootDir, 'package-lock.json'), 'npm'),
        findLockFile(join(projectRootDir, 'yarn.lock'), 'yarn'),
        findLockFile(join(projectRootDir, 'pnpm-lock.yaml'), 'pnpm'),
        findLockFile(join(projectRootDir, 'npm-shrinkwrap.json'), 'npm'),
        findLockFile(join(projectRootDir, '.yarnrc.yml'), 'yarn'),
      ])
    }
  }
  return result
}

async function maybeRealpath(path: string) {
  if (configs.resolve.preserveSymlinks === false) {
    return realpath(path)
  } else {
    return path
  }
}

async function findPackagePath(
  packageName: string,
  startPath: string,
  endPath: string
) {
  // const isOrganizePkg = packageName.startsWith('@')
  // 从package.json所在目录的node_modules寻找，直到根目录的node_modules停止。
  startPath = trimRightSlash(startPath)
  endPath = trimRightSlash(endPath)
  if (await isFile(startPath)) {
    startPath = dirname(startPath)
  }
  let currentDirPath = startPath
  let end = false
  let destPath: string = ''
  do {
    const realP = await maybeRealpath(currentDirPath)
    if (realP) {
      currentDirPath = realP
      destPath = join(currentDirPath, NODE_MODULES, packageName)
      if (await exists(destPath)) {
        return destPath
      }
    }
    end = endPath === currentDirPath || !currentDirPath
    currentDirPath = dirname(currentDirPath)
  } while (!end)
  return undefined
}

function getPkgVersionFromPkgJson(
  pkgName: string,
  pkgJson: any
): string | undefined {
  if (isObject(pkgJson)) {
    return (
      (pkgJson.dependencies && pkgJson.dependencies[pkgName]) ||
      (pkgJson.devDependencies && pkgJson.devDependencies[pkgName])
    )
  }
}

export {
  detectCurrentUsePkgManager,
  findPackagePath,
  getDepsOffsetRange,
  getPkgVersionFromPkgJson,
}
