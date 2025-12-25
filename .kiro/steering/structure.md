# Project Structure

## Organization Philosophy

**機能ベースのフラットモジュール構成**: 各モジュールは単一責任を持ち、`src/`直下に配置。深いディレクトリ階層を避け、インポートパスを短く保つことで可読性と保守性を向上。

## Directory Patterns

### Core Modules (`src/*.ts`)
**Location**: `/src/`
**Purpose**: 拡張機能のコア機能を実装する独立したモジュール
**Example**:
- `extension.ts` - エントリーポイント、ライフサイクル管理
- `webviewManager.ts` - Webview作成・更新・通信
- `projectStorage.ts` - プロジェクトデータの永続化
- `commandHandlers.ts` - VSCodeコマンドハンドラー
- `types.ts` - ドメインエンティティと型定義の集約

### Test Modules (`src/test/suite/*.test.ts`)
**Location**: `/src/test/suite/`
**Purpose**: 各モジュールに対応するテストファイル
**Example**: `webviewManager.test.ts` ↔ `webviewManager.ts`

### Build Output (`out/`)
**Location**: `/out/`
**Purpose**: TypeScriptコンパイル結果（package.jsonの`main`フィールドで参照）

## Naming Conventions

- **Files**: camelCase (`projectStorage.ts`, `emptyWindowDetection.ts`)
- **Test Files**: `<moduleName>.test.ts` パターン
- **Interfaces/Types**: PascalCase (`Project`, `AsciiArtConfig`)
- **Functions**: camelCase (`createWebviewManager`, `handleOpenProject`)

## Import Organization

```typescript
// External dependencies first
import * as vscode from 'vscode';

// Internal modules (relative paths)
import { ProjectStorage } from './projectStorage';
import { WebviewManager, createWebviewManager } from './webviewManager';
import { Project, ExtensionToWebviewMessage } from './types';
```

**Path Strategy**:
- 相対パスのみ使用（フラット構造のため`@/`エイリアス不要）
- 型のみのインポートには `import type { ... }` を推奨（将来的なTree Shaking最適化）

## Code Organization Principles

- **単一責任原則**: 各モジュールは1つの関心事に集中（Webview管理、ストレージ、コマンド等）
- **依存性注入パターン**: `createXXXDependencies` 関数でテスト容易性を確保
- **型ファーストアプローチ**: `types.ts`で全ドメイン概念を定義し、実装がそれに従う
- **メッセージプロトコル**: Extension ↔ Webview間は型安全なメッセージ型で通信

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
