import { parse, Visitor } from '@zyrong/json-parser'
import { teardown } from 'mocha'
import path, { join } from 'path'
import sinon from 'sinon'
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import {
  commands,
  extensions,
  Range,
  TextDocument,
  Uri,
  window,
  workspace,
} from 'vscode'

import {
  DOT_PACKAGE_LOCK_JSON,
  NODE_MODULES,
  PACKAGE_JSON,
  PACKAGE_LOCK_JSON,
} from '../../../types'
import { getWorkSpacePath } from '../util'

function closeAllEditors() {
  return commands.executeCommand('workbench.action.closeAllEditors')
}
function closeActiveEditor() {
  return commands.executeCommand('workbench.action.closeActiveEditor')
}

function getPkgNameFromPath(path: string) {
  if (/^node_modules\//.test(path)) {
    path = path.slice(path.lastIndexOf(NODE_MODULES) + NODE_MODULES.length + 1)
  }
  return path
}

function checkPkgJsonDocument(
  document: TextDocument,
  pkgName: string,
  pkgPath?: string
) {
  if (~document.fileName.indexOf(pkgPath || join(pkgName, PACKAGE_JSON))) {
    const jsonText = document.getText()
    try {
      const json = JSON.parse(jsonText)
      return json.name === pkgName
    } catch (error) {
      return false
    }
  }
}

async function goToDefinition(
  document: TextDocument,
  visitor: Visitor,
  keyPath: string | string[],
  pkgName: string,
  { pkgPath, isValue }: { pkgPath?: string; isValue?: boolean } = {}
) {
  return new Promise<void>(async (resolve, reject) => {
    const node = visitor.get(keyPath)
    if (node) {
      const pkgNameRange = isValue ? node.valueRange : node.keyRange!
      const range = new Range(
        document.positionAt(pkgNameRange.start),
        document.positionAt(pkgNameRange.end)
      )
      await window.showTextDocument(document, { selection: range })
      let id: NodeJS.Timeout
      id = setTimeout(function () {
        reject(`not found keyPath: ${keyPath}`)
        disposable.dispose()
      }, 500)
      const disposable = window.onDidChangeActiveTextEditor(async (e) => {
        if (!e) {
          return
        }
        if (checkPkgJsonDocument(e.document, pkgName, pkgPath)) {
          clearTimeout(id)
          disposable.dispose()
          resolve()
        }
      })
      await commands.executeCommand('editor.action.revealDefinition')
    } else {
      reject(`keyPath error: ${keyPath}`)
    }
  })
}

function goToDefinition_expectNotOpen(
  document: TextDocument,
  visitor: Visitor,
  keyPath: string | string[],
  pkgName: string
) {
  return new Promise<void>((resolve, reject) => {
    goToDefinition(document, visitor, keyPath, pkgName).then(reject, resolve)
  })
}

const notOpenedError = function () {
  throw new Error('The corresponding file was not opened correctly')
}

suite('active extension Test', function () {
  teardown(async function () {
    await closeAllEditors()
  })

  test('open package.json file active extension', async function () {
    const WorkspacePath = getWorkSpacePath()
    const packageJsonFile = Uri.file(path.join(WorkspacePath, PACKAGE_JSON))
    const document = await workspace.openTextDocument(packageJsonFile)
    await window.showTextDocument(document, {
      selection: new Range(0, 0, 0, 0),
    })

    if (!extensions.getExtension('zyrong.node-modules')) {
      throw new Error('Not activated extension')
    }
  })
})

suite('pkgjson-dep-jump-nm package.json Test', function () {
  const WorkspacePath = getWorkSpacePath()

  teardown(async function () {
    await closeAllEditors()
  })

  let document!: TextDocument
  let visitor!: Visitor
  async function initVisitor() {
    const packageJsonFile = Uri.file(path.join(WorkspacePath, PACKAGE_JSON))
    document = await workspace.openTextDocument(packageJsonFile)
    const pkgJson = document.getText()
    const visitor_ = parse(pkgJson)
    if (!visitor_) {
      throw new Error('package.json unknown error')
    }
    visitor = visitor_
  }

  test('basic Jump', async function () {
    await initVisitor()
    const pkgName = 'basic-test'
    const needTestFieldNames = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'bundleDependencies',
      'optionalDependencies',
      'resolutions',
      'overrides',
      'dependenciesMeta',
      'peerDependenciesMeta',
    ]
    const testKeyPathList = needTestFieldNames.map((name) => {
      return name + '.' + pkgName
    })
    await testKeyPathList
      .reduce((chain, keyPath) => {
        return chain.then(() => {
          return goToDefinition(document, visitor, keyPath, pkgName)
        })
      }, Promise.resolve())
      .then(() => {
        return goToDefinition(
          document,
          visitor,
          'bundledDependencies.0',
          pkgName,
          { isValue: true }
        )
      })
  })

  test('@scope/test Jump', async function (): Promise<void> {
    await initVisitor()
    const pkgName = '@scope/test'
    await goToDefinition(document, visitor, 'dependencies.' + pkgName, pkgName)
  })

  test('Not Jump', function (): Promise<void> {
    return new Promise(async (resolve, reject) => {
      await initVisitor()

      const pkgName = 'dependencies'
      try {
        await goToDefinition_expectNotOpen(document, visitor, pkgName, pkgName)
        resolve()
      } catch (error) {
        reject('The expected result is not to open any files')
      }
    })
  })

  test('Not installed Package', async function (): Promise<void> {
    await initVisitor()
    const pkgName = 'not-install'
    const spyShowInformationMessage = sinon.spy(
      window,
      'showInformationMessage'
    )
    await goToDefinition_expectNotOpen(
      document,
      visitor,
      'dependencies.' + pkgName,
      pkgName
    )
    spyShowInformationMessage.restore()
    if (!spyShowInformationMessage.called) {
      throw new Error('No error message prompt is displayed')
    }
  })
})

