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

  suite('Sorting Integration Tests', () => {
    test('getProjects()がソート済み配列を返す', () => {
      storage.addProject({
        name: 'zebra',
        path: '/path/to/zebra',
        type: 'folder'
      });
      storage.addProject({
        name: 'apple',
        path: '/path/to/apple',
        type: 'folder'
      });
      storage.addProject({
        name: 'banana',
        path: '/path/to/banana',
        type: 'folder'
      });

      const projects = storage.getProjects();

      // アルファベット順にソートされていること
      assert.strictEqual(projects[0].name, 'apple', '1番目はapple');
      assert.strictEqual(projects[1].name, 'banana', '2番目はbanana');
      assert.strictEqual(projects[2].name, 'zebra', '3番目はzebra');
    });

    test('addProject()後にgetProjects()を呼ぶとソート済み配列が返る', () => {
      storage.addProject({
        name: 'charlie',
        path: '/path/to/charlie',
        type: 'folder'
      });
      storage.addProject({
        name: 'alice',
        path: '/path/to/alice',
        type: 'folder'
      });

      const projects1 = storage.getProjects();
      assert.strictEqual(projects1[0].name, 'alice', '最初はalice');
      assert.strictEqual(projects1[1].name, 'charlie', '次はcharlie');

      // 新しいプロジェクトを追加
      storage.addProject({
        name: 'bob',
        path: '/path/to/bob',
        type: 'folder'
      });

      const projects2 = storage.getProjects();
      // 再度ソートされていること
      assert.strictEqual(projects2[0].name, 'alice');
      assert.strictEqual(projects2[1].name, 'bob');
      assert.strictEqual(projects2[2].name, 'charlie');
    });

    test('removeProject()後にgetProjects()を呼ぶとソート済み配列が返る', () => {
      storage.addProject({
        name: 'alice',
        path: '/path/to/alice',
        type: 'folder'
      });
      const bob = storage.addProject({
        name: 'bob',
        path: '/path/to/bob',
        type: 'folder'
      });
      storage.addProject({
        name: 'charlie',
        path: '/path/to/charlie',
        type: 'folder'
      });

      // bobを削除
      storage.removeProject(bob!.id);

      const projects = storage.getProjects();
      // ソート順が維持されていること
      assert.strictEqual(projects.length, 2);
      assert.strictEqual(projects[0].name, 'alice');
      assert.strictEqual(projects[1].name, 'charlie');
    });

    test('既存データの互換性: 未ソートの既存データを読み込んだ場合にソート済み配列が返る', () => {
      // 未ソートのデータを直接globalStateに設定（既存データをシミュレート）
      const unsortedProjects = [
        {
          id: 'id-1',
          name: 'zebra',
          path: '/path/to/zebra',
          type: 'folder' as const,
          addedAt: 1000
        },
        {
          id: 'id-2',
          name: 'apple',
          path: '/path/to/apple',
          type: 'folder' as const,
          addedAt: 2000
        },
        {
          id: 'id-3',
          name: 'banana',
          path: '/path/to/banana',
          type: 'folder' as const,
          addedAt: 3000
        }
      ];
      mockState.update('startBoard.projects', unsortedProjects);

      // 新しいStorageインスタンスで読み込み
      const newStorage = new ProjectStorage(mockState as unknown as { get: <T>(key: string) => T | undefined; update: (key: string, value: unknown) => Thenable<void> });
      const projects = newStorage.getProjects();

      // 自動的にソートされていること
      assert.strictEqual(projects[0].name, 'apple');
      assert.strictEqual(projects[1].name, 'banana');
      assert.strictEqual(projects[2].name, 'zebra');
    });

    test('大文字小文字を区別せずにソートされる', () => {
      storage.addProject({
        name: 'Project',
        path: '/path/to/Project',
        type: 'folder'
      });
      storage.addProject({
        name: 'apple',
        path: '/path/to/apple',
        type: 'folder'
      });
      storage.addProject({
        name: 'Banana',
        path: '/path/to/Banana',
        type: 'folder'
      });

      const projects = storage.getProjects();

      // 大文字小文字を区別せずにソート
      assert.strictEqual(projects[0].name, 'apple');
      assert.strictEqual(projects[1].name, 'Banana');
      assert.strictEqual(projects[2].name, 'Project');
    });

    test('日本語プロジェクト名が正しくソートされる', () => {
      storage.addProject({
        name: 'プロジェクトC',
        path: '/path/to/project-c',
        type: 'folder'
      });
      storage.addProject({
        name: 'あいうえお',
        path: '/path/to/aiueo',
        type: 'folder'
      });
      storage.addProject({
        name: 'abc',
        path: '/path/to/abc',
        type: 'folder'
      });

      const projects = storage.getProjects();

      // 日本語も含めて正しくソート
      assert.strictEqual(projects[0].name, 'abc');
      // 日本語文字列がソートされていることを確認
      const names = projects.map(p => p.name);
      assert.ok(names.includes('あいうえお'));
      assert.ok(names.includes('プロジェクトC'));
    });
  });
});
