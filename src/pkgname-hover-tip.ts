import {
  TextDocument,
  Position,
  CancellationToken,
  Definition,
  LocationLink,
  ExtensionContext,
  languages,
  window,
  HoverProvider,
  Hover,
  MarkdownString,
  ProviderResult,
  Uri,
  env,
  CancellationTokenSource,
  workspace,
  Range
} from "vscode";
import { parse, ParserOptions } from '@babel/parser';
import traverse from "@babel/traverse";
import { isIdentifier, isImport, isStringLiteral, isTSExternalModuleReference } from '@babel/types';
import { error, isRecord } from "./utils";
import { getFileInProjectRootDir, } from './vs-utils';
import { findPkgPath } from './utils/pkg';
import { dirname, join } from "path";
import { PACKAGE_JSON } from "./types";
import { readFile } from 'fs/promises';
import isBuiltinModule from 'is-builtin-module';
import validate from 'validate-npm-package-name';


function inRange(range: { start?: number | null, end?: number | null }, val: number) {
  return range.start && range.end && val >= range.start && val <= range.end;
}

const URL_Regex = /https?:\/\/.*/i;
function extractUrl(str: any) {
  if (typeof str !== 'string') { return ''; };
  const match = str.match(URL_Regex);
  if (match) {
    return match[0];
  }
  return '';
}

function getSpaceString(num: number) {
  let result = '';
  while (--num >= 0) {
    result += '&nbsp;';
  }
  return result;
}

function findQuota(text: string, eachNum: number, start: number, step: number) {
  const quotas = new Set(["'", '"']);
  let quotaIdx = -1;
  // 查找距离hover最近的/'|"/
  while (eachNum > 0) {
    const char = text[start];
    if (quotas.has(char)) {
      quotaIdx = start;
      break;
    }
    start += step;
    eachNum--;
  }
  return quotaIdx;
}

function getLineTextQuotaBetweenString(document: TextDocument, position: Position, range: Range) {
  const textLine = document.lineAt(position.line);
  const hoverRowText = textLine.text;

  const leftQuotaIndex = findQuota(hoverRowText, range.start.character + 1, range.start.character, -1);
  if (leftQuotaIndex === -1) { return; };
  const rightQuotaIndex = findQuota(hoverRowText, hoverRowText.length - range.end.character, range.end.character, 1);
  if (rightQuotaIndex === -1) { return; };

  return hoverRowText.slice(leftQuotaIndex + 1, rightQuotaIndex);
}



