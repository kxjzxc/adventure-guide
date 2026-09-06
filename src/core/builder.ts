/**
 * Builder — 核心编排器。
 *
 * Pipeline:
 *   Parser → ParsedVault → buildRelations → Renderer → Static Site
 *
 * Builder 不直接碰 Vault 数据，只委托给插件并协调流程。
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  AGConfig,
  ParsedVault,
  IParser,
  IStorage,
  IRenderer,
  PluginRegistry,
  RenderContext,
  Place,
  ContentItem,
} from '../types';

export interface BuildOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

export interface BuildStats {
  worlds: number;
  places: number;
  routes: number;
  contents: number;
  adventures: number;
  backlinks: number;
  outputFiles: number;
}

export class Builder {
  private registry: PluginRegistry;
  private config: AGConfig;

  constructor(registry: PluginRegistry, config: AGConfig) {
    this.registry = registry;
    this.config = config;
  }

  async build(options: BuildOptions = {}): Promise<BuildStats> {
    const { dryRun, verbose } = options;
    const log = (msg: string) => {
      if (verbose || dryRun) console.log(msg);
    };

    // 1. 解析插件
    const parserFactory = this.registry.parsers.get('obsidian');
    const storageFactory = this.registry.storages.get(this.config.storage);
    const rendererFactory = this.registry.renderers.get(this.config.theme || 'default');

    if (!parserFactory || !storageFactory || !rendererFactory) {
      throw new Error('缺少必要插件，请检查 config 与 registry。');
    }

    const parser: IParser = parserFactory();
    const storage: IStorage = (storageFactory as (base?: string) => IStorage)(this.config.outputPath);
    const renderer: IRenderer = rendererFactory();

    // 2. 清理输出目录（保留 assets/ 用于增量图片处理）
    this.cleanOutput();

    // 3. 解析 Vault
    log('正在解析 Obsidian Vault...');
    const vault = await parser.parse(this.config.vaultPath);
    log(`  世界: ${vault.worlds.length}`);
    log(`  地点: ${vault.places.length}`);
    log(`  路线: ${vault.routes.length}`);
    log(`  内容: ${vault.contents.length}`);
    log(`  冒险: ${vault.adventures.length}`);

    if (dryRun) {
      console.log(`\n[Dry Run] 解析完成：`);
      console.log(`  • 世界: ${vault.worlds.length}`);
      console.log(`  • 地点: ${vault.places.length}`);
      console.log(`  • 路线: ${vault.routes.length}`);
      console.log(`  • 内容: ${vault.contents.length}`);
      console.log(`  • 冒险: ${vault.adventures.length}`);
      return {
        worlds: vault.worlds.length,
        places: vault.places.length,
        routes: vault.routes.length,
        contents: vault.contents.length,
        adventures: vault.adventures.length,
        backlinks: 0,
        outputFiles: 0,
      };
    }

    // 3b. 校验 Adventure 路径一致性 + 构建双向引用关系
    log('构建引用关系...');
    this.validateAdventures(vault);
    this.buildRelations(vault);
    const backlinks = vault.places.reduce((s, p) => s + (p.backlinkIds?.length || 0), 0)
      + vault.contents.reduce((s, c) => s + c.backlinkIds.length, 0);
    log(`  反向引用: ${backlinks}`);

    // 4. 渲染静态网站
    log('正在渲染静态网站...');
    const ctx: RenderContext = {
      outputPath: this.config.outputPath,
      storage,
      config: this.config,
    };
    await renderer.render(vault, ctx);

    // 5. 统计输出文件
    let outputFiles = 0;
    const countFiles = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) countFiles(full);
        else outputFiles++;
      }
    };
    countFiles(this.config.outputPath);

    log('\n构建完成。');
    log(`  输出: ${this.config.outputPath}`);

    return {
      worlds: vault.worlds.length,
      places: vault.places.length,
      routes: vault.routes.length,
      contents: vault.contents.length,
      adventures: vault.adventures.length,
      backlinks,
      outputFiles,
    };
  }

  /**
   * 校验 Adventure 不变量：
   *   routeIds.length === placeIds.length - 1
   *   routeIds[i] 连接 placeIds[i] ↔ placeIds[i+1]（无向边）
   */
  private validateAdventures(vault: ParsedVault): void {
    const placeMap = new Map(vault.places.map((p) => [p.id, p]));
    const routeMap = new Map(vault.routes.map((r) => [r.id, r]));

    for (const adv of vault.adventures) {
      if (adv.routeIds.length !== adv.placeIds.length - 1) {
        console.warn(`⚠ 冒险 "${adv.id}": routeIds 数量 (${adv.routeIds.length}) ≠ placeIds.length - 1 (${adv.placeIds.length - 1})`);
        continue;
      }
      for (let i = 0; i < adv.routeIds.length; i++) {
        const r = routeMap.get(adv.routeIds[i]);
        if (!r) {
          console.warn(`⚠ 冒险 "${adv.id}": routeIds[${i}] = ${adv.routeIds[i]} 不存在`);
          continue;
        }
        const a = adv.placeIds[i];
        const b = adv.placeIds[i + 1];
        // 无向边：两端点匹配即可
        const ends = new Set([r.fromPlaceId, r.toPlaceId]);
        if (!ends.has(a) || !ends.has(b)) {
          console.warn(`⚠ 冒险 "${adv.id}": route ${r.id} 不连接 ${a} ↔ ${b}`);
        }
      }
      // 校验 placeIds 都存在
      for (const pid of adv.placeIds) {
        if (!placeMap.has(pid)) {
          console.warn(`⚠ 冒险 "${adv.id}": placeId "${pid}" 不存在`);
        }
      }
    }
  }

  /**
   * 构建双向引用关系：
   * 1. [[wikilink]] 引用的条目名 → 目标条目收集反向引用
   * 2. Content.placeId → Place 收集关联内容
   *
   * wikilink 解析：按条目名（不区分大小写）匹配 id 或 name。
   */
  private buildRelations(vault: ParsedVault): void {
    // 建立名→id 映射（Place / Content）
    const nameToPlaceId = new Map<string, string>();
    for (const p of vault.places) {
      nameToPlaceId.set(p.name.toLowerCase(), p.id);
      if (p.localName) nameToPlaceId.set(p.localName.toLowerCase(), p.id);
    }
    const nameToContentId = new Map<string, string>();
    for (const c of vault.contents) {
      nameToContentId.set(c.title.toLowerCase(), c.id);
    }

    // 合并映射：任意条目名 → id（用于通用 wikilink 解析）
    const nameToId = new Map<string, { type: 'place' | 'content'; id: string }>();
    for (const [name, id] of nameToPlaceId) {
      nameToId.set(name, { type: 'place', id });
    }
    for (const [name, id] of nameToContentId) {
      // content 优先级低于 place（同名时 place 胜出）
      if (!nameToId.has(name)) nameToId.set(name, { type: 'content', id });
    }

    // Place.links / Content.links → 目标条目的 backlinkIds
    const addBacklink = (targetType: 'place' | 'content', targetId: string, sourceId: string) => {
      if (targetType === 'place') {
        const target = vault.places.find((p) => p.id === targetId);
        if (target && !target.backlinkIds!.includes(sourceId)) {
          target.backlinkIds!.push(sourceId);
        }
      } else {
        const target = vault.contents.find((c) => c.id === targetId);
        if (target && !target.backlinkIds.includes(sourceId)) {
          target.backlinkIds.push(sourceId);
        }
      }
    };

    for (const place of vault.places) {
      for (const linkName of place.links || []) {
        const target = nameToId.get(linkName.toLowerCase());
        if (target && target.id !== place.id) {
          addBacklink(target.type, target.id, place.id);
        }
      }
    }

    for (const content of vault.contents) {
      for (const linkName of content.links) {
        const target = nameToId.get(linkName.toLowerCase());
        if (target && target.id !== content.id) {
          addBacklink(target.type, target.id, content.id);
        }
      }
    }
  }

  /**
   * 清理输出目录，但保留 assets/ 子目录（用于增量图片处理）。
   */
  private cleanOutput(): void {
    const output = this.config.outputPath;
    if (!fs.existsSync(output)) return;

    for (const entry of fs.readdirSync(output)) {
      if (entry === 'assets') continue;
      const fullPath = path.join(output, entry);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }
}
