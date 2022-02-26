import { ExtensionContext, commands } from "vscode";

export function activate(context: ExtensionContext) {
  import('./pkgjson-dep-jump-nm').then(({ default: packageJsonJumpToNodeModules }) => {
      packageJsonJumpToNodeModules(context);
  });


  context.subscriptions.push(
    commands.registerCommand("extension.search.package", async (uri) => {
      import('./search-package').then(({ default: searchPackage }) => {
          searchPackage(uri);
      });
    })
  );

  context.subscriptions.push(
    commands.registerCommand("extension.search.node_modules", async (uri) => {
      import('./search-node_modules').then(({ default: searchNodeModules }) => {
          searchNodeModules(uri);
      });
    })
  );
}

export function deactivate() {}
