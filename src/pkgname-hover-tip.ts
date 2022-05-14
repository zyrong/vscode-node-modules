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
  workspace
} from "vscode";
import { parse } from '@babel/parser';
import traverse from "@babel/traverse";
import { isIdentifier, isStringLiteral, isTSExternalModuleReference } from '@babel/types';
import { error, getFileInProjectRootDir, getPkgPath } from "./utils";
import { dirname, join } from "path";
import { PACKAGE_JSON } from "./types";
import { readFile } from 'fs/promises';
import * as isBuiltinModule from 'is-builtin-module';

function inRange(range: { start: number | null, end: number | null }, val: number) {
  return range.start && range.end && val >= range.start && val <= range.end;
}

const URL_Regex = /https?:\/\/.*/i;
function matchUrl(str: string) {
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

class HoverTip implements HoverProvider {
  provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Hover> {
    const range = document.getWordRangeAtPosition(position);
    const hoverWord = document.getText(range);
    if (!hoverWord) { return; };

    const textLine = document.lineAt(position.line);
    const hoverRowText = textLine.text;
    let fullPkgPathRegex;
    try {
      fullPkgPathRegex = new RegExp(`['"]([^'"\`\\s~!();*]*${hoverWord}[^'"\`\\s~!();*]*)['"]`);
    } catch (err: any) {
      error(err);
      return;
    }
    const match = hoverRowText.match(fullPkgPathRegex);

    // 排除不符合pkgname的字符串
    if (!match) { return; }

    const fullPkgPath = match[1];

    // 排除相对路径
    if (fullPkgPath[0] === '.') { return; };


    const nextLinePosition = new Position(position.line + 1, 0);
    const nextLineoffset = document.offsetAt(nextLinePosition);
    const text = document.getText();
    let upperPartText = text.slice(0, nextLineoffset);
    let offset = document.offsetAt(position);

    if (document.languageId === 'vue') {
      const idx = upperPartText.indexOf('<script');
      if (idx !== -1) {
        const scriptLabelRegex = /<script.*?>/;
        const scriptText = upperPartText.slice(idx);
        offset -= idx;
        const match = scriptText.match(scriptLabelRegex);
        if (match) {
          upperPartText = scriptText.slice(match[0].length);
          offset -= match[0].length;
        } else {
          error('match vue <script> error');
        }
      } else {
        error('not found <script>');
      }
    }


    // 正则匹配，可能存在想不到的情况，暂时不考虑，例如: code = "import a from 'xxx'" // 一个包含import的字符串
    // const pkgname = 'xxx'
    // const pkgnameRegex = new RegExp(`['"]${pkgname}['"]`).source
    // const import_export_from_Regex = new RegExp(`(?:import|export)[^'";]+from\\s*${pkgnameRegex}`)
    // const onlyImportRegex = new RegExp(`import\\s*${pkgnameRegex}`)
    // const requireRegex = new RegExp(`require\\s*\\(\\s*${pkgnameRegex}\\s*\\)`)
    // const finalImportRegex = new RegExp(`${import_export_from_Regex.source}|${onlyImportRegex.source}|${requireRegex.source}`)


    // 检查是否以下导入import、export、require()
    let isImport = false;

    let ast;
    try {
      ast = parse(upperPartText, {
        sourceType: 'module',
        ranges: false,
        startLine: 0, // position.line的起始行号为0，保持一致
        errorRecovery: true, // 兼容 upperPartText 存在截取错误情况
        plugins: ['typescript']
      });
    } catch (err: any) {
      error(err);
      return;
    }


    traverse(ast, {
      CallExpression(path) {
        if (isImport) { return; };
        const { callee, arguments: arguments_ } = path.node;
        if (isIdentifier(callee) && callee.name === 'require' && arguments_.length === 1) {
          const arg1 = arguments_[0];

          if (isStringLiteral(arg1) && inRange(arg1, offset)) {
            isImport = true;
          }
        }
      },
      ImportDeclaration(path) {
        if (isImport) { return; };
        const { source } = path.node;
        if (inRange(source, offset)) {
          isImport = true;
        }
      },
      ExportNamedDeclaration(path) {
        if (isImport) { return; };
        const { source } = path.node;
        if (isStringLiteral(source) && inRange(source, offset)) {
          isImport = true;
        }
      },
      TSImportEqualsDeclaration(path) {
        if (isImport) { return; };
        if (isTSExternalModuleReference(path.node.moduleReference) && inRange(path.node.moduleReference.expression, offset)) {
          isImport = true;
        }
      }
    });

    if (!isImport) { return; };


    const pkgNameMatch = fullPkgPath.match(/((?:@.+?\/)?[^@/]+)/);
    if (!pkgNameMatch) { error('pkgname match error'); return; }
    const pkgName = pkgNameMatch[1];

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
        const pkgPath = getPkgPath(pkgName, document.uri.path, rootDir);
        if (pkgPath) {
          const pkgJsonBuffer = await readFile(join(pkgPath, PACKAGE_JSON));
          const pkgJson = JSON.parse(pkgJsonBuffer.toString());

          if (pkgJson.homepage) {
            homepageUrl = matchUrl(pkgJson.homepage);
          }
          if (pkgJson.repository && pkgJson.repository.url) {
            repositoryUrl = matchUrl(pkgJson.repository.url);
          }
          if (!repositoryUrl && pkgJson.bugs && pkgJson.bugs.url) {
            let url = matchUrl(pkgJson.bugs.url);
            const idx = url.indexOf('/issues');
            if (idx !== -1) {
              url = url.slice(0, idx);
            }
            repositoryUrl = url;
          }
        } else {
          // 该包可能未安装
        }
      }

      // command uri: https://liiked.github.io/VS-Code-Extension-Doc-ZH/#/extension-guides/command?id=%e5%91%bd%e4%bb%a4%e7%9a%84urls
      markdown = `<span style="color:#569CD6;">${pkgName}</span>${getSpaceString(2)}`;
      if (homepageUrl) {
        markdown += `[HomePage](${homepageUrl})${getSpaceString(4)}`;
      }
      if (repositoryUrl) {
        markdown += `[Repository](${repositoryUrl})${getSpaceString(4)}`;
      }
      markdown += `[NPM](https://www.npmjs.com/package/${pkgName})`;

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