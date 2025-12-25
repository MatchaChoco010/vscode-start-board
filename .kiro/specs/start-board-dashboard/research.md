# Research & Design Decisions

## Summary
- **Feature**: `start-board-dashboard`
- **Discovery Scope**: New Feature (Greenfield)
- **Key Findings**:
  - VSCode Webview APIはセキュリティ上の理由で分離されたコンテキストで実行され、メッセージパッシングで通信する
  - globalStateはワークスペース間で永続的なデータを保存するのに適している（SQLiteベース）
  - Webview UI Toolkitは2025年1月に非推奨となるため、カスタムCSSまたは代替ライブラリを使用する

## Research Log

### VSCode Webview API
- **Context**: ダッシュボードUIの実装方法を調査
- **Sources Consulted**:
  - [VSCode Webview API公式ドキュメント](https://code.visualstudio.com/api/extension-guides/webview)
  - [VSCode API Reference](https://code.visualstudio.com/api/references/vscode-api)
- **Findings**:
  - `vscode.window.createWebviewPanel()` でWebviewパネルを作成
  - `viewType`, `title`, `viewColumn`, `options` の4パラメータが必要
  - `enableScripts: true` でJavaScript実行を許可
  - Webviewは分離されたコンテキストで実行される
  - `acquireVsCodeApi()` は1セッションにつき1回のみ呼び出し可能
- **Implications**:
  - Extension ⇔ Webview間の通信はメッセージパッシング必須
  - CSP (Content Security Policy) の設定が推奨される

### メッセージパッシング
- **Context**: Webviewとextension間のデータ連携方法
- **Sources Consulted**: VSCode Webview APIドキュメント
- **Findings**:
  - Extension → Webview: `panel.webview.postMessage()`
  - Webview → Extension: `vscode.postMessage()` (acquireVsCodeApiから取得)
  - Extension側は `panel.webview.onDidReceiveMessage()` でリッスン
  - Webview側は `window.addEventListener('message', ...)` でリッスン
- **Implications**:
  - 型安全なメッセージプロトコルの定義が必要
  - プロジェクトリストの取得・更新はメッセージで行う

### データ永続化オプション
- **Context**: プロジェクトリストの保存方法を調査
- **Sources Consulted**:
  - [VSCode Storage API](https://code.visualstudio.com/api/extension-capabilities/common-capabilities)
  - [globalState解説記事](https://medium.com/@krithikanithyanandam/vs-code-extension-storage-explained-the-what-where-and-how-3a0846a632ea)
- **Findings**:
  - `ExtensionContext.globalState`: 全ワークスペース共通のKey-Value保存（Memento API）
  - `ExtensionContext.globalStorageUri`: ファイルベースの保存先ディレクトリ
  - globalStateはSQLiteデータベースに保存される（macOS: `~/Library/Application Support/Code/User/globalStorage/state.vscdb`）
  - `setKeysForSync()` で設定同期に参加可能
- **Implications**:
  - プロジェクトリストはglobalStateで保存（シンプルなKey-Value構造に適合）
  - JSON形式の要件はglobalState内部で自動的に満たされる

### VSCode設定API
- **Context**: アスキーアート設定のカスタマイズ方法
- **Sources Consulted**:
  - [Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
  - [Configuration Sample](https://github.com/Microsoft/vscode-extension-samples/blob/main/configuration-sample/package.json)
- **Findings**:
  - `contributes.configuration` でpackage.jsonに設定を定義
  - `vscode.workspace.getConfiguration('extensionName')` で読み取り
  - 型: string, number, boolean, array, object などサポート
  - `markdownDescription` でMarkdown形式の説明が可能
- **Implications**:
  - アスキーアートのテキスト、フォント、サイズ、ライン幅を設定として定義
  - 設定変更イベント `onDidChangeConfiguration` で動的更新

### 空のウィンドウ検出
- **Context**: 空のウィンドウを開いた時の検出方法
- **Sources Consulted**: VSCode API Reference
- **Findings**:
  - `vscode.workspace.workspaceFolders` が `undefined` または空配列で判定
  - `vscode.window.onDidChangeActiveTextEditor` でエディタ変更を検出
  - 拡張機能のactivation event: `onStartupFinished` で起動時に処理可能
- **Implications**:
  - 起動時とワークスペース変更時に空のウィンドウを判定
  - 条件に合致したらダッシュボードを自動表示

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Simple Module Pattern | 機能ごとにモジュール分割（commands, webview, storage） | シンプル、VSCode拡張機能の標準的なパターン | 大規模化すると管理困難 | 本機能の規模に適切 |
| Hexagonal Architecture | ポート＆アダプターパターン | 高いテスト可能性、境界明確 | オーバーエンジニアリング | 本機能には過剰 |

**選択**: Simple Module Pattern - 機能の規模と複雑さに対して適切

## Design Decisions

### Decision: データ永続化にglobalStateを使用
- **Context**: プロジェクトリストをローカルJSONファイルに保存する要件
- **Alternatives Considered**:
  1. `globalStorageUri` + ファイルI/O — JSONファイルを直接読み書き
  2. `globalState` (Memento API) — Key-Value形式で保存
- **Selected Approach**: globalState (Memento API)
- **Rationale**:
  - プロジェクトリストは単純なオブジェクト配列であり、Key-Value保存に適合
  - ファイルI/Oの複雑さを回避できる
  - VSCodeが自動的にSQLiteに永続化するため、信頼性が高い
  - 要件の「ローカルにjsonで保持」はglobalStateの内部実装で満たされる
- **Trade-offs**:
  - ファイルを直接編集できない（ただし手動編集は要件外）
  - 大量データには不向き（プロジェクトリストの規模では問題なし）
- **Follow-up**: なし

### Decision: Webview UI Toolkitを使用しない
- **Context**: WebviewのUI実装方法
- **Alternatives Considered**:
  1. Webview UI Toolkit — 公式のUIコンポーネントライブラリ
  2. カスタムHTML/CSS — 独自実装
  3. VSCode Elements — 代替のWebコンポーネントライブラリ
- **Selected Approach**: カスタムHTML/CSS
- **Rationale**:
  - Webview UI Toolkitは2025年1月に非推奨
  - シンプルなUIであり、外部依存を減らせる
  - VSCodeのテーマ変数（CSS変数）を直接使用可能
- **Trade-offs**:
  - コンポーネントを手動で実装する必要がある
  - ネイティブのVSCode UIとの一貫性を保つ努力が必要
- **Follow-up**: VSCodeのCSSカスタムプロパティを活用してテーマ対応

### Decision: メッセージプロトコルの型定義
- **Context**: Extension ⇔ Webview間の通信における型安全性
- **Alternatives Considered**:
  1. 型なしオブジェクト — 柔軟だが型安全でない
  2. Discriminated Union — TypeScriptのユニオン型で型安全に
- **Selected Approach**: Discriminated Union
- **Rationale**:
  - コンパイル時に型チェックが可能
  - メッセージの種類ごとに明確なペイロード定義
  - VSCode拡張機能開発のベストプラクティス
- **Trade-offs**:
  - 型定義の追加作業が必要
- **Follow-up**: 共通の型定義ファイルを作成

## Risks & Mitigations
- **Risk 1**: Webview UI Toolkit非推奨による将来の互換性 — カスタムCSSで独自実装し、VSCodeテーマ変数を使用
- **Risk 2**: 空のウィンドウ判定の信頼性 — 起動時とワークスペース変更イベントの両方で判定
- **Risk 3**: プロジェクトパスの存在確認 — `vscode.workspace.fs.stat()` でパス存在を検証

## References
- [VSCode Webview API](https://code.visualstudio.com/api/extension-guides/webview) — 公式Webviewガイド
- [VSCode Contribution Points](https://code.visualstudio.com/api/references/contribution-points) — 設定定義方法
- [VSCode Extension Capabilities](https://code.visualstudio.com/api/extension-capabilities/common-capabilities) — ストレージAPI
- [VSCode Extension Samples](https://github.com/Microsoft/vscode-extension-samples) — 公式サンプル集
