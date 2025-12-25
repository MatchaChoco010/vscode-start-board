import * as vscode from 'vscode';
import { ExtensionToWebviewMessage, WebviewToExtensionMessage } from './types';

/**
 * WebviewPanelの抽象インターフェース（テスト用）
 */
export interface WebviewPanelInterface {
  webview: {
    html: string;
    options: vscode.WebviewOptions;
    postMessage(message: ExtensionToWebviewMessage): Thenable<boolean>;
    onDidReceiveMessage: vscode.Event<WebviewToExtensionMessage>;
  };
  reveal(viewColumn?: vscode.ViewColumn, preserveFocus?: boolean): void;
  dispose(): void;
  onDidDispose: vscode.Event<void>;
  visible: boolean;
}

/**
 * WebviewPanel作成関数の型
 */
export type CreateWebviewPanelFn = (
  viewType: string,
  title: string,
  showOptions: vscode.ViewColumn | { viewColumn: vscode.ViewColumn; preserveFocus?: boolean },
  options: vscode.WebviewPanelOptions & vscode.WebviewOptions
) => WebviewPanelInterface;

/**
 * Webviewパネルのライフサイクル管理とメッセージ通信を担当するクラス
 *
 * 責務:
 * - WebviewPanelの作成、表示、破棄を管理
 * - Extension ⇔ Webview間のメッセージパッシング
 * - 設定変更時のWebview更新
 * - 単一インスタンスの保証（シングルトン）
 */
export class WebviewManager {
  private panel: WebviewPanelInterface | null = null;
  private extensionUri: vscode.Uri;
  private createPanel: CreateWebviewPanelFn;
  private messageHandlers: Set<(message: WebviewToExtensionMessage) => void> = new Set();
  private disposeHandler: (() => void) | null = null;
  private messageDisposable: vscode.Disposable | null = null;
  private panelDisposeDisposable: vscode.Disposable | null = null;

  /**
   * WebviewManagerを作成する
   * @param extensionUri 拡張機能のURI
   * @param createPanel WebviewPanel作成関数（テスト時にモックを注入可能）
   */
  constructor(extensionUri: vscode.Uri, createPanel?: CreateWebviewPanelFn) {
    this.extensionUri = extensionUri;
    this.createPanel = createPanel ?? ((viewType, title, showOptions, options) => {
      return vscode.window.createWebviewPanel(viewType, title, showOptions, options) as unknown as WebviewPanelInterface;
    });
  }

  /**
   * ダッシュボードを表示する
   * 既にパネルが存在する場合は再表示する
   */
  async showDashboard(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = this.createPanel(
      'startBoard.dashboard',
      'Start Board',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri]
      }
    );

    this.panel.webview.html = this.getHtmlContent();

    this.panelDisposeDisposable = this.panel.onDidDispose(() => {
      this.panel = null;
      this.messageDisposable?.dispose();
      this.messageDisposable = null;
      this.panelDisposeDisposable?.dispose();
      this.panelDisposeDisposable = null;
      if (this.disposeHandler) {
        this.disposeHandler();
      }
    });

    this.messageDisposable = this.panel.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      for (const handler of this.messageHandlers) {
        handler(message);
      }
    });
  }

  /**
   * ダッシュボードを非表示にする
   */
  hideDashboard(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }

  /**
   * ダッシュボードが表示されているかを返す
   */
  isVisible(): boolean {
    return this.panel?.visible ?? false;
  }

  /**
   * Webviewにメッセージを送信する
   */
  sendMessage(message: ExtensionToWebviewMessage): void {
    if (this.panel) {
      this.panel.webview.postMessage(message);
    }
  }

  /**
   * Webviewからのメッセージハンドラーを登録する
   */
  onMessage(handler: (message: WebviewToExtensionMessage) => void): vscode.Disposable {
    this.messageHandlers.add(handler);
    return {
      dispose: () => {
        this.messageHandlers.delete(handler);
      }
    };
  }

  /**
   * パネルが破棄された時のハンドラーを登録する
   */
  onDidDispose(handler: () => void): vscode.Disposable {
    this.disposeHandler = handler;
    return {
      dispose: () => {
        this.disposeHandler = null;
      }
    };
  }

  /**
   * リソースをクリーンアップする
   */
  dispose(): void {
    this.hideDashboard();
    this.messageHandlers.clear();
    this.disposeHandler = null;
  }

  /**
   * WebviewのHTMLコンテンツを生成する
   */
  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Start Board</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .splash-container {
      flex: 0 0 auto;
      margin-bottom: 40px;
      text-align: center;
    }
    .splash-text {
      white-space: pre;
      font-family: monospace;
    }
    .project-list-container {
      flex: 1 1 auto;
      width: 100%;
      max-width: 600px;
    }
    .project-list-title {
      font-size: 1.2em;
      margin-bottom: 16px;
      color: var(--vscode-foreground);
    }
    .project-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .project-item {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.1s;
    }
    .project-item:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
    .project-info {
      flex: 1;
    }
    .project-name {
      font-weight: 500;
    }
    .project-path {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }
    .delete-button {
      opacity: 0;
      background: none;
      border: none;
      color: var(--vscode-errorForeground);
      cursor: pointer;
      padding: 4px 8px;
      font-size: 16px;
    }
    .project-item:hover .delete-button {
      opacity: 1;
    }
    .empty-message {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="splash-container">
    <pre class="splash-text" id="splash"></pre>
  </div>
  <div class="project-list-container">
    <h2 class="project-list-title">Projects</h2>
    <ul class="project-list" id="project-list"></ul>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    let projects = [];
    let config = {
      text: 'Welcome',
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 1.2
    };

    function renderSplash() {
      const splash = document.getElementById('splash');
      splash.textContent = config.text;
      splash.style.fontFamily = config.fontFamily;
      splash.style.fontSize = config.fontSize + 'px';
      splash.style.lineHeight = config.lineHeight;
    }

    function renderProjects() {
      const list = document.getElementById('project-list');
      list.innerHTML = '';

      if (projects.length === 0) {
        list.innerHTML = '<li class="empty-message">プロジェクトがありません</li>';
        return;
      }

      for (const project of projects) {
        const li = document.createElement('li');
        li.className = 'project-item';
        li.innerHTML = \`
          <div class="project-info">
            <div class="project-name">\${escapeHtml(project.name)}</div>
            <div class="project-path">\${escapeHtml(project.path)}</div>
          </div>
          <button class="delete-button" data-id="\${project.id}">&times;</button>
        \`;

        li.querySelector('.project-info').addEventListener('click', () => {
          vscode.postMessage({ type: 'openProject', projectId: project.id });
        });

        li.querySelector('.delete-button').addEventListener('click', (e) => {
          e.stopPropagation();
          vscode.postMessage({
            type: 'confirmDelete',
            projectId: project.id,
            projectName: project.name
          });
        });

        list.appendChild(li);
      }
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    window.addEventListener('message', (event) => {
      const message = event.data;
      switch (message.type) {
        case 'init':
          projects = message.projects;
          config = message.config;
          renderSplash();
          renderProjects();
          break;
        case 'projectsUpdated':
          projects = message.projects;
          renderProjects();
          break;
        case 'configUpdated':
          config = message.config;
          renderSplash();
          break;
      }
    });

    // 初期化完了を通知
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}

/**
 * VSCode APIを使用したWebviewManagerを作成する
 * @param extensionUri 拡張機能のURI
 */
export function createWebviewManager(extensionUri: vscode.Uri): WebviewManager {
  return new WebviewManager(extensionUri);
}
