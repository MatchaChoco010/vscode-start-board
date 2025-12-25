# Technology Stack

## Architecture

VSCode Extension APIをベースとした、イベント駆動型のシングルプロセスアーキテクチャ。Webviewによるカスタムビューと、メッセージパッシングによるExtension Host ↔ Webview間通信を採用。

## Core Technologies

- **Language**: TypeScript 5.3+
- **Platform**: VSCode Extension API 1.85+
- **Runtime**: Node.js (ES2022 target)

## Key Libraries

- **vscode**: 拡張機能のコアAPI（Webview、コマンド、ストレージ、ワークスペース操作）
- **@vscode/test-electron**: 拡張機能の統合テスト実行環境
- **Mocha**: テストフレームワーク

## Development Standards

### Type Safety
- TypeScript strict mode全面有効化
- 明示的な型定義（types.tsでドメインエンティティを集約）
- `any`の使用禁止（forceConsistentCasingInFileNamesでケース一貫性も強制）

### Code Quality
- ESLint + TypeScript ESLint Plugin
- camelCase命名規則（ファイル、関数、変数）
- JSDocコメントで重要な関数の意図を明示

### Testing
- すべての主要モジュールに対応するテストファイル（`src/test/suite/*.test.ts`）
- ユニットテスト + 統合テスト（VSCode APIモック）
- `npm run pretest`でlintとコンパイルを事前実行

## Development Environment

### Required Tools
- Node.js 20+
- TypeScript 5.3+
- VSCode 1.85+

### Common Commands
```bash
# Dev: npm run watch
# Build: npm run compile
# Test: npm test
# Lint: npm run lint
```

## Key Technical Decisions

- **Flat Module Structure**: 機能ごとにモジュール分割し、`src/`直下に配置。深いネストを避け、依存関係を明確化
- **Message Protocol定義**: Extension ↔ Webview間の通信を型安全なメッセージプロトコルとして定義（types.ts）
- **Dependency Injection的アプローチ**: `createXXXDependencies`パターンでテスタビリティを向上
- **VSCode globalStateでの永続化**: プロジェクトリストをExtension Context globalStateに保存（軽量データに最適）

---
_Document standards and patterns, not every dependency_
