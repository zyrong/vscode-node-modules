import { statSync } from 'fs'
import { readFile } from 'fs/promises'
import { forOwn } from 'lodash'
import { Location, Position, Range, Uri } from 'vscode'

export function isFileSync(path: string): Boolean {
  try {
    const _stat = statSync(path)
    return _stat.isFile()
  } catch (error) {
    return false
  }
}
export function isDirectorySync(path: string): Boolean {
  try {
    const _stat = statSync(path)
    return _stat.isDirectory()
  } catch (error) {
    return false
  }
}

export function trimRightSlash(str: string) {
  return str.replace(/\/*$/, '')
}

export function trimLeftSlash(str: string) {
  return str.replace(/\/*$/, '')
}

// 生成 vscode.location对象 用来让vscode跳转到指定文件的指定位置
export const genFileLocation = (
  destPath: string,
  line: number = 0,
  character: number = 0
) => {
  // new vscode.Position(0, 0) 表示跳转到某个文件的第一行第一列
  return new Location(Uri.file(destPath), new Position(line, character))
}

export function isObject(target: any): target is Record<string, any> {
  return target !== null && typeof target === 'object'
}

export function promiseDebounce<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  getKey: (...args: any[]) => any
) {
  const promises = new Map()
  return function (...args: T): Promise<R> {
    const key = getKey(...args)
    if (!promises.has(key)) {
      const promise = fn(...args)
      promises.set(key, promise)
      promise.finally(() => {
        promises.delete(key)
      })
    }
    return promises.get(key)!
  }
}

export async function getFileRange(filePath: string) {
  const textContent = await readFile(filePath, 'utf8')
  const lines = textContent.split(/\r?\n/)
  const lastLine = lines.at(-1)
  return new Range(
    new Position(0, 0),
    new Position(
      Math.max(0, lines.length - 1),
      lastLine === undefined ? 0 : Math.max(0, lastLine.length - 1)
    )
  )
}

export function spacing(num: number) {
  let result = ''
  while (--num >= 0) {
    result += '&nbsp;'
  }
  return result
}

export function forOwnDeep(
  object: Record<any, any>,
  iteratee: (
    value: any,
    key: string,
    parentObject: any,
    parentKeyPath: string
  ) => false | void,
  parentValue: Record<any, any> = object,
  parentKeyPath = ''
) {
  forOwn(object, (value, key) => {
    if (iteratee(value, key, parentValue, parentKeyPath) === false) {
      return false
    }
    if (isObject(value)) {
      forOwnDeep(
        value,
        iteratee,
        value,
        (parentKeyPath && parentKeyPath + '.') + key
      )
    }
  })
}
