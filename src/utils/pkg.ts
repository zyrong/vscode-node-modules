import axios, { AxiosError } from 'axios'
import { existsSync } from 'fs'
import LRUCache from 'lru-cache'
import pacote, { Manifest, ManifestResult } from 'pacote'
import { dirname, join } from 'path'

import { logger } from '../extension'
import {
  NODE_MODULES,
  PACKAGE_JSON,
  SUPPORT_PKGMANAGER_NAMES,
  T_SUPPORT_PKGMANAGER_NAMES,
} from '../types'
import { isFile, parseJsonFile } from '../vs-utils'
import { isFileSync, isRecord, promiseDebounce, trimRightSlash } from './'

type DepsOffsetRange = {
  peerDependencies?: number[]
  dependencies?: number[]
  devDependencies?: number[]
}
// 获取deps字符范围
export const getDepsOffsetRange = function (
  packageJson: string
): DepsOffsetRange {
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

export async function detectCurrentUsePkgManager(projectRootDir: string) {
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

export function findPkgPath(
  pkgName: string,
  startPath: string,
  endPath: string
) {
  const isOrganizePkg = pkgName.startsWith('@')
  const pkgNamePath = isOrganizePkg ? pkgName.split('/') : [pkgName]
  // 从package.json所在目录的node_modules寻找，直到根目录的node_modules停止。
  let currentDirPath = startPath
  if (isFileSync(startPath)) {
    currentDirPath = dirname(currentDirPath)
  }
  if (/node_modules\/?$/.test(currentDirPath)) {
    currentDirPath = dirname(currentDirPath)
  }
  currentDirPath = trimRightSlash(currentDirPath)
  endPath = trimRightSlash(endPath)
  let end = false
  let destPath: string = ''
  do {
    destPath = join(currentDirPath, NODE_MODULES, ...pkgNamePath)
    if (existsSync(destPath)) {
      return destPath
    }
    end = endPath === currentDirPath || !currentDirPath
    currentDirPath = dirname(currentDirPath)
  } while (!end)
  return undefined
}

export function getPkgVersionFromPkgJson(
  pkgName: string,
  pkgJson: any
): string | undefined {
  if (isRecord(pkgJson)) {
    return (
      (pkgJson.dependencies && pkgJson.dependencies[pkgName]) ||
      (pkgJson.devDependencies && pkgJson.devDependencies[pkgName])
    )
  }
}

export type PkgJsonInfo = {
  name: string
  version: string
  homepage?: string | { url?: string }
  repository?: string | { url?: string }
  bugs?: string | { url?: string }
} & { lastUpdate?: number }

const pacoteManifest = promiseDebounce(
  pacote.manifest,
  (pkgNameAndRangeVersion: string) => {
    return pkgNameAndRangeVersion
  }
)
const remotePkgJsonInfoCache = new LRUCache<string, PkgJsonInfo>({
  max: 100,
  ttl: 1000 * 60 * 10,
})
export async function getPkgJsonInfo(
  pkgName: string,
  pkgJsonPath: string | undefined,
  rootDir: string
) {
  let result = {
    name: pkgName,
  } as PkgJsonInfo
  let localPkgJson: PkgJsonInfo | undefined
  if (pkgJsonPath) {
    localPkgJson = (await parseJsonFile(pkgJsonPath)) as any
    if (isRecord(localPkgJson)) {
      result.version = localPkgJson.version
      result.homepage = localPkgJson.homepage
      result.repository = localPkgJson.repository
      result.bugs = localPkgJson.bugs
      result.lastUpdate = Date.now()
    }
  }

  if (!localPkgJson) {
    const rootPkgJsonPath = join(rootDir, PACKAGE_JSON)
    const rootDirPkgJson = await parseJsonFile(rootPkgJsonPath)
    if (rootDirPkgJson) {
      const rangeVersion = getPkgVersionFromPkgJson(pkgName, rootDirPkgJson)
      const pkgNameAndRangeVersion = `${pkgName}${
        rangeVersion ? '@' + rangeVersion : ''
      }`
      if (!remotePkgJsonInfoCache.has(pkgNameAndRangeVersion)) {
        const pkgJson = (await pacoteManifest(pkgNameAndRangeVersion, {
          fullMetadata: true,
        })) as unknown as Manifest & ManifestResult
        if (isRecord(pkgJson)) {
          result.version = pkgJson.version
          result.homepage = pkgJson.homepage
          result.repository = pkgJson.repository
          result.bugs = pkgJson.bugs
          remotePkgJsonInfoCache.set(pkgNameAndRangeVersion, result)
        }
      } else {
        result = remotePkgJsonInfoCache.get(pkgNameAndRangeVersion)!
      }
    }
  }

  if (!result.version) {
    return
  } else {
    return result
  }
}

export type PackageInfo = {
  name: string
  version: string
  homepageUrl?: string
  repositoryUrl?: string
  bugsUrl?: string
  webpackBundleSize?: {
    normal: number
    gzip: number
  }
} & { lastPkgJsonInfoUpdate?: number }

const getBundlephobiaApiSize = promiseDebounce(
  (pkgNameAndVersion: string) => {
    return axios.get<{ gzip?: number; size?: number }>(
      `https://bundlephobia.com/api/size?package=${pkgNameAndVersion}`,
      {
        timeout: 5000,
      }
    )
  },
  (pkgNameAndVersion: string) => pkgNameAndVersion
)
const pkgInfoCache = new LRUCache<string, PackageInfo>({
  max: 100,
  ttl: 1000 * 60 * 10,
})
export async function getPackageInfo(pkgJsonInfo: PkgJsonInfo) {
  const extractUrl = (
    val: string | { url?: string | undefined } | undefined
  ) => {
    if (typeof val === 'string') {
      return val
    } else if (isRecord(val) && typeof val.url === 'string') {
      return val.url
    }
  }

  const pkgNameAndVersion = pkgJsonInfo.name + '@' + pkgJsonInfo.version
  const pkgInfo = pkgInfoCache.get(pkgNameAndVersion)
  if (!pkgInfo) {
    let pkgInfo: PackageInfo = {
      name: pkgJsonInfo.name,
      version: pkgJsonInfo.version,
      homepageUrl: extractUrl(pkgJsonInfo.homepage),
      repositoryUrl: extractUrl(pkgJsonInfo.repository),
      bugsUrl: extractUrl(pkgJsonInfo.bugs),
    }

    try {
      const { data: sizeInfo } = await getBundlephobiaApiSize(pkgNameAndVersion)
      if (sizeInfo && typeof sizeInfo.size === 'number') {
        pkgInfo.webpackBundleSize = {
          gzip: sizeInfo.gzip!,
          normal: sizeInfo.size,
        }
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        logger.error(
          `\nAxios ${err.name} \nCode: ${err.code} \nMessage: ${err.message} \nURL: ${err.config.url}`
        )
      } else {
        logger.error('', err)
      }
    }
    pkgInfoCache.set(pkgNameAndVersion, pkgInfo)
  } else if (pkgInfo.lastPkgJsonInfoUpdate !== pkgJsonInfo.lastUpdate) {
    // forcaUpdatePkgJsonInfo
    pkgInfo.lastPkgJsonInfoUpdate = pkgJsonInfo.lastUpdate
    pkgInfo.homepageUrl = extractUrl(pkgJsonInfo.homepage)
    pkgInfo.repositoryUrl = extractUrl(pkgJsonInfo.repository)
    pkgInfo.bugsUrl = extractUrl(pkgJsonInfo.bugs)
  }

  return pkgInfoCache.get(pkgNameAndVersion)!
}
