import * as assert from 'assert';
import * as vscode from 'vscode';
import { AddProjectCommand, AddProjectDependencies } from '../../commandHandlers';
import { ProjectInput } from '../../types';
import { ProjectStorage } from '../../projectStorage';

/**
 * モック用のProjectStorageインターフェース
 */
function createMockDependencies(overrides?: Partial<AddProjectDependencies>): AddProjectDependencies {
  return {
    getWorkspaceFolders: () => undefined,
    getWorkspaceFile: () => undefined,
    addProject: () => ({
      id: 'test-id',
      name: 'test-project',
      path: '/path/to/project',
      type: 'folder' as const,
      addedAt: Date.now()
    }),
    hasProject: () => false,
    showInfoMessage: () => Promise.resolve(undefined),
    showWarningMessage: () => Promise.resolve(undefined),
    showErrorMessage: () => Promise.resolve(undefined),
    ...overrides
  };
}

/**
 * CommandHandlers のユニットテスト
 */
suite('CommandHandlers Test Suite', () => {
  suite('AddProjectCommand', () => {

    test('フォルダが開かれている場合、プロジェクトを追加する', async () => {
      const mockFolder = {
        uri: { fsPath: '/path/to/project' },
        name: 'project',
        index: 0
      };

      let addedProject: ProjectInput | null = null;
      let infoMessage = '';

      const deps = createMockDependencies({
        getWorkspaceFolders: () => [mockFolder] as unknown as readonly vscode.WorkspaceFolder[],
        addProject: (input) => {
          addedProject = input;
          return {
            id: 'generated-id',
            name: input.name,
            path: input.path,
            type: input.type,
            addedAt: Date.now()
          };
        },
        showInfoMessage: (message) => {
          infoMessage = message;
          return Promise.resolve(undefined);
        }
      });

      const command = new AddProjectCommand(deps);
      const result = await command.execute();

      assert.strictEqual(result.success, true);
      assert.ok(addedProject !== null);
      const project = addedProject as ProjectInput;
      assert.strictEqual(project.name, 'project');
      assert.strictEqual(project.path, '/path/to/project');
      assert.strictEqual(project.type, 'folder');
      assert.ok(infoMessage.includes('追加しました'));
    });

    test('ワークスペースファイルが開かれている場合、プロジェクトを追加する', async () => {
      const mockWorkspaceFile = {
        fsPath: '/path/to/project.code-workspace',
        path: '/path/to/project.code-workspace'
      };

      let addedProject: ProjectInput | null = null;

      const deps = createMockDependencies({
        getWorkspaceFolders: () => undefined,
        getWorkspaceFile: () => mockWorkspaceFile as unknown as vscode.Uri,
        addProject: (input) => {
          addedProject = input;
          return {
            id: 'generated-id',
            name: input.name,
            path: input.path,
            type: input.type,
            addedAt: Date.now()
          };
        }
      });

      const command = new AddProjectCommand(deps);
      const result = await command.execute();

      assert.strictEqual(result.success, true);
      assert.ok(addedProject !== null);
      const project = addedProject as ProjectInput;
      assert.strictEqual(project.name, 'project');
      assert.strictEqual(project.path, '/path/to/project.code-workspace');
      assert.strictEqual(project.type, 'workspace');
    });

    test('フォルダもワークスペースも開かれていない場合、エラーメッセージを表示する', async () => {
      let errorMessage = '';

      const deps = createMockDependencies({
        getWorkspaceFolders: () => undefined,
        getWorkspaceFile: () => undefined,
        showErrorMessage: (message) => {
          errorMessage = message;
          return Promise.resolve(undefined);
        }
      });

      const command = new AddProjectCommand(deps);
      const result = await command.execute();

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'no-workspace');
      assert.ok(errorMessage.includes('フォルダまたはワークスペースを開いてください'));
    });

    test('同じパスのプロジェクトが既に存在する場合、警告メッセージを表示する', async () => {
      const mockFolder = {
        uri: { fsPath: '/path/to/project' },
        name: 'project',
        index: 0
      };

      let warningMessage = '';

      const deps = createMockDependencies({
        getWorkspaceFolders: () => [mockFolder] as unknown as readonly vscode.WorkspaceFolder[],
        hasProject: () => true,
        showWarningMessage: (message) => {
          warningMessage = message;
          return Promise.resolve(undefined);
        }
      });

      const command = new AddProjectCommand(deps);
      const result = await command.execute();

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'duplicate');
      assert.ok(warningMessage.includes('既に追加されています'));
    });

    test('複数のワークスペースフォルダがある場合、最初のフォルダを使用する', async () => {
      const mockFolders = [
        { uri: { fsPath: '/path/to/first' }, name: 'first', index: 0 },
        { uri: { fsPath: '/path/to/second' }, name: 'second', index: 1 }
      ];

      let addedProject: ProjectInput | null = null;

      const deps = createMockDependencies({
        getWorkspaceFolders: () => mockFolders as unknown as readonly vscode.WorkspaceFolder[],
        addProject: (input) => {
          addedProject = input;
          return {
            id: 'generated-id',
            name: input.name,
            path: input.path,
            type: input.type,
            addedAt: Date.now()
          };
        }
      });

      const command = new AddProjectCommand(deps);
      const result = await command.execute();

      assert.strictEqual(result.success, true);
      assert.ok(addedProject !== null);
      const project = addedProject as ProjectInput;
      assert.strictEqual(project.name, 'first');
      assert.strictEqual(project.path, '/path/to/first');
    });

    test('ワークスペースファイルとフォルダの両方がある場合、ワークスペースファイルを優先する', async () => {
      const mockFolder = {
        uri: { fsPath: '/path/to/folder' },
        name: 'folder',
        index: 0
      };
      const mockWorkspaceFile = {
        fsPath: '/path/to/project.code-workspace',
        path: '/path/to/project.code-workspace'
      };

      let addedProject: ProjectInput | null = null;

      const deps = createMockDependencies({
        getWorkspaceFolders: () => [mockFolder] as unknown as readonly vscode.WorkspaceFolder[],
        getWorkspaceFile: () => mockWorkspaceFile as unknown as vscode.Uri,
        addProject: (input) => {
          addedProject = input;
          return {
            id: 'generated-id',
            name: input.name,
            path: input.path,
            type: input.type,
            addedAt: Date.now()
          };
        }
      });

      const command = new AddProjectCommand(deps);
      const result = await command.execute();

      assert.strictEqual(result.success, true);
      assert.ok(addedProject !== null);
      const project = addedProject as ProjectInput;
      assert.strictEqual(project.type, 'workspace');
      assert.strictEqual(project.path, '/path/to/project.code-workspace');
    });
  });

  /**
   * 統合テスト: CommandHandlers と ProjectStorage の連携
   */
  suite('Integration Tests with ProjectStorage', () => {
    let mockGlobalState: Map<string, unknown>;
    let storage: ProjectStorage;

    setup(() => {
      // モックglobalStateを作成
      mockGlobalState = new Map();
      const globalStateInterface = {
        get: <T>(key: string): T | undefined => mockGlobalState.get(key) as T | undefined,
        update: (key: string, value: unknown): Promise<void> => {
          mockGlobalState.set(key, value);
          return Promise.resolve();
        }
      };
      // 実際のProjectStorageインスタンスを作成
      storage = new ProjectStorage(globalStateInterface);
    });

    test('プロジェクト追加コマンドがStorageと連携してプロジェクトを永続化する', async () => {
      const mockFolder = {
        uri: { fsPath: '/path/to/integration-project' },
        name: 'integration-project',
        index: 0
      };

      let infoMessage = '';

      const deps = createMockDependencies({
        getWorkspaceFolders: () => [mockFolder] as unknown as readonly vscode.WorkspaceFolder[],
        addProject: (input) => storage.addProject(input),
        hasProject: (path) => storage.hasProject(path),
        showInfoMessage: (message) => {
          infoMessage = message;
          return Promise.resolve(undefined);
        }
      });

      const command = new AddProjectCommand(deps);
      const result = await command.execute();

      // コマンドが成功すること
      assert.strictEqual(result.success, true);
      assert.ok(infoMessage.includes('追加しました'));

      // Storageに実際に保存されていることを確認
      const projects = storage.getProjects();
      assert.strictEqual(projects.length, 1);
      assert.strictEqual(projects[0].name, 'integration-project');
      assert.strictEqual(projects[0].path, '/path/to/integration-project');
      assert.strictEqual(projects[0].type, 'folder');
    });

    test('ワークスペース未オープン時のエラーハンドリングが正しく機能する', async () => {
      let errorMessage = '';

      const deps = createMockDependencies({
        getWorkspaceFolders: () => undefined,
        getWorkspaceFile: () => undefined,
        addProject: (input) => storage.addProject(input),
        hasProject: (path) => storage.hasProject(path),
        showErrorMessage: (message) => {
          errorMessage = message;
          return Promise.resolve(undefined);
        }
      });

      const command = new AddProjectCommand(deps);
      const result = await command.execute();

      // コマンドが失敗すること
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'no-workspace');

      // エラーメッセージが表示されること
      assert.ok(errorMessage.includes('フォルダまたはワークスペースを開いてください'));

      // Storageには何も追加されていないこと
      const projects = storage.getProjects();
      assert.strictEqual(projects.length, 0);
    });

    test('重複追加時の警告メッセージが正しく表示される', async () => {
      // まず最初のプロジェクトを追加
      const mockFolder = {
        uri: { fsPath: '/path/to/duplicate-project' },
        name: 'duplicate-project',
        index: 0
      };

      const deps1 = createMockDependencies({
        getWorkspaceFolders: () => [mockFolder] as unknown as readonly vscode.WorkspaceFolder[],
        addProject: (input) => storage.addProject(input),
        hasProject: (path) => storage.hasProject(path)
      });

      const command1 = new AddProjectCommand(deps1);
      const result1 = await command1.execute();

      assert.strictEqual(result1.success, true);
      assert.strictEqual(storage.getProjects().length, 1);

      // 同じプロジェクトを再度追加しようとする
      let warningMessage = '';

      const deps2 = createMockDependencies({
        getWorkspaceFolders: () => [mockFolder] as unknown as readonly vscode.WorkspaceFolder[],
        addProject: (input) => storage.addProject(input),
        hasProject: (path) => storage.hasProject(path),
        showWarningMessage: (message) => {
          warningMessage = message;
          return Promise.resolve(undefined);
        }
      });

      const command2 = new AddProjectCommand(deps2);
      const result2 = await command2.execute();

      // コマンドが失敗すること
      assert.strictEqual(result2.success, false);
      assert.strictEqual(result2.reason, 'duplicate');

      // 警告メッセージが表示されること
      assert.ok(warningMessage.includes('既に追加されています'));

      // Storageには1つのプロジェクトのみが存在すること
      const projects = storage.getProjects();
      assert.strictEqual(projects.length, 1);
    });

    test('複数のプロジェクトを順次追加してStorageに正しく保存される', async () => {
      const mockFolder1 = {
        uri: { fsPath: '/path/to/project1' },
        name: 'project1',
        index: 0
      };

      const mockFolder2 = {
        uri: { fsPath: '/path/to/project2' },
        name: 'project2',
        index: 0
      };

      // 最初のプロジェクトを追加
      const deps1 = createMockDependencies({
        getWorkspaceFolders: () => [mockFolder1] as unknown as readonly vscode.WorkspaceFolder[],
        addProject: (input) => storage.addProject(input),
        hasProject: (path) => storage.hasProject(path)
      });

      const command1 = new AddProjectCommand(deps1);
      await command1.execute();

      // 2番目のプロジェクトを追加
      const deps2 = createMockDependencies({
        getWorkspaceFolders: () => [mockFolder2] as unknown as readonly vscode.WorkspaceFolder[],
        addProject: (input) => storage.addProject(input),
        hasProject: (path) => storage.hasProject(path)
      });

      const command2 = new AddProjectCommand(deps2);
      await command2.execute();

      // Storageに2つのプロジェクトが存在すること
      const projects = storage.getProjects();
      assert.strictEqual(projects.length, 2);
      assert.strictEqual(projects[0].name, 'project1');
      assert.strictEqual(projects[1].name, 'project2');
    });

    test('ワークスペースファイル追加がStorageと正しく連携する', async () => {
      const mockWorkspaceFile = {
        fsPath: '/path/to/my-workspace.code-workspace',
        path: '/path/to/my-workspace.code-workspace'
      };

      const deps = createMockDependencies({
        getWorkspaceFile: () => mockWorkspaceFile as unknown as vscode.Uri,
        addProject: (input) => storage.addProject(input),
        hasProject: (path) => storage.hasProject(path)
      });

      const command = new AddProjectCommand(deps);
      const result = await command.execute();

      // コマンドが成功すること
      assert.strictEqual(result.success, true);

      // Storageに正しく保存されていること
      const projects = storage.getProjects();
      assert.strictEqual(projects.length, 1);
      assert.strictEqual(projects[0].name, 'my-workspace');
      assert.strictEqual(projects[0].path, '/path/to/my-workspace.code-workspace');
      assert.strictEqual(projects[0].type, 'workspace');
    });
  });
});
