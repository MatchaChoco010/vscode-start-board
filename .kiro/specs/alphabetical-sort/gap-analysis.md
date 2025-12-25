# Implementation Gap Analysis

## 1. 現状調査

### 主要コンポーネントとアーキテクチャ

#### キーファイル/モジュール
- **`src/types.ts`**: プロジェクトの型定義（`Project`, `ProjectInput`）
- **`src/projectStorage.ts`**: プロジェクトリストの永続化と操作（追加、削除、取得）
- **`src/webviewManager.ts`**: Webviewパネルのライフサイクル管理とメッセージ通信
- **`src/messageIntegration.ts`**: Extension ↔ Webview間の通信統合
- **`src/commandHandlers.ts`**: プロジェクト追加コマンドの実装
- **`src/extension.ts`**: 拡張機能のエントリーポイントとライフサイクル管理
- **`src/test/suite/projectStorage.test.ts`**: ProjectStorageのユニットテスト

#### アーキテクチャパターン
- **フラットモジュール構成**: 機能ごとにモジュール分割し、`src/`直下に配置
- **依存性注入パターン**: `createXXXDependencies`関数でテスタビリティを確保
- **メッセージパッシング**: Extension ↔ Webview間は型安全なメッセージプロトコルで通信
- **globalState永続化**: プロジェクトリストを`ExtensionContext.globalState`に保存
- **TypeScript strict mode**: 型安全性を最大限に確保

#### データフロー
1. **プロジェクト取得**: `ProjectStorage.getProjects()` → Project配列を返す（**現在は未ソート**）
2. **Extension → Webview**: `{ type: 'init', projects }` または `{ type: 'projectsUpdated', projects }`
3. **Webview表示**: `renderProjects()` 関数でプロジェクトリストをレンダリング
4. **プロジェクト追加**: `ProjectStorage.addProject()` → 配列の末尾に追加（`projects.push(project)`）

### Project型定義
```typescript
export interface Project {
  id: string;           // UUID
  name: string;         // 表示名（ソート対象）
  path: string;         // ファイルシステムパス
  type: ProjectType;    // 'folder' | 'workspace'
  addedAt: number;      // Unix timestamp
}
```

## 2. 要件実現性分析

### 技術的ニーズ（要件から抽出）

#### Requirement 1: プロジェクトリストのアルファベット順表示
- **ソート関数**: プロジェクト名（`Project.name`）での比較ベースソート
- **大文字小文字の扱い**: `localeCompare`または`toLowerCase()`を使用した正規化
- **日本語対応**: Unicodeコードポイント順のソート（JavaScriptの`localeCompare`で対応可能）
- **動的ソート**: プロジェクト追加時の自動再ソート

#### Requirement 2: ソート状態の永続化
- **既存のglobalState**: すでに`ProjectStorage`がglobalStateで永続化を実装
- **順序維持**: ソート済み配列をそのまま保存すれば順序が維持される（追加実装不要）

#### Requirement 3: 既存データの互換性
- **型定義の互換性**: `Project`型の変更は不要（name, path, type, id, addedAtはすべて既存）
- **マイグレーション**: 既存データ読み込み時に自動ソート適用

#### Requirement 4: パフォーマンス
- **ソートアルゴリズム**: JavaScriptの`Array.sort()`はV8エンジンでTimsort（O(n log n)）を使用
- **100件**: 10ms以内（十分達成可能）
- **1000件**: 100ms以内（文字列比較のオーバーヘッドを考慮しても達成可能）

### ギャップと制約

#### 欠落している機能
1. **ソートロジック**: プロジェクト名でのアルファベット順ソート関数が存在しない
2. **ソート適用ポイント**: `getProjects()`または`addProject()`/`removeProject()`時のソート適用が未実装
3. **テストケース**: ソート動作を検証するテストが存在しない

#### 既存の利点
- ✅ globalStateでの永続化は既に実装済み
- ✅ `Project`型は既に定義されており、拡張不要
- ✅ プロジェクト更新時のWebview通知メカニズムは存在
- ✅ テストインフラ（Mocha/assert）は整備済み

#### 制約
- **パフォーマンス**: `getProjects()`が呼ばれるたびにソートすると、呼び出し頻度によってはオーバーヘッドが発生する可能性
- **ソート安定性**: 同名プロジェクトの順序保証が必要かどうか（現在は`addedAt`で判別可能）

## 3. 実装アプローチ オプション

### Option A: ProjectStorageを拡張（最小変更）

#### 戦略
`ProjectStorage.getProjects()`メソッド内でソートを実行し、ソート済み配列を返す。

#### 変更ファイル
- **`src/projectStorage.ts`**: `getProjects()`メソッドにソートロジックを追加
- **`src/test/suite/projectStorage.test.ts`**: ソート動作のテストケース追加

