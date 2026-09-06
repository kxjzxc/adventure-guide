/**
 * LocalStorage — 本地文件系统存储插件。
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IStorage } from '../types';

export class LocalStorage implements IStorage {
  readonly name = 'local';
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async save(filePath: string, content: Buffer | string): Promise<void> {
    const full = path.join(this.basePath, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }

  async read(filePath: string): Promise<Buffer> {
    const full = path.join(this.basePath, filePath);
    return fs.promises.readFile(full);
  }

  async exists(filePath: string): Promise<boolean> {
    const full = path.join(this.basePath, filePath);
    return fs.existsSync(full);
  }
}
