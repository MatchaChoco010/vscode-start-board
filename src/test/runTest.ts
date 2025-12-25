import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // ELECTRON_RUN_AS_NODE が設定されていると、VSCodeがNode.jsとして動作し
    // Electron固有のオプション（--no-sandbox等）が認識されなくなる
    // VSCode拡張機能ホスト内から実行される場合にこの問題が発生するため解除する
    delete process.env['ELECTRON_RUN_AS_NODE'];

    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Download VS Code, unzip it and run the integration test
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();
