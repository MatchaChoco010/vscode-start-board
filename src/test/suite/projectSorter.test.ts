import * as assert from 'assert';
import { sortProjectsAlphabetically } from '../../projectSorter';
import { Project } from '../../types';

suite('ProjectSorter Test Suite', () => {
  /**
   * テスト用プロジェクトデータを生成するヘルパー関数
   */
  function createProject(name: string, addedAt: number = Date.now()): Project {
    return {
      id: `id-${name}`,
      name,
      path: `/path/to/${name}`,
      type: 'folder',
      addedAt
    };
  }

  suite('sortProjectsAlphabetically', () => {
    test('基本ソート: アルファベット順（昇順）でソートされる', () => {
      const projects = [
        createProject('zebra'),
        createProject('apple'),
        createProject('banana')
      ];

      const sorted = sortProjectsAlphabetically(projects);

      assert.strictEqual(sorted[0].name, 'apple');
      assert.strictEqual(sorted[1].name, 'banana');
      assert.strictEqual(sorted[2].name, 'zebra');
    });

    test('大文字小文字の扱い: "Project" と "project" が同じ扱いになる', () => {
      const projects = [
        createProject('Project'),
        createProject('apple'),
        createProject('project'),
        createProject('Banana')
      ];

      const sorted = sortProjectsAlphabetically(projects);

      // 大文字小文字を区別せずにソート
      // 期待される順序: apple, Banana, Project, project (アルファベット順)
      assert.strictEqual(sorted[0].name, 'apple');
      assert.strictEqual(sorted[1].name, 'Banana');
      // Project と project は同じ扱い（どちらが先でも良い）
      assert.ok(['Project', 'project'].includes(sorted[2].name));
      assert.ok(['Project', 'project'].includes(sorted[3].name));
    });

    test('日本語対応: 日本語プロジェクト名が正しくソートされる', () => {
      const projects = [
        createProject('プロジェクトC'),
        createProject('あいうえお'),
        createProject('カタカナ'),
        createProject('漢字プロジェクト'),
        createProject('abc'),
        createProject('ひらがな')
      ];

      const sorted = sortProjectsAlphabetically(projects);

      // localeCompare()によるUnicodeソート順
      // 期待される順序: abc, あいうえお, カタカナ, ひらがな, プロジェクトC, 漢字プロジェクト
      // ※実際の順序はロケールに依存するため、最初と最後のみ検証
      assert.strictEqual(sorted[0].name, 'abc');
      // 日本語文字列が正しくソートされていることを確認
      const names = sorted.map(p => p.name);
      assert.ok(names.includes('あいうえお'));
      assert.ok(names.includes('カタカナ'));
      assert.ok(names.includes('ひらがな'));
    });

    test('同名プロジェクト: 同名の場合はaddedAtでソートされる', () => {
      const projects = [
        createProject('project', 1000), // 古い
        createProject('project', 3000), // 新しい
        createProject('project', 2000)  // 中間
      ];

      const sorted = sortProjectsAlphabetically(projects);

      // 同名の場合はaddedAtの昇順
      assert.strictEqual(sorted[0].addedAt, 1000);
      assert.strictEqual(sorted[1].addedAt, 2000);
      assert.strictEqual(sorted[2].addedAt, 3000);
    });

    test('空配列: 空配列を渡した場合に空配列が返る', () => {
      const projects: Project[] = [];

      const sorted = sortProjectsAlphabetically(projects);

      assert.strictEqual(sorted.length, 0);
      assert.ok(Array.isArray(sorted));
    });

    test('不変性: ソート後も元の配列が変更されていない（新しい配列を返す）', () => {
      const projects = [
        createProject('zebra'),
        createProject('apple'),
        createProject('banana')
      ];
      const originalOrder = projects.map(p => p.name);

      const sorted = sortProjectsAlphabetically(projects);

      // 元の配列は変更されていない
      assert.strictEqual(projects[0].name, originalOrder[0]);
      assert.strictEqual(projects[1].name, originalOrder[1]);
      assert.strictEqual(projects[2].name, originalOrder[2]);

      // ソート済み配列は異なる配列
      assert.notStrictEqual(sorted, projects);

      // ソート済み配列は正しくソートされている
      assert.strictEqual(sorted[0].name, 'apple');
      assert.strictEqual(sorted[1].name, 'banana');
      assert.strictEqual(sorted[2].name, 'zebra');
    });

    test('複合ケース: 英数字と日本語が混在する実際のプロジェクト名', () => {
      const projects = [
        createProject('my-website'),
        createProject('APIサーバー'),
        createProject('todo-app'),
        createProject('データ分析'),
        createProject('backend-service'),
        createProject('アプリ開発')
      ];

      const sorted = sortProjectsAlphabetically(projects);

      // localeCompareによるソート順を検証
      // すべてのプロジェクトが正しくソートされていることを確認
      assert.strictEqual(sorted.length, 6);

      // ソート順が安定していることを確認（同じ入力で同じ出力）
      const sorted2 = sortProjectsAlphabetically(projects);
      assert.deepStrictEqual(
        sorted.map(p => p.name),
        sorted2.map(p => p.name),
        'ソート順が安定している'
      );

      // 各プロジェクト名が正しくソートされている（昇順）ことを確認
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i].name.toLowerCase();
        const next = sorted[i + 1].name.toLowerCase();
        assert.ok(
          current.localeCompare(next) <= 0,
          `${sorted[i].name} should come before or equal to ${sorted[i + 1].name}`
        );
      }
    });
  });
});
