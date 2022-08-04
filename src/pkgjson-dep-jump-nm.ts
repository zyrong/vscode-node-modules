import { CodeRange, isSimpleNode, parse, Visitor } from '@zyrong/json-parser'
import { ComplexNode, NodeType } from '@zyrong/json-parser/dist/node'
import SHA512 from 'crypto-js/sha512'
import { basename, dirname, join } from 'path'
import validate from 'validate-npm-package-name'
import {
  CancellationToken,
  Definition,
  ExtensionContext,
  languages,
  LocationLink,
  Position,
  Range,
  TextDocument,
  window,
} from 'vscode'

import { NODE_MODULES, PACKAGE_JSON } from './types'
import { error, genFileLocation } from './utils/index'
import t from './utils/localize'
import { findPkgPath } from './utils/pkg'
import { getFileInProjectRootDir } from './vs-utils'

function aContainB(a: CodeRange, b: CodeRange) {
  return a.start <= b.start && a.end >= b.end
}

function findKeyStringNode(node: ComplexNode, keyString: string) {
  if (node.type !== 'object') {
    return
  }
  return node.properties.find((item) => {
    return item.key === keyString
  })
}

function findOverridesPkgNameNode(
  node: ComplexNode,
  pkgName: string,
  pkgNameRange: CodeRange
): NodeType | undefined {
  for (let i = 0; i < node.properties.length; i++) {
    const pkgName_node = node.properties[i]
    if (
      pkgName_node.keyRange &&
      aContainB(pkgName_node.keyRange, pkgNameRange) &&
      pkgName_node.key === pkgName
    ) {
      return pkgName_node
    } else if (
      pkgName_node.type === 'object' &&
      aContainB(pkgName_node.valueRange, pkgNameRange)
    ) {
      return findOverridesPkgNameNode(pkgName_node, pkgName, pkgNameRange)
    }
  }
}

function findPkgNameNodeInPkgJson(
  pkgJsonNode: NodeType,
  pkgName: string,
  pkgNameRange: CodeRange
): NodeType | undefined {
  const possiblyKey = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'bundledDependencies',
    'bundleDependencies',
    'optionalDependencies',
    'resolutions',
    'overrides',
    'dependenciesMeta',
    'peerDependenciesMeta',
  ]
  if (pkgJsonNode && pkgJsonNode.type === 'object') {
    for (let i = 0; i < pkgJsonNode.properties.length; i++) {
      const node = pkgJsonNode.properties[i]
      const idx = possiblyKey.indexOf(node.key as string)
      if (idx !== -1) {
        if (aContainB(node.valueRange, pkgNameRange)) {
          if (node.type === 'object') {
            if (possiblyKey[idx] === 'overrides') {
              return findOverridesPkgNameNode(node, pkgName, pkgNameRange)
            } else {
              return findKeyStringNode(node, pkgName)
            }
          } else if (
            node.type === 'array' &&
            ['bundledDependencies', 'bundleDependencies'].includes(
              possiblyKey[idx]
            )
          ) {
            return node.properties.find((item) => {
              if (isSimpleNode(item) && item.value === pkgName) {
                return item
              }
            })
          }
          return
        } else {
          possiblyKey.splice(idx, 1)
        }
      }
    }
  }
  return undefined
}

function packageJsonHandler({
  visitor,
  fullStringRange,
  pkgName,
  filepath,
}: HandlerArgs): string | undefined {
  if (!!findPkgNameNodeInPkgJson(visitor.body, pkgName, fullStringRange)) {
    return filepath
  }
}

