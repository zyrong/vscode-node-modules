export const NODE_MODULES = "node_modules";
export const PACKAGE_JSON = "package.json";

export const SUPPORT_PKGMANAGER_NAMES = ["npm", "yarn", "pnpm"] as const;
export type T_SUPPORT_PKGMANAGER_NAMES = typeof SUPPORT_PKGMANAGER_NAMES[number];