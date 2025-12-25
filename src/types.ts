/**
 * プロジェクトの種類
 */
export type ProjectType = 'folder' | 'workspace';

/**
 * プロジェクト情報を表すエンティティ
 */
export interface Project {
  /** 一意識別子（UUID） */
  id: string;
  /** 表示名（フォルダ名またはワークスペース名） */
  name: string;
  /** ファイルシステムパス */
  path: string;
  /** プロジェクトの種類 */
  type: ProjectType;
  /** 追加日時（Unix timestamp） */
  addedAt: number;
}

/**
 * プロジェクト追加時の入力データ
 */
export type ProjectInput = Omit<Project, 'id' | 'addedAt'>;

/**
 * アスキーアート表示設定
 */
export interface AsciiArtConfig {
  /** アスキーアートとして表示するテキスト */
  text: string;
  /** フォントファミリー */
  fontFamily: string;
  /** フォントサイズ（px） */
  fontSize: number;
  /** 行の高さ */
  lineHeight: number;
}

/**
 * Extension → Webview メッセージプロトコル
 */
export type ExtensionToWebviewMessage =
  | { type: 'init'; projects: Project[]; config: AsciiArtConfig }
  | { type: 'projectsUpdated'; projects: Project[] }
  | { type: 'configUpdated'; config: AsciiArtConfig };

/**
 * Webview → Extension メッセージプロトコル
 */
export type WebviewToExtensionMessage =
  | { type: 'openProject'; projectId: string }
  | { type: 'confirmDelete'; projectId: string; projectName: string }
  | { type: 'ready' };
