/* eslint-disable @typescript-eslint/naming-convention */
import { isComplexNode, isSimpleNode } from '@zyrong/json-parser'
import { NodeType } from '@zyrong/json-parser/dist/node'
import { basename, dirname, join } from 'path'
import { performance } from 'perf_hooks'
import validate from 'validate-npm-package-name'
import { Position, Range, TextDocument } from 'vscode'

import { NODE_MODULES, PACKAGE_JSON } from '../constant'
import { logger } from '../extension'
import { getWorkspaceFolderPathByPath } from '../vs-utils'
import {
  findNodeByKey,
  getJsonNodeByRange,
  getParentPathNodes,
  getToTopLevelNodePath,
  isKeyRange,
  parseJson,
} from './json-node'
import { findPackagePath } from './pkg'

enum PKGJSON_FIELD {
  dependencies = 'dependencies',
  devDependencies = 'devDependencies',
  peerDependencies = 'peerDependencies',
  optionalDependencies = 'optionalDependencies',
  resolutions = 'resolutions',

  bundledDependencies = 'bundledDependencies',
  bundleDependencies = 'bundleDependencies',

  peerDependenciesMeta = 'peerDependenciesMeta',
  dependenciesMeta = 'dependenciesMeta',

  overrides = 'overrides',

  packages = 'packages',
  requires = 'requires',
}

type PkgInfo = {
  rangeVersion?: string
  pkgFindStartPath: string
}

function getPkgInfoFromPackageJson({
  jsonNode,
  isKeyRange,
  jsonFilePath,
  rootNode,
}: {
  jsonNode: NodeType
  isKeyRange: boolean
  jsonFilePath: string
  rootNode?: NodeType
}) {
  let isPkgNameNode = false,
    rangeVersion: string | undefined
  // let pkgNameBelongNode: NodeType | undefined

  const parentNode = jsonNode.parent
  if (parentNode) {
    // pkgNameBelongNode = parentNode
    if (isKeyRange) {
      if (
        isSimpleNode(jsonNode) &&
        [
          PKGJSON_FIELD.dependencies,
          PKGJSON_FIELD.devDependencies,
          PKGJSON_FIELD.peerDependencies,
          PKGJSON_FIELD.optionalDependencies,
          PKGJSON_FIELD.resolutions,
        ].includes(parentNode.key as any)
      ) {
        isPkgNameNode = true
        rangeVersion = jsonNode.value
      } else if (
        parentNode.key === PKGJSON_FIELD.peerDependenciesMeta ||
        parentNode.key === PKGJSON_FIELD.dependenciesMeta
      ) {
        // https://docs.npmjs.com/cli/v9/configuring-npm/package-json#peerdependenciesmeta
        // https://yarnpkg.com/configuration/manifest/#dependenciesMeta
        isPkgNameNode = true
      } else {
        const nodePath = getToTopLevelNodePath(jsonNode, rootNode)
        rootNode = nodePath[nodePath.length - 1]
        // 如果topLevelNode == jsonNode相等，那么jsonNode就是overrides根节点, 忽略
        if (rootNode !== jsonNode && rootNode.key === PKGJSON_FIELD.overrides) {
          isPkgNameNode = true
          // pkgNameBelongNode = topLevelNode
        }
      }
    } else {
      if (parentNode.type === 'array') {
        if (
          parentNode.key === PKGJSON_FIELD.bundleDependencies ||
          parentNode.key === PKGJSON_FIELD.bundledDependencies
        ) {
          isPkgNameNode = true
        }
      }
    }
  }

  if (isPkgNameNode) {
    let result: PkgInfo = { pkgFindStartPath: dirname(jsonFilePath) }
    if (rangeVersion) {
      result.rangeVersion = rangeVersion
    }
    return result
  }
}

function packageJsonHandler({
  jsonNode,
  isKeyRange,
  packageName,
  jsonFilePath,
}: HandlerArgs): PkgInfo | undefined {
  return getPkgInfoFromPackageJson({
    jsonNode,
    isKeyRange,
    jsonFilePath,
  })
}

function getPkgPathFromParentPathNodes(
  jsonNode: NodeType,
  skipKeys: string[],
  jsonFilePath: string
) {
  const pkgNameNodes = getParentPathNodes(jsonNode, skipKeys)
  let pkgFindStartPath = join(dirname(jsonFilePath), NODE_MODULES)
  for (let i = pkgNameNodes.length - 1; i >= 0; i--) {
    pkgFindStartPath = join(pkgFindStartPath, pkgNameNodes[i], NODE_MODULES)
  }
  return pkgFindStartPath
}

