/**
 * Plugin Registry — 插件名 → 工厂函数的映射。
 * Builder 通过 config 中的名字查找实现。
 */

import type { PluginRegistry } from './types';
import { ObsidianParser } from './parsers/obsidian/parser';
import { LocalStorage } from './storage/local';
import { DefaultRenderer } from './renderers/default/renderer';

export function createDefaultRegistry(): PluginRegistry {
  return {
    parsers: new Map([['obsidian', () => new ObsidianParser()]]),
    storages: new Map([
      ['local', (basePath?: string) => new LocalStorage(basePath || './dist')] as any,
    ]),
    renderers: new Map([['default', () => new DefaultRenderer()]]),
  };
}

export { ObsidianParser, LocalStorage, DefaultRenderer };
