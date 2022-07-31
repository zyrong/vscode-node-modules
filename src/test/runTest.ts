import path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    const fixturesDir = path.resolve(extensionDevelopmentPath, './src/test/fixtures');

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/pkgjson-dep-jump-nm/index');
    const testWorkspace = path.resolve(fixturesDir, './pkgjson-dep-jump-nm');

    // Download VS Code, unzip it and run the integration test
    await runTests({
      version: '1.67.2',
      extensionDevelopmentPath,
      extensionTestsPath,
      extensionTestsEnv: { WorkspacePath: testWorkspace }, // process.env.WorkspacePath
      launchArgs: [testWorkspace, '--disable-extensions'] // 禁用除当前正在测试插件以外的其他插件
    });
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();
