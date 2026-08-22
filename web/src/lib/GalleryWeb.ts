export class GalleryWeb {
  async checkPermission(): Promise<{ granted: boolean; showRationale?: boolean }> {
    return { granted: false, showRationale: false };
  }

  async requestPermission(): Promise<{ granted: boolean }> {
    return { granted: false };
  }

  async pickDirectory(): Promise<{ treeUri: string; displayName: string; persisted: boolean }> {
    return { treeUri: '', displayName: '', persisted: false };
  }

  async listFiles(_options: { treeUri: string; recursive?: boolean; maxDepth?: number; mimeTypes?: string[] }): Promise<{ files: Record<string, any>; count: number }> {
    return { files: {}, count: 0 };
  }

  async persistDirectory(_treeUri: string): Promise<{ persisted: boolean }> {
    return { persisted: false };
  }

  async getPersistedDirectories(): Promise<{ directories: Record<string, string>; count: number }> {
    return { directories: {}, count: 0 };
  }
}
