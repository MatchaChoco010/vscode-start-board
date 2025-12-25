# Implementation Gap Analysis

## 1. 現状調査

### 主要ファイルとモジュール

#### Core Modules
- **src/webviewManager.ts** (346行): WebviewPanelのライフサイクル管理、HTML生成（`getHtmlContent()`メソッド）
- **src/types.ts** (56行): ドメインエンティティ（Project、AsciiArtConfig）とメッセージプロトコル定義
- **src/configurationManager.ts** (116行): ユーザー設定の読み取りと変更監視
- **src/extension.ts**: 拡張機能のエントリーポイント
- **src/messageIntegration.ts**: Extension ↔ Webview間のメッセージハンドリング

#### Test Modules
- **src/test/suite/webviewManager.test.ts**: WebviewManagerのテスト
- 各主要モジュールに対応するテストファイルが存在

### 既存のレイアウト構造

**現在のHTML構造**（webviewManager.ts:163-343）:
```html
<body>  <!-- display: flex, flex-direction: column, min-height: 100vh -->
  <div class="splash-container">  <!-- flex: 0 0 auto, 固定サイズ -->
    <pre class="splash-text" id="splash"></pre>
  </div>
  <div class="project-list-container">  <!-- flex: 1 1 auto, 残りスペース占有 -->
    <h2 class="project-list-title">Projects</h2>
    <ul class="project-list" id="project-list"></ul>
  </div>
</body>
```

**現在のCSSスタイリング**:
- **body**: `min-height: 100vh` により、コンテンツが画面を超えると全体がスクロール可能
- **splash-container**: `flex: 0 0 auto` で固定サイズ、スクロールに影響されない意図はあるが、body自体がスクロールするため機能しない
- **project-list-container**: `flex: 1 1 auto` で残りのスペースを占有するが、overflow制御なし

**問題点**:
- プロジェクトリストが増えると画面全体がスクロールし、ASCIIアートが画面外に消える
- プロジェクトリスト専用のスクロール領域が存在しない

### 既存の設定管理

**AsciiArtConfig** (types.ts:28-39):
- `text`: ASCIIアートテキスト
- `fontFamily`: フォントファミリー
- `fontSize`: フォントサイズ（px）
- `lineHeight`: 行の高さ

レイアウトやスクロール関連の設定は現在存在しない。

### アーキテクチャパターン

- **Flat Module Structure**: src/直下に機能別モジュールを配置
- **Message Protocol**: Extension ↔ Webview間は型安全なメッセージで通信
- **Dependency Injection**: `createXXXDependencies`パターンでテスタビリティ確保
- **Inline HTML/CSS**: WebviewのHTML/CSSは`getHtmlContent()`メソッド内にインライン記述

### 命名規則とコーディングスタイル

- **ファイル**: camelCase（webviewManager.ts）
- **クラス/インターフェース**: PascalCase（WebviewManager、Project）
- **関数/変数**: camelCase（getHtmlContent、renderProjects）
- **CSSクラス**: BEM風（splash-container、project-list-title）

## 2. 要件実現可能性分析

### EARS要件から抽出される技術的ニーズ

#### UI/コンポーネント変更
- **固定ヘッダーレイアウト** (Requirement 1):
  - body要素のスタイル変更: `height: 100vh`, `overflow: hidden`
  - splash-containerを固定ヘッダーとして維持
  - project-list-containerをスクロール可能領域に変更

- **プロジェクトリストのスクロール動作** (Requirement 2):
  - project-list-containerに`overflow-y: auto`を追加
  - 高さ計算: `height: calc(100vh - [splash-containerの高さ])`

- **スクロールバーの視覚的配慮** (Requirement 3):
  - カスタムスクロールバースタイル（Webkit/Firefox対応）
  - VSCodeテーマカラーとの調和
  - ホバー時のフェードイン/アウトエフェクト

- **レイアウトの応答性** (Requirement 4):
  - ウィンドウリサイズ時の動的高さ再計算（CSSの`calc()`で対応可能）
  - ちらつき防止（CSSトランジションの適切な設定）

#### データモデル変更
- **不要**: 既存のProject、AsciiArtConfigはそのまま使用可能

