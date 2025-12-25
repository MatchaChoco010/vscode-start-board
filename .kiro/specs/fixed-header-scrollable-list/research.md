# Research & Design Decisions

## Summary
- **Feature**: `fixed-header-scrollable-list`
- **Discovery Scope**: Extension（既存Webviewレイアウトの拡張）
- **Key Findings**:
  - VSCode Webview（Chromiumベース）は`::-webkit-scrollbar`疑似要素とVSCodeテーマ変数（`--vscode-*`）をサポート
  - クロスブラウザスクロールバースタイリングには標準プロパティ（`scrollbar-width`, `scrollbar-color`）とWebkit疑似要素の併用が必要
  - CSS `calc()`とFlexboxによる動的高さ計算で、JavaScriptなしでレイアウト応答性を実現可能

## Research Log

### VSCode Webviewにおけるスクロールバースタイリング
- **Context**: プロジェクトリストのスクロールバーをVSCodeテーマと調和させる方法を調査
- **Sources Consulted**:
  - [VSCode Webview API](https://code.visualstudio.com/api/extension-guides/webview)
  - [::-webkit-scrollbar - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/::-webkit-scrollbar)
  - [VSCode WebView overlay scrollbars discussion](https://github.com/microsoft/vscode-discussions/discussions/998)
  - [A code-driven approach to theme your VS Code webview](https://www.eliostruyf.com/code-driven-approach-theme-vscode-webview/)
- **Findings**:
  - VSCode WebviewはElectron/Chromiumベースのため、`::-webkit-scrollbar`疑似要素が完全サポート
  - VSCodeテーマカラーは`--vscode-*`プレフィックスのCSS変数として利用可能（例: `--vscode-scrollbarSlider-background`）
  - Webview UI Toolkitは2025年1月1日に非推奨となったため、カスタムCSSを直接実装する必要がある
  - Developer Tools（`Developer: Open Webview Developer Tools`）で注入されたスタイルを確認可能
- **Implications**:
  - `::-webkit-scrollbar-*`疑似要素を使用してスクロールバーをカスタマイズ
  - `--vscode-scrollbarSlider-background`, `--vscode-scrollbarSlider-hoverBackground`などのテーマ変数を活用
  - `!important`や高い特定性のセレクターが必要な場合がある

### クロスブラウザスクロールバースタイリング（2025年版）
- **Context**: Firefox含む全ブラウザでスクロールバースタイルを統一する方法を調査
- **Sources Consulted**:
  - [scrollbar-color - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color)
  - [scrollbar-width - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-width)
  - [CSS Scrollbars Styling Module Level 1](https://drafts.csswg.org/css-scrollbars/)
  - [How to Style Scrollbars with Cross-Browser Compatibility](https://www.2hatslogic.com/help-desk/style-scrollbars-with-cross-browser-compatibility/)
- **Findings**:
  - 2025年12月時点で`scrollbar-color`はクロスブラウザサポート達成
  - 標準プロパティ: `scrollbar-width: thin | auto | none`, `scrollbar-color: <thumb-color> <track-color>`
  - Webkit疑似要素: `::-webkit-scrollbar`, `::-webkit-scrollbar-thumb`, `::-webkit-scrollbar-track`
  - ブラウザは認識できないルールを無視するため、両方のアプローチを併用可能
- **Implications**:
  - 標準プロパティとWebkit疑似要素の両方を記述してクロスブラウザ対応を実現
  - VSCode Webview（Chromiumベース）では主にWebkit疑似要素を使用
  - Firefoxでテストする場合は標準プロパティで対応

### 固定ヘッダー+スクロール領域のCSSレイアウト
- **Context**: ASCIIアートを固定し、プロジェクトリストのみスクロール可能にするレイアウト構造を調査
- **Sources Consulted**:
  - 既存コードベース分析（webviewManager.ts:163-343）
  - Gap Analysis（gap-analysis.md）
- **Findings**:
  - 現在の実装: `body`要素が`min-height: 100vh`でコンテンツ全体がスクロール可能
  - 既存のHTML構造（`splash-container`, `project-list-container`）は既に分離されており、変更不要
  - CSS Flexboxと`overflow`プロパティで固定ヘッダー+スクロール領域を実現可能
- **Implications**:
  - `body`要素: `height: 100vh; overflow: hidden;`で画面全体のスクロールを防止
  - `project-list-container`: `overflow-y: auto;`でスクロール可能領域を作成
  - HTML構造の変更不要、JavaScriptロジックの変更不要

## Architecture Pattern Evaluation

既存のインラインHTML/CSS生成パターンを維持する方針を選択。新規モジュール作成は過剰設計と判断。

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A: `getHtmlContent()`拡張 | 既存メソッド内でCSS追加/変更 | 最小限の変更、既存パターン維持、迅速な実装 | `getHtmlContent()`が若干長くなる（約400行） | **選択**: ギャップ分析で推奨、ステアリング原則に合致 |
| B: HTML生成モジュール分離 | `WebviewHtmlGenerator`を新規作成 | 関心の分離、テスト容易性 | 過剰設計、新規ファイル追加、ナビゲーションコスト | 拒否: 現在のHTML生成は単純なテンプレート文字列のため不要 |

## Design Decisions

### Decision: CSSのみでレイアウト変更を実装

- **Context**: 固定ヘッダー+スクロール領域の実装方法
- **Alternatives Considered**:
  1. CSS変更のみ — `body`, `project-list-container`のスタイル変更
  2. JavaScript動的計算 — ウィンドウリサイズ時にJavaScriptで高さを計算
- **Selected Approach**: CSS変更のみ（Option 1）
  - `body`: `height: 100vh; overflow: hidden;`
  - `project-list-container`: `overflow-y: auto;`
  - Flexboxの`flex: 1 1 auto;`で動的高さ計算
- **Rationale**:
  - CSS `calc()`とFlexboxで動的高さ計算が可能、JavaScript不要
  - パフォーマンス最適化（レイアウト計算はブラウザエンジンに委譲）
  - 保守性向上（CSSのみの変更）
- **Trade-offs**:
  - ✅ パフォーマンス: ブラウザネイティブのレイアウトエンジン使用
  - ✅ 保守性: HTML/JavaScript変更不要
  - ⚠️ 制約: Flexboxと`overflow`の組み合わせのみで実現可能な範囲
- **Follow-up**: 大量プロジェクト（100+）でのスクロールパフォーマンステスト

### Decision: VSCodeテーマ変数を使用したスクロールバースタイリング

- **Context**: スクロールバーの色とスタイルをVSCodeテーマと調和させる
- **Alternatives Considered**:
  1. VSCodeテーマ変数使用 — `--vscode-scrollbarSlider-*`変数
  2. 固定カラー — ハードコードされた色値
  3. JavaScript動的取得 — VSCode APIで現在のテーマカラーを取得
- **Selected Approach**: VSCodeテーマ変数使用（Option 1）
  - `::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); }`
  - `::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }`
- **Rationale**:
  - テーマ変更時の自動適応
  - VSCodeの標準スクロールバーとの視覚的一貫性
  - 追加のJavaScript不要
- **Trade-offs**:
  - ✅ テーマ対応: ライト/ダークテーマ自動切り替え
  - ✅ 一貫性: VSCodeネイティブUIとの調和
  - ⚠️ 制約: VSCodeが提供する変数のみ使用可能
- **Follow-up**: Developer Toolsで実際のテーマ変数を確認してスタイルを最適化

### Decision: クロスブラウザ対応のスクロールバースタイル

- **Context**: Firefox含む全ブラウザでスクロールバースタイルを統一
- **Alternatives Considered**:
  1. Webkit疑似要素のみ — VSCode Webview（Chromium）のみ対応
  2. 標準プロパティのみ — 古いブラウザで非対応
  3. 両方併用 — Webkit疑似要素 + 標準プロパティ
- **Selected Approach**: 両方併用（Option 3）
  - 標準プロパティ: `scrollbar-width: thin; scrollbar-color: [thumb] [track];`
  - Webkit疑似要素: `::-webkit-scrollbar-*`
- **Rationale**:
  - ブラウザは認識できないルールを無視するため、両方記述可能
  - 2025年時点で標準プロパティのクロスブラウザサポート達成
  - 将来的な互換性確保
- **Trade-offs**:
  - ✅ 互換性: 全モダンブラウザ対応
  - ✅ 将来性: 標準仕様への移行準備
  - ⚠️ コード量: 両方のスタイル定義が必要（約20行追加）
- **Follow-up**: なし（標準的なベストプラクティス）

## Risks & Mitigations

- **Risk 1: 大量プロジェクト（100+）でのスクロールパフォーマンス** — ミティゲーション: 実装後にパフォーマンステストを実施、必要に応じて仮想スクロール（将来の機能）を検討
- **Risk 2: スクロールバーの視覚的ノイズ** — ミティゲーション: `:hover`状態での強調表示、非アクティブ時の控えめな表示（`opacity`調整）
- **Risk 3: ウィンドウリサイズ時のレイアウトちらつき** — ミティゲーション: CSS `transition`プロパティは使用せず、ブラウザネイティブのレイアウト計算に委譲

## References

**VSCode Webview & スクロールバースタイリング**:
- [VSCode Webview API](https://code.visualstudio.com/api/extension-guides/webview) — 公式ガイド
- [::-webkit-scrollbar - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/::-webkit-scrollbar) — Webkit疑似要素リファレンス
- [VSCode WebView overlay scrollbars discussion](https://github.com/microsoft/vscode-discussions/discussions/998) — オーバーレイスクロールバーの議論
- [A code-driven approach to theme your VS Code webview](https://www.eliostruyf.com/code-driven-approach-theme-vscode-webview/) — テーマ変数活用法

**クロスブラウザスクロールバースタイリング**:
- [scrollbar-color - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color) — 標準プロパティリファレンス
- [scrollbar-width - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-width) — 標準プロパティリファレンス
- [CSS Scrollbars Styling Module Level 1](https://drafts.csswg.org/css-scrollbars/) — W3C仕様
- [How to Style Scrollbars with Cross-Browser Compatibility](https://www.2hatslogic.com/help-desk/style-scrollbars-with-cross-browser-compatibility/) — クロスブラウザ実装ガイド

