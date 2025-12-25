import * as assert from 'assert';
import * as vscode from 'vscode';
import { WebviewManager, WebviewPanelInterface, CreateWebviewPanelFn } from '../../webviewManager';
import { ExtensionToWebviewMessage, WebviewToExtensionMessage, Project, AsciiArtConfig } from '../../types';

/**
 * モック用のDisposable
 */
interface MockDisposable {
  dispose: () => void;
}

/**
 * モック用のEvent
 */
function createMockEvent<T>(): {
  event: vscode.Event<T>;
  fire: (data: T) => void;
  handlers: Array<(data: T) => void>;
} {
  const handlers: Array<(data: T) => void> = [];
  const event = (handler: (data: T) => void): MockDisposable => {
    handlers.push(handler);
    return {
      dispose: () => {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  };
  const fire = (data: T) => {
    for (const handler of handlers) {
      handler(data);
    }
  };
  return { event: event as vscode.Event<T>, fire, handlers };
}

suite('WebviewManager Test Suite', () => {
  let extensionUri: vscode.Uri;
  let mockPanel: WebviewPanelInterface;
  let createPanelCalls: Array<{
    viewType: string;
    title: string;
    showOptions: vscode.ViewColumn | { viewColumn: vscode.ViewColumn; preserveFocus?: boolean };
    options: vscode.WebviewPanelOptions & vscode.WebviewOptions;
  }>;
  let disposeEvent: ReturnType<typeof createMockEvent<void>>;
  let messageEvent: ReturnType<typeof createMockEvent<WebviewToExtensionMessage>>;
  let postedMessages: ExtensionToWebviewMessage[];
  let revealCalls: Array<{ viewColumn?: vscode.ViewColumn; preserveFocus?: boolean }>;
  let panelDisposed: boolean;

  function createMockPanel(): WebviewPanelInterface {
    disposeEvent = createMockEvent<void>();
    messageEvent = createMockEvent<WebviewToExtensionMessage>();
    panelDisposed = false;

    return {
      webview: {
        html: '',
        options: { enableScripts: true },
        postMessage: (message: ExtensionToWebviewMessage) => {
          postedMessages.push(message);
          return Promise.resolve(true);
        },
        onDidReceiveMessage: messageEvent.event
      },
      reveal: (viewColumn?: vscode.ViewColumn, preserveFocus?: boolean) => {
        revealCalls.push({ viewColumn, preserveFocus });
      },
      dispose: () => {
        panelDisposed = true;
        disposeEvent.fire();
      },
      onDidDispose: disposeEvent.event,
      visible: true
    };
  }

  setup(() => {
    extensionUri = vscode.Uri.file('/tmp/test-extension');
    createPanelCalls = [];
    postedMessages = [];
    revealCalls = [];
    mockPanel = createMockPanel();
  });

  test('showDashboard creates WebviewPanel with correct options', async () => {
    const createPanel: CreateWebviewPanelFn = (viewType, title, showOptions, options) => {
      createPanelCalls.push({ viewType, title, showOptions, options });
      return mockPanel;
    };

    const manager = new WebviewManager(extensionUri, createPanel);
    await manager.showDashboard();

    assert.strictEqual(createPanelCalls.length, 1);
    assert.strictEqual(createPanelCalls[0].viewType, 'startBoard.dashboard');
    assert.strictEqual(createPanelCalls[0].title, 'Start Board');
    assert.strictEqual(createPanelCalls[0].options.enableScripts, true);
    assert.strictEqual(createPanelCalls[0].options.retainContextWhenHidden, true);
  });

  test('showDashboard reveals existing panel instead of creating new one', async () => {
    const createPanel: CreateWebviewPanelFn = (viewType, title, showOptions, options) => {
      createPanelCalls.push({ viewType, title, showOptions, options });
      return mockPanel;
    };

    const manager = new WebviewManager(extensionUri, createPanel);

    await manager.showDashboard();
    await manager.showDashboard();

    assert.strictEqual(createPanelCalls.length, 1, 'Panel should only be created once');
    assert.strictEqual(revealCalls.length, 1, 'reveal should be called for second showDashboard');
  });

  test('isVisible returns correct state', async () => {
    const manager = new WebviewManager(extensionUri, () => mockPanel);

    assert.strictEqual(manager.isVisible(), false, 'Should be false before showing');

    await manager.showDashboard();
    assert.strictEqual(manager.isVisible(), true, 'Should be true after showing');

    manager.hideDashboard();
    assert.strictEqual(manager.isVisible(), false, 'Should be false after hiding');
  });

  test('hideDashboard disposes the panel', async () => {
    const manager = new WebviewManager(extensionUri, () => mockPanel);

    await manager.showDashboard();
    manager.hideDashboard();

    assert.strictEqual(panelDisposed, true, 'Panel should be disposed');
    assert.strictEqual(manager.isVisible(), false, 'Should not be visible after hide');
  });

  test('sendMessage posts message to webview', async () => {
    const manager = new WebviewManager(extensionUri, () => mockPanel);
    await manager.showDashboard();

    const testProjects: Project[] = [{
      id: 'test-id',
      name: 'Test Project',
      path: '/path/to/project',
      type: 'folder',
      addedAt: Date.now()
    }];

    const testConfig: AsciiArtConfig = {
      text: 'Welcome',
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 1.2
    };

    const message: ExtensionToWebviewMessage = {
      type: 'init',
      projects: testProjects,
      config: testConfig
    };

    manager.sendMessage(message);

    assert.strictEqual(postedMessages.length, 1);
    assert.deepStrictEqual(postedMessages[0], message);
  });

  test('onMessage receives messages from webview', async () => {
    const manager = new WebviewManager(extensionUri, () => mockPanel);
    await manager.showDashboard();

    const receivedMessages: WebviewToExtensionMessage[] = [];
    manager.onMessage((msg) => {
      receivedMessages.push(msg);
    });

    const testMessage: WebviewToExtensionMessage = { type: 'ready' };
    messageEvent.fire(testMessage);

    assert.strictEqual(receivedMessages.length, 1);
    assert.deepStrictEqual(receivedMessages[0], testMessage);
  });

  test('onDidDispose is called when panel is disposed', async () => {
    const manager = new WebviewManager(extensionUri, () => mockPanel);
    await manager.showDashboard();

    let disposeCalled = false;
    manager.onDidDispose(() => {
      disposeCalled = true;
    });

    mockPanel.dispose();

    assert.strictEqual(disposeCalled, true, 'Dispose handler should be called');
    assert.strictEqual(manager.isVisible(), false, 'Should not be visible after dispose');
  });

  test('panel reference is cleared after dispose', async () => {
    const createPanel: CreateWebviewPanelFn = (viewType, title, showOptions, options) => {
      createPanelCalls.push({ viewType, title, showOptions, options });
      return createMockPanel();
    };

    const manager = new WebviewManager(extensionUri, createPanel);

    await manager.showDashboard();
    disposeEvent.fire();

    // パネルが破棄された後、再度showDashboardを呼ぶと新しいパネルが作成される
    await manager.showDashboard();

    assert.strictEqual(createPanelCalls.length, 2, 'New panel should be created after dispose');
  });

  test('dispose cleans up all resources', async () => {
    const manager = new WebviewManager(extensionUri, () => mockPanel);

    await manager.showDashboard();
    manager.dispose();

    assert.strictEqual(panelDisposed, true, 'Panel should be disposed');
    assert.strictEqual(manager.isVisible(), false, 'Should not be visible after dispose');
  });

  test('sendMessage does nothing when panel is not created', () => {
    const manager = new WebviewManager(extensionUri, () => mockPanel);

    const message: ExtensionToWebviewMessage = {
      type: 'projectsUpdated',
      projects: []
    };

    // パネルがない状態でsendMessageを呼んでも例外を投げない
    assert.doesNotThrow(() => {
      manager.sendMessage(message);
    });

    assert.strictEqual(postedMessages.length, 0, 'No message should be posted');
  });

  test('multiple message handlers receive messages', async () => {
    const manager = new WebviewManager(extensionUri, () => mockPanel);
    await manager.showDashboard();

    const receivedMessages1: WebviewToExtensionMessage[] = [];
    const receivedMessages2: WebviewToExtensionMessage[] = [];

    manager.onMessage((msg) => {
      receivedMessages1.push(msg);
    });
    manager.onMessage((msg) => {
      receivedMessages2.push(msg);
    });

    const testMessage: WebviewToExtensionMessage = { type: 'ready' };
    messageEvent.fire(testMessage);

    assert.strictEqual(receivedMessages1.length, 1);
    assert.strictEqual(receivedMessages2.length, 1);
  });

  test('message handler disposable removes handler', async () => {
    const manager = new WebviewManager(extensionUri, () => mockPanel);
    await manager.showDashboard();

    const receivedMessages: WebviewToExtensionMessage[] = [];
    const disposable = manager.onMessage((msg) => {
      receivedMessages.push(msg);
    });

    const testMessage1: WebviewToExtensionMessage = { type: 'ready' };
    messageEvent.fire(testMessage1);

    assert.strictEqual(receivedMessages.length, 1);

    disposable.dispose();

    const testMessage2: WebviewToExtensionMessage = { type: 'ready' };
    messageEvent.fire(testMessage2);

    assert.strictEqual(receivedMessages.length, 1, 'Handler should not receive message after dispose');
  });

  // Task 4.1: ダッシュボード基本レイアウトのテスト
  suite('Dashboard HTML Content (Task 4.1)', () => {
    test('HTML contains splash container and project list container', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      assert.ok(html.includes('class="splash-container"'), 'HTML should contain splash container');
      assert.ok(html.includes('class="project-list-container"'), 'HTML should contain project list container');
    });

    test('HTML uses VSCode theme variables', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      assert.ok(html.includes('var(--vscode-font-family)'), 'HTML should use --vscode-font-family');
      assert.ok(html.includes('var(--vscode-foreground)'), 'HTML should use --vscode-foreground');
      assert.ok(html.includes('var(--vscode-editor-background)'), 'HTML should use --vscode-editor-background');
      assert.ok(html.includes('var(--vscode-list-hoverBackground)'), 'HTML should use --vscode-list-hoverBackground');
      assert.ok(html.includes('var(--vscode-descriptionForeground)'), 'HTML should use --vscode-descriptionForeground');
    });

    test('HTML uses flexbox for vertical layout', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      assert.ok(html.includes('display: flex'), 'HTML should use display: flex');
      assert.ok(html.includes('flex-direction: column'), 'HTML should use flex-direction: column');
    });

    test('HTML includes Content Security Policy', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      assert.ok(html.includes('Content-Security-Policy'), 'HTML should include Content-Security-Policy meta tag');
      assert.ok(html.includes("default-src 'none'"), 'CSP should have default-src none');
    });

    test('HTML uses acquireVsCodeApi', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      assert.ok(html.includes('acquireVsCodeApi()'), 'HTML should call acquireVsCodeApi');
    });

    test('HTML contains splash text element with pre tag', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      assert.ok(html.includes('<pre class="splash-text"'), 'HTML should contain pre tag for splash text');
      assert.ok(html.includes('id="splash"'), 'Splash element should have id="splash"');
    });

    test('HTML contains project list element', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      assert.ok(html.includes('class="project-list"'), 'HTML should contain project list element');
      assert.ok(html.includes('id="project-list"'), 'Project list should have id="project-list"');
    });
  });

  // Task 4.2: アスキーアートスプラッシュスクリーンのテスト
  suite('ASCII Art Splash Screen (Task 4.2)', () => {
    test('HTML contains pre tag for ASCII art display', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // preタグでアスキーアートテキストを表示する
      assert.ok(html.includes('<pre class="splash-text"'), 'HTML should contain pre tag with splash-text class');
      assert.ok(html.includes('id="splash"'), 'Splash element should have id="splash"');
    });

    test('HTML contains renderSplash function that applies font settings', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // 設定から取得したフォントファミリーを適用する
      assert.ok(html.includes('splash.style.fontFamily = config.fontFamily'), 'renderSplash should apply fontFamily from config');
      // 設定から取得したフォントサイズをピクセル単位で適用する
      assert.ok(html.includes("splash.style.fontSize = config.fontSize + 'px'"), 'renderSplash should apply fontSize in pixels');
      // 設定から取得したライン幅（line-height）を適用する
      assert.ok(html.includes('splash.style.lineHeight = config.lineHeight'), 'renderSplash should apply lineHeight from config');
    });

    test('HTML splash container has center text alignment', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // テキストを中央に配置する
      assert.ok(html.includes('.splash-container'), 'HTML should have splash-container class');
      assert.ok(html.includes('text-align: center'), 'Splash container should have text-align: center');
    });

    test('HTML contains handler for configUpdated message', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // 設定更新メッセージ受信時に表示を更新する
      assert.ok(html.includes("case 'configUpdated':"), 'HTML should handle configUpdated message');
      // configUpdatedでrenderSplashが呼ばれることを確認
      assert.ok(html.includes('config = message.config'), 'configUpdated handler should update config');
      // renderSplashはcase 'configUpdated':の後に呼ばれる
      const configUpdatedIndex = html.indexOf("case 'configUpdated':");
      const renderSplashAfterConfigUpdated = html.indexOf('renderSplash()', configUpdatedIndex);
      assert.ok(renderSplashAfterConfigUpdated > configUpdatedIndex, 'configUpdated should call renderSplash');
    });

    test('HTML initializes splash in init message handler', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // 初期化メッセージでもsplashが描画されることを確認
      assert.ok(html.includes("case 'init':"), 'HTML should handle init message');
      const initIndex = html.indexOf("case 'init':");
      const renderSplashAfterInit = html.indexOf('renderSplash()', initIndex);
      assert.ok(renderSplashAfterInit > initIndex, 'init should call renderSplash');
    });

    test('HTML sets textContent for splash element', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // textContentを使ってテキストを設定（XSS対策）
      assert.ok(html.includes('splash.textContent = config.text'), 'renderSplash should use textContent for security');
    });

    test('HTML splash-text has white-space: pre for ASCII art formatting', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // アスキーアートのフォーマットを保持するためにwhite-space: preを使用
      assert.ok(html.includes('.splash-text'), 'HTML should have splash-text class definition');
      assert.ok(html.includes('white-space: pre'), 'splash-text should have white-space: pre for ASCII art formatting');
    });

    test('HTML contains default config values', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // デフォルト設定値の確認
      assert.ok(html.includes("text: 'Welcome'"), 'Default text should be Welcome');
      assert.ok(html.includes("fontFamily: 'monospace'"), 'Default fontFamily should be monospace');
      assert.ok(html.includes('fontSize: 14'), 'Default fontSize should be 14');
      assert.ok(html.includes('lineHeight: 1.2'), 'Default lineHeight should be 1.2');
    });

    test('sendMessage with configUpdated type is properly handled', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const testConfig: AsciiArtConfig = {
        text: 'Custom ASCII Art',
        fontFamily: 'Consolas',
        fontSize: 16,
        lineHeight: 1.5
      };

      const message: ExtensionToWebviewMessage = {
        type: 'configUpdated',
        config: testConfig
      };

      manager.sendMessage(message);

      assert.strictEqual(postedMessages.length, 1);
      assert.strictEqual(postedMessages[0].type, 'configUpdated');
      assert.deepStrictEqual((postedMessages[0] as { type: 'configUpdated'; config: AsciiArtConfig }).config, testConfig);
    });
  });

  // Task 4.3: プロジェクト一覧コンポーネントのテスト
  suite('Project List Component (Task 4.3)', () => {
    test('HTML contains renderProjects function', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // プロジェクト配列を受け取り、リスト形式で表示する関数が存在する
      assert.ok(html.includes('function renderProjects()'), 'HTML should contain renderProjects function');
    });

    test('renderProjects creates project items with name and path', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // 各プロジェクト項目にプロジェクト名とパスを表示する
      assert.ok(html.includes('class="project-name"'), 'HTML should have project-name class');
      assert.ok(html.includes('class="project-path"'), 'HTML should have project-path class');
      assert.ok(html.includes('project.name'), 'renderProjects should use project.name');
      assert.ok(html.includes('project.path'), 'renderProjects should use project.path');
    });

    test('renderProjects shows empty message when projects array is empty', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // プロジェクトが空の場合は「プロジェクトがありません」のメッセージを表示する
      assert.ok(html.includes('projects.length === 0'), 'renderProjects should check if projects array is empty');
      assert.ok(html.includes('プロジェクトがありません'), 'HTML should show empty message in Japanese');
      assert.ok(html.includes('class="empty-message"'), 'Empty message should have empty-message class');
    });

    test('HTML handles projectsUpdated message and calls renderProjects', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // プロジェクト更新メッセージ受信時にリストを再描画する
      assert.ok(html.includes("case 'projectsUpdated':"), 'HTML should handle projectsUpdated message');
      const projectsUpdatedIndex = html.indexOf("case 'projectsUpdated':");
      const renderProjectsAfterUpdate = html.indexOf('renderProjects()', projectsUpdatedIndex);
      assert.ok(renderProjectsAfterUpdate > projectsUpdatedIndex, 'projectsUpdated should call renderProjects');
    });

    test('HTML initializes project list in init message handler', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // 初期化メッセージでプロジェクトリストも描画されることを確認
      assert.ok(html.includes("case 'init':"), 'HTML should handle init message');
      const initIndex = html.indexOf("case 'init':");
      const renderProjectsAfterInit = html.indexOf('renderProjects()', initIndex);
      assert.ok(renderProjectsAfterInit > initIndex, 'init should call renderProjects');
    });

    test('HTML contains project list element with correct structure', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // プロジェクトリストのDOM構造を確認
      assert.ok(html.includes('<ul class="project-list"'), 'HTML should have ul with project-list class');
      assert.ok(html.includes('id="project-list"'), 'Project list should have id="project-list"');
    });

    test('renderProjects uses innerHTML to clear and rebuild list', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // リストの再描画時にinnerHTMLでクリアする
      assert.ok(html.includes("list.innerHTML = ''") || html.includes('list.innerHTML = ""'), 'renderProjects should clear list using innerHTML');
    });

    test('renderProjects iterates over projects array', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // プロジェクト配列をループで処理する
      assert.ok(html.includes('for (const project of projects)') || html.includes('projects.forEach'), 'renderProjects should iterate over projects');
    });

    test('sendMessage with projectsUpdated type is properly handled', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const testProjects: Project[] = [
        {
          id: 'project-1',
          name: 'Project One',
          path: '/path/to/project-one',
          type: 'folder',
          addedAt: Date.now()
        },
        {
          id: 'project-2',
          name: 'Project Two',
          path: '/path/to/project-two',
          type: 'workspace',
          addedAt: Date.now()
        }
      ];

      const message: ExtensionToWebviewMessage = {
        type: 'projectsUpdated',
        projects: testProjects
      };

      manager.sendMessage(message);

      assert.strictEqual(postedMessages.length, 1);
      assert.strictEqual(postedMessages[0].type, 'projectsUpdated');
      assert.deepStrictEqual((postedMessages[0] as { type: 'projectsUpdated'; projects: Project[] }).projects, testProjects);
    });

    test('project item escapes HTML to prevent XSS', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // XSS対策としてHTMLエスケープ関数が存在する
      assert.ok(html.includes('escapeHtml'), 'HTML should have escapeHtml function for XSS prevention');
      assert.ok(html.includes('escapeHtml(project.name)'), 'Project name should be escaped');
      assert.ok(html.includes('escapeHtml(project.path)'), 'Project path should be escaped');
    });

    test('project item has project-item class for styling', async () => {
      const manager = new WebviewManager(extensionUri, () => mockPanel);
      await manager.showDashboard();

      const html = mockPanel.webview.html;
      // プロジェクト項目にproject-itemクラスがある
      assert.ok(html.includes("li.className = 'project-item'") || html.includes('class="project-item"'), 'Project items should have project-item class');
    });
  });
});
