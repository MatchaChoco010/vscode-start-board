import * as vscode from 'vscode';

/**
 * ワークスペースフォルダが空かどうかを判定する
 * @param workspaceFolders ワークスペースフォルダの配列（undefinedまたは空配列の場合は空ウィンドウ）
 * @returns 空ウィンドウの場合はtrue、それ以外はfalse
 */
export function isEmptyWindow(
  workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined
): boolean {
  return workspaceFolders === undefined || workspaceFolders.length === 0;
}

/**
 * 空ウィンドウが検出された場合にダッシュボードを自動表示する
 * @param showDashboard ダッシュボードを表示する関数
 */
export async function autoShowDashboardIfEmptyWindow(
  showDashboard: () => Promise<void>
): Promise<void> {
  if (isEmptyWindow(vscode.workspace.workspaceFolders)) {
    await showDashboard();
  }
}