suite('pkgjson-dep-jump-nm package-lock.json Test', function () {
  const WorkspacePath = getWorkSpacePath()

  teardown(async function () {
    await closeAllEditors()
  })

  let document!: TextDocument
  let visitor!: Visitor
  async function initVisitor() {
    const packageJsonFile = Uri.file(
      path.join(WorkspacePath, PACKAGE_LOCK_JSON)
    )
    document = await workspace.openTextDocument(packageJsonFile)
    const pkgJson = document.getText()
    const visitor_ = parse(pkgJson)
    if (!visitor_) {
      throw new Error('package-lock.json unknown error')
    }
    visitor = visitor_
  }

  ;[
    ['packages', '', 'dependencies', 'basic-test'],
    ['packages', '', 'devDependencies', '@scope/test'],
    ['packages', 'node_modules/@scope/test'],
    ['packages', 'node_modules/basic-test'],
    ['packages', 'node_modules/a-1'],
    ['packages', 'node_modules/a-1', 'dependencies', 'basic-test'],
    ['dependencies', 'basic-test'],
    ['dependencies', 'basic-test', 'requires', 'a-1'],
    ['dependencies', '@scope/test'],

    ['packages', 'node_modules/@scope/test', 'dependencies', 'b-1'], // b-1
    ['packages', 'node_modules/a-1', 'dependencies', 'b-1'], // a-1/b-1
    ['packages', 'node_modules/a-1/node_modules/b-1'], // a-1/b-1
    [
      'packages',
      'node_modules/a-1/node_modules/b-1',
      'dependencies',
      'basic-test',
    ],
    ['dependencies', '@scope/test', 'dependencies', 'b-1'], // b-1
    ['dependencies', 'a-1', 'dependencies', 'b-1'], // a-1/b-1
    ['dependencies', 'a-1', 'dependencies', 'b-1', 'requires', 'basic-test'],
  ]
  // 测试案例分为 校验规则: jump（可以指定路径，默认可以不指定），jump打不开
  // deep Jump

  test('basic jump', async () => {
    await initVisitor()
    const testCases = [
      ['packages', '', 'dependencies', 'basic-test'],
      ['packages', '', 'devDependencies', '@scope/test'],
      ['packages', 'node_modules/@scope/test'],
      ['packages', 'node_modules/basic-test'],
      ['packages', 'node_modules/a-1'],
      ['packages', 'node_modules/a-1', 'dependencies', 'basic-test'],
      ['dependencies', 'basic-test'],
      ['dependencies', 'basic-test', 'requires', 'a-1'],
      ['dependencies', '@scope/test'],
    ]
    await testCases.reduce((chain, keyPath) => {
      return chain.then(() => {
        return goToDefinition(
          document,
          visitor,
          keyPath,
          getPkgNameFromPath(keyPath[keyPath.length - 1])
        )
      })
    }, Promise.resolve())
  })

  test('deep Jump', async () => {
    await initVisitor()
    const testCases: Array<[string[], string]> = [
      [['packages', 'node_modules/@scope/test', 'dependencies', 'b-1'], 'b-1'],
      [
        ['packages', 'node_modules/a-1', 'dependencies', 'b-1'],
        'a-1/node_modules/b-1',
      ],
      [
        ['packages', 'node_modules/a-1/node_modules/b-1'],
        'a-1/node_modules/b-1',
      ],
      [
        [
          'packages',
          'node_modules/a-1/node_modules/b-1',
          'dependencies',
          'basic-test',
        ],
        'basic-test',
      ],
      [['dependencies', '@scope/test', 'dependencies', 'b-1'], 'b-1'],
      [['dependencies', 'a-1', 'dependencies', 'b-1'], 'a-1/node_modules/b-1'],
      [
        [
          'dependencies',
          'a-1',
          'dependencies',
          'b-1',
          'requires',
          'basic-test',
        ],
        'basic-test',
      ],
    ]
    await testCases.reduce((chain, item) => {
      return chain.then(() => {
        const [keyPath, expectPkgPath] = item
        return goToDefinition(
          document,
          visitor,
          keyPath,
          getPkgNameFromPath(keyPath[keyPath.length - 1]),
          {
            pkgPath: expectPkgPath,
          }
        )
      })
    }, Promise.resolve())
  })

  test('Not Jump', async () => {
    await initVisitor()
    const testCases = [
      ['packages', '', 'name'],
      ['packages', '', 'devDependencies'],
    ]
    await testCases.reduce((chain, keyPath) => {
      return chain.then(() => {
        return goToDefinition_expectNotOpen(
          document,
          visitor,
          keyPath,
          getPkgNameFromPath(keyPath[keyPath.length - 1])
        )
      })
    }, Promise.resolve())
  })

  test('Not installed Package', async () => {
    await initVisitor()
    const testCases = [
      ['packages', '', 'dependencies', 'not-install'],
      ['dependencies', 'basic-test', 'requires', 'not-install'],
    ]

    await testCases.reduce((chain, keyPath) => {
      return chain.then(async () => {
        const spyShowInformationMessage = sinon.spy(
          window,
          'showInformationMessage'
        )
        const errMsg = await goToDefinition_expectNotOpen(
          document,
          visitor,
          keyPath,
          getPkgNameFromPath(keyPath[keyPath.length - 1])
        )
        // console.log(errMsg);
        spyShowInformationMessage.restore()
        if (!spyShowInformationMessage.called) {
          throw new Error('No error message prompt is displayed')
        }
      })
    }, Promise.resolve())
  })
})

