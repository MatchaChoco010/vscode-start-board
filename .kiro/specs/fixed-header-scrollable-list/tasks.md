# Implementation Plan

## 1. WebviewレイアウトのCSS実装

- [x] 1.1 固定ヘッダーとスクロール領域の実装
  - `WebviewManager.getHtmlContent()`メソッド内のCSSスタイルを変更
  - body要素の`min-height: 100vh`を`height: 100vh`に変更し、ビューポート全体を固定
  - body要素に`overflow: hidden`を追加し、画面全体のスクロールを無効化
  - splash-containerのスタイルは`flex: 0 0 auto`のまま維持（固定サイズ）
  - project-list-containerに`overflow-y: auto`を追加し、縦スクロールを有効化
  - Flexboxの`flex: 1 1 auto`により、ASCIIアート表示後の残り領域を自動割り当て
  - ウィンドウリサイズ時にブラウザのレイアウトエンジンが動的に高さを再計算することを確認
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4_

- [x] 1.2 カスタムスクロールバースタイルの実装
  - project-list-containerに標準スクロールバープロパティを追加（`scrollbar-width: thin`, `scrollbar-color`）
  - Webkit疑似要素スタイルを追加（`::-webkit-scrollbar`, `::-webkit-scrollbar-track`, `::-webkit-scrollbar-thumb`）
  - VSCodeテーマ変数を使用してスクロールバーをテーマと調和させる（`--vscode-scrollbarSlider-background`, `--vscode-scrollbarSlider-hoverBackground`, `--vscode-scrollbarSlider-activeBackground`）
  - スクロールバーの幅を10pxに設定し、プロジェクト名の表示領域を圧迫しないように調整
  - スクロールバートラックを透明に設定し、thumbに`border-radius: 5px`を適用して控えめな表示を実現
  - ホバー時とアクティブ時のスクロールバースタイルを実装
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

## 2. バージョン管理の更新

- [x] 2. (P) package.jsonのマイナーバージョンアップ
  - package.jsonのversionフィールドを`0.1.0`から`0.2.0`にバージョンアップ
  - 新機能追加を示すセマンティックバージョニングに従う
  - _Requirements: 5.1_

## 3. テストの更新と検証

- [x] 3.1 HTMLスナップショットテストの更新
  - `src/test/suite/webviewManager.test.ts`のHTMLスナップショットテストを実行
  - CSS変更を反映した新しいスナップショットを更新
  - `getHtmlContent()`メソッドの出力に期待通りのCSSスタイル（body、project-list-container、カスタムスクロールバー）が含まれることを確認
  - テストが成功することを確認

- [ ]* 3.2 視覚的検証とパフォーマンステスト
  - 複数のVSCodeテーマ（Light、Dark、High Contrast）でダッシュボードを表示し、スクロールバースタイルとテーマ変数の適用を確認
  - 小さいウィンドウ（縦幅400px程度）でプロジェクトリストのスクロールが正常に動作し、ASCIIアートが固定されることを確認
  - 大きいウィンドウ（縦幅1200px程度）でプロジェクトがビューポート内に収まる場合、スクロールバーが非表示になることを確認
  - ウィンドウリサイズ時にレイアウトの崩れやちらつきが発生しないことを確認
  - プロジェクトリストをスクロールしてもASCIIアートが画面上部に固定されたままであることを確認
  - ホバー時とアクティブ時のスクロールバー状態変化を確認
  - 100個以上のプロジェクトをロードし、Chrome DevTools（`Developer: Open Webview Developer Tools`）のPerformanceタブでスクロールのフレームレートが60fpsを維持することを確認
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_
