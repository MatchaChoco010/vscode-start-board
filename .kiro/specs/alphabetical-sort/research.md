# Research & Design Decisions

---
**Purpose**: アルファベット順ソート機能の調査結果、アーキテクチャ検討、設計判断の根拠を記録する。

**Usage**:
- 発見フェーズでの調査活動と結果をログに記録
- `design.md` には詳細すぎる設計判断のトレードオフを文書化
- 将来の監査や再利用のための参照と証拠を提供
---

## Summary
- **Feature**: `alphabetical-sort`
- **Discovery Scope**: Extension（既存システムへの拡張）
- **Key Findings**:
  - JavaScriptの`Array.sort()`と`String.localeCompare()`で要件を満たせる（外部依存なし）
  - `ProjectStorage.getProjects()`を拡張し、ソートロジックを別モジュールに分離する設計を採用
  - パフォーマンス要件（100件で10ms、1000件で100ms）はJavaScript標準実装で達成可能

## Research Log

### ソートアルゴリズムの選定
- **Context**: プロジェクト名のアルファベット順ソートを実装する必要がある。要件では時間計算量O(n log n)が求められている。
- **Sources Consulted**:
  - MDN Web Docs: `Array.prototype.sort()` の実装と計算量
  - V8エンジンのソートアルゴリズム（Timsort）のドキュメント
  - `String.prototype.localeCompare()` のUnicode対応
- **Findings**:
  - JavaScriptの`Array.sort()`はV8エンジンでTimsortを使用（O(n log n)の安定ソート）
  - `localeCompare()`は大文字小文字を区別しない比較とUnicode/日本語対応をサポート
  - 外部ライブラリ不要で要件を満たせる
- **Implications**:
  - 技術スタックに新しい依存関係を追加する必要がない
  - TypeScript strict modeと互換性がある
  - VSCode拡張機能の軽量性を維持できる

### 大文字小文字を区別しないソート
- **Context**: 要件1.3で大文字小文字を区別せずにソートする必要がある
- **Sources Consulted**:
  - MDN: `String.prototype.localeCompare()` の`locales`と`options`パラメータ
  - ECMAScript Internationalization API仕様
- **Findings**:
  - `localeCompare()`の`sensitivity`オプションで大文字小文字の扱いを制御可能
  - `sensitivity: 'base'` を指定すると大文字小文字とアクセント記号を無視
  - または`toLowerCase()`で正規化してから比較する方法もある
- **Implications**:
  - `toLowerCase() + localeCompare()`の組み合わせがシンプルで理解しやすい
  - 日本語の平仮名/片仮名の違いにも対応

### パフォーマンス検証
- **Context**: 要件4で100件は10ms以内、1000件は100ms以内のソート処理が求められている
- **Sources Consulted**:
  - V8エンジンのTimsortのベンチマーク資料
  - JavaScriptの文字列比較のパフォーマンス特性
- **Findings**:
  - 100件の文字列配列のソート: 現代のブラウザ/Node.jsで1-3ms程度
  - 1000件の文字列配列のソート: 10-30ms程度
  - `localeCompare()`は文字列長に依存するが、プロジェクト名（通常10-50文字）では十分高速
- **Implications**:
  - キャッシュなしで毎回ソートしても要件を満たせる
  - 将来的なパフォーマンス最適化（キャッシュ）は不要と判断
  - パフォーマンステストは実装フェーズで検証する

### 既存コードベースとの統合
- **Context**: `ProjectStorage`クラスと`WebviewManager`への統合方法を決定する必要がある
- **Sources Consulted**:
  - `.kiro/specs/alphabetical-sort/gap-analysis.md`
  - 既存コード: `src/projectStorage.ts`, `src/types.ts`, `src/webviewManager.ts`
- **Findings**:
  - `ProjectStorage.getProjects()`は現在未ソートの配列を返している
  - `Project`型は変更不要（name, path, type, id, addedAtはすべて既存）
  - globalStateでの永続化メカニズムは既に実装済み