suite('pkgjson-dep-jump-nm .package-lock.json Test', function () {
  const WorkspacePath = getWorkSpacePath()

  teardown(async function () {
    await closeAllEditors()
  })

  let document!: TextDocument
  let visitor!: Visitor
  async function initVisitor() {
    const packageJsonFile = Uri.file(
      path.join(WorkspacePath, NODE_MODULES, DOT_PACKAGE_LOCK_JSON)
    )
    document = await workspace.openTextDocument(packageJsonFile)
    const pkgJson = document.getText()
    const visitor_ = parse(pkgJson)
    if (!visitor_) {
      throw new Error('package-lock.json unknown error')
    }
    visitor = visitor_
  }

  test('basic jump', async () => {
    await initVisitor()
    const testCases = [
      ['packages', 'node_modules/@scope/test'],
      ['packages', 'node_modules/basic-test'],
      ['packages', 'node_modules/a-1'],
      ['packages', 'node_modules/a-1', 'dependencies', 'basic-test'],
    ]
    await testCases.reduce((chain, keyPath) => {
      return chain.then(() => {
        return goToDefinition(
          document,
          visitor,
          keyPath,
          getPkgNameFromPath(keyPath[keyPath.length - 1])
        )
      })
    }, Promise.resolve())
  })

  test('deep Jump', async () => {
    await initVisitor()
    const testCases: Array<[string[], string]> = [
      [['packages', 'node_modules/@scope/test', 'dependencies', 'b-1'], 'b-1'],
      [
        ['packages', 'node_modules/a-1', 'dependencies', 'b-1'],
        'a-1/node_modules/b-1',
      ],
      [
        ['packages', 'node_modules/a-1/node_modules/b-1'],
        'a-1/node_modules/b-1',
      ],
      [
        [
          'packages',
          'node_modules/a-1/node_modules/b-1',
          'dependencies',
          'basic-test',
        ],
        'basic-test',
      ],
    ]
    await testCases.reduce((chain, item) => {
      return chain.then(() => {
        const [keyPath, expectPkgPath] = item
        return goToDefinition(
          document,
          visitor,
          keyPath,
          getPkgNameFromPath(keyPath[keyPath.length - 1]),
          {
            pkgPath: expectPkgPath,
          }
        )
      })
    }, Promise.resolve())
  })

  test('Not Jump', async () => {
    await initVisitor()
    const testCases = [
      ['packages', '', 'name'],
      ['packages', '', 'devDependencies'],
    ]
    await testCases.reduce((chain, keyPath) => {
      return chain.then(() => {
        return goToDefinition_expectNotOpen(
          document,
          visitor,
          keyPath,
          getPkgNameFromPath(keyPath[keyPath.length - 1])
        )
      })
    }, Promise.resolve())
  })

  test('Not installed Package', async () => {
    await initVisitor()
    const testCases = [['packages', '', 'dependencies', 'not-install']]

    await testCases.reduce((chain, keyPath) => {
      return chain.then(async () => {
        const spyShowInformationMessage = sinon.spy(
          window,
          'showInformationMessage'
        )
        const errMsg = await goToDefinition_expectNotOpen(
          document,
          visitor,
          keyPath,
          getPkgNameFromPath(keyPath[keyPath.length - 1])
        )
        // console.log(errMsg);
        spyShowInformationMessage.restore()
        if (!spyShowInformationMessage.called) {
          throw new Error('No error message prompt is displayed')
        }
      })
    }, Promise.resolve())
  })
})
