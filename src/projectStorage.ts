import { Project, ProjectInput } from './types';

/**
 * globalStateのインターフェース（テスト用に抽象化）
 */
export interface GlobalStateInterface {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}

/**
 * プロジェクトストレージのキー
 */
const STORAGE_KEY = 'startBoard.projects';

/**
 * UUID v4を生成する
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * プロジェクトリストの永続化と操作を担当するクラス
 *
 * 責務:
 * - globalStateへのプロジェクトリスト保存/読み込み
 * - プロジェクトの追加、削除、一覧取得
 * - 重複チェック（パスベース）
 * - データの整合性保証
 */
export class ProjectStorage {
  private globalState: GlobalStateInterface;

  constructor(globalState: GlobalStateInterface) {
    this.globalState = globalState;
  }

  /**
   * 全てのプロジェクトを取得する
   * @returns プロジェクト配列
   */
  getProjects(): Project[] {
    const projects = this.globalState.get<Project[]>(STORAGE_KEY);
    if (!projects) {
      return [];
    }
    // データ整合性チェック
    if (!Array.isArray(projects)) {
      return [];
    }
    return projects;
  }

  /**
   * プロジェクトを追加する
   * @param input プロジェクト入力データ（id, addedAtを除く）
   * @returns 追加されたプロジェクト、重複の場合はnull
   */
  addProject(input: ProjectInput): Project | null {
    // 重複チェック
    if (this.hasProject(input.path)) {
      return null;
    }

    const project: Project = {
      id: generateUUID(),
      name: input.name,
      path: input.path,
      type: input.type,
      addedAt: Date.now()
    };

    const projects = this.getProjects();
    projects.push(project);
    this.globalState.update(STORAGE_KEY, projects);

    return project;
  }

  /**
   * プロジェクトを削除する
   * @param id 削除するプロジェクトのID
   * @returns 削除成功時はtrue、見つからない場合はfalse
   */
  removeProject(id: string): boolean {
    const projects = this.getProjects();
    const index = projects.findIndex((p) => p.id === id);

    if (index === -1) {
      return false;
    }

    projects.splice(index, 1);
    this.globalState.update(STORAGE_KEY, projects);

    return true;
  }

  /**
   * 指定パスのプロジェクトが既に存在するかチェックする
   * @param path チェックするパス
   * @returns 存在する場合はtrue
   */
  hasProject(path: string): boolean {
    const projects = this.getProjects();
    return projects.some((p) => p.path === path);
  }
}
