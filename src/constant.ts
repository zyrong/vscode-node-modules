export const EXTENSION_NAME = 'node_modules'
export const NODE_MODULES = 'node_modules'
export const PACKAGE_JSON = 'package.json'
export const PACKAGE_LOCK_JSON = 'package-lock.json'
export const DOT_PACKAGE_LOCK_JSON = '.package-lock.json'

export const SUPPORT_PKGMANAGER_NAMES = ['npm', 'yarn', 'pnpm'] as const
export type T_SUPPORT_PKGMANAGER_NAMES = typeof SUPPORT_PKGMANAGER_NAMES[number]