export class HoverTip implements HoverProvider {
  provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Hover> {
    const range = document.getWordRangeAtPosition(position);
    if (!range) { return; };
    const hoverWord = document.getText(range);
    if (!hoverWord) { return; };

    const fullPkgPath = getLineTextQuotaBetweenString(document, position, range);

    // 排除相对路径
    if (!fullPkgPath || fullPkgPath[0] === '.') { return; };

    const pkgNameMatch = fullPkgPath.match(/((?:@.+?\/)?[^@/]+)/);
    if (!pkgNameMatch) { error('pkgname match error'); return; }
    const pkgName = pkgNameMatch[1];

    if (!validate(pkgName).validForOldPackages) {
      return;
    }


    const nextLinePosition = new Position(position.line + 1, 0);
    const nextLineoffset = document.offsetAt(nextLinePosition);
    let jscode = document.getText();

    let offset = document.offsetAt(position);
    if (document.languageId === 'vue') {
      const startScriptIdx = jscode.indexOf('<script');
      const endScriptIdx = jscode.lastIndexOf('</script');

      if (startScriptIdx !== -1 && endScriptIdx !== -1) {
        const startScriptLabelRegex = /<script.*?>/;
        let scriptRangeCode = jscode.slice(startScriptIdx, endScriptIdx);
        offset -= startScriptIdx; // 同步offset与code的关系
        const matchFullStartScriptLabel = scriptRangeCode.match(startScriptLabelRegex);
        if (matchFullStartScriptLabel) {
          scriptRangeCode = scriptRangeCode.slice(matchFullStartScriptLabel[0].length);
          offset -= matchFullStartScriptLabel[0].length;
          jscode = scriptRangeCode;
        } else {
          error('match vue <script> error');
          return;
        }
      } else {
        error('not found <script>');
        return;
      }
    }
    let upperPartText = jscode.slice(0, nextLineoffset);


    // 正则匹配，可能存在想不到的情况，暂时不考虑，例如: code = "import a from 'xxx'" // 一个包含import的字符串
    // const pkgname = 'xxx'
    // const pkgnameRegex = new RegExp(`['"]${pkgname}['"]`).source
    // const import_export_from_Regex = new RegExp(`(?:import|export)[^'";]+from\\s*${pkgnameRegex}`)
    // const onlyImportRegex = new RegExp(`import\\s*${pkgnameRegex}`)
    // const dynamic_import_require_Regex = new RegExp(`(?:import|require)\\s*\\(\\s*${pkgnameRegex}\\s*\\)`)
    // const finalImportRegex = new RegExp(`${import_export_from_Regex.source}|${onlyImportRegex.source}|${dynamic_import_require_Regex.source}`)


    // 检查是否以下导入import、export、require()、import()
    let isImportPkg = false;

    try {
      let ast;
      const parserOptions: ParserOptions = {
        sourceType: 'module',
        ranges: false,
        startLine: 0, // position.line的起始行号为0，保持一致
        errorRecovery: true, // 兼容部分 upperPartText 存在截取错误情况
        plugins: ['typescript']
      };
      try {
        ast = parse(upperPartText, parserOptions);
      } catch (err) {
        try {
          // 如果使用upperPartText优化，当遇到代码中非顶层的动态import或require的情况会很容易导致paser解析失败！
          // 尝试对整个code生成ast 或者 可以考虑不支持非顶层的动态import或require提示。
          ast = parse(jscode, parserOptions);
        } catch (err: any) {
          error(err);
          return;
        }
      }

      traverse(ast, {
        CallExpression(path) {
          const { callee, arguments: arguments_ } = path.node;
          if ((isIdentifier(callee) && (callee.name === 'require') || isImport(callee)) && arguments_.length === 1) {
            const arg1 = arguments_[0];
            if (isStringLiteral(arg1) && inRange(arg1, offset)) {
              isImportPkg = true;
              path.stop();
            }
          }
        },
        ImportDeclaration(path) {
          const { source } = path.node;
          if (inRange(source, offset)) {
            isImportPkg = true;
            path.stop();
          }
        },
        ExportNamedDeclaration(path) {
          const { source } = path.node;
          if (isStringLiteral(source) && inRange(source, offset)) {
            isImportPkg = true;
            path.stop();
          }
        },
        TSImportEqualsDeclaration(path) {
          if (isTSExternalModuleReference(path.node.moduleReference) && inRange(path.node.moduleReference.expression, offset)) {
            isImportPkg = true;
            path.stop();
          }
        }
      });
    } catch (err: any) {
      error(err);
      return;
    }

    if (!isImportPkg) { return; };

    const rootDir = getFileInProjectRootDir(document.uri.path);
    if (!rootDir) {
      error("寻找项目根目录失败");
      return;
    }

    return new Promise(async (resolve, reject) => {
      let markdown,
        homepageUrl = '', repositoryUrl = '';
      if (isBuiltinModule(pkgName)) {
        homepageUrl = `https://nodejs.org/${env.language}/`;
        repositoryUrl = 'https://github.com/nodejs/node';
      } else {
        const pkgPath = findPkgPath(pkgName, document.uri.path, rootDir);
        if (pkgPath) {
          const pkgJsonBuffer = await readFile(join(pkgPath, PACKAGE_JSON));
          const pkgJson = JSON.parse(pkgJsonBuffer.toString());
          if (isRecord(pkgJson)) {
            homepageUrl = extractUrl(pkgJson.homepage);

            if (typeof pkgJson.repository === 'string') {
              repositoryUrl = pkgJson.repository;
            } else if (isRecord(pkgJson.repository) && typeof pkgJson.repository.url === 'string') {
              repositoryUrl = pkgJson.repository.url;
            }
            if (repositoryUrl) {
              const matchResult = extractUrl(repositoryUrl);
              if (matchResult) {
                repositoryUrl = matchResult;
              } else {
                repositoryUrl = 'https://github.com/' + repositoryUrl.replace(/^(\s|\/)*/, '');
              }
            }else{
              let bugsUrl = '';
              if (typeof pkgJson.bugs === 'string') {
                bugsUrl = pkgJson.bugs;
              } else if (isRecord(pkgJson.bugs) && typeof pkgJson.bugs.url === 'string') {
                bugsUrl = pkgJson.bugs.url;
              }
              let url = extractUrl(bugsUrl);
              const idx = url.indexOf('/issues');
              if (idx !== -1) {
                url = url.slice(0, idx);
              }
              repositoryUrl = url;
            }
          }

        } else {
          // 该包可能未安装
        }
      }

      // command uri: https://liiked.github.io/VS-Code-Extension-Doc-ZH/#/extension-guides/command?id=%e5%91%bd%e4%bb%a4%e7%9a%84urls
      markdown = `<span style="color:#569CD6;">${pkgName}</span>${getSpaceString(2)}`;
      markdown += `[NPM](https://www.npmjs.com/package/${pkgName})`;
      if (homepageUrl) {
        markdown += `[HomePage](${homepageUrl})${getSpaceString(4)}`;
      }
      if (repositoryUrl) {
        markdown += `[Repository](${repositoryUrl})${getSpaceString(4)}`;
      }

      const contents = new MarkdownString(markdown);
      contents.isTrusted = true;
      contents.supportHtml = true;
      resolve(new Hover(contents));
    });
  }
}

export default function (context: ExtensionContext) {
  context.subscriptions.push(
    languages.registerHoverProvider(
      ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'vue'],
      new HoverTip
    )
  );
}