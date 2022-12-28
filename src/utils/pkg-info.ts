import axios, { AxiosError } from 'axios'
import isBuiltinModule from 'is-builtin-module'
import { isObject } from 'lodash'
import LRUCache from 'lru-cache'
import pacote, { Manifest, ManifestResult } from 'pacote'
import { join } from 'path'
import { CancellationToken } from 'vscode'

import { PACKAGE_JSON } from '../constant'
import { logger } from '../extension'
import { parseJsonFile } from '../vs-utils'
import { promiseDebounce } from './'

type PackageJsonData = {
  name: string
  version: string
  homepage?: string | { url?: string }
  repository?: string | { url?: string }
  bugs?: string | { url?: string }
}

type WebpackBundleSize = {
  gzip: number
  normal: number
}

type PackageInfo =
  | {
      name: string
      version: string
      // latestVersion?: string
      isBuiltinModule: false
      installedVersion?: string
      installedPath?: string
      webpackBundleSize?: WebpackBundleSize
      packageJson: PackageJsonData
    }
  | { isBuiltinModule: true; name: string }

const pacoteManifest = promiseDebounce(
  pacote.manifest,
  (pkgNameAndRangeVersion: string) => {
    return pkgNameAndRangeVersion
  }
)
const remotePkgMetadataCache = new LRUCache<string, PackageJsonData>({
  max: 100,
  ttl: 1000 * 60 * 10,
})
async function getRemotePackageJsonData(pkgName: string, pkgVersion?: string) {
  let result: PackageJsonData | undefined
  const pkgNameAndVersion = `${pkgName}${pkgVersion ? '@' + pkgVersion : ''}`
  if (!remotePkgMetadataCache.has(pkgNameAndVersion)) {
    try {
      const pkgJsonData = (await pacoteManifest(pkgNameAndVersion, {
        fullMetadata: true,
      })) as unknown as Manifest & ManifestResult
      if (isObject(pkgJsonData)) {
        result = pkgJsonData
        remotePkgMetadataCache.set(pkgNameAndVersion, result)
      }
    } catch (error) {
      logger.error('', error)
    }
  } else {
    result = remotePkgMetadataCache.get(pkgNameAndVersion)!
  }
  return result
}

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

const pkgWebpackBundleSizeCache = new LRUCache<string, WebpackBundleSize>({
  max: 100,
  ttl: 1000 * 60 * 10,
})

async function getPkgWebpackBundleSize(pkgNameAndVersion: string) {
  let bundleSizeInfo = pkgWebpackBundleSizeCache.get(pkgNameAndVersion)
  if (!bundleSizeInfo) {
    try {
      const { data } = await getBundlephobiaApiSize(pkgNameAndVersion)
      if (data && typeof data.size === 'number') {
        bundleSizeInfo = {
          gzip: data.gzip!,
          normal: data.size,
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
  }
  return bundleSizeInfo
}

const getPackageInfoDefaultOptions = {
  remoteFetch: true,
  fetchBundleSize: true,
  skipBuiltinModuleCheck: false,
}
async function getPackageInfo(
  packageName: string,
  options: {
    packageInstalledPath?: string
    searchVersionRange?: string
    remoteFetch?: boolean
    fetchBundleSize?: boolean
    token?: CancellationToken
    skipBuiltinModuleCheck?: boolean
    // getLatestVersion?: boolean
  } = {}
) {
  options = {
    ...getPackageInfoDefaultOptions,
    ...options,
  }
  let result: PackageInfo | undefined
  // const getLatestVersion = options.getLatestVersion || false

  if (
    !options.packageInstalledPath &&
    !options.skipBuiltinModuleCheck &&
    isBuiltinModule(packageName)
  ) {
    result = {
      name: packageName,
      isBuiltinModule: true,
    }
    return result
  }

  if (options.packageInstalledPath) {
    let localPkgJson: PackageJsonData | undefined = (await parseJsonFile(
      join(options.packageInstalledPath, PACKAGE_JSON)
    )) as any
    if (isObject(localPkgJson)) {
      result = {
        name: packageName,
        version: localPkgJson.version,
        isBuiltinModule: false,
        installedVersion: localPkgJson.version,
        installedPath: options.packageInstalledPath,
        packageJson: localPkgJson,
      }
    }
  }

  if (!result && options.remoteFetch) {
    const remotePackageJsonData = await (!options.token
      ?.isCancellationRequested &&
      getRemotePackageJsonData(packageName, options.searchVersionRange))
    if (remotePackageJsonData) {
      result = {
        name: packageName,
        version: remotePackageJsonData.version,
        isBuiltinModule: false,
        packageJson: remotePackageJsonData,
      }
    }
  }

  if (result) {
    if (options.fetchBundleSize) {
      const pkgNameAndVersion = result.name + '@' + (result as any).version
      const webpackBundleSize = await (!options.token
        ?.isCancellationRequested && getPkgWebpackBundleSize(pkgNameAndVersion))
      if (webpackBundleSize) {
        ;(result as any).webpackBundleSize = webpackBundleSize
      }
    }
  }

  return result
}

export { getPackageInfo }
export type { PackageInfo, PackageJsonData, WebpackBundleSize }
