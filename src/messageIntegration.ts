import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { ProjectStorage } from './projectStorage';
import { ConfigurationManager } from './configurationManager';
import { WebviewToExtensionMessage } from './types';

/**
 * メッセージ通信統合クラス
 *
 * Extension、WebviewManager、ProjectStorage、ConfigurationManagerを統合し、
 * Extension ⇔ Webview間のメッセージ通信を管理する
 *
 * 責務:
 * - Webviewからのメッセージ（ready, openProject, confirmDelete）を処理する
 * - 設定変更時にWebviewへ通知する
 * - プロジェクトリスト更新時にWebviewへ通知する
 */
export class MessageIntegration {
  constructor(
    private webviewManager: WebviewManager,
    private projectStorage: ProjectStorage,
    private configManager: ConfigurationManager
  ) {}

  /**
   * メッセージハンドラーを初期化する
   * @returns Disposable
   */
  initialize(): vscode.Disposable {
    const disposable = this.webviewManager.onMessage(async (message) => {
      await this.handleWebviewMessage(message);
    });

    // 設定変更の監視
    const configDisposable = this.configManager.onConfigChange((config) => {
      this.webviewManager.sendMessage({
        type: 'configUpdated',
        config
      });
    });

    return {
      dispose: () => {
        disposable.dispose();
        configDisposable.dispose();
      }
    };
  }

  /**
   * Webviewからのメッセージを処理する
   */
  private async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.handleReady();
        break;
      case 'confirmDelete':
        await this.handleConfirmDelete(message.projectId, message.projectName);
        break;
      case 'openProject':
        this.handleOpenProject(message.projectId);
        break;
    }
  }

  /**
   * ready メッセージを処理する
   * Webviewの初期化が完了したら、プロジェクトリストと設定を送信する
   */
  private handleReady(): void {
    const projects = this.projectStorage.getProjects();
    const config = this.configManager.getAsciiArtConfig();

    this.webviewManager.sendMessage({
      type: 'init',
      projects,
      config
    });
  }

  /**
   * confirmDelete メッセージを処理する
   * 確認ダイアログを表示し、承認されたらプロジェクトを削除する
   */
  private async handleConfirmDelete(projectId: string, projectName: string): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
      `「${projectName}」を削除しますか？`,
      { modal: true },
      '削除',
      'キャンセル'
    );

    if (confirmation === '削除') {
      this.projectStorage.removeProject(projectId);
      const projects = this.projectStorage.getProjects();

      this.webviewManager.sendMessage({
        type: 'projectsUpdated',
        projects
      });
    }
  }

  /**
   * openProject メッセージを処理する
   * 指定されたプロジェクトを開く
   */
  private async handleOpenProject(projectId: string): Promise<void> {
    const projects = this.projectStorage.getProjects();
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
      vscode.window.showErrorMessage(`パスが存在しません: ${project.path}`);
      return;
    }

    // プロジェクトを開く
    await vscode.commands.executeCommand('vscode.openFolder', uri, false);
  }

  /**
   * プロジェクトリストが更新されたことを通知する
   * 外部からプロジェクトが追加された場合などに呼び出す
   */
  notifyProjectsUpdated(): void {
    const projects = this.projectStorage.getProjects();
    this.webviewManager.sendMessage({
      type: 'projectsUpdated',
      projects
    });
  }
}
