import { ExtensionContext, commands, workspace, window, extensions, env } from "vscode";

export function activate(context: ExtensionContext) {
  import("./pkgjson-dep-jump-nm").then(
    (value: typeof import("./pkgjson-dep-jump-nm")) => {
      value.default(context);
    }
  );


  context.subscriptions.push(
    commands.registerCommand("extension.search.package", async (uri) => {
      import("./search-package").then((value) => {
        value.default(uri);
      });
    })
  );

  context.subscriptions.push(
    commands.registerCommand("extension.search.node_modules", async (uri) => {
      import("./search-node_modules").then((value) => {
        value.default(uri);
      });
    })
  );
}

export function deactivate() {}
