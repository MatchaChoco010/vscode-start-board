import * as assert from 'assert';
import { ConfigurationManager, WorkspaceConfigInterface } from '../../configurationManager';
import { AsciiArtConfig } from '../../types';

/**
 * モック設定クラス
 */
class MockWorkspaceConfig implements WorkspaceConfigInterface {
  private configValues: Record<string, unknown> = {};

  setConfig(key: string, value: unknown): void {
    this.configValues[key] = value;
  }

  get<T>(key: string, defaultValue: T): T {
    const value = this.configValues[key];
    if (value === undefined) {
      return defaultValue;
    }
    return value as T;
  }
}

suite('ConfigurationManager Test Suite', () => {
  let mockConfig: MockWorkspaceConfig;
  let configManager: ConfigurationManager;

  setup(() => {
    mockConfig = new MockWorkspaceConfig();
    configManager = new ConfigurationManager(() => mockConfig);
  });

  suite('getAsciiArtConfig', () => {
    test('デフォルト設定値が正しく返される', () => {
      const config = configManager.getAsciiArtConfig();

      assert.strictEqual(config.text, 'Welcome');
      assert.strictEqual(config.fontFamily, 'monospace');
      assert.strictEqual(config.fontSize, 14);
      assert.strictEqual(config.lineHeight, 1.2);
    });

    test('カスタムtext設定が正しく取得される', () => {
      mockConfig.setConfig('asciiArt.text', 'Hello World');

      const config = configManager.getAsciiArtConfig();

      assert.strictEqual(config.text, 'Hello World');
    });

    test('カスタムfontFamily設定が正しく取得される', () => {
      mockConfig.setConfig('asciiArt.fontFamily', 'Courier New');

      const config = configManager.getAsciiArtConfig();

      assert.strictEqual(config.fontFamily, 'Courier New');
    });

    test('カスタムfontSize設定が正しく取得される', () => {
      mockConfig.setConfig('asciiArt.fontSize', 24);

      const config = configManager.getAsciiArtConfig();

      assert.strictEqual(config.fontSize, 24);
    });

    test('カスタムlineHeight設定が正しく取得される', () => {
      mockConfig.setConfig('asciiArt.lineHeight', 1.5);

      const config = configManager.getAsciiArtConfig();

      assert.strictEqual(config.lineHeight, 1.5);
    });

    test('複数のカスタム設定が同時に正しく取得される', () => {
      mockConfig.setConfig('asciiArt.text', 'Custom Text');
      mockConfig.setConfig('asciiArt.fontFamily', 'Arial');
      mockConfig.setConfig('asciiArt.fontSize', 20);
      mockConfig.setConfig('asciiArt.lineHeight', 2.0);

      const config = configManager.getAsciiArtConfig();

      assert.strictEqual(config.text, 'Custom Text');
      assert.strictEqual(config.fontFamily, 'Arial');
      assert.strictEqual(config.fontSize, 20);
      assert.strictEqual(config.lineHeight, 2.0);
    });
  });

  suite('onConfigChange', () => {
    test('設定変更時にハンドラーが呼び出される', () => {
      let callCount = 0;
      let receivedConfig: AsciiArtConfig | undefined;

      configManager.onConfigChange((config) => {
        callCount++;
        receivedConfig = config;
      });

      mockConfig.setConfig('asciiArt.text', 'Changed');
      configManager.notifyConfigChange();

      assert.strictEqual(callCount, 1);
      assert.ok(receivedConfig !== undefined);
      assert.strictEqual((receivedConfig as AsciiArtConfig).text, 'Changed');
    });

    test('複数のハンドラーが登録できる', () => {
      let callCount1 = 0;
      let callCount2 = 0;

      configManager.onConfigChange(() => {
        callCount1++;
      });
      configManager.onConfigChange(() => {
        callCount2++;
      });

      configManager.notifyConfigChange();

      assert.strictEqual(callCount1, 1);
      assert.strictEqual(callCount2, 1);
    });

    test('disposeでハンドラーが解除される', () => {
      let callCount = 0;

      const disposable = configManager.onConfigChange(() => {
        callCount++;
      });

      configManager.notifyConfigChange();
      assert.strictEqual(callCount, 1);

      disposable.dispose();
      configManager.notifyConfigChange();
      assert.strictEqual(callCount, 1); // 解除後は呼ばれない
    });
  });

  suite('デフォルト値定数', () => {
    test('DEFAULT_CONFIG定数が正しい値を持つ', () => {
      const defaults = ConfigurationManager.DEFAULT_CONFIG;

      assert.strictEqual(defaults.text, 'Welcome');
      assert.strictEqual(defaults.fontFamily, 'monospace');
      assert.strictEqual(defaults.fontSize, 14);
      assert.strictEqual(defaults.lineHeight, 1.2);
    });
  });
});
