import assert from 'assert';
import path from 'path';
import { afterEach } from 'mocha';
import sinon from 'sinon';
import rimraf from 'rimraf';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { extensions, window, Uri, Range, workspace, commands, Position } from 'vscode';
import * as myExtension from '../../extension';
import { getWorkSpacePath, getWordPosition } from './util';




function closeAllEditors() {
  return commands.executeCommand('workbench.action.closeAllEditors');
}

suite('pkgjson-dep-jump-nm Test', function(){
  const WorkspacePath = getWorkSpacePath();
  const packageJsonFile = Uri.file(
    path.join(WorkspacePath, 'package.json')
  );

  afterEach(async function(){
    await closeAllEditors();
  });

  test('open json file active extension', async function () {
    const document = await workspace.openTextDocument(packageJsonFile);
    await window.showTextDocument(document, {
      selection: new Range(0, 0, 0, 0)
    });

    if (
      !extensions.getExtension('zyrong.node-modules')
    ) {
      throw new Error('Not activated extension');
    }
  });


  test('Jump', function (): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const document = await workspace.openTextDocument(packageJsonFile);
      const pkgName = '"lodash"';
      const { line, character } = getWordPosition(document.getText(), pkgName);
      if (line < 0 || character < 0) {
        throw new Error('test package.json existing problems');
      }
      await window.showTextDocument(document, {
        selection: new Range(line, character, line, character + pkgName.length)
      });

      const fail = function(){
        reject('The corresponding file was not opened correctly');
      };

      let id: NodeJS.Timeout;
      window.onDidChangeVisibleTextEditors(textEditorList => {
        const jsonText = textEditorList[0].document.getText();
        const json = JSON.parse(jsonText);
        if (json.name === 'lodash') {
          clearTimeout(id);
          resolve();
        } else {
          fail();
        }
      });


      // exec go to Definitions action
      await commands.executeCommand('editor.action.revealDefinition');

      id = setTimeout(function(){
        fail();
      }, 1000);
    });

  });

  test('Not Jump', function (): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const document = await workspace.openTextDocument(packageJsonFile);
      const pkgName = '"dependencies"';
      const { line, character } = getWordPosition(document.getText(), pkgName);
      if (line < 0 || character < 0) {
        throw new Error('test package.json existing problems');
      }
      await window.showTextDocument(document, {
        selection: new Range(line, character, line, character + pkgName.length)
      });


      let id: NodeJS.Timeout;
      window.onDidChangeVisibleTextEditors(textEditorList => {
        clearTimeout(id);
        reject('The expected result is not to open any files');
      });


      // exec go to Definitions action
      await commands.executeCommand('editor.action.revealDefinition');

      id = setTimeout(function(){
        resolve();
      }, 500);
    });

  });

  test('Not installed Package', function (): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const document = await workspace.openTextDocument(packageJsonFile);
      const pkgName = '"@types/lodash"';
      const { line, character } = getWordPosition(document.getText(), pkgName);
      if (line < 0 || character < 0) {
        throw new Error('test package.json existing problems');
      }

      await window.showTextDocument(document, {
        selection: new Range(line, character, line, character + pkgName.length)
      });

      rimraf.sync(path.resolve(WorkspacePath, 'node_modules/@types/lodash'));
      const spyShowInformationMessage = sinon.spy(window, 'showInformationMessage');
      await commands.executeCommand('editor.action.revealDefinition');
      spyShowInformationMessage.called ? resolve() : reject('No error message prompt is displayed');
      spyShowInformationMessage.restore();
    });

  });
});
