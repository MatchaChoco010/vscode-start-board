import * as assert from 'assert';
import { ProjectStorage } from '../../projectStorage';

/**
 * globalStateのモック実装
 */
class MockGlobalState {
  private storage: Map<string, unknown> = new Map();

  get<T>(key: string): T | undefined {
    return this.storage.get(key) as T | undefined;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.storage.set(key, value);
  }

  clear(): void {
    this.storage.clear();
  }
}

suite('ProjectStorage Test Suite', () => {
  let mockState: MockGlobalState;
  let storage: ProjectStorage;

  setup(() => {
    mockState = new MockGlobalState();
    storage = new ProjectStorage(mockState as unknown as { get: <T>(key: string) => T | undefined; update: (key: string, value: unknown) => Thenable<void> });
  });

  test('初期状態で空のプロジェクトリストを返す', () => {
    const projects = storage.getProjects();
    assert.deepStrictEqual(projects, [], 'プロジェクトリストは空であること');
  });

  test('プロジェクトを追加できる', () => {
    const result = storage.addProject({
      name: 'TestProject',
      path: '/path/to/project',
      type: 'folder'
    });

    assert.ok(result !== null, 'プロジェクトが追加されること');
    assert.strictEqual(result!.name, 'TestProject', '名前が正しいこと');
    assert.strictEqual(result!.path, '/path/to/project', 'パスが正しいこと');
    assert.strictEqual(result!.type, 'folder', 'タイプが正しいこと');
    assert.ok(result!.id.length > 0, 'IDが生成されること');
    assert.ok(result!.addedAt > 0, 'addedAtが設定されること');
  });

  test('追加したプロジェクトがリストに含まれる', () => {
    storage.addProject({
      name: 'TestProject',
      path: '/path/to/project',
      type: 'folder'
    });

    const projects = storage.getProjects();
    assert.strictEqual(projects.length, 1, 'プロジェクトが1つ存在すること');
    assert.strictEqual(projects[0].name, 'TestProject', '名前が正しいこと');
  });

  test('複数のプロジェクトを追加できる', () => {
    storage.addProject({
      name: 'Project1',
      path: '/path/to/project1',
      type: 'folder'
    });
    storage.addProject({
      name: 'Project2',
      path: '/path/to/project2',
      type: 'workspace'
    });

    const projects = storage.getProjects();
    assert.strictEqual(projects.length, 2, 'プロジェクトが2つ存在すること');
  });

  test('同じパスのプロジェクトは追加できない（重複チェック）', () => {
    storage.addProject({
      name: 'Project1',
      path: '/path/to/project',
      type: 'folder'
    });

    const result = storage.addProject({
      name: 'Project2',
      path: '/path/to/project',
      type: 'folder'
    });

    assert.strictEqual(result, null, '重複パスはnullを返すこと');
    assert.strictEqual(storage.getProjects().length, 1, 'プロジェクト数は1のままであること');
  });

  test('hasProjectで既存のパスを検出できる', () => {
    storage.addProject({
      name: 'TestProject',
      path: '/path/to/project',
      type: 'folder'
    });

    assert.strictEqual(storage.hasProject('/path/to/project'), true, '既存パスはtrueを返すこと');
    assert.strictEqual(storage.hasProject('/path/to/other'), false, '存在しないパスはfalseを返すこと');
  });

  test('IDでプロジェクトを削除できる', () => {
    const added = storage.addProject({
      name: 'TestProject',
      path: '/path/to/project',
      type: 'folder'
    });

    const result = storage.removeProject(added!.id);
    assert.strictEqual(result, true, '削除成功はtrueを返すこと');
    assert.strictEqual(storage.getProjects().length, 0, 'プロジェクトが削除されること');
  });

  test('存在しないIDで削除するとfalseを返す', () => {
    storage.addProject({
      name: 'TestProject',
      path: '/path/to/project',
      type: 'folder'
    });

    const result = storage.removeProject('non-existent-id');
    assert.strictEqual(result, false, '削除失敗はfalseを返すこと');
    assert.strictEqual(storage.getProjects().length, 1, 'プロジェクトは削除されないこと');
  });

  test('正しいプロジェクトだけが削除される', () => {
    const project1 = storage.addProject({
      name: 'Project1',
      path: '/path/to/project1',
      type: 'folder'
    });
    storage.addProject({
      name: 'Project2',
      path: '/path/to/project2',
      type: 'folder'
    });

    storage.removeProject(project1!.id);

    const projects = storage.getProjects();
    assert.strictEqual(projects.length, 1, 'プロジェクトが1つ残ること');
    assert.strictEqual(projects[0].name, 'Project2', 'Project2が残ること');
  });

  test('workspaceタイプのプロジェクトを追加できる', () => {
    const result = storage.addProject({
      name: 'MyWorkspace',
      path: '/path/to/workspace.code-workspace',
      type: 'workspace'
    });

    assert.ok(result !== null, 'workspaceプロジェクトが追加されること');
    assert.strictEqual(result!.type, 'workspace', 'タイプがworkspaceであること');
  });

  test('プロジェクトにUUIDが正しく生成される', () => {
    const project1 = storage.addProject({
      name: 'Project1',
      path: '/path/to/project1',
      type: 'folder'
    });
    const project2 = storage.addProject({
      name: 'Project2',
      path: '/path/to/project2',
      type: 'folder'
    });

    assert.ok(project1!.id !== project2!.id, 'IDは一意であること');
    // UUID v4形式のチェック（簡易）
    assert.ok(project1!.id.length === 36, 'UUIDの長さが36文字であること');
    assert.ok(project1!.id.includes('-'), 'UUIDにハイフンが含まれること');
  });

  test('globalStateにデータが永続化される', () => {
    storage.addProject({
      name: 'TestProject',
      path: '/path/to/project',
      type: 'folder'
    });

    // 新しいインスタンスを作成して永続化を確認
    const newStorage = new ProjectStorage(mockState as unknown as { get: <T>(key: string) => T | undefined; update: (key: string, value: unknown) => Thenable<void> });
    const projects = newStorage.getProjects();

    assert.strictEqual(projects.length, 1, '永続化されたプロジェクトが読み込まれること');
    assert.strictEqual(projects[0].name, 'TestProject', '名前が正しいこと');
  });
});