#### 実装イメージ
```typescript
getProjects(): Project[] {
  const projects = this.globalState.get<Project[]>(STORAGE_KEY);
  if (!projects || !Array.isArray(projects)) {
    return [];
  }
  // アルファベット順にソート
  return projects.sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );
}
```

#### トレードオフ
- ✅ **最小限のファイル変更**（1ファイルのみ修正）
- ✅ **既存インターフェース維持**（呼び出し側の変更不要）
- ✅ **自動ソート適用**（`getProjects()`を呼ぶだけでソート済み配列が得られる）
- ❌ **パフォーマンス懸念**: `getProjects()`が呼ばれるたびにソート（ただし要件範囲内では問題なし）
- ❌ **責務の増加**: ProjectStorageがソート責務も持つ（単一責任原則の観点）

#### 複雑性と保守性
- **認知負荷**: 低（既存クラスへの小規模追加）
- **ファイルサイズ**: 許容範囲（現在114行 → 約120行）
- **単一責任**: やや違反（ストレージ + ソート）

---

### Option B: ソートユーティリティモジュールを作成（関心の分離）

#### 戦略
新しい`src/projectSorter.ts`モジュールを作成し、ソートロジックを分離。呼び出し側（extensionやmessageIntegration）で明示的にソートを実行。

#### 新規ファイル
- **`src/projectSorter.ts`**: ソート関数を提供
  ```typescript
  export function sortProjectsAlphabetically(projects: Project[]): Project[] {
    return [...projects].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  }
  ```
- **`src/test/suite/projectSorter.test.ts`**: ソート関数のユニットテスト

#### 変更ファイル
- **`src/extension.ts`**: `getProjects()`呼び出し後にソート関数を適用
- **`src/messageIntegration.ts`**: `getProjects()`呼び出し後にソート関数を適用

#### トレードオフ
- ✅ **関心の分離**（ProjectStorageは永続化のみ、ソートは別モジュール）
- ✅ **テスト容易性**（ソートロジックを独立してテスト可能）
- ✅ **再利用可能**（将来的に他の並び順が必要になった場合に拡張しやすい）
- ❌ **新しいファイル**（プロジェクト構造が複雑化）
- ❌ **明示的な呼び出し**（呼び出し側すべてでソート関数を呼ぶ必要がある）
- ❌ **呼び出し漏れリスク**（新しいコードで`getProjects()`を使う際にソートを忘れる可能性）

#### 複雑性と保守性
- **認知負荷**: 中（新しいモジュールの概念導入）
- **ファイルサイズ**: 小（新規ファイルは20-30行程度）
- **単一責任**: ✅ 遵守

---

### Option C: ハイブリッドアプローチ（推奨）

#### 戦略
ソートロジックを別モジュール（`src/projectSorter.ts`）に分離し、`ProjectStorage.getProjects()`から内部的に呼び出す。

#### 新規ファイル
- **`src/projectSorter.ts`**: ソート関数を提供（Option Bと同じ）
- **`src/test/suite/projectSorter.test.ts`**: ソート関数のユニットテスト

#### 変更ファイル
- **`src/projectStorage.ts`**: `getProjects()`でソート関数を呼び出す
  ```typescript
  import { sortProjectsAlphabetically } from './projectSorter';

  getProjects(): Project[] {
    const projects = this.globalState.get<Project[]>(STORAGE_KEY);
    if (!projects || !Array.isArray(projects)) {
      return [];
    }
    return sortProjectsAlphabetically(projects);
  }
  ```
- **`src/test/suite/projectStorage.test.ts`**: ソート動作を検証するテスト追加

#### トレードオフ
- ✅ **関心の分離**（ソートロジックは独立モジュール）
- ✅ **テスト容易性**（ソート関数とProjectStorageを分離してテスト）
- ✅ **既存インターフェース維持**（呼び出し側の変更不要）
- ✅ **自動ソート適用**（`getProjects()`を呼ぶだけでソート済み）
- ✅ **拡張性**（将来的に別のソート順を追加する際にprojectSorter.tsを拡張）
- ❌ **複数ファイル変更**（2ファイル新規 + 2ファイル変更）
- ❌ **パフォーマンス懸念**: `getProjects()`が呼ばれるたびにソート（ただし要件範囲内）

#### 複雑性と保守性
- **認知負荷**: 中（新しいモジュールだが役割は明確）
- **ファイルサイズ**: 適切（各ファイルの責務が明確で小さい）
- **単一責任**: ✅ 遵守

#### パフォーマンス最適化案（将来的）
- **キャッシュ戦略**: ProjectStorage内部でソート済み配列をキャッシュし、`addProject()`/`removeProject()`時のみ無効化
- **評価**: 現時点では要件のパフォーマンス目標（100件で10ms、1000件で100ms）を満たせると予想されるため、最適化は不要

---

## 4. 実装複雑度とリスク評価

