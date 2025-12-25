import * as vscode from 'vscode';
import { ProjectStorage } from './projectStorage';
import { createWebviewManager, WebviewManager } from './webviewManager';
import { createConfigurationManager } from './configurationManager';
import { AddProjectCommand, createAddProjectDependencies } from './commandHandlers';
import { autoShowDashboardIfEmptyWindow } from './emptyWindowDetection';

/**
 * プロジェクトを開く処理
 * @param projectId 開くプロジェクトのID
 * @param projectStorage プロジェクトストレージ
 * @param webviewManager Webviewマネージャー
 */
async function handleOpenProject(
  projectId: string,
  projectStorage: ProjectStorage,
  webviewManager: WebviewManager
): Promise<void> {
  const projects = projectStorage.getProjects();
  const project = projects.find(p => p.id === projectId);

  if (!project) {
    vscode.window.showErrorMessage('プロジェクトが見つかりません');
    return;
  }

  // パスの存在確認
  const uri = vscode.Uri.file(project.path);
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    // パスが存在しない場合、削除オプション付きでエラーメッセージを表示
    const selection = await vscode.window.showErrorMessage(
      `パスが存在しません: ${project.path}`,
      'リストから削除'
    );
    if (selection === 'リストから削除') {
      projectStorage.removeProject(projectId);
      webviewManager.sendMessage({
        type: 'projectsUpdated',
        projects: projectStorage.getProjects()
      });
    }
    return;
  }

  // プロジェクトを開く（フォルダもワークスペースも同じコマンドを使用）
  // 第3引数のfalseは新しいウィンドウで開かないことを意味する
  await vscode.commands.executeCommand('vscode.openFolder', uri, false);
}

/**
 * 拡張機能のアクティベート時に呼び出される
 * @param context 拡張機能コンテキスト
 */
export function activate(context: vscode.ExtensionContext): void {
  // コンポーネントの初期化
  const projectStorage = new ProjectStorage(context.globalState);
  const webviewManager = createWebviewManager(context.extensionUri);
  const { manager: configManager, disposable: configDisposable } = createConfigurationManager();
  context.subscriptions.push(configDisposable);

  // プロジェクト追加コマンドを登録
  const addProjectCommand = vscode.commands.registerCommand(
    'startBoard.addProject',
    async () => {
      const deps = createAddProjectDependencies(
        (input) => projectStorage.addProject(input),
        (path) => projectStorage.hasProject(path)
      );
      const command = new AddProjectCommand(deps);
      const result = await command.execute();

      // 成功した場合、ダッシュボードが表示中なら更新メッセージを送信
      if (result.success && webviewManager.isVisible()) {
        webviewManager.sendMessage({
          type: 'projectsUpdated',
          projects: projectStorage.getProjects()
        });
      }
    }
  );
  context.subscriptions.push(addProjectCommand);

  // ダッシュボード表示コマンドを登録
  const showDashboardCommand = vscode.commands.registerCommand(
    'startBoard.showDashboard',
    async () => {
      await webviewManager.showDashboard();
    }
  );
  context.subscriptions.push(showDashboardCommand);

  // Webviewからのメッセージハンドラー
  const messageHandler = webviewManager.onMessage(async (message) => {
    switch (message.type) {
      case 'ready':
        // 初期データを送信
        webviewManager.sendMessage({
          type: 'init',
          projects: projectStorage.getProjects(),
          config: configManager.getAsciiArtConfig()
        });
        break;
      case 'openProject':
        // プロジェクトを開く
        handleOpenProject(message.projectId, projectStorage, webviewManager);
        break;
      case 'confirmDelete':
        // VSCodeの確認ダイアログを表示
        const confirmation = await vscode.window.showWarningMessage(
          `「${message.projectName}」を削除しますか？`,
          { modal: true },
          '削除',
          'キャンセル'
        );

        if (confirmation === '削除') {
          // プロジェクトを削除して更新されたリストを送信
          projectStorage.removeProject(message.projectId);
          webviewManager.sendMessage({
            type: 'projectsUpdated',
            projects: projectStorage.getProjects()
          });
        }
        break;
    }
  });
  context.subscriptions.push(messageHandler);

  // 設定変更の監視
  const configChangeHandler = configManager.onConfigChange((config) => {
    webviewManager.sendMessage({
      type: 'configUpdated',
      config
    });
  });
  context.subscriptions.push(configChangeHandler);

  // クリーンアップ登録
  context.subscriptions.push({
    dispose: () => {
      webviewManager.dispose();
    }
  });

  // 空ウィンドウの場合、ダッシュボードを自動表示
  // setImmediateを使用して、アクティベーション完了後すぐに実行
  setImmediate(() => {
    autoShowDashboardIfEmptyWindow(async () => {
      await webviewManager.showDashboard();
    });
  });
}

/**
 * 拡張機能のディアクティベート時に呼び出される
 */
export function deactivate(): void {
  // クリーンアップが必要な場合はここで行う
}
