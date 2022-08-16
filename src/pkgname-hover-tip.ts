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
import hostedGitInfo from 'hosted-git-info'
import isBuiltinModule from 'is-builtin-module'
import { join } from 'path'
import { performance } from 'perf_hooks'
import validate from 'validate-npm-package-name'
import {
  CancellationToken,
  env,
  ExtensionContext,
  Hover,
  HoverProvider,
  languages,
  MarkdownString,
  Position,
  ProviderResult,
  Range,
  TextDocument,
  Uri,
} from 'vscode'

import { logger } from './extension'
import { PACKAGE_JSON } from './types'
import { trimLeftSlash } from './utils'
import {
  findPkgPath,
  getPackageInfo,
  getPkgJsonInfo,
  PackageInfo,
} from './utils/pkg'
import { getFileInProjectRootDir } from './vs-utils'
import { forMatSize } from './vs-utils/util'

type BabelAst = ParseResult<import('@babel/types').File>

function inRange(
  range: { start?: number | null; end?: number | null },
  val: number
) {
  return range.start && range.end && val >= range.start && val <= range.end
}

function getSpaceString(num: number) {
  let result = ''
  while (--num >= 0) {
    result += '&nbsp;'
  }
  return result
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
    const rootDir = getFileInProjectRootDir(filepath)
    if (!rootDir) {
      logger.error('Failed to find project root directory')
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

    // 排除相对路径
    if (!fullPkgPath || fullPkgPath[0] === '.') {
      return
    }

    const pkgNameMatch = fullPkgPath.match(/((?:@.+?\/)?[^@/]+)/)
    if (!pkgNameMatch) {
      logger.error('pkgname match error')
      return
    }
    const pkgName = pkgNameMatch[1]

    if (!validate(pkgName).validForOldPackages) {
      return
    }

    logger.debug(`----------- Emit PkgName Hover Tip -----------`)

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

    logger.debug(`Matched Package Name: "${pkgName}"`)

    return new Promise(async (resolve, reject) => {
      const isNodeBuiltinModule = isBuiltinModule(pkgName)
      let contents: MarkdownString | undefined
      if (isNodeBuiltinModule) {
        logger.debug(`[isNodeBuiltinModule]`)
        contents = this.generateTipMarkdown(pkgName, true)
      } else {
        let pkgJsonPath: string | undefined
        const pkgPath = findPkgPath(pkgName, document.uri.path, rootDir)
        if (pkgPath) {
          pkgJsonPath = join(pkgPath, PACKAGE_JSON)
          logger.debug(`FindLocalPackagePath: "${pkgPath}"`)
        } else {
          logger.debug(`[NotFindLocalPackagePath]`)
        }
        startTime = performance.now()
        const pkgJson = await (!token.isCancellationRequested &&
          getPkgJsonInfo(pkgName, pkgJsonPath, rootDir))
        if (pkgJson) {
          logger.debug(
            `Get "${pkgName}" PackageJsonInfo Time: ${
              performance.now() - startTime
            }`
          )
          startTime = performance.now()
          const pkgInfo = await (!token.isCancellationRequested &&
            getPackageInfo(pkgJson))
          if (pkgInfo) {
            logger.debug(
              `Get "${pkgName}" PackageInfo Time: ${
                performance.now() - startTime
              }`
            )
            contents = this.generateTipMarkdown(pkgName, pkgInfo, pkgJsonPath)
          } else {
            logger.debug(`Get "${pkgName}" PackageInfo Failure`)
          }
        } else {
          logger.debug(`Get "${pkgName}" PackageJsonInfo Failure`)
        }
      }
      contents ? resolve(new Hover(contents)) : reject()
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
    { ast: BabelAst | undefined; integrity: string }
  >({ ttl: 1000 * 60 * 10 })
  parseJs(jscode: string, document: TextDocument, position: Position) {
    const filepath = document.uri.fsPath
    let cacheValue = this.astCache.get(filepath)
    const latestIntegrity = SHA512(jscode).toString()

    if (!cacheValue || latestIntegrity !== cacheValue.integrity) {
      let newAst

      const nextLinePosition = new Position(position.line + 1, 0)
      const nextLineoffset = document.offsetAt(nextLinePosition)

      let upperPartText = jscode.slice(0, nextLineoffset)

      const parserOptions: ParserOptions = {
        sourceType: 'module',
        ranges: false,
        startLine: 0, // position.line的起始行号为0，保持一致
        errorRecovery: true, // 兼容部分 upperPartText 存在截取错误情况
        plugins: ['typescript'],
      }

      try {
        newAst = parse(upperPartText, parserOptions)
      } catch (err) {
        try {
          // 如果使用upperPartText优化，当遇到代码中非顶层的动态import或require的情况会很容易导致paser解析失败！
          // 尝试对整个code生成ast 或者 可以考虑不支持非顶层的动态import或require提示。
          newAst = parse(jscode, parserOptions)
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

  generateTipMarkdown(
    pkgName: string,
    isNodeBuiltinModule: true
  ): MarkdownString
  generateTipMarkdown(
    pkgName: string,
    packageInfo: PackageInfo,
    pkgJsonPath: string | undefined
  ): MarkdownString
  generateTipMarkdown(
    pkgName: string,
    arg: true | PackageInfo,
    pkgJsonPath?: string | undefined
  ): MarkdownString {
    let isNodeBuiltinModule = false
    let markdown = '',
      homepageUrl: string | undefined,
      repositoryUrl: string | undefined,
      pkgVersion = '',
      sizeInfo = ''
    if (typeof arg === 'boolean') {
      homepageUrl = `https://nodejs.org/${env.language}/`
      repositoryUrl = 'https://github.com/nodejs/node'
      isNodeBuiltinModule = true
    } else {
      const packageInfo = arg
      pkgVersion = packageInfo.version
      homepageUrl = packageInfo.homepageUrl
      repositoryUrl = packageInfo.repositoryUrl

      function extractGitUrl(url: string) {
        let result: string | undefined
        if (/^https?:\/\/.*/i.test(url)) {
          result = url
        } else {
          const gitInfo = hostedGitInfo.fromUrl(trimLeftSlash(url))
          if (gitInfo) {
            result = gitInfo.https({ noGitPlus: true, noCommittish: true })
          }
        }
        result && (result = result.replace(/\.git$/, ''))
        return result
      }

      if (repositoryUrl) {
        repositoryUrl = extractGitUrl(repositoryUrl)
      }
      if (!repositoryUrl && packageInfo.bugsUrl) {
        let bugsUrl = packageInfo.bugsUrl
        const idx = bugsUrl.indexOf('/issues')
        if (idx !== -1) {
          bugsUrl = bugsUrl.slice(0, idx)
        }
        repositoryUrl = extractGitUrl(bugsUrl)
      }

      if (repositoryUrl === homepageUrl) {
        homepageUrl = undefined
      }

      if (packageInfo.webpackBundleSize) {
        sizeInfo = `BundleSize:${getSpaceString(3)}${forMatSize(
          packageInfo.webpackBundleSize.normal
        )}${getSpaceString(3)}(gzip:${getSpaceString(1)}${forMatSize(
          packageInfo.webpackBundleSize.gzip
        )})`
      }
    }

    let pkgnameMarkdown = ''
    if (isNodeBuiltinModule) {
      pkgnameMarkdown = `\`${pkgName}\``
    } else {
      pkgnameMarkdown = `\`${pkgName}${pkgVersion ? '@' + pkgVersion : ''}\``
      if (pkgJsonPath) {
        // command uri: https://liiked.github.io/VS-Code-Extension-Doc-ZH/#/extension-guides/command?id=%e5%91%bd%e4%bb%a4%e7%9a%84urls
        const showTextDocumentCmdUri = Uri.parse(
          `command:extension.show.textDocument?${encodeURIComponent(
            `"${pkgJsonPath}"`
          )}`
        )
        pkgnameMarkdown = `[${pkgnameMarkdown}](${showTextDocumentCmdUri})`
      }
    }
    markdown += `<span style="color:#569CD6;">${pkgnameMarkdown}</span>${getSpaceString(
      2
    )}`
    if (!isNodeBuiltinModule) {
      markdown += `[NPM](https://www.npmjs.com/package/${pkgName}${
        pkgVersion ? '/v/' + pkgVersion : ''
      })${getSpaceString(4)}`
    }
    if (homepageUrl) {
      markdown += `[HomePage](${homepageUrl})${getSpaceString(4)}`
    }
    if (repositoryUrl) {
      markdown += `[Repository](${repositoryUrl})${getSpaceString(4)}`
    }
    if (sizeInfo) {
      markdown += `<br/>${sizeInfo}`
    }
    const contents = new MarkdownString(markdown)
    contents.isTrusted = true
    contents.supportHtml = true
    return contents
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
