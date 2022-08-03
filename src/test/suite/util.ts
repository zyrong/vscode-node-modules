import chai, { expect } from 'chai';
import chaiJestSnapshot from 'chai-jest-snapshot';
import { Position, workspace } from 'vscode';

chai.use(chaiJestSnapshot);

const snapShotIndexMap: Record<string, Record<string, number>> = {};
function matchSnapshot(val: any, snapFilePath: string, mochaCtx: Mocha.Context) {
  const snapShotName = `${mochaCtx.test?.parent?.title} ${mochaCtx.test?.title}`;
  if (!snapShotIndexMap[snapFilePath]) {
    snapShotIndexMap[snapFilePath] = {};
  }
  if (!snapShotIndexMap[snapFilePath][snapShotName]) {
    snapShotIndexMap[snapFilePath][snapShotName] = 1;
  }
  expect(val).to.matchSnapshot(snapFilePath, `${snapShotName} ${snapShotIndexMap[snapFilePath][snapShotName]++}`);
}

function getWorkSpacePath() {
  const workspaceFolders = workspace.workspaceFolders;
  return workspaceFolders![0].uri.fsPath;
}

function sleep(timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => { resolve(); }, timeout);
  });
}

function getWordPosition(text: string, word: string, startLine = 0): Position {
  let line = -1, character = -1;
  const textLines = text.split('\n');
  textLines.find((textLine, index) => {
    const idx = textLine.indexOf(word);
    if (idx !== -1) {
      character = idx;
      line = index;
      return true;
    }
    return false;
  });

  return new Position(line === -1 ? line : (line + startLine), character);
}

export { getWordPosition, getWorkSpacePath, matchSnapshot, sleep };