#### ビジネスロジック変更
- **不要**: JavaScriptロジック（renderProjects、renderSplash）は変更不要

#### 非機能要件
- **パフォーマンス**: CSSの`calc()`とflexboxによる動的高さ計算は軽量
- **互換性**: Webview（Chromiumベース）でのCSS対応は問題なし
- **セキュリティ**: CSP変更不要、スタイル追加のみ

### ギャップと制約

#### Missing（既存コードベースに存在しない機能）
1. **固定ヘッダー+スクロール領域のCSSレイアウト**: 現在は全体スクロール
2. **カスタムスクロールバースタイル**: 現在はブラウザデフォルト
3. **動的高さ計算**: 現在はflexboxの自動レイアウトのみ

#### Constraint（既存アーキテクチャからの制約）
1. **インラインCSS**: HTML/CSSは`getHtmlContent()`メソッド内にテンプレート文字列として記述
2. **CSP制限**: `style-src 'unsafe-inline'`のみ許可、外部CSSファイル不可
3. **単一ファイル構造**: Webview関連のHTML/CSS/JavaScriptはすべてwebviewManager.ts内

#### Research Needed（設計フェーズで調査が必要な項目）
1. **スクロールバーのクロスブラウザ対応**: WebkitとFirefoxの両方でスタイリングが機能するか検証
2. **VSCodeテーマカラーの動的取得**: スクロールバーに適用するCSS変数の選択
3. **パフォーマンステスト**: 大量のプロジェクト（100+）でのスクロールパフォーマンス

### 複雑性シグナル

- **シンプルなUI変更**: CSSスタイルの追加/変更が主体
- **アルゴリズムロジック**: なし
- **ワークフロー**: なし
- **外部統合**: なし

## 3. 実装アプローチのオプション

### Option A: 既存WebviewManager.getHtmlContent()を拡張 ✅ 推奨

#### 変更対象ファイル
- **src/webviewManager.ts**: `getHtmlContent()`メソッド内のHTML/CSSを修正

#### 具体的な変更内容
1. **bodyスタイル**:
   ```css
   body {
     height: 100vh;  /* min-heightから変更 */
     overflow: hidden;  /* 追加 */
     /* 既存のスタイルは維持 */
   }
   ```

2. **project-list-containerスタイル**:
   ```css
   .project-list-container {
     flex: 1 1 auto;
     overflow-y: auto;  /* 追加 */
     /* 既存のスタイルは維持 */
   }
   ```

3. **カスタムスクロールバースタイル**（追加）:
   ```css
   .project-list-container::-webkit-scrollbar {
     width: 10px;
   }
   .project-list-container::-webkit-scrollbar-track {
     background: transparent;
   }
   .project-list-container::-webkit-scrollbar-thumb {
     background: var(--vscode-scrollbarSlider-background);
     border-radius: 5px;
   }
   /* ... Firefoxスタイルも追加 */
   ```

#### 互換性評価
- ✅ 既存のHTML構造を維持（JavaScript変更不要）
- ✅ 既存のメッセージプロトコルを維持
- ✅ 破壊的変更なし（レイアウトの改善のみ）

#### 複雑性と保守性
- ✅ 認知負荷: 低（CSSの追加/変更のみ）
- ✅ 単一責任: 維持される（WebviewManagerはWebview管理のまま）
- ✅ ファイルサイズ: 約50行のCSS追加、許容範囲内

#### Trade-offs
- ✅ 最小限のファイル変更で実装可能
- ✅ 既存のパターンとインフラを活用
- ✅ テスト影響範囲が小さい（HTMLのsnapshotテストのみ）
- ✅ 迅速な開発と検証が可能
- ⚠️ `getHtmlContent()`メソッドが若干長くなる（約400行）

### Option B: HTML生成を新モジュールに分離

#### 新規作成ファイル
- **src/webviewHtmlGenerator.ts**: HTML/CSS生成ロジックを分離

#### 統合ポイント
- `WebviewManager.getHtmlContent()`から`WebviewHtmlGenerator.generate()`を呼び出し

#### 責任境界
- **WebviewHtmlGenerator**: HTML/CSSテンプレート生成のみ
- **WebviewManager**: ライフサイクル管理とメッセージング

