import { ExtensionContext, commands, workspace, window, extensions } from "vscode";

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
}

export function deactivate() {}
