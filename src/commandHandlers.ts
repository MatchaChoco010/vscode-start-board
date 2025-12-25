import * as vscode from 'vscode';
import * as path from 'path';
import { Project, ProjectInput } from './types';

/**
 * プロジェクト追加コマンドの依存関係インターフェース（テスト用に抽象化）
 */
export interface AddProjectDependencies {
  getWorkspaceFolders: () => readonly vscode.WorkspaceFolder[] | undefined;
  getWorkspaceFile: () => vscode.Uri | undefined;
  addProject: (input: ProjectInput) => Project | null;
  hasProject: (path: string) => boolean;
  showInfoMessage: (message: string) => Thenable<string | undefined>;
  showWarningMessage: (message: string) => Thenable<string | undefined>;
  showErrorMessage: (message: string) => Thenable<string | undefined>;
}

/**
 * プロジェクト追加コマンドの結果
 */
export type AddProjectResult =
  | { success: true; project: Project }
  | { success: false; reason: 'no-workspace' | 'duplicate' };

/**
 * 現在のワークスペース/フォルダをプロジェクトとして追加するコマンド
 */
export class AddProjectCommand {
  private deps: AddProjectDependencies;

  constructor(deps: AddProjectDependencies) {
    this.deps = deps;
  }

  /**
   * コマンドを実行する
   */
  async execute(): Promise<AddProjectResult> {
    const workspaceFile = this.deps.getWorkspaceFile();
    const workspaceFolders = this.deps.getWorkspaceFolders();

    // ワークスペースファイルを優先してチェック
    if (workspaceFile) {
      return this.addWorkspaceProject(workspaceFile);
    }

    // フォルダをチェック
    if (workspaceFolders && workspaceFolders.length > 0) {
      return this.addFolderProject(workspaceFolders[0]);
    }

    // フォルダもワークスペースも開かれていない
    await this.deps.showErrorMessage(
      'Start Board: プロジェクトを追加するには、フォルダまたはワークスペースを開いてください。'
    );
    return { success: false, reason: 'no-workspace' };
  }

  /**
   * ワークスペースファイルをプロジェクトとして追加
   */
  private async addWorkspaceProject(workspaceFile: vscode.Uri): Promise<AddProjectResult> {
    const projectPath = workspaceFile.fsPath;
    const projectName = path.basename(projectPath, '.code-workspace');

    return this.addProjectInternal({
      name: projectName,
      path: projectPath,
      type: 'workspace'
    });
  }

  /**
   * フォルダをプロジェクトとして追加
   */
  private async addFolderProject(folder: vscode.WorkspaceFolder): Promise<AddProjectResult> {
    const projectPath = folder.uri.fsPath;
    const projectName = folder.name;

    return this.addProjectInternal({
      name: projectName,
      path: projectPath,
      type: 'folder'
    });
  }

  /**
   * プロジェクトを追加する共通処理
   */
  private async addProjectInternal(input: ProjectInput): Promise<AddProjectResult> {
    // 重複チェック
    if (this.deps.hasProject(input.path)) {
      await this.deps.showWarningMessage(
        `Start Board: "${input.name}" は既に追加されています。`
      );
      return { success: false, reason: 'duplicate' };
    }

    // プロジェクトを追加
    const project = this.deps.addProject(input);

    if (project) {
      await this.deps.showInfoMessage(
        `Start Board: "${project.name}" をプロジェクトリストに追加しました。`
      );
      return { success: true, project };
    }

    // addProjectがnullを返すのは重複の場合のみなので、ここには到達しないはず
    return { success: false, reason: 'duplicate' };
  }
}

/**
 * VSCode APIを使用したAddProjectDependenciesを作成する
 */
export function createAddProjectDependencies(
  addProject: (input: ProjectInput) => Project | null,
  hasProject: (path: string) => boolean
): AddProjectDependencies {
  return {
    getWorkspaceFolders: () => vscode.workspace.workspaceFolders,
    getWorkspaceFile: () => vscode.workspace.workspaceFile,
    addProject,
    hasProject,
    showInfoMessage: (message) => vscode.window.showInformationMessage(message),
    showWarningMessage: (message) => vscode.window.showWarningMessage(message),
    showErrorMessage: (message) => vscode.window.showErrorMessage(message)
  };
}
