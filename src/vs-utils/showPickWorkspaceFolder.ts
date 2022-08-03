import { window, workspace } from 'vscode';

import t from './i18n';

export default async function showPickWorkspaceFolder(): Promise<string> {
  const workspaceFolders = workspace.workspaceFolders;
  if (!(workspaceFolders && workspaceFolders.length)) {
    throw new Error('The current workspace does not have an open project');
  }
  if (workspaceFolders.length === 1) {
    return workspaceFolders[0].uri.fsPath;
  } else {
    const pickResult = await window.showQuickPick(
      workspaceFolders!.map((item) => {
        return {
          label: item.name,
          fsPath: item.uri.fsPath,
        };
      }),
      {
        placeHolder: t("tip.selectWorkspaceFolder"),
      }
    );

    return pickResult?.fsPath || "";
  }
}