- **Implications**:
  - `getProjects()`メソッドを変更し、ソート済み配列を返すようにする
  - 呼び出し側（extension.ts, messageIntegration.ts）の変更は不要
  - データマイグレーション不要（既存データを読み込み時に自動ソート）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Option A: ProjectStorageを拡張 | `getProjects()`内でソート | 最小限のファイル変更、既存インターフェース維持 | ソート責務の追加、毎回ソートのオーバーヘッド | シンプルだが単一責任原則の観点で課題 |
| Option B: ソートユーティリティモジュール | 新しい`projectSorter.ts`モジュールを作成 | 関心の分離、テスト容易性、再利用可能 | 呼び出し側で明示的なソート呼び出しが必要 | フラットモジュール構成に適合 |
| **Option C: ハイブリッド（採用）** | ソートロジックを別モジュールに分離し、`getProjects()`から呼び出す | 関心の分離 + 既存インターフェース維持、テスト容易性 | 複数ファイルの変更が必要 | 推奨アプローチ。ステアリングの原則に整合 |

## Design Decisions

### Decision: ハイブリッドアプローチの採用（Option C）
- **Context**: プロジェクトリストのソート機能を既存システムに追加する必要がある。単一責任原則とテスト容易性を確保しつつ、既存インターフェースを維持したい。
- **Alternatives Considered**:
  1. **Option A**: `ProjectStorage`クラス内で直接ソート実装 - 最小変更だが責務が増える
  2. **Option B**: 独立したソートモジュール + 呼び出し側で明示的ソート - 関心の分離だが呼び出し漏れリスク
  3. **Option C**: ソートモジュール分離 + `getProjects()`から内部呼び出し - バランスの取れたアプローチ
- **Selected Approach**: Option C（ハイブリッド）を採用
  - 新規モジュール `src/projectSorter.ts` にソートロジックを実装
  - `ProjectStorage.getProjects()` から内部的に `sortProjectsAlphabetically()` を呼び出す
  - ソート関数の型定義: `(projects: Project[]) => Project[]`
- **Rationale**:
  - **関心の分離**: ソートロジックを独立モジュールとして分離し、ProjectStorageは永続化に専念
  - **テスト容易性**: ソート関数を単体でテスト可能（純粋関数）
  - **既存パターン整合**: フラットモジュール構成（`src/`直下に配置）に従う
  - **自動適用**: 呼び出し側の変更不要で、`getProjects()`を呼ぶだけでソート済み配列を取得
  - **拡張性**: 将来的に別のソート順（更新日時順など）が必要になった場合、`projectSorter.ts`を拡張可能
- **Trade-offs**:
  - ✅ **Benefits**: 単一責任原則の遵守、テスト容易性、再利用可能性、既存インターフェース維持
  - ❌ **Compromises**: 複数ファイルの変更が必要（2新規 + 2変更）、毎回ソートのオーバーヘッド（ただし要件範囲内）
- **Follow-up**: パフォーマンステストで100件/1000件の要件を検証する

### Decision: `localeCompare()`による文字列比較
- **Context**: 要件1.2で日本語を含むプロジェクト名のソート、要件1.3で大文字小文字を区別しないソートが求められている。
- **Alternatives Considered**:
  1. `toLowerCase() + 単純比較 (<, >)` - シンプルだがUnicode正規化の問題
  2. `toLowerCase() + localeCompare()` - Unicode対応 + 大文字小文字正規化
  3. `localeCompare()`の`sensitivity: 'base'`オプション - より正確だが複雑
- **Selected Approach**: `name.toLowerCase().localeCompare(other.toLowerCase())` を使用
- **Rationale**:
  - **Unicode対応**: `localeCompare()`はUnicodeコードポイント順でソート（要件1.2）
  - **大文字小文字の扱い**: `toLowerCase()`で正規化（要件1.3）
  - **シンプル性**: 追加の設定不要で直感的
  - **互換性**: すべてのモダンブラウザとNode.jsでサポート