#### Trade-offs
- ✅ 関心の分離が明確
- ✅ HTML生成ロジックのテストが容易
- ❌ 過剰設計の可能性（現在のHTML生成は単純なテンプレート文字列）
- ❌ 新しいファイルとインターフェースの追加によるナビゲーションコスト
- ❌ 既存のフラットモジュール構造に合致しない

### Option C: ハイブリッドアプローチ

#### 適用性
現在の要件は**シンプルなCSS変更**のみのため、ハイブリッドアプローチは不要。

Option Aで十分に対応可能。

## 4. 要件-アセットマッピング

| 要件 | 既存アセット | ギャップ/制約 |
|------|------------|--------------|
| **Req 1: 固定ヘッダーレイアウト構造** | webviewManager.ts:164-255（HTML構造） | **Missing**: 固定ヘッダー+スクロール領域のCSSレイアウト |
| **Req 2: プロジェクトリストのスクロール動作** | webviewManager.ts:193-197（project-list-container） | **Missing**: `overflow-y: auto`スタイル |
| **Req 3: スクロールバーの視覚的配慮** | なし | **Missing**: カスタムスクロールバースタイル |
| **Req 4: レイアウトの応答性** | webviewManager.ts:172-183（bodyスタイル） | **Constraint**: CSSの`calc()`のみで対応可能、JavaScript不要 |
| **Req 5: バージョン管理** | package.json:5（version: "0.1.0"） | **Missing**: バージョン番号の更新（0.1.0 → 0.2.0） |

## 5. 実装の複雑性とリスク

### 工数見積もり: **S（1-3日）**

**理由**:
- CSSスタイルの追加/変更が主体（約50行）
- HTML構造の変更なし
- JavaScriptロジックの変更なし
- 既存のパターンに従う単純な拡張
- テスト更新も最小限（HTMLスナップショットのみ）

### リスク評価: **Low**

**理由**:
- 既存の技術スタック（HTML/CSS）のみ使用
- 明確なスコープ（レイアウトとスクロール動作のみ）
- 最小限の統合（単一ファイルの変更）
- 破壊的変更なし
- パフォーマンスリスクなし（CSSベースの軽量実装）

**潜在的リスク**:
1. **スクロールバーのクロスブラウザ対応**: WebkitとFirefoxでスタイルが異なる → 設計フェーズで検証
2. **大量プロジェクトでのパフォーマンス**: 100+プロジェクトでのスクロール → パフォーマンステストで確認

## 6. 設計フェーズへの推奨事項

### 推奨アプローチ
**Option A: 既存WebviewManager.getHtmlContent()を拡張**

**理由**:
- 最小限の変更で要件を満たせる
- 既存のアーキテクチャパターンに合致
- 迅速な実装と検証が可能
- テスト影響範囲が小さい

### 主要な設計決定事項
1. **スクロールバースタイル**: VSCodeテーマカラー（`--vscode-scrollbarSlider-*`）を使用し、Webkit/Firefox両対応
2. **高さ計算**: CSSの`calc()`とflexboxで動的高さを実現、JavaScript不要
3. **レイアウト構造**: 既存のHTML構造を維持、CSSのみ変更

### 設計フェーズで調査すべき項目
1. **スクロールバーのクロスブラウザ対応**:
   - Webkit（`::-webkit-scrollbar-*`）とFirefox（`scrollbar-width`, `scrollbar-color`）の両対応
   - VSCodeのWebview（Chromiumベース）での動作検証

2. **VSCodeテーマカラーの選択**:
   - スクロールバーに適用する最適なCSS変数の特定
   - `--vscode-scrollbarSlider-background`, `--vscode-scrollbarSlider-hoverBackground`など

3. **パフォーマンステスト**:
   - 100+プロジェクトでのスクロールパフォーマンス測定
   - `will-change`プロパティの必要性評価

### 実装時の注意事項
1. **既存テストの更新**: webviewManager.test.tsのHTMLスナップショットを更新
2. **バージョン番号**: package.jsonを0.1.0 → 0.2.0に更新（マイナーバージョンアップ）
3. **後方互換性**: 既存の機能（プロジェクト追加/削除/オープン）は影響を受けない

