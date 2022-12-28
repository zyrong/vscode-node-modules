/* eslint-disable @typescript-eslint/naming-convention */
import { join } from 'path'
import {
  CancellationToken,
  Definition,
  DefinitionLink,
  ExtensionContext,
  languages,
  LocationLink,
  Position,
  TextDocument,
  Uri,
  window,
} from 'vscode'

import { PACKAGE_JSON } from './constant'
import { logger } from './extension'
import { getFileRange } from './utils'
import t from './utils/localize'
import { getPackageNodeInfoByDocAndPos } from './utils/pkg-json-node'

async function provideDefinition(
  document: TextDocument,
  position: Position,
  token: CancellationToken
): Promise<Definition | DefinitionLink[] | LocationLink[] | null | undefined> {
  try {
    const pkgNodeInfo = await getPackageNodeInfoByDocAndPos(document, position)
    if (!pkgNodeInfo?.packageInstalledPath) {
      window.showInformationMessage(t('tip.notFoundPackage'))
      return
    }
    const targetUri = Uri.file(
      join(pkgNodeInfo.packageInstalledPath, PACKAGE_JSON)
    )
    const targetRange = await getFileRange(targetUri.fsPath) // 设置 peeked editor 显示的文件内容范围
    const definitionLink: DefinitionLink = {
      originSelectionRange: pkgNodeInfo.originSelectionRange,
      targetUri,
      targetRange,
    }
    return [definitionLink]
  } catch (err) {
    const isErrMsg = typeof err === 'string'
    isErrMsg ? logger.error(err) : logger.error('', err)
    return
  }
}

export default function (context: ExtensionContext) {
  // 注册如何实现跳转到定义，第一个参数表示仅对json文件生效
  context.subscriptions.push(
    languages.registerDefinitionProvider(['json', 'jsonc'], {
      provideDefinition, // 当按住Ctrl键时鼠标hover文本内容 或 右键转到定义时 就会触发该函数
    })
  )
}
