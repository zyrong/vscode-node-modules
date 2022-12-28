README.md Language: [中文](https://github.com/zyrong/vscode-node-modules/blob/master/README.md) | [English](https://github.com/zyrong/vscode-node-modules/blob/master/README.en.md)
<br/><br/>

# node-modules ![](https://vsmarketplacebadge.apphb.com/version/zyrong.node-modules.svg) ![](https://vsmarketplacebadge.apphb.com/installs/zyrong.node-modules.svg)

> 快速前往node_modules下对应package的目录

<br/>

## Features

- 在`package.json`文件中 将鼠标悬停在`packageName`上会出现相关提示
如果此packageName对应的package在已经安装的情况下，点击悬浮框中的包名，会跳转到包的安装目录下   
![](https://raw.githubusercontent.com/zyrong/vscode-node-modules/master/resources/images/hover-pkgjson-pkgname.gif)

- 在`.ts` `.js` `.jsx` `.tsx` `.vue`文件中使用`import`或`require`导入`package`时，鼠标移动到`PackageName`上，将会得到相关提示。   
![](https://raw.githubusercontent.com/zyrong/vscode-node-modules/master/resources/images/hover-import-pkgname.gif)

- 在package.json文件中 `按住ctrl`+`点击packageName`将跳转到node_modules对应package目录下.   
![](https://raw.githubusercontent.com/zyrong/vscode-node-modules/master/resources/images/goToDefine.gif)

- 对 node_modules文件夹 点击右键，在弹出的菜单，点击搜索 Package，可以对node_modules的package进行搜索。   
![](https://raw.githubusercontent.com/zyrong/vscode-node-modules/master/resources/images/search-package.gif)

- 在弹出的菜单中，点击搜索 node_modules，可以对node_modules进行路径搜索。   
![](https://raw.githubusercontent.com/zyrong/vscode-node-modules/master/resources/images/search-node_modules.gif)

- 复制符号链接对应的实际路径   
![](https://raw.githubusercontent.com/zyrong/vscode-node-modules/master/resources/images/copyRealPath.gif)

> 快捷键:  
> 搜索 Package: windows(ctrl+k p)、mac(cmd+k p)  
> 搜索 node_modules: windows(ctrl+k n)、mac(cmd+k n)