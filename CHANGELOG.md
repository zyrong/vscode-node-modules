# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.5.1](https://github.com/zyrong/vscode-node-modules/compare/v1.5.0...v1.5.1) (2022-08-16)


### Bug Fixes

* make sure to get the word range between double quotes ([a5dd7fe](https://github.com/zyrong/vscode-node-modules/commit/a5dd7fefbe9277603dab1e78ca197010671b1875)), closes [#6](https://github.com/zyrong/vscode-node-modules/issues/6)
* parse jscode cache problem ([8ecb7f1](https://github.com/zyrong/vscode-node-modules/commit/8ecb7f11c743d2133da28fec605322753093b68f))

## [1.5.0](https://github.com/zyrong/vscode-node-modules/compare/v1.4.2...v1.5.0) (2022-08-02)


### Features

* package-lock.json and package.json new feature ([c23b721](https://github.com/zyrong/vscode-node-modules/commit/c23b721ea16c8b113d28e5f84d95461c5b7f3746))
* update hover tip feature ([e0516c4](https://github.com/zyrong/vscode-node-modules/commit/e0516c457712ea5e38b1eeade9c16d37fb4ac8f9))

### [1.4.2](https://github.com/zyrong/vscode-node-modules/compare/v1.4.1...v1.4.2) (2022-07-02)

### [1.4.1](https://github.com/zyrong/vscode-node-modules/compare/v1.4.0...v1.4.1) (2022-05-30)


### Bug Fixes

* add support when the package.json is jsonc ([fccc4de](https://github.com/zyrong/vscode-node-modules/commit/fccc4deb45b23d7d3d27c1e9473fd9b1413dcfb4))

## [1.4.0](https://github.com/zyrong/vscode-node-modules/compare/v1.3.0...v1.4.0) (2022-05-15)


### Features

* add package name hover tip to support dynamic import ([8e3efa7](https://github.com/zyrong/vscode-node-modules/commit/8e3efa77c96c78924d2c151a290169fbb6b22a7e))
* package not installed also shown npm navigation ([f44c371](https://github.com/zyrong/vscode-node-modules/commit/f44c371ac79efd87cefc238821ac8db36aa88f20))


### Bug Fixes

* dynamic import judgment ([966a4c9](https://github.com/zyrong/vscode-node-modules/commit/966a4c9741b19888182958217f6a1e20cfcf1c32))
* remove多余的1 ([feda203](https://github.com/zyrong/vscode-node-modules/commit/feda2036d95edc850d3bf7b230d2c7c74b03f7ad))
* 完善判断逻辑，捕获某些可能会抛出异常的情况 ([f6159aa](https://github.com/zyrong/vscode-node-modules/commit/f6159aabdf763a091e0b8fce89a06133b05bb3b7))

## [1.3.0](https://github.com/zyrong/vscode-node-modules/compare/v1.2.0...v1.3.0) (2022-05-03)


### Features

* change Extension emit mode , add hoverTip node built-in module support ([4e0162f](https://github.com/zyrong/vscode-node-modules/commit/4e0162f5e440a7989d14df18dec61ba2ccfedb8f))
* hoverTip support typescript require import ([a6f7799](https://github.com/zyrong/vscode-node-modules/commit/a6f7799339427acd0a414d7cea37b102c9b2f69c))

## [1.2.0](https://github.com/zyrong/vscode-node-modules/compare/v1.1.4...v1.2.0) (2022-05-02)


### Features

* add package name hover tip ([21eddbf](https://github.com/zyrong/vscode-node-modules/commit/21eddbf5f85b02f74ad91ea1fee56fee6df4b536))
* add walkthrough ([c234232](https://github.com/zyrong/vscode-node-modules/commit/c2342324ff22c47d52bb29adfb39b752e67e139a))
* search Package增加对pnpm的node_modules/.pnpm/node_modules的支持 ([6acddd8](https://github.com/zyrong/vscode-node-modules/commit/6acddd8db53b9f105aee98841d2af4e4096e02c4))


### Bug Fixes

* fix pkgjson-dep-jump-nm exist of regex matching problem ([38acaac](https://github.com/zyrong/vscode-node-modules/commit/38acaacf1a03afbd3e3e89c0b5aaf68ac251b158))

## [1.1.4](https://github.com/zyrong/vscode-node-modules/compare/v1.1.3...v1.1.4) (2022-02-23)


### Bug Fixes

* fix vscode version dependency to 1.43.1 ([626456d](https://github.com/zyrong/vscode-node-modules/commit/626456d54da74554ec6256134afbb874c655cdec))



## [1.1.3](https://github.com/zyrong/vscode-node-modules/compare/v1.1.2...v1.1.3) (2022-02-23)


### Bug Fixes

* change functionName promiseAny to promiseAll , Handle errors in readdir methods ([aad9ce3](https://github.com/zyrong/vscode-node-modules/commit/aad9ce35fe0f212fb3ffe90f60ce448b1645eafd))



## [1.1.2](https://github.com/zyrong/vscode-node-modules/compare/v1.1.1...v1.1.2) (2022-02-22)


### Bug Fixes

* fix mouse hover pkgname bug ([3d15cbb](https://github.com/zyrong/vscode-node-modules/commit/3d15cbb9801e812d68b8fbf41c1ef6b00365daf8)), closes [#1](https://github.com/zyrong/vscode-node-modules/issues/1)



## [1.1.1](https://github.com/zyrong/vscode-node-modules/compare/v1.1.0...v1.1.1) (2021-12-14)


### Bug Fixes

* 修复node_modules下package对应的package.json点击packageName无法跳转到对应package的问题 ([79f6077](https://github.com/zyrong/vscode-node-modules/commit/79f60773014160d89e9e2dc3f80c8d4989a8eac0))



# [1.1.0](https://github.com/zyrong/vscode-node-modules/compare/v1.0.1...v1.1.0) (2021-12-13)


### Bug Fixes

* 修复vscode engines版本过高问题 ([d6f181f](https://github.com/zyrong/vscode-node-modules/commit/d6f181fd8f489b96aa2c64d2e9e2dada9ad5ae52))


### Features

* 新增search node_modules ([a06e7d8](https://github.com/zyrong/vscode-node-modules/commit/a06e7d8667de0e1fd09927c72b91cb51385b726e))



## [1.0.1](https://github.com/zyrong/vscode-node-modules/compare/v1.0.0...v1.0.1) (2021-12-11)



# [1.0.0](https://github.com/zyrong/vscode-node-modules/compare/8cdd6b5664422cba3ed8ad9668d421438190676d...v1.0.0) (2021-12-11)


### Features

* complete basic features ([8cdd6b5](https://github.com/zyrong/vscode-node-modules/commit/8cdd6b5664422cba3ed8ad9668d421438190676d))