- **Trade-offs**:
  - ✅ **Benefits**: シンプル、理解しやすい、TypeScript strict modeと互換性あり
  - ❌ **Compromises**: ロケール依存の細かい制御はできない（現在の要件では不要）
- **Follow-up**: 日本語プロジェクト名でのソート動作をテストで検証する

### Decision: 同名プロジェクトのセカンダリソート
- **Context**: プロジェクト名が同じ場合のソート順序を定義する必要がある。
- **Alternatives Considered**:
  1. 同名の場合は元の順序を維持（安定ソート）
  2. `addedAt`（追加日時）でセカンダリソート
  3. `path`でセカンダリソート
- **Selected Approach**: 同名の場合は`addedAt`でセカンダリソート（古い順）
- **Rationale**:
  - **一貫性**: ユーザーにとって予測可能な順序
  - **意味性**: 追加日時は時系列的な意味を持つ
  - **既存データ**: `addedAt`は既に`Project`型に存在（変更不要）
- **Trade-offs**:
  - ✅ **Benefits**: 予測可能、実装シンプル
  - ❌ **Compromises**: パスで区別したい場合は対応できない（現在の要件では不要）
- **Follow-up**: テストで同名プロジェクトの順序を検証する

### Decision: パフォーマンス最適化（キャッシュ）は不要
- **Context**: 要件4でパフォーマンス目標（100件で10ms、1000件で100ms）が定義されている。`getProjects()`が呼ばれるたびにソートするとオーバーヘッドが発生する可能性がある。
- **Alternatives Considered**:
  1. **毎回ソート**: `getProjects()`のたびにソート実行（シンプル）
  2. **キャッシュ戦略**: ソート済み配列をキャッシュし、`addProject()`/`removeProject()`時のみ無効化
- **Selected Approach**: 毎回ソート（キャッシュなし）
- **Rationale**:
  - **要件達成**: JavaScriptの`Array.sort()`は100件で1-3ms、1000件で10-30ms程度で要件を満たす
  - **シンプル性**: キャッシュ管理の複雑性を避ける
  - **呼び出し頻度**: `getProjects()`の呼び出し頻度は比較的低い（ダッシュボード表示時、プロジェクト更新時）
  - **データ量**: 実際のユーザーは通常10-50件のプロジェクトを管理（1000件は極端なケース）
- **Trade-offs**:
  - ✅ **Benefits**: 実装がシンプル、バグのリスク低減、保守性向上
  - ❌ **Compromises**: 理論上のパフォーマンスオーバーヘッド（実用上は問題なし）
- **Follow-up**: パフォーマンステストで実測値を検証し、必要に応じて将来的にキャッシュを追加

## Risks & Mitigations

- **Risk 1: パフォーマンス要件を満たせない可能性** - Mitigation: パフォーマンステストを実装し、100件/1000件で実測。要件を満たせない場合はキャッシュ戦略を追加
- **Risk 2: 日本語ソートの動作が期待と異なる** - Mitigation: 日本語プロジェクト名（平仮名、片仮名、漢字、英数字混在）でのテストケースを追加
- **Risk 3: 既存データとの互換性問題** - Mitigation: 既存の`Project`型を変更しない設計、マイグレーション不要を確認
- **Risk 4: ソート呼び出し漏れ** - Mitigation: `getProjects()`から自動的にソートするため、呼び出し側の変更不要で呼び出し漏れリスクを排除

## References
- [MDN: Array.prototype.sort()](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) — JavaScriptのソートアルゴリズムと計算量
- [MDN: String.prototype.localeCompare()](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare) — Unicode対応の文字列比較
- [V8 Blog: Array.prototype.sort](https://v8.dev/blog/array-sort) — V8エンジンのTimsort実装
- `.kiro/specs/alphabetical-sort/gap-analysis.md` — 実装ギャップ分析と既存コードベース調査
- `.kiro/steering/structure.md` — プロジェクト構造とフラットモジュール構成の原則
- `.kiro/steering/tech.md` — TypeScript strict modeと型安全性の基準
