import { commands, env, ExtensionContext, Uri, window, workspace } from 'vscode'

import { initExtensionConfigs } from './extension-configs'
import t from './utils/localize'
import Logger from './utils/log'
import {
  exists,
  getWorkspaceFolderPathByPath,
  isFile,
  realpath,
} from './vs-utils'

export const logger = new Logger('node_modules', {
  levels: ['info', 'warn', 'error'],
})

export function activate(context: ExtensionContext) {
  logger.log('activate node_modules Extension')
  initExtensionConfigs()

  import('./pkgjson-dep-jump-nm').then(
    ({ default: packageJsonJumpToNodeModules }) => {
      packageJsonJumpToNodeModules(context)
    }
  )

  import('./pkgjson-hover-tip').then(({ default: packageJsonHoverTip }) => {
    packageJsonHoverTip(context)
  })

  import('./pkgname-hover-tip').then(({ default: pkgnameHoverTip }) => {
    pkgnameHoverTip(context)
  })

  context.subscriptions.push(
    commands.registerCommand('extension.search.package', async (uri) => {
      import('./search-package').then(({ default: searchPackage }) => {
        searchPackage(uri)
      })
    })
  )

  context.subscriptions.push(
    commands.registerCommand('extension.search.node_modules', async (uri) => {
      import('./search-node_modules').then(({ default: searchNodeModules }) => {
        searchNodeModules(uri)
      })
    })
  )

  context.subscriptions.push(
    commands.registerCommand(
      'extension.copy.realPath',
      async (uri: Uri, notCopy?: true) => {
        let path
        if (uri) {
          path = uri.fsPath
        } else {
          const pickResult = await window.showQuickPick(
            [
              { label: t('text.currentFilePath'), value: 'currentFilePath' },
              { label: t('text.enterPath'), value: 'enterPath' },
            ],
            {
              title: t('text.selectPathSource'),
              placeHolder: t('text.placeHolderSelectPathSource'),
            }
          )
          if (pickResult) {
            if (pickResult.value === 'currentFilePath') {
              path = window.activeTextEditor?.document.uri.fsPath
            } else if (pickResult.value === 'enterPath') {
              path = await window.showInputBox({
                placeHolder: t('text.placeHolderEnterPath'),
              })
            }
          }
        }
        if (path && (await exists(path))) {
          const realP = await realpath(path)
          if (realP) {
            !notCopy && (await env.clipboard.writeText(realP))
            return realP
          }
        } else {
          window.showErrorMessage(t('text.pathError'))
        }
      }
    )
  )
  context.subscriptions.push(
    commands.registerCommand(
      'extension.copy.relativeRealPath',
      async (uri: Uri) => {
        const realP: string = await commands.executeCommand(
          'extension.copy.realPath',
          uri,
          true
        )
        if (realP) {
          const wsFolderPath = getWorkspaceFolderPathByPath(
            uri?.fsPath || realP
          )!
          if (wsFolderPath) {
            await env.clipboard.writeText(realP.slice(wsFolderPath.length + 1))
          } else {
            await env.clipboard.writeText(realP)
          }
        }
      }
    )
  )

  context.subscriptions.push(
    commands.registerCommand(
      'extension.show.textDocument',
      async (pkgJsonPath: string) => {
        const uri = Uri.file(pkgJsonPath)
        try {
          await isFile(uri.fsPath)
          const document = await workspace.openTextDocument(uri)
          await window.showTextDocument(document, {})
        } catch (err) {
          window.showInformationMessage(t('tip.notFoundPackage'))
        }
      }
    )
  )
}

export function deactivate() {}
