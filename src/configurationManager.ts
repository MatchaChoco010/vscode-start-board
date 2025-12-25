import * as vscode from 'vscode';
import { AsciiArtConfig } from './types';

/**
 * VSCode workspace.getConfigurationの抽象化インターフェース（テスト用）
 */
export interface WorkspaceConfigInterface {
  get<T>(key: string, defaultValue: T): T;
}

/**
 * Disposableインターフェース
 */
export interface Disposable {
  dispose(): void;
}

/**
 * 設定変更ハンドラーの型
 */
type ConfigChangeHandler = (config: AsciiArtConfig) => void;

/**
 * 設定セクション名
 */
const CONFIG_SECTION = 'startBoard';

/**
 * ユーザー設定の読み取りと変更監視を担当するクラス
 *
 * 責務:
 * - VSCode設定からアスキーアート関連設定を取得
 * - 設定変更イベントの監視と通知
 * - デフォルト値の提供
 */
export class ConfigurationManager {
  /**
   * デフォルト設定値
   */
  static readonly DEFAULT_CONFIG: AsciiArtConfig = {
    text: 'Welcome\nto\nStart Board',
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 1.2
  };

  private configProvider: () => WorkspaceConfigInterface;
  private changeHandlers: Set<ConfigChangeHandler> = new Set();

  /**
   * ConfigurationManagerを作成する
   * @param configProvider 設定取得関数（テスト時にモックを注入可能）
   */
  constructor(configProvider: () => WorkspaceConfigInterface) {
    this.configProvider = configProvider;
  }

  /**
   * アスキーアート設定を取得する
   * @returns 現在のアスキーアート設定
   */
  getAsciiArtConfig(): AsciiArtConfig {
    const config = this.configProvider();

    return {
      text: config.get<string>('asciiArt.text', ConfigurationManager.DEFAULT_CONFIG.text),
      fontFamily: config.get<string>('asciiArt.fontFamily', ConfigurationManager.DEFAULT_CONFIG.fontFamily),
      fontSize: config.get<number>('asciiArt.fontSize', ConfigurationManager.DEFAULT_CONFIG.fontSize),
      lineHeight: config.get<number>('asciiArt.lineHeight', ConfigurationManager.DEFAULT_CONFIG.lineHeight)
    };
  }

  /**
   * 設定変更時のコールバックを登録する
   * @param handler 設定変更時に呼び出されるハンドラー
   * @returns ハンドラーを解除するためのDisposable
   */
  onConfigChange(handler: ConfigChangeHandler): Disposable {
    this.changeHandlers.add(handler);

    return {
      dispose: () => {
        this.changeHandlers.delete(handler);
      }
    };
  }

  /**
   * 設定変更を通知する
   * VSCodeのonDidChangeConfigurationイベントから呼び出される
   */
  notifyConfigChange(): void {
    const config = this.getAsciiArtConfig();
    for (const handler of this.changeHandlers) {
      handler(config);
    }
  }
}

/**
 * VSCode APIを使用したConfigurationManagerを作成する
 * @returns ConfigurationManagerとDisposable（設定変更監視の解除用）
 */
export function createConfigurationManager(): { manager: ConfigurationManager; disposable: vscode.Disposable } {
  const manager = new ConfigurationManager(() => vscode.workspace.getConfiguration(CONFIG_SECTION));

  // 設定変更イベントを監視
  const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(CONFIG_SECTION)) {
      manager.notifyConfigChange();
    }
  });

  return { manager, disposable };
}
