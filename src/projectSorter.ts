import { Project } from './types';

/**
 * プロジェクトリストをアルファベット順にソートする
 *
 * @param projects - ソート対象のプロジェクト配列
 * @returns ソート済みのプロジェクト配列（新しい配列を返す）
 */
export function sortProjectsAlphabetically(projects: Project[]): Project[] {
  // 空配列の場合はそのまま返す
  if (projects.length === 0) {
    return [];
  }

  // 新しい配列を作成してソート（元の配列を変更しない）
  return [...projects].sort((a, b) => {
    // プロジェクト名を大文字小文字を区別せずに比較
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();

    // localeCompare()でUnicode/日本語対応のソート
    const nameComparison = nameA.localeCompare(nameB);

    // 名前が同じ場合は、addedAt（追加日時）でソート
    if (nameComparison === 0) {
      return a.addedAt - b.addedAt;
    }

    return nameComparison;
  });
}
