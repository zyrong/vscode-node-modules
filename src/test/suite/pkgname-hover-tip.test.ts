import fs from 'fs';
import path from 'path';
import { workspace, window, Range, Position, MarkdownString, Uri, Hover } from 'vscode';
import { HoverTip } from '../../pkgname-hover-tip';
import { getWorkSpacePath, getWordPosition, matchSnapshot } from './util';
import { expect } from "chai";
import { Test } from 'mocha';

const hoverTip = new HoverTip();


function getTestCasePackageNamePosition(code: string, testCaseFlag: string) {
  const startIndex = code.indexOf(testCaseFlag);
  const newCode = code.slice(startIndex + testCaseFlag.length);
  const position = getWordPosition(newCode, 'lodash', code.slice(0, startIndex).split('\n').length - 1);
  return position;
}


suite('pkgjson-dep-jump-nm Test', async function () {
  const WorkspacePath = getWorkSpacePath();
  const snapshotsPATH = path.resolve(WorkspacePath, '__snapshots__');
  function _matchSnapshot(hover: Hover, mochaCtx: Mocha.Context) {
    matchSnapshot((hover.contents as MarkdownString[])[0].value, `${snapshotsPATH}/${path.basename(mochaCtx.test?.file!, '.js')}.ts.snap`, mochaCtx);
  }

  (async function (this: Mocha.Suite){
    function error(flag: string): never {
      throw new Error(`[${flag}]: create hover tip error`);
    }
    const documentPath = path.resolve(WorkspacePath, 'hover-tip-test.ts');
    const document = await workspace.openTextDocument(documentPath);
    const code = document.getText();
    ['@test:import', '@test:export', '@test:require', '@test:inside-block-require'].forEach((testCaseFlag) => {
      const test = new Test(testCaseFlag.slice(1), async function (this: Mocha.Context) {
        const position = getTestCasePackageNamePosition(code, testCaseFlag);
        const hoverPromise = hoverTip.provideHover(document, position, {} as any);
        if (!hoverPromise) { error(testCaseFlag); }
        const hover = await hoverPromise;
        if (!hover) { error(testCaseFlag); };
        if (!(Array.isArray(hover.contents) && hover.contents.length)) {
          error(testCaseFlag);
        }
        _matchSnapshot(hover, this);
      });
      test.file = this.file;
      this.addTest(test);
    });
  }).call(this);

  test("test:not-hover-tip", async function () {
    const documentPath = path.resolve(WorkspacePath, 'hover-tip-test.ts');
    const document = await workspace.openTextDocument(documentPath);

    const code = document.getText();
    const position = getTestCasePackageNamePosition(code, '@test:not-hover-tip');
    const hoverPromise = hoverTip.provideHover(document, position, {} as any);
    if (hoverPromise) { throw new Error('Expected to be undefined'); }
  });

  test("vue test", async function () {
    function error(): never {
      throw new Error(`create hover tip error`);
    }
    const documentPath = path.resolve(WorkspacePath, 'hover-tip-test.vue');
    const document = await workspace.openTextDocument(Uri.file(documentPath));
    const proxyDocument = new Proxy(document, {
      get(target, property, receiver) {
        if (property === 'languageId') {
          return 'vue';
        } else {
          return Reflect.get(target, property, receiver);
        }
      }
    });
    const code = proxyDocument.getText();
    const position = getWordPosition(code, 'lodash');
    const hoverPromise = hoverTip.provideHover(proxyDocument, position, {} as any);
    if (!hoverPromise) { error(); }
    const hover = await hoverPromise;
    if (!hover) { error(); };

    if (!(Array.isArray(hover.contents) && hover.contents.length)) {
      error();
    }

    _matchSnapshot(hover, this);
  });
});