function packageLockJsonHandler({
  visitor,
  fullStringRange,
  fullString,
  pkgName,
  filepath,
}: HandlerArgs): string | undefined {
  const dirPath = dirname(filepath)

  const PACKAGES = 'packages'
  const packages_node = visitor.get(PACKAGES)
  if (
    packages_node &&
    packages_node.type === 'object' &&
    aContainB(packages_node.valueRange, fullStringRange)
  ) {
    if (
      /^node_modules\//.test(fullString) &&
      findKeyStringNode(packages_node, fullString)
    ) {
      const pkgPath = join(dirPath, fullString)
      return pkgPath.slice(0, pkgPath.lastIndexOf(NODE_MODULES) - 1)
    } else {
      const pkgPathNode = packages_node.properties.find((pkgPathNode) => {
        if (aContainB(pkgPathNode.valueRange, fullStringRange)) {
          return !!findPkgNameNodeInPkgJson(
            pkgPathNode,
            pkgName,
            fullStringRange
          )
        }
      })
      return pkgPathNode ? join(dirPath, pkgPathNode.key as string) : undefined
    }
  } else {
    const DEPENDENCIES = 'dependencies'
    const REQUIRES = 'requires'

    function findNode(node: NodeType): NodeType | undefined {
      if (node && node.type === 'object') {
        for (let i = 0; i < node.properties.length; i++) {
          const pkgInfo_node = node.properties[i]
          if (pkgInfo_node.type !== 'object') {
            continue
          }
          if (pkgInfo_node.key === DEPENDENCIES) {
            const dependencies_node = pkgInfo_node
            if (aContainB(dependencies_node.valueRange, fullStringRange)) {
              for (let j = 0; j < dependencies_node.properties.length; j++) {
                const pkgName_node = dependencies_node.properties[j]
                if (
                  pkgName_node.keyRange &&
                  aContainB(pkgName_node.keyRange, fullStringRange) &&
                  pkgName_node.key === fullString
                ) {
                  return pkgName_node
                } else if (
                  aContainB(pkgName_node.valueRange, fullStringRange)
                ) {
                  return findNode(pkgName_node)
                }
              }
            }
          } else if (pkgInfo_node.key === REQUIRES) {
            const requires_node = pkgInfo_node
            if (aContainB(requires_node.valueRange, fullStringRange)) {
              return findKeyStringNode(requires_node, fullString)
            }
          }
        }
      }
    }
    let node: NodeType | undefined | null = findNode(visitor.body)
    if (node) {
      const pkgNames = [] as string[]
      const skipKeys = [REQUIRES, DEPENDENCIES]
      while ((node = node.parent)) {
        if (skipKeys.includes(node.key as string)) {
          continue
        }
        node.key && pkgNames.push(node.key as string)
      }
      let startPath = join(dirPath, NODE_MODULES)
      for (let i = pkgNames.length - 1; i >= 0; i--) {
        startPath = join(startPath, pkgNames[i], NODE_MODULES)
      }
      return startPath
    }
  }
}
function dotPackageLockJsonHandler(args: HandlerArgs): string | undefined {
  if (/\/node_modules\/\.package-lock\.json$/.test(args.filepath)) {
    args.filepath = join(
      args.filepath.slice(0, -'/node_modules/.package-lock.json'.length),
      PACKAGE_JSON
    )
    return packageLockJsonHandler(args)
  }
}

type HandlerArgs = {
  visitor: Visitor
  fullStringRange: CodeRange
  fullString: string
  pkgName: string
  filepath: string
}

const caches: {
  [filepath: string]: { visitor: Visitor | null; integrity: string }
} = {}
function getJsonVisitor(filepath: string, json: string) {
  let cache = caches[filepath]
  const latestIntegrity = SHA512(json).toString()

  if (cache) {
    if (latestIntegrity !== cache.integrity) {
      cache.integrity = latestIntegrity
      cache.visitor = parse(json)
    }
  } else {
    cache = caches[filepath] = {
      visitor: parse(json),
      integrity: latestIntegrity,
    }
  }
  return cache.visitor
}
const strategy = {
  'package.json': packageJsonHandler,
  'package-lock.json': packageLockJsonHandler,
  'npm-shrinkwrap.json': packageLockJsonHandler,
  '.package-lock.json': dotPackageLockJsonHandler,
} as { [key: string]: (args: HandlerArgs) => string | undefined }

async function provideDefinition(
  document: TextDocument,
  position: Position,
  token: CancellationToken
): Promise<Definition | LocationLink[] | null | undefined> {
  const filepath = document.uri.fsPath
  const rootDir = getFileInProjectRootDir(filepath)
  if (!rootDir) {
    error('Failed to find project root directory')
    return
  }

  const fileName = basename(filepath)
  const handler = strategy[fileName]
  if (handler) {
    const wordRange = document.getWordRangeAtPosition(position, /"[^\n\r\s]+?"/)
    if (!wordRange) {
      return
    }

    const stringRange = new Range(
      pkgNameRange.start.translate(0, 1),
      pkgNameRange.end.translate(0, -1)
    )
    const fullString = document.getText(stringRange)
    let pkgName = document.getText(pkgNameRange);
    if (/^node_modules\//.test(pkgName)) {
      pkgName = pkgName.slice(
        pkgName.lastIndexOf(NODE_MODULES) + NODE_MODULES.length + 1
      )
    }
    if (!validate(pkgName).validForOldPackages) {
      return
    }

    const json = document.getText()
    // const line = document.lineAt(position);
    // line.text // 光标行对应的那行文本内容
    try {
      const visitor = getJsonVisitor(filepath, json)
      if (!visitor) {
        return
      }

      const startOffset = document.offsetAt(stringRange.start),
        endOffset = document.offsetAt(stringRange.end)
      const fullStringRange = { start: startOffset, end: endOffset }
      const startPath = handler({
        visitor,
        fullStringRange,
        fullString,
        pkgName,
        filepath,
      })
      if (!startPath) {
        return
      }

      const pkgPath = findPkgPath(pkgName, startPath, rootDir)
      if (!pkgPath) {
        window.showInformationMessage(t('tip.notFoundPackage'))
        return
      }
      return genFileLocation(join(pkgPath, PACKAGE_JSON)) // return location，字符串就会变成一个可以点击的链接
    } catch (err) {
      console.error(err)
      return
    }
  }
}

export default function (context: ExtensionContext) {
  // 注册如何实现跳转到定义，第一个参数表示仅对json文件生效
  context.subscriptions.push(
    languages.registerDefinitionProvider(['json', 'jsonc'], {
      provideDefinition, // 当按住Ctrl键时鼠标hover文本内容 或 右键转到定义时 就会触发该函数
    })
  )
}
