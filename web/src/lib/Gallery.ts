export interface DirectoryPickerResult {
  treeUri: string;
  displayName: string;
  persisted: boolean;
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  uri: string;
  mimeType: string;
  size: string;
  dateAdded?: string;
  dateModified?: string;
}

export interface GalleryPluginInterface {
  checkPermission(): Promise<{ granted: boolean; showRationale?: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  pickDirectory(): Promise<DirectoryPickerResult>;
  listFiles(options: { treeUri: string; recursive?: boolean; maxDepth?: number; mimeTypes?: string[] }): Promise<{ files: Record<string, FileItem>; count: number }>;
  persistDirectory(treeUri: string): Promise<{ persisted: boolean }>;
  getPersistedDirectories(): Promise<{ directories: Record<string, string>; count: number }>;
}

import { registerPlugin } from '@capacitor/core';

const Gallery = registerPlugin<GalleryPluginInterface>('Gallery', {
  web: () => import('./GalleryWeb').then(m => new m.GalleryWeb()),
});

export { Gallery };