### Effort: S（1-3日）
- 既存パターンに従った実装（フラットモジュール、依存性注入不要なユーティリティ）
- JavaScriptの標準`Array.sort()`と`localeCompare()`を使用（外部依存なし）
- テストの追加が必要だが、既存のテストパターン（Mocha/assert）に従う
- 変更範囲が限定的（2-4ファイル）

### Risk: Low
- **技術的リスク**: 低（既知の技術、標準ライブラリのみ使用）
- **スコープ**: 明確（プロジェクト名のソートのみ）
- **既存機能への影響**: 最小限（読み取り専用の変更、既存データ構造は変更なし）
- **データ互換性**: 問題なし（`Project`型は変更不要、既存データは自動ソート）
- **テスト**: 既存テストインフラが整備済み、新規テスト追加のみ

### リスク要因
- **呼び出し頻度**: `getProjects()`の呼び出し頻度が不明（ダッシュボード表示時、プロジェクト更新時など）
  - **緩和策**: パフォーマンステストを実装し、要件を満たすことを検証
- **ソート安定性**: 同名プロジェクトの順序が未定義
  - **緩和策**: 同名の場合は`addedAt`でセカンダリソート（設計フェーズで決定）

---

## 5. 推奨事項と次フェーズへの引き継ぎ

### 推奨アプローチ: **Option C（ハイブリッド）**

#### 理由
1. **関心の分離**: ソートロジックを独立モジュールとして分離し、テストと保守性を向上
2. **既存パターンとの整合性**: フラットモジュール構成に従い、新しいユーティリティモジュールを追加
3. **自動適用**: `getProjects()`を呼ぶだけでソート済み配列が得られ、呼び出し側の変更不要
4. **拡張性**: 将来的に別のソート順（更新日時順、カスタム順など）が必要になった場合、`projectSorter.ts`を拡張可能

### 設計フェーズでの調査項目

#### 1. ソート関数の詳細設計
- **`localeCompare`の使用**: `name.toLowerCase().localeCompare(other.toLowerCase())`
- **日本語/Unicode対応**: `localeCompare`のロケール指定（デフォルトまたは`'ja'`）
- **同名プロジェクトの扱い**: セカンダリソートキーとして`addedAt`を使用するか

#### 2. パフォーマンステスト設計
- **100件、1000件のプロジェクトリスト生成**: テストデータ作成
- **ソート時間計測**: `console.time()`または`performance.now()`
- **要件検証**: 10ms/100ms以内の確認

#### 3. キャッシュ戦略の必要性評価
- **`getProjects()`呼び出し頻度の調査**: ダッシュボード表示、プロジェクト追加/削除時
- **キャッシュ実装の判断**: 要件を満たせない場合のみ検討（現時点では不要と予想）

#### 4. エッジケース処理
- **空文字列のプロジェクト名**: ソート順序の定義
- **特殊文字を含む名前**: `localeCompare`の動作確認
- **大量プロジェクト**: 1000件以上のパフォーマンス挙動（要件外だが参考値として）

---

## 6. 要件とアセットのマッピング

| 要件 | 既存アセット | ギャップ | 実装アプローチ |
|-----|------------|---------|--------------|
| **Req 1.1**: アルファベット順ソート表示 | `ProjectStorage.getProjects()` | **Missing**: ソート関数 | `projectSorter.ts`新規作成、`getProjects()`から呼び出し |
| **Req 1.2**: Unicode/日本語対応 | - | **Missing**: `localeCompare`実装 | `localeCompare()`使用 |
| **Req 1.3**: 大文字小文字を区別しない | - | **Missing**: 正規化 | `toLowerCase()`で正規化 |
| **Req 1.4**: 新規追加時の再ソート | `ProjectStorage.addProject()` | **Constraint**: 追加後のソート | `getProjects()`で毎回ソート |
| **Req 2.1**: ソート順の永続化 | globalState永続化 | **OK**: 既存機能で対応 | 変更不要 |
| **Req 2.2**: 再起動後の復元 | globalState読み込み | **OK**: 既存機能で対応 | 変更不要 |
| **Req 3.1**: 既存データの互換性 | `Project`型定義 | **OK**: 型変更不要 | 既存データを自動ソート |
| **Req 3.2**: エラーハンドリング | `getProjects()`のバリデーション | **OK**: 既存実装 | 変更不要 |
| **Req 4.1-4.3**: パフォーマンス | - | **Research Needed**: 計測が必要 | パフォーマンステスト実装 |

---

## まとめ

### スコープ
アルファベット順ソート機能の追加は、既存のVSCode拡張機能アーキテクチャに小規模な変更を加えるだけで実現可能。主な変更は`ProjectStorage`とソートユーティリティの追加。

### 課題
- ソート関数の詳細設計（`localeCompare`の挙動、セカンダリソートキー）
- パフォーマンス要件の検証（特に1000件のケース）

### 推奨
**Option C（ハイブリッドアプローチ）**を採用し、設計フェーズでソート関数の詳細とパフォーマンステストを設計。
