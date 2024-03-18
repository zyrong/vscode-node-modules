import { parse, ParseResult, ParserOptions } from '@babel/parser'
import traverse from '@babel/traverse'
import {
  isIdentifier,
  isImport,
  isStringLiteral,
  isTSExternalModuleReference,
} from '@babel/types'
import TTLCache from '@isaacs/ttlcache'
import SHA512 from 'crypto-js/sha512'
import { join } from 'path'
import { performance } from 'perf_hooks'
import validate from 'validate-npm-package-name'
import {
  CancellationToken,
  ExtensionContext,
  Hover,
  HoverProvider,
  languages,
  Position,
  ProviderResult,
  Range,
  TextDocument,
} from 'vscode'

import { PACKAGE_JSON } from './constant'
import { logger } from './extension'
import { configs } from './extension-configs'
import { findPackagePath, getPkgVersionFromPkgJson } from './utils/pkg'
import { getPkgHoverContentsCreator } from './utils/pkg-hover-contents'
import { getPackageInfo } from './utils/pkg-info'
import { getWorkspaceFolderPathByPath } from './vs-utils'
import { parseJsonFile } from './vs-utils/util'

type BabelAst = ParseResult<import('@babel/types').File>

function inRange(
  range: { start?: number | null; end?: number | null },
  val: number
) {
  return range.start && range.end && val >= range.start && val <= range.end
}

function findQuota(text: string, eachNum: number, start: number, step: number) {
  const quotas = new Set(["'", '"'])
  let quotaIdx = -1
  // 查找距离hover最近的/'|"/
  while (eachNum > 0) {
    const char = text[start]
    if (quotas.has(char)) {
      quotaIdx = start
      break
    }
    start += step
    eachNum--
  }
  return quotaIdx
}

function getLineTextQuotaBetweenString(
  document: TextDocument,
  position: Position,
  range: Range
) {
  const textLine = document.lineAt(position.line)
  const hoverRowText = textLine.text

  const leftQuotaIndex = findQuota(
    hoverRowText,
    range.start.character + 1,
    range.start.character,
    -1
  )
  if (leftQuotaIndex === -1) {
    return
  }
  const rightQuotaIndex = findQuota(
    hoverRowText,
    hoverRowText.length - range.end.character,
    range.end.character,
    1
  )
  if (rightQuotaIndex === -1) {
    return
  }

  return hoverRowText.slice(leftQuotaIndex + 1, rightQuotaIndex)
}

export class HoverTip implements HoverProvider {
  provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Hover> {
    const filepath = document.uri.fsPath
    const wsFolderPath = getWorkspaceFolderPathByPath(filepath)
    if (!wsFolderPath) {
      logger.error('Failed to find workspace folder')
      return
    }

    const range = document.getWordRangeAtPosition(position)
    if (!range) {
      return
    }
    const hoverWord = document.getText(range)
    if (!hoverWord) {
      return
    }

    const fullPkgPath = getLineTextQuotaBetweenString(document, position, range)

    // 排除相对和绝对路径导入语句
    if (!fullPkgPath || fullPkgPath[0] === '.' || fullPkgPath[0] === '/') {
      return
    }

    let packageName = fullPkgPath
    const slashIndex = packageName.indexOf('/')
    if (slashIndex !== -1) {
      const isScopePkg = packageName.startsWith('@')
      if (isScopePkg) {
        const secondSlashIndex = fullPkgPath.indexOf('/', slashIndex + 1)
        if (secondSlashIndex !== -1) {
          packageName = packageName.slice(0, secondSlashIndex)
        }
      } else {
        packageName = packageName.slice(0, slashIndex)
      }
    }

    if (!validate(packageName).validForOldPackages) {
      return
    }

    logger.debug(`----------- Emit PackageName Hover Tip -----------`)

    const { jscode, positionOffset } =
      this.getJsCodeAndPositionOffset(document, position) || {}
    if (!(jscode && positionOffset)) {
      return
    }
    let startTime = performance.now()
    const ast = this.parseJs(jscode, document, position)
    if (!ast) {
      return
    }
    logger.debug(`Parse JsCode Time: ${performance.now() - startTime}`)

    if (!this.positionIsImported(positionOffset, ast)) {
      logger.debug(`Not Import`)
      return
    }

    logger.debug(`Matched Package Name: "${packageName}"`)

    return new Promise(async (resolve, reject) => {
      try {
        const packageInstalledPath = await findPackagePath(
          packageName,
          document.uri.path,
          wsFolderPath
        )
        let packageVersionRange: string | undefined
        if (packageInstalledPath) {
          logger.debug(`FindPackageInstalledPath: "${packageInstalledPath}"`)
        } else {
          logger.debug(`[NotFindPackageInstalledPath]`)
          const rootPkgJsonPath = join(wsFolderPath, PACKAGE_JSON)
          const rootDirPkgJson = await parseJsonFile(rootPkgJsonPath)
          packageVersionRange = getPkgVersionFromPkgJson(
            packageName,
            rootDirPkgJson
          )
        }

        startTime = performance.now()
        const packageInfo = await getPackageInfo(packageName, {
          packageInstalledPath,
          searchVersionRange: packageVersionRange,
          fetchBundleSize: configs.hovers.pkgName.bundleSize,
          token,
          skipBuiltinModuleCheck: !!packageVersionRange, // 如果pkgJson的deps字段中存在packageName，那么就认为不是使用node内置模块
        })
        if (packageInfo) {
          logger.debug(
            `Get "${packageName}" PackageInfo Time: ${
              performance.now() - startTime
            }`
          )
          const pkgHoverContentsCreator = getPkgHoverContentsCreator()
          const hoverContents = pkgHoverContentsCreator.generate(packageInfo)
          resolve(new Hover(hoverContents))
        } else {
          logger.debug(`Get "${packageName}" PackageInfo Failure`)
          reject()
        }
      } catch (err: any) {
        reject()
        const isErrMsg = typeof err === 'string'
        isErrMsg ? logger.error(err) : logger.error('', err)
      }
    })
  }

