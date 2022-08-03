import { commands, ExtensionContext, Uri, window, workspace } from 'vscode';

import t from './utils/localize';
import { isFile } from './vs-utils';

export function activate(context: ExtensionContext) {
  import('./pkgjson-dep-jump-nm').then(
    ({ default: packageJsonJumpToNodeModules }) => {
      packageJsonJumpToNodeModules(context)
    }
  )

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
