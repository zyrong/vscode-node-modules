import TTLCache from '@isaacs/ttlcache'
import { CodeRange, isComplexNode, parse, Visitor } from '@zyrong/json-parser'
import { ComplexNode, NodeType } from '@zyrong/json-parser/dist/node'
import { SHA512 } from 'crypto-js'

import { logger } from '../extension'

const jsonParseCache = new TTLCache<
  string,
  { visitor: Visitor | null; integrity: string }
>({ ttl: 1000 * 60 * 10 })
function parseJson(filepath: string, json: string) {
  let cacheValue = jsonParseCache.get(filepath)
  const latestIntegrity = SHA512(json).toString()

  if (!cacheValue || latestIntegrity !== cacheValue.integrity) {
    try {
      const visitor = parse(json)
      jsonParseCache.set(
        filepath,
        (cacheValue = {
          visitor,
          integrity: latestIntegrity,
        })
      )
    } catch (err) {
      logger.error('Parse Json Error', err)
      return
    }
  }
  return cacheValue.visitor
}

function aContainB(a: CodeRange, b: CodeRange) {
  return a.start <= b.start && a.end >= b.end
}
function aEqualB(a: CodeRange, b: CodeRange) {
  return a.start === b.start && a.end === b.end
}

function getJsonNodeByRange(
  node: NodeType,
  range: CodeRange
): NodeType | undefined {
  if (node.keyRange && aEqualB(node.keyRange, range)) {
    return node
  } else if (aEqualB(node.valueRange, range)) {
    return node
  } else if (isComplexNode(node) && aContainB(node.valueRange, range)) {
    for (let i = 0; i < node.properties.length; i++) {
      const result = getJsonNodeByRange(node.properties[i], range)
      if (result) {
        return result
      } else if (result === false) {
        return undefined
      }
    }
    return false as any // 如果keyRange在当前node范围内未找到对应node，那么后续的node的肯定也不是
  }
  return undefined
}

function isKeyRange(node: NodeType, range: CodeRange) {
  return !!node.keyRange && aEqualB(node.keyRange, range)
}

function getToTopLevelNodePath(node: NodeType, rootNode?: NodeType) {
  const nodePath = []
  while (node.parent && node.parent.parent) {
    if (node.parent === rootNode) {
      break
    }
    nodePath.push(node.parent)
    node = node.parent
  }
  return nodePath
}

function findNodeByKey(node: ComplexNode, key: string) {
  if (isComplexNode(node)) {
    return node.properties.find((item) => {
      return item.key === key
    })
  }
}

function getParentPathNodes(jsonNode: NodeType, skipKeys: string[]) {
  const parentNodes = [] as string[]
  while ((jsonNode = jsonNode.parent!)) {
    if (skipKeys.includes(jsonNode.key as string)) {
      continue
    }
    jsonNode.key && parentNodes.push(jsonNode.key as string)
  }
  return parentNodes
}

export {
  findNodeByKey,
  getJsonNodeByRange,
  getParentPathNodes,
  getToTopLevelNodePath,
  isKeyRange,
  parseJson,
}
