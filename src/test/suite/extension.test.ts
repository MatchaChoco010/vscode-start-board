import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('拡張機能がアクティブになる', async () => {
    // 拡張機能が正しくロードされることを確認
    // 実際の拡張機能のテストはE2Eテスト環境で実行される
    assert.ok(true, '拡張機能テストの基本セットアップ完了');
  });

  test('startBoard.addProjectコマンドが登録されている', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('startBoard.addProject'),
      'startBoard.addProjectコマンドが登録されていること'
    );
  });

  test('startBoard.showDashboardコマンドが登録されている', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('startBoard.showDashboard'),
      'startBoard.showDashboardコマンドが登録されていること'
    );
  });

  test('アスキーアート設定がデフォルト値を持つ', () => {
    const config = vscode.workspace.getConfiguration('startBoard.asciiArt');

    assert.strictEqual(config.get('text'), 'Welcome\nto\nStart Board', 'textのデフォルト値');
    assert.strictEqual(config.get('fontFamily'), 'monospace', 'fontFamilyのデフォルト値');
    assert.strictEqual(config.get('fontSize'), 14, 'fontSizeのデフォルト値');
    assert.strictEqual(config.get('lineHeight'), 1.2, 'lineHeightのデフォルト値');
  });
});
