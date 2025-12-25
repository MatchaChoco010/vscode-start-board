# Implementation Plan

## Task Overview
プロジェクトリストのアルファベット順ソート機能の実装タスク。ProjectSorterモジュールの新規作成、ProjectStorageの統合、テストの実装を含む。

## Tasks

- [x] 1. ProjectSorterモジュールの実装 (P)
- [x] 1.1 (P) ソート関数の実装
  - プロジェクト配列をアルファベット順（昇順）にソートする純粋関数を実装
  - 大文字小文字を区別しない比較（`toLowerCase()`で正規化）
  - `localeCompare()`を使用してUnicode/日本語文字列に対応
  - 同名プロジェクトの場合は`addedAt`（追加日時）でセカンダリソート
  - 元の配列を変更せず、新しいソート済み配列を返す（不変性）
  - 空配列を渡された場合は空配列を返す
  - `src/projectSorter.ts`に実装
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 1.2 (P) ProjectSorterのユニットテスト実装
  - 基本ソート: アルファベット順（昇順）でソートされることを検証
  - 大文字小文字の扱い: "Project" と "project" が同じ扱いになることを検証
  - 日本語対応: 日本語プロジェクト名（平仮名、片仮名、漢字、英数字混在）が正しくソートされることを検証
  - 同名プロジェクト: 同名の場合は`addedAt`でソートされることを検証
  - 空配列: 空配列を渡した場合に空配列が返ることを検証
  - 不変性: ソート後も元の配列が変更されていないことを検証（新しい配列を返す）
  - `src/test/suite/projectSorter.test.ts`に実装
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 2. ProjectStorageの統合
- [x] 2.1 ProjectStorage.getProjects()の変更
  - `getProjects()`メソッド内で`sortProjectsAlphabetically()`を呼び出す
  - 既存のバリデーション（`!projects || !Array.isArray(projects)`）の後にソート適用
  - ソート済みプロジェクト配列を返す
  - `addProject()`と`removeProject()`は既存のまま変更不要（要件2.3）
  - データの整合性を維持（既存データの自動ソート、要件3.1）
  - `src/projectStorage.ts`を変更
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

- [x] 2.2 ProjectStorageの統合テスト追加
  - ソート済み取得: `getProjects()`がソート済み配列を返すことを検証
  - プロジェクト追加後のソート: `addProject()`後に`getProjects()`を呼ぶとソート済み配列が返ることを検証（要件1.4）
  - プロジェクト削除後のソート: `removeProject()`後に`getProjects()`を呼ぶとソート済み配列が返ることを検証（要件2.3）
  - 既存データの互換性: 未ソートの既存データを読み込んだ場合にソート済み配列が返ることを検証（要件3.1）
  - `src/test/suite/projectStorage.test.ts`に追加
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 3.1_

- [x] 3. パフォーマンステストの実装
- [x] 3.1 パフォーマンスベンチマークテスト実装
  - 100件のプロジェクトリストをソートして10ms以内であることを検証（要件4.1）
  - 1000件のプロジェクトリストをソートして100ms以内であることを検証（要件4.2）
  - `performance.now()`を使用してソート処理時間を実測
  - ランダムなプロジェクト名（英数字、日本語混在、平均20文字）のテストデータを生成
  - 大文字小文字、平仮名/片仮名が混在するデータセットを使用
  - ソートアルゴリズムの計算量がO(n log n)であることを理論的に検証（要件4.3）
  - `src/test/suite/performance.test.ts`に実装（新規ファイル）
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. E2E統合テストの実装
- [x] 4.1 ダッシュボード表示時のソート検証
  - ダッシュボード表示時にソート済みプロジェクトリストが表示されることを検証
  - Extension → Webviewメッセージでソート済み配列が送信されることを確認
  - Webview UIでプロジェクトがアルファベット順に表示されることを確認
  - `src/test/suite/integration.test.ts`に追加（既存ファイルがある場合）または新規作成
  - _Requirements: 1.1, 1.4, 2.1_

- [x] 4.2 VSCode再起動後の復元検証
  - プロジェクト追加後にglobalStateに保存されることを検証
  - VSCode再起動（モック）後もソート順が維持されることを検証（要件2.2）
  - globalStateの永続化メカニズムが正しく機能することを確認
  - `src/test/suite/integration.test.ts`に追加
  - _Requirements: 2.1, 2.2_

- [x] 5. バージョン番号の更新
- [x] 5.1 package.jsonのバージョン更新
  - 新機能追加のため、マイナーバージョンを上げる（例: 1.0.0 → 1.1.0）
  - セマンティックバージョニング（Semantic Versioning）に従う
  - `package.json`の`version`フィールドを更新
  - CHANGELOGやREADMEがある場合は更新を検討（オプション）

## Requirements Coverage

全12件の要件が以下のタスクでカバーされています：

| Requirement | Tasks | Notes |
|-------------|-------|-------|
| 1.1 | 1.1, 1.2, 4.1 | アルファベット順ソート |
| 1.2 | 1.1, 1.2 | Unicode/日本語対応 |
| 1.3 | 1.1, 1.2 | 大文字小文字を区別しない |
| 1.4 | 2.1, 2.2, 4.1 | 新規追加時の再ソート |
| 1.5 | 1.1, 1.2 | プロジェクト名のみでソート |
| 2.1 | 2.1, 2.2, 4.1, 4.2 | globalStateへの保存 |
| 2.2 | 2.1, 2.2, 4.2 | VSCode再起動後の復元 |
| 2.3 | 2.1, 2.2 | 削除時のソート順維持 |
| 3.1 | 2.1, 2.2 | 既存データの自動ソート |
| 3.2 | 2.1 | エラーハンドリング |
| 3.3 | 2.1 | `Project`型互換性 |
| 4.1 | 3.1 | 100件で10ms以内 |
| 4.2 | 3.1 | 1000件で100ms以内 |
| 4.3 | 3.1 | O(n log n)のソート |

## Task Dependencies

```
1. ProjectSorterモジュールの実装 (P)
   ├─ 1.1 ソート関数の実装 (P)
   └─ 1.2 ユニットテスト実装 (P)

2. ProjectStorageの統合 (依存: Task 1完了後)
   ├─ 2.1 getProjects()の変更 (依存: 1.1)
   └─ 2.2 統合テスト追加 (依存: 2.1)

3. パフォーマンステスト (依存: Task 1, 2完了後)
   └─ 3.1 パフォーマンスベンチマーク (依存: 1.1, 2.1)

4. E2E統合テスト (依存: Task 1, 2完了後)
   ├─ 4.1 ダッシュボード表示検証 (依存: 2.1)
   └─ 4.2 VSCode再起動後の復元検証 (依存: 2.1)

5. バージョン番号の更新 (依存: Task 1-4完了後)
   └─ 5.1 package.jsonのバージョン更新 (依存: すべてのタスク完了)
```

## Parallel Execution Notes

- **Task 1 (ProjectSorter)**: 新規モジュールのため、他のタスクと並列実行可能 `(P)`
- **Task 2 (ProjectStorage)**: Task 1のProjectSorterに依存するため、Task 1完了後に実行
- **Task 3 (Performance)**: Task 1と2の実装完了後に実行
- **Task 4 (E2E)**: Task 1と2の実装完了後に実行（Task 3と並列実行可能）
- **Task 5 (Version)**: すべての実装とテストが完了した後に実行
