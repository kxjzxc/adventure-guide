/**
 * LocalStorage — 本地文件系统存储插件。
 *
 * 负责输出目录的完整生命周期：初始化、读写、清理、列举。
 * Builder / Renderer 通过本接口写输出，不直接操作底层 fs。
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IStorage } from '../types';

export class LocalStorage implements IStorage {
  readonly name = 'local';
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    // 确保输出目录存在
    fs.mkdirSync(this.basePath, { recursive: true });
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

  async clean(exclusions: string[] = []): Promise<void> {
    if (!fs.existsSync(this.basePath)) return;
    const keep = new Set(exclusions);
    for (const entry of fs.readdirSync(this.basePath)) {
      if (keep.has(entry)) continue;
      fs.rmSync(path.join(this.basePath, entry), { recursive: true, force: true });
    }
  }

  async list(): Promise<string[]> {
    if (!fs.existsSync(this.basePath)) return [];
    const results: string[] = [];
    const walk = (dir: string, prefix: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, rel);
        else results.push(rel);
      }
    };
    walk(this.basePath, '');
    return results.sort();
  }
}
