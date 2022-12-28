import {
  CancellationToken,
  ExtensionContext,
  Hover,
  languages,
  MarkdownString,
  Position,
  TextDocument,
} from 'vscode'

import { logger } from './extension'
import { configs } from './extension-configs'
import { getPkgHoverContentsCreator } from './utils/pkg-hover-contents'
import { getPackageInfo } from './utils/pkg-info'
import { getPackageNodeInfoByDocAndPos } from './utils/pkg-json-node'

async function provideHover(
  document: TextDocument,
  position: Position,
  token: CancellationToken
): Promise<Hover | null | undefined> {
  try {
    const pkgNodeInfo = await getPackageNodeInfoByDocAndPos(document, position)

    if (pkgNodeInfo) {
      let hoverContents: MarkdownString | undefined
      const packageInfo = await getPackageInfo(pkgNodeInfo.packageName, {
        packageInstalledPath: pkgNodeInfo.packageInstalledPath,
        searchVersionRange: pkgNodeInfo.packageVersion,
        fetchBundleSize: configs.hovers.pkgName.bundleSize,
        skipBuiltinModuleCheck: true, // Note: 当package.json中定义了依赖类似"path"这样与node内置模块相同名称的包时，永远认为他不是使用node内置模块
        token,
      })
      if (packageInfo) {
        const pkgHoverContentsCreator = getPkgHoverContentsCreator()
        hoverContents = pkgHoverContentsCreator.generate(packageInfo)
      }
      return hoverContents && new Hover(hoverContents)
    }
  } catch (err: any) {
    const isErrMsg = typeof err === 'string'
    isErrMsg ? logger.error(err) : logger.error('', err)
    return
  }
}

export default function (context: ExtensionContext) {
  context.subscriptions.push(
    languages.registerHoverProvider(['json', 'jsonc'], { provideHover })
  )
}
