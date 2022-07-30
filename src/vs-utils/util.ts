import { constants } from "fs";
import { access, stat, readFile } from "fs/promises";
import { workspace } from "vscode";

export async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    return false;
  }
}

export async function existFile(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}


// 获取文件所在工作空间的根目录
export function getFileInProjectRootDir(
  filepath: string
): string | undefined {
  const project = workspace.workspaceFolders?.find((project) => {
    return filepath.startsWith(project.uri.path);
  });
  return project?.uri.path;
};

export async function parseJsonFile(jsonPath: string): Promise<Record<string, any> | undefined> {
  try {
    const jsonBuffer = readFile(jsonPath);
    if (jsonBuffer) {
      return JSON.parse(jsonBuffer.toString());
    }
  } catch (err) {
  }
}