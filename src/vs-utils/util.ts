import { constants } from 'fs'
import { access, readFile, stat } from 'fs/promises'
import { workspace } from 'vscode'

export async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch (error) {
    return false
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch (error) {
    return false
  }
}

export async function existFile(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch (error) {
    return false
  }
}

// 获取文件所在工作空间的根目录
export function getFileInProjectRootDir(filepath: string): string | undefined {
  const project = workspace.workspaceFolders?.find((project) => {
    return filepath.startsWith(project.uri.path)
  })
  return project?.uri.path
}

export async function parseJsonFile(
  jsonPath: string
): Promise<Record<string, any> | undefined> {
  try {
    const jsonBuffer = await readFile(jsonPath)
    if (jsonBuffer) {
      return JSON.parse(jsonBuffer.toString())
    }
  } catch (err) {
    console.error(err)
  }
}

export function forMatSize(byteSize: number, decimal = 2): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  for (; i < units.length; i++) {
    if (byteSize < 1024) {
      break
    }
    byteSize /= 1024
  }
  return byteSize.toFixed(decimal) + units[i]
}
