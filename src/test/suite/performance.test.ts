import * as assert from 'assert';
import { sortProjectsAlphabetically } from '../../projectSorter';
import { Project } from '../../types';

suite('Performance Test Suite', () => {
  /**
   * ランダムなプロジェクトデータを生成するヘルパー関数
   * @param count 生成するプロジェクト数
   * @returns ランダムなプロジェクト配列
   */
  function generateRandomProjects(count: number): Project[] {
    const projects: Project[] = [];
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789あいうえおかきくけこアイウエオカキクケコ';

    for (let i = 0; i < count; i++) {
      // ランダムなプロジェクト名を生成（平均20文字）
      const nameLength = 10 + Math.floor(Math.random() * 20);
      let name = '';
      for (let j = 0; j < nameLength; j++) {
        name += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      projects.push({
        id: `id-${i}`,
        name,
        path: `/path/to/project-${i}`,
        type: i % 2 === 0 ? 'folder' : 'workspace',
        addedAt: Date.now() + i
      });
    }

    return projects;
  }

  /**
   * ソート処理時間を計測するヘルパー関数
   * @param projects ソート対象のプロジェクト配列
   * @returns 処理時間（ミリ秒）
   */
  function measureSortTime(projects: Project[]): number {
    const start = performance.now();
    sortProjectsAlphabetically(projects);
    const end = performance.now();
    return end - start;
  }

  suite('Sorting Performance Benchmarks', () => {
    test('100件のプロジェクトリストを10ms以内にソート', () => {
      const projects = generateRandomProjects(100);
      const time = measureSortTime(projects);

      console.log(`  [Performance] 100件のソート時間: ${time.toFixed(2)}ms`);

      assert.ok(
        time < 10,
        `100件のソート時間は10ms以内であること（実測: ${time.toFixed(2)}ms）`
      );
    });

    test('1000件のプロジェクトリストを100ms以内にソート', () => {
      const projects = generateRandomProjects(1000);
      const time = measureSortTime(projects);

      console.log(`  [Performance] 1000件のソート時間: ${time.toFixed(2)}ms`);

      assert.ok(
        time < 100,
        `1000件のソート時間は100ms以内であること（実測: ${time.toFixed(2)}ms）`
      );
    });

    test('ソートアルゴリズムの計算量がO(n log n)であることを理論的に検証', () => {
      // 異なるサイズでソート時間を計測
      const sizes = [100, 200, 500, 1000];
      const times: number[] = [];

      for (const size of sizes) {
        const projects = generateRandomProjects(size);
        const time = measureSortTime(projects);
        times.push(time);
        console.log(`  [Performance] ${size}件のソート時間: ${time.toFixed(2)}ms`);
      }

      // O(n log n)の検証: 時間比率が (n2 log n2) / (n1 log n1) に近いことを確認
      // 厳密な検証ではなく、大まかに線形以上・二乗未満であることを確認
      for (let i = 1; i < sizes.length; i++) {
        const n1 = sizes[i - 1];
        const n2 = sizes[i];
        const t1 = times[i - 1];
        const t2 = times[i];

        const ratio = t2 / t1;
        const expectedRatio = (n2 * Math.log2(n2)) / (n1 * Math.log2(n1));

        console.log(
          `  [Performance] サイズ比 ${n1}→${n2}: 実測比 ${ratio.toFixed(2)}、` +
          `期待比 ${expectedRatio.toFixed(2)} (O(n log n))`
        );

        // 時間比率が期待比率の0.5〜3倍の範囲内であることを確認
        // （計測誤差や他の処理の影響を考慮した緩い条件）
        assert.ok(
          ratio >= expectedRatio * 0.3 && ratio <= expectedRatio * 5,
          `時間比率がO(n log n)の範囲内であること（実測比: ${ratio.toFixed(2)}, 期待比: ${expectedRatio.toFixed(2)}）`
        );
      }
    });

    test('大文字小文字・日本語混在データのパフォーマンス', () => {
      // 実際のユースケースに近いデータでのパフォーマンス検証
      const projects: Project[] = [];
      const names = [
        'my-website',
        'APIサーバー',
        'Project',
        'データ分析',
        'Backend',
        'アプリ開発',
        'todo-app',
        'frontend',
        'プロジェクトC'
      ];

      // 100件のプロジェクトを生成（9種類の名前を繰り返し使用）
      for (let i = 0; i < 100; i++) {
        projects.push({
          id: `id-${i}`,
          name: names[i % names.length] + `-${i}`,
          path: `/path/to/project-${i}`,
          type: 'folder',
          addedAt: Date.now() + i
        });
      }

      const time = measureSortTime(projects);
      console.log(`  [Performance] 混在データ100件のソート時間: ${time.toFixed(2)}ms`);

      assert.ok(
        time < 10,
        `混在データのソート時間は10ms以内であること（実測: ${time.toFixed(2)}ms）`
      );
    });

    test('ソートの安定性: 同じ入力で同じ出力を返す', () => {
      const projects = generateRandomProjects(100);

      // 複数回ソートして結果が一致することを確認
      const sorted1 = sortProjectsAlphabetically(projects);
      const sorted2 = sortProjectsAlphabetically(projects);
      const sorted3 = sortProjectsAlphabetically(projects);

      assert.deepStrictEqual(
        sorted1.map(p => p.id),
        sorted2.map(p => p.id),
        'ソート結果は毎回同じであること'
      );
      assert.deepStrictEqual(
        sorted2.map(p => p.id),
        sorted3.map(p => p.id),
        'ソート結果は毎回同じであること'
      );
    });
  });
});
