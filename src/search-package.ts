import { access, readdir, stat } from 'fs/promises'
import { basename, join } from 'path'
import validate = require('validate-npm-package-name')
import { Uri, window, workspace } from 'vscode'

import { logger } from './extension'
import { NODE_MODULES, PACKAGE_JSON } from './types'
import t from './utils/localize'
import { getFileInProjectRootDir } from './vs-utils'
import showPickWorkspaceFolder from './vs-utils/showPickWorkspaceFolder'

export default async function (uri: Uri) {
  // package.json中menus已经限定目录名为node_modules才触发该命令，所以uri.path存在必定是node_modulesPath
  let node_modulesPath = uri ? uri.path : ''

  if (!node_modulesPath) {
    let projectRootPath
    try {
      projectRootPath = await showPickWorkspaceFolder()
      if (!projectRootPath) {
        window.showErrorMessage(t('tip.selectSearchProject'))
        return
      }
    } catch (error: any) {
      projectRootPath = ''
      window.showErrorMessage(t('tip.workspaceNoOpenProject'))
      return
    }
    node_modulesPath = join(projectRootPath, NODE_MODULES)
  }

  if (node_modulesPath) {
    await searchNodeModules(node_modulesPath)
  }
}

async function getNodeModulesPkgNameList(node_modulesPath: string) {
  try {
    const files = await readdir(node_modulesPath)
    // 处理 @开头的package
    const organizePkgList: string[] = [],
      pkgList: string[] = []
    files.forEach((filename) => {
      if (filename.startsWith('@')) {
        organizePkgList.push(filename)
      } else if (validate(filename).validForOldPackages) {
        pkgList.push(filename)
      }
    })

    const resultList = await Promise.allSettled(
      organizePkgList.map((filename) => {
        return readdir(join(node_modulesPath, filename))
      })
    )

    let fullOrganizePkgList: string[] = []
    resultList.forEach((result, idx) => {
      if (result.status === 'rejected') {
        return
      }
      const _files = result.value
      if (Array.isArray(_files)) {
        const organizeName = organizePkgList[idx]
        const fullOrganizePkgNameList = _files.map((filename) => {
          return `${organizeName}/${filename}`
        })
        fullOrganizePkgList = fullOrganizePkgList.concat(
          fullOrganizePkgNameList
        )
      }
    })

    // node_modules完整packageName列表
    const fullPkgNameList = fullOrganizePkgList.concat(pkgList)
    return fullPkgNameList
  } catch (err) {
    logger.error(`读取${node_modulesPath}目录失败`, err)
    return [] as string[]
  }
}

async function searchNodeModules(node_modulesPath: string) {
  let promises = [getNodeModulesPkgNameList(node_modulesPath)]

  const pnpmOtherPkgNode_modules = join(
    node_modulesPath,
    '.pnpm',
    'node_modules'
  )
  try {
    await access(pnpmOtherPkgNode_modules)
    promises.push(getNodeModulesPkgNameList(pnpmOtherPkgNode_modules))
  } catch (error) {}

  const results = await Promise.allSettled(promises)

  let fullPkgNameList = results
    .map((item) => {
      if (item.status === 'rejected') {
        return []
      }
      return item.value
    })
    .flat()

  const projectRootDir = getFileInProjectRootDir(node_modulesPath)
  const projectName = basename(projectRootDir!)
  // 用户选择结果
  const pickResult = await window.showQuickPick(fullPkgNameList, {
    placeHolder: join(projectName, NODE_MODULES),
  })
  if (pickResult) {
    let userPickPath = join(node_modulesPath, pickResult)
    try {
      await access(userPickPath)
    } catch (err) {
      try {
        userPickPath = join(pnpmOtherPkgNode_modules, pickResult)
        await access(userPickPath)
      } catch (err) {
        logger.error(`路径不存在:${userPickPath}`, err)
      }
    }

    const pkgJsonPath = join(userPickPath, PACKAGE_JSON)
    let isPkg = false
    try {
      await access(pkgJsonPath)
      isPkg = true
    } catch (error) {}

    let destPath = ''
    if (!isPkg) {
      // 不是package, 是类似: .bin文件夹或普通文件
      const _stat = await stat(userPickPath)
      if (_stat.isFile()) {
        destPath = userPickPath
      } else {
        // 遍历文件列表，打开最前面的文件
        const files = await readdir(userPickPath)
        let i = 0
        while (i < files.length) {
          // 判断防止全是文件夹的情况
          const filePath = join(userPickPath, files[i++])
          const _stat = await stat(filePath)
          if (_stat.isFile()) {
            destPath = filePath
            break
          }
        }
      }
    } else {
      destPath = pkgJsonPath
    }
    destPath &&
      workspace.openTextDocument(destPath).then(window.showTextDocument)
  }
}