  getJsCodeAndPositionOffset(document: TextDocument, position: Position) {
    let jscode = document.getText()
    let positionOffset = document.offsetAt(position)

    if (document.languageId === 'vue') {
      const startScriptIdx = jscode.indexOf('<script')
      const endScriptIdx = jscode.lastIndexOf('</script')

      if (startScriptIdx !== -1 && endScriptIdx !== -1) {
        const startScriptLabelRegex = /<script.*?>/
        let scriptRangeCode = jscode.slice(startScriptIdx, endScriptIdx)
        positionOffset -= startScriptIdx // 同步offset与code的关系
        const matchFullStartScriptLabel = scriptRangeCode.match(
          startScriptLabelRegex
        )
        if (matchFullStartScriptLabel) {
          scriptRangeCode = scriptRangeCode.slice(
            matchFullStartScriptLabel[0].length
          )
          positionOffset -= matchFullStartScriptLabel[0].length
          jscode = scriptRangeCode
        } else {
          logger.error('match vue <script> error')
          return
        }
      } else {
        logger.error('not found <script>')
        return
      }
    }

    return {
      jscode,
      positionOffset,
    }
  }

  astCache = new TTLCache<
    string,
    { ast: BabelAst | undefined; integrity: string; isUpperPart: boolean }
  >({ ttl: 1000 * 60 * 10 })
  parseJs(jscode: string, document: TextDocument, position: Position) {
    const filepath = document.uri.fsPath
    let cacheValue = this.astCache.get(filepath)

    const nextLinePosition = new Position(position.line + 1, 0)
    const nextLineoffset = document.offsetAt(nextLinePosition)
    let upperPartText = jscode.slice(0, nextLineoffset)

    let latestIntegrity: string = cacheValue
        ? cacheValue.isUpperPart
          ? SHA512(upperPartText).toString()
          : SHA512(jscode).toString()
        : '',
      isUpperPart = false

    if (!cacheValue || latestIntegrity !== cacheValue.integrity) {
      let newAst

      const parserOptions: ParserOptions = {
        sourceType: 'module',
        ranges: false,
        startLine: 0, // position.line的起始行号为0，保持一致
        errorRecovery: true, // 兼容部分 upperPartText 存在截取错误情况
        plugins: ['typescript'],
      }

      try {
        newAst = parse(upperPartText, parserOptions)
        isUpperPart = true
      } catch (err) {
        try {
          // 如果使用upperPartText优化，当遇到代码中非顶层的动态import或require的情况会很容易导致paser解析失败！
          // 尝试对整个code生成ast 或者 可以考虑不支持非顶层的动态import或require提示。
          newAst = parse(jscode, parserOptions)
          isUpperPart = false
          cacheValue?.isUpperPart &&
            (latestIntegrity = SHA512(jscode).toString())
        } catch (err: any) {
          logger.error('Parse JsCode Error', err)
          return
        }
      }

      this.astCache.set(
        filepath,
        (cacheValue = {
          ast: newAst,
          integrity: latestIntegrity,
          isUpperPart,
        })
      )
    }

    return cacheValue.ast
  }

  positionIsImported(positionOffset: number, ast: BabelAst) {
    let isImportPkg = false
    try {
      // 正则匹配，可能存在想不到的情况，暂时不考虑，例如: code = "import a from 'xxx'" // 一个包含import的字符串
      // const pkgname = 'xxx'
      // const pkgnameRegex = new RegExp(`['"]${pkgname}['"]`).source
      // const import_export_from_Regex = new RegExp(`(?:import|export)[^'";]+from\\s*${pkgnameRegex}`)
      // const onlyImportRegex = new RegExp(`import\\s*${pkgnameRegex}`)
      // const dynamic_import_require_Regex = new RegExp(`(?:import|require)\\s*\\(\\s*${pkgnameRegex}\\s*\\)`)
      // const finalImportRegex = new RegExp(`${import_export_from_Regex.source}|${onlyImportRegex.source}|${dynamic_import_require_Regex.source}`)

      // 检查是否以下导入import、export、require()、import()
      traverse(ast, {
        CallExpression(path) {
          const { callee, arguments: arguments_ } = path.node
          if (
            ((isIdentifier(callee) && callee.name === 'require') ||
              isImport(callee)) &&
            arguments_.length === 1
          ) {
            const arg1 = arguments_[0]
            if (isStringLiteral(arg1) && inRange(arg1, positionOffset)) {
              isImportPkg = true
              path.stop()
            }
          }
        },
        ImportDeclaration(path) {
          const { source } = path.node
          if (inRange(source, positionOffset)) {
            isImportPkg = true
            path.stop()
          }
        },
        ExportNamedDeclaration(path) {
          const { source } = path.node
          if (isStringLiteral(source) && inRange(source, positionOffset)) {
            isImportPkg = true
            path.stop()
          }
        },
        TSImportEqualsDeclaration(path) {
          if (
            isTSExternalModuleReference(path.node.moduleReference) &&
            inRange(path.node.moduleReference.expression, positionOffset)
          ) {
            isImportPkg = true
            path.stop()
          }
        },
      })
    } catch (err: any) {
      logger.error(err)
    }

    return isImportPkg
  }
}

export default function (context: ExtensionContext) {
  context.subscriptions.push(
    languages.registerHoverProvider(
      ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'vue'],
      new HoverTip()
    )
  )
}