function packageLockJsonHandler({
  jsonNode,
  isKeyRange,
  packageName,
  jsonFilePath,
}: HandlerArgs): PkgInfo | undefined {
  let pkgFindStartPath: string | undefined, rangeVersion: string | undefined

  const nodePath = getToTopLevelNodePath(jsonNode)
  const topLevelNode = nodePath[nodePath.length - 1]
  if (topLevelNode !== jsonNode && isComplexNode(topLevelNode)) {
    if (topLevelNode.key === PKGJSON_FIELD.packages) {
      if (
        isKeyRange &&
        jsonNode.parent?.key === PKGJSON_FIELD.packages &&
        isComplexNode(jsonNode)
      ) {
        // match "packages" > "node_modules/@scope/test"

        pkgFindStartPath = join(dirname(jsonFilePath), jsonNode.key as string)
        const versionNode = findNodeByKey(jsonNode, 'version')
        if (isSimpleNode(versionNode)) {
          rangeVersion = versionNode.value // Note: 这里的version非range，与安装版本一致
        }
      } else {
        const packagesSubNode = nodePath[nodePath.length - 2] // is "packages" > "node_modules/@scope/test"
        if (isComplexNode(packagesSubNode)) {
          const pkgInfo = getPkgInfoFromPackageJson({
            jsonNode,
            jsonFilePath,
            isKeyRange,
            rootNode: packagesSubNode,
          })
          if (pkgInfo) {
            pkgFindStartPath = join(
              pkgInfo.pkgFindStartPath,
              packagesSubNode.key as string
            )
            rangeVersion = pkgInfo.rangeVersion
          }
        }
      }
    } else if (topLevelNode.key === PKGJSON_FIELD.dependencies) {
      const parentKey = jsonNode.parent?.key
      if (isComplexNode(jsonNode) && parentKey === PKGJSON_FIELD.dependencies) {
        pkgFindStartPath = getPkgPathFromParentPathNodes(
          jsonNode,
          [PKGJSON_FIELD.requires, PKGJSON_FIELD.dependencies],
          jsonFilePath
        )
        const versionNode = findNodeByKey(jsonNode, 'version') // Note: 这里的version非range，与安装版本一致
        if (isSimpleNode(versionNode)) {
          rangeVersion = versionNode.value
        }
      } else if (
        isSimpleNode(jsonNode) &&
        parentKey === PKGJSON_FIELD.requires
      ) {
        pkgFindStartPath = getPkgPathFromParentPathNodes(
          jsonNode,
          [PKGJSON_FIELD.requires, PKGJSON_FIELD.dependencies],
          jsonFilePath
        )
        rangeVersion = jsonNode.value
      }
    }
  }

  if (pkgFindStartPath) {
    return { pkgFindStartPath, rangeVersion }
  }
}

function dotPackageLockJsonHandler(args: HandlerArgs): PkgInfo | undefined {
  if (/\/node_modules\/\.package-lock\.json$/.test(args.jsonFilePath)) {
    args.jsonFilePath = join(
      args.jsonFilePath.slice(0, -'/node_modules/.package-lock.json'.length),
      PACKAGE_JSON
    )
    return packageLockJsonHandler(args)
  }
}

type HandlerArgs = {
  jsonNode: NodeType
  isKeyRange: boolean
  fullString: string
  packageName: string
  jsonFilePath: string
}

const strategy = {
  'package.json': packageJsonHandler,
  'package-lock.json': packageLockJsonHandler,
  'npm-shrinkwrap.json': packageLockJsonHandler,
  '.package-lock.json': dotPackageLockJsonHandler,
} as { [key: string]: (args: HandlerArgs) => PkgInfo | undefined }

function createGetPkgInfoFromJsonNodeFn(jsonFilename: string) {
  return strategy[jsonFilename]
}

async function getPackageNodeInfoByDocAndPos(
  document: TextDocument,
  position: Position
) {
  const throwErrorMsg = (msg: string) => {
    throw msg
  }

  const filepath = document.uri.fsPath
  const wsFolderPath = getWorkspaceFolderPathByPath(filepath)
  if (!wsFolderPath) {
    return throwErrorMsg('Failed to find workspace folder')
  }

  const jsonFilename = basename(filepath)
  const getPkgInfoFromJsonNodeInfo =
    createGetPkgInfoFromJsonNodeFn(jsonFilename)
  if (!strategy[jsonFilename]) {
    return throwErrorMsg(
      `Not Support from "${jsonFilename}" get packageName path`
    )
  }

  const wordRange = document.getWordRangeAtPosition(position, /"[^\n\r\s]+?"/)
  if (!wordRange) {
    return throwErrorMsg(
      `Failed to get word range. Line: ${position.line}, character:${position.character}`
    )
  }

  const originSelectionRange = new Range(
    wordRange.start.translate(0, 1),
    wordRange.end.translate(0, -1)
  )
  const fullString = document.getText(originSelectionRange)
  let packageName = fullString
  if (/^node_modules\//.test(packageName)) {
    packageName = packageName.slice(
      packageName.lastIndexOf(NODE_MODULES) + NODE_MODULES.length + 1
    )
  }
  if (!validate(packageName).validForOldPackages) {
    return
  }

  logger.debug(`----------- Word Range pass check -----------`)

  const json = document.getText()
  // const line = document.lineAt(position);
  // line.text // 光标行对应的那行文本内容
  try {
    const startTime = performance.now()
    const visitor = parseJson(filepath, json)
    if (!visitor) {
      return
    }
    logger.debug(`Parse Json Time: ${performance.now() - startTime}`)

    const startOffset = document.offsetAt(originSelectionRange.start),
      endOffset = document.offsetAt(originSelectionRange.end)
    const fullStringRange = { start: startOffset, end: endOffset }

    const jsonNode = getJsonNodeByRange(visitor.body, fullStringRange)
    if (!jsonNode) {
      logger.debug(`----------- Get JsonNode Error From Range -----------`)
      return
    }

    const keyRange = isKeyRange(jsonNode, fullStringRange)

    const pkgInfo = getPkgInfoFromJsonNodeInfo({
      jsonNode,
      isKeyRange: keyRange,
      fullString,
      packageName,
      jsonFilePath: filepath,
    })
    if (!pkgInfo) {
      logger.debug(`----------- Current Position Is Not PkgName -----------`)
      return
    }

    const packageInstalledPath = await findPackagePath(
      packageName,
      pkgInfo.pkgFindStartPath,
      wsFolderPath
    )

    return {
      packageName,
      packageVersion: pkgInfo.rangeVersion,
      packageInstalledPath,
      pkgFindStartPath: pkgInfo.pkgFindStartPath,
      jsonNode,
      projectRootPath: wsFolderPath,
      originSelectionRange,
    }
  } catch (err) {
    throw err
  }
}

export { getPackageNodeInfoByDocAndPos }
