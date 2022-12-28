README.md Language: [中文](https://github.com/zyrong/vscode-node-modules/blob/master/README.md) | [English](https://github.com/zyrong/vscode-node-modules/blob/master/README.en.md)
<br/><br/>

# node-modules ![](https://vsmarketplacebadge.apphb.com/version/zyrong.node-modules.svg) ![](https://vsmarketplacebadge.apphb.com/installs/zyrong.node-modules.svg)

> Quickly go to the directory of the corresponding package under the node_modules

<br/>

## Features

- Hover the mouse over 'packageName' in the' package.json' file and a related prompt will appear.
If the package corresponding to this packageName is already installed, click the package name in the floating box, and it will jump to the installation directory of the package.   
![](https://raw.githubusercontent.com/zyrong/vscode-node-modules/master/resources/images/hover-pkgjson-pkgname.gif)

- When importing `package` using `import` or `require` in `.ts`、`.js`、`.jsx`、`.tsx`、`.vue` file, move the mouse over the `PackageName`, You will get relevant tips.   
![](https://raw.githubusercontent.com/zyrong/vscode-node-modules/master/resources/images/hover-import-pkgname.gif)

- In package.json file, `press Ctrl` and `click packagename` to jump to node_ modules corresponds to the package directory.   
![](https://raw.githubusercontent.com/zyrong/vscode-node-modules/master/resources/images/goToDefine.gif)

- Right-click the node_modules folder and click the search Package in the pop-up menu to search the node_modules package.   
![](https://raw.githubusercontent.com/zyrong/vscode-node-modules/master/resources/images/search-package.gif)

- In the pop-up menu, click the search node_modules to search the node_modules path.   
![](https://raw.githubusercontent.com/zyrong/vscode-node-modules/master/resources/images/search-node_modules.gif)

- Copy the real path corresponding to the symbolic link   
![](https://raw.githubusercontent.com/zyrong/vscode-node-modules/master/resources/images/copyRealPath.gif)

> Shortcut keys:  
> Search Package: windows(ctrl+k p)、mac(cmd+k p)  
> Search node_modules: windows(ctrl+k n)、mac(cmd+k n)