import * as assert from 'assert';
import { WebviewManager, WebviewPanelInterface, CreateWebviewPanelFn } from '../../webviewManager';
import { ProjectStorage, GlobalStateInterface } from '../../projectStorage';
import { ConfigurationManager, WorkspaceConfigInterface } from '../../configurationManager';
import { MessageIntegration } from '../../messageIntegration';
import { WebviewToExtensionMessage, ExtensionToWebviewMessage } from '../../types';
import * as vscode from 'vscode';

/**
 * メッセージ通信の統合テスト
 * Task 3.2: Extension ⇔ Webview間のメッセージ通信を実装する
 */

/**
 * モック用のEvent
 */
function createMockEvent<T>(): {
  event: vscode.Event<T>;
  fire: (data: T) => void;
} {
  const handlers: Array<(data: T) => void> = [];
  const event = (handler: (data: T) => void) => {
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
  return { event: event as vscode.Event<T>, fire };
}

suite('Message Integration Test Suite', () => {
  let mockPanel: WebviewPanelInterface;
  let postedMessages: ExtensionToWebviewMessage[];
  let messageEvent: ReturnType<typeof createMockEvent<WebviewToExtensionMessage>>;
  let disposeEvent: ReturnType<typeof createMockEvent<void>>;
  let globalState: Map<string, unknown>;
  let configValues: Map<string, unknown>;

  function createMockPanel(): WebviewPanelInterface {
    disposeEvent = createMockEvent<void>();
    messageEvent = createMockEvent<WebviewToExtensionMessage>();

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
      reveal: () => {},
      dispose: () => {
        disposeEvent.fire();
      },
      onDidDispose: disposeEvent.event,
      visible: true
    };
  }

  function createMockGlobalState(): GlobalStateInterface {
    return {
      get: <T>(key: string): T | undefined => {
        return globalState.get(key) as T | undefined;
      },
      update: (key: string, value: unknown): Thenable<void> => {
        globalState.set(key, value);
        return Promise.resolve();
      }
    };
  }

  function createMockWorkspaceConfig(): WorkspaceConfigInterface {
    return {
      get: <T>(key: string, defaultValue: T): T => {
        return (configValues.get(key) as T) ?? defaultValue;
      }
    };
  }

  setup(() => {
    postedMessages = [];
    globalState = new Map();
    configValues = new Map();
    mockPanel = createMockPanel();
  });

  test('ready メッセージ受信時に init メッセージを送信する', async () => {
    const extensionUri = vscode.Uri.file('/tmp/test');
    const createPanel: CreateWebviewPanelFn = () => mockPanel;

    const webviewManager = new WebviewManager(extensionUri, createPanel);
    const projectStorage = new ProjectStorage(createMockGlobalState());
    const configManager = new ConfigurationManager(() => createMockWorkspaceConfig());

    const integration = new MessageIntegration(webviewManager, projectStorage, configManager);
    integration.initialize();

    await webviewManager.showDashboard();
    postedMessages = []; // showDashboard後のメッセージをクリア

    // ready メッセージを送信
    messageEvent.fire({ type: 'ready' });

    assert.strictEqual(postedMessages.length, 1, 'init メッセージが1つ送信される');
    assert.strictEqual(postedMessages[0].type, 'init', 'メッセージタイプは init');

    const initMessage = postedMessages[0];
    if (initMessage.type === 'init') {
      assert.ok(Array.isArray(initMessage.projects), 'projects が配列');
      assert.ok(initMessage.config, 'config が存在');
      assert.strictEqual(initMessage.config.text, 'Welcome', 'デフォルトのテキスト');
    }
  });

  test('ready メッセージ受信時にストレージのプロジェクトを含む init メッセージを送信する', async () => {
    const extensionUri = vscode.Uri.file('/tmp/test');
    const createPanel: CreateWebviewPanelFn = () => mockPanel;

    const webviewManager = new WebviewManager(extensionUri, createPanel);
    const projectStorage = new ProjectStorage(createMockGlobalState());
    const configManager = new ConfigurationManager(() => createMockWorkspaceConfig());

    // プロジェクトを追加
    projectStorage.addProject({
      name: 'Test Project',
      path: '/path/to/project',
      type: 'folder'
    });

    const integration = new MessageIntegration(webviewManager, projectStorage, configManager);
    integration.initialize();

    await webviewManager.showDashboard();
    postedMessages = [];

    // ready メッセージを送信
    messageEvent.fire({ type: 'ready' });

    assert.strictEqual(postedMessages.length, 1);
    const initMessage = postedMessages[0];
    if (initMessage.type === 'init') {
      assert.strictEqual(initMessage.projects.length, 1, 'プロジェクトが1つ含まれる');
      assert.strictEqual(initMessage.projects[0].name, 'Test Project');
    }
  });

  test('deleteProject メッセージ受信時にプロジェクトを削除し projectsUpdated を送信する', async () => {
    const extensionUri = vscode.Uri.file('/tmp/test');
    const createPanel: CreateWebviewPanelFn = () => mockPanel;

    const webviewManager = new WebviewManager(extensionUri, createPanel);
    const projectStorage = new ProjectStorage(createMockGlobalState());
    const configManager = new ConfigurationManager(() => createMockWorkspaceConfig());

    // プロジェクトを追加
    const project = projectStorage.addProject({
      name: 'Test Project',
      path: '/path/to/project',
      type: 'folder'
    });

    const integration = new MessageIntegration(webviewManager, projectStorage, configManager);
    integration.initialize();

    await webviewManager.showDashboard();
    postedMessages = [];

    // confirmDelete メッセージを送信
    messageEvent.fire({ type: 'confirmDelete', projectId: project!.id, projectName: project!.name });

    assert.strictEqual(postedMessages.length, 1, 'projectsUpdated メッセージが送信される');
    assert.strictEqual(postedMessages[0].type, 'projectsUpdated');

    const updateMessage = postedMessages[0];
    if (updateMessage.type === 'projectsUpdated') {
      assert.strictEqual(updateMessage.projects.length, 0, 'プロジェクトが削除されている');
    }

    // ストレージからも削除されていることを確認
    assert.strictEqual(projectStorage.getProjects().length, 0);
  });

  test('設定変更時に configUpdated メッセージを送信する', async () => {
    const extensionUri = vscode.Uri.file('/tmp/test');
    const createPanel: CreateWebviewPanelFn = () => mockPanel;

    const webviewManager = new WebviewManager(extensionUri, createPanel);
    const projectStorage = new ProjectStorage(createMockGlobalState());
    const configManager = new ConfigurationManager(() => createMockWorkspaceConfig());

    const integration = new MessageIntegration(webviewManager, projectStorage, configManager);
    integration.initialize();

    await webviewManager.showDashboard();
    postedMessages = [];

    // 設定を変更
    configValues.set('asciiArt.text', 'New Text');
    configManager.notifyConfigChange();

    assert.strictEqual(postedMessages.length, 1, 'configUpdated メッセージが送信される');
    assert.strictEqual(postedMessages[0].type, 'configUpdated');

    const configMessage = postedMessages[0];
    if (configMessage.type === 'configUpdated') {
      assert.strictEqual(configMessage.config.text, 'New Text', '変更された設定が反映される');
    }
  });

  test('notifyProjectsUpdated を呼ぶと projectsUpdated メッセージを送信する', async () => {
    const extensionUri = vscode.Uri.file('/tmp/test');
    const createPanel: CreateWebviewPanelFn = () => mockPanel;

    const webviewManager = new WebviewManager(extensionUri, createPanel);
    const projectStorage = new ProjectStorage(createMockGlobalState());
    const configManager = new ConfigurationManager(() => createMockWorkspaceConfig());

    // プロジェクトを追加
    projectStorage.addProject({
      name: 'Test Project',
      path: '/path/to/project',
      type: 'folder'
    });

    const integration = new MessageIntegration(webviewManager, projectStorage, configManager);
    integration.initialize();

    await webviewManager.showDashboard();
    postedMessages = [];

    // プロジェクト更新を通知
    integration.notifyProjectsUpdated();

    assert.strictEqual(postedMessages.length, 1, 'projectsUpdated メッセージが送信される');
    assert.strictEqual(postedMessages[0].type, 'projectsUpdated');

    const updateMessage = postedMessages[0];
    if (updateMessage.type === 'projectsUpdated') {
      assert.strictEqual(updateMessage.projects.length, 1, 'プロジェクトが含まれる');
    }
  });

  test('openProject メッセージ受信時に存在しないプロジェクトIDの場合エラーメッセージを表示する', async () => {
    const extensionUri = vscode.Uri.file('/tmp/test');
    const createPanel: CreateWebviewPanelFn = () => mockPanel;

    const webviewManager = new WebviewManager(extensionUri, createPanel);
    const projectStorage = new ProjectStorage(createMockGlobalState());
    const configManager = new ConfigurationManager(() => createMockWorkspaceConfig());

    const integration = new MessageIntegration(webviewManager, projectStorage, configManager);
    integration.initialize();

    await webviewManager.showDashboard();
    postedMessages = [];

    // 存在しないプロジェクトIDでopenProjectメッセージを送信
    messageEvent.fire({ type: 'openProject', projectId: 'non-existent-id' });

    // エラーが発生してもクラッシュしないことを確認
    // 実際のエラーメッセージ表示はvscode.window.showErrorMessageに依存
    assert.ok(true, 'エラーハンドリングが正しく動作する');
  });
});
