import * as assert from 'assert';
import * as vscode from 'vscode';
import { isEmptyWindow } from '../../emptyWindowDetection';

suite('Empty Window Detection Test Suite', () => {
  test('workspaceFoldersがundefinedの場合、trueを返す', () => {
    const result = isEmptyWindow(undefined);
    assert.strictEqual(result, true, 'undefinedの場合は空ウィンドウ');
  });

  test('workspaceFoldersが空配列の場合、trueを返す', () => {
    const result = isEmptyWindow([]);
    assert.strictEqual(result, true, '空配列の場合は空ウィンドウ');
  });

  test('workspaceFoldersにフォルダがある場合、falseを返す', () => {
    const mockFolders = [
      { uri: vscode.Uri.file('/path/to/folder'), name: 'folder', index: 0 }
    ] as readonly vscode.WorkspaceFolder[];
    const result = isEmptyWindow(mockFolders);
    assert.strictEqual(result, false, 'フォルダがある場合は空ウィンドウではない');
  });

  test('workspaceFoldersに複数のフォルダがある場合、falseを返す', () => {
    const mockFolders = [
      { uri: vscode.Uri.file('/path/to/folder1'), name: 'folder1', index: 0 },
      { uri: vscode.Uri.file('/path/to/folder2'), name: 'folder2', index: 1 }
    ] as readonly vscode.WorkspaceFolder[];
    const result = isEmptyWindow(mockFolders);
    assert.strictEqual(result, false, '複数フォルダがある場合も空ウィンドウではない');
  });
});
