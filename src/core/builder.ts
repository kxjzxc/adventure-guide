/**
 * Builder — 核心编排器。
 *
 * Pipeline:
 *   Parser → ParsedVault → buildRelations → Renderer → Static Site
 *
 * Builder 不直接碰 Vault 数据，只委托给插件并协调流程。
 */

import type {
  AGConfig,
  ParsedVault,
  IParser,
  IStorage,
  IRenderer,
  PluginRegistry,
  RenderContext,
  WikilinkRef,
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

    // 2. 解析 Vault
    log('正在解析 Obsidian Vault...');
    const vault = await parser.parse(this.config.vaultPath);
    log(`  世界: ${vault.worlds.length}`);
    log(`  地点: ${vault.places.length}`);
    log(`  路线: ${vault.routes.length}`);
    log(`  内容: ${vault.contents.length}`);
    log(`  冒险: ${vault.adventures.length}`);

    // 3. 校验领域引用完整性（结构性错误 → build 失败）
    //    覆盖 Adventure 路径一致性 + Domain Reference Validation：
    //    World/Place/Route/Content 之间的引用存在性与 worldId 一致性
    this.validateAdventures(vault);
    this.validateReferences(vault);

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

    // 4. 清理输出目录（保留 assets/ 用于增量图片处理）— 由 Storage 负责
    await storage.clean(['assets']);

    // 5. 构建双向引用关系（wikilink 无法解析 → warning，不阻断构建）
    log('构建引用关系...');
    this.buildRelations(vault);
    const backlinks = vault.places.reduce((s, p) => s + (p.backlinkIds?.length || 0), 0)
      + vault.contents.reduce((s, c) => s + c.backlinkIds.length, 0);
    log(`  反向引用: ${backlinks}`);

    // 6. 渲染静态网站
    log('正在渲染静态网站...');
    const ctx: RenderContext = {
      outputPath: this.config.outputPath,
      storage,
      config: this.config,
    };
    await renderer.render(vault, ctx);

    // 7. 统计输出文件 — 由 Storage 负责列举
    const files = await storage.list();
    const outputFiles = files.length;

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
   *
   * 分级处理：
   *   - error（Place/Route 不存在、数量不匹配、Route 无法连接相邻 Place）→ 抛异常终止构建
   *   - warning 仍由 buildRelations 处理（如未解析的 wikilink）
   */
  private validateAdventures(vault: ParsedVault): void {
    const placeMap = new Map(vault.places.map((p) => [p.id, p]));
    const routeMap = new Map(vault.routes.map((r) => [r.id, r]));
    const errors: string[] = [];

    for (const adv of vault.adventures) {
      // 1. placeIds 存在性 + World 一致性
      for (const pid of adv.placeIds) {
        const p = placeMap.get(pid);
        if (!p) {
          errors.push(`冒险 "${adv.id}": placeId "${pid}" 不存在`);
        } else if (p.worldId !== adv.worldId) {
          errors.push(`冒险 "${adv.id}" 属于 world "${adv.worldId}"，但 place "${pid}" 属于 world "${p.worldId}"`);
        }
      }
      // routeIds 存在性 + World 一致性
      for (const rid of adv.routeIds) {
        const r = routeMap.get(rid);
        if (!r) {
          errors.push(`冒险 "${adv.id}": routeId "${rid}" 不存在`);
        } else if (r.worldId !== adv.worldId) {
          errors.push(`冒险 "${adv.id}" 属于 world "${adv.worldId}"，但 route "${rid}" 属于 world "${r.worldId}"`);
        }
      }

      // 2. routeIds 数量 = placeIds.length - 1
      if (adv.routeIds.length !== adv.placeIds.length - 1) {
        errors.push(
          `冒险 "${adv.id}": routeIds 数量 (${adv.routeIds.length}) ≠ placeIds.length - 1 (${adv.placeIds.length - 1})`,
        );
        // 数量不匹配时无法逐段校验连接关系
        continue;
      }

      // 3. 每段 route 连接相邻 place（无向边）
      for (let i = 0; i < adv.routeIds.length; i++) {
        const r = routeMap.get(adv.routeIds[i]);
        if (!r) continue; // 已记为 error
        const a = adv.placeIds[i];
        const b = adv.placeIds[i + 1];
        const ends = new Set([r.fromPlaceId, r.toPlaceId]);
        if (!ends.has(a) || !ends.has(b)) {
          errors.push(
            `冒险 "${adv.id}": route "${r.id}" 不连接 ${a} ↔ ${b}（实际连接 ${r.fromPlaceId} ↔ ${r.toPlaceId}）`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Adventure 结构校验失败（${errors.length} 项 error）:\n${errors.map((e) => `  • ${e}`).join('\n')}`,
      );
    }
  }

  /**
   * Domain Reference Validation — 统一校验领域对象之间的引用完整性。
   *
   * 覆盖三类引用（不依赖是否被 Adventure 引用）：
   *   1. Object → World：所有对象的 worldId 必须指向已存在的 World
   *   2. Route → Place：fromPlaceId / toPlaceId 必须存在，且 worldId 与 Route 一致
   *   3. Content → Place：placeId 若存在则 Place 必须存在，且 worldId 与 Content 一致
   *
   * 另外强化「ID 在 Vault 内全局唯一」规则：
   *   - Place 之间、Content 之间不允许重复 ID
   *   - Place 与 Content 不允许跨类型同 ID（避免 backlink 渲染按类型猜时歧义）
   *
   * 全部为 error：存在性问题或一致性违反即终止 build，避免生成孤立对象或跨 World 串内容。
   */
  private validateReferences(vault: ParsedVault): void {
    const worldIds = new Set(vault.worlds.map((w) => w.id));
    const placeMap = new Map(vault.places.map((p) => [p.id, p]));
    const errors: string[] = [];

    // 1. Object → World 完整性
    const checkWorld = (kind: string, id: string, worldId: string) => {
      if (!worldIds.has(worldId)) {
        errors.push(`${kind} "${id}" 引用了不存在的 world "${worldId}"`);
      }
    };
    for (const p of vault.places) checkWorld('Place', p.id, p.worldId);
    for (const r of vault.routes) checkWorld('Route', r.id, r.worldId);
    for (const c of vault.contents) checkWorld('Content', c.id, c.worldId);
    for (const a of vault.adventures) checkWorld('Adventure', a.id, a.worldId);

    // 2. Route → Place 端点（存在性 + World 一致性）
    for (const r of vault.routes) {
      const from = placeMap.get(r.fromPlaceId);
      if (!from) {
        errors.push(`Route "${r.id}": fromPlaceId "${r.fromPlaceId}" 不存在`);
      } else if (from.worldId !== r.worldId) {
        errors.push(`Route "${r.id}" 属于 world "${r.worldId}"，但 from Place "${r.fromPlaceId}" 属于 world "${from.worldId}"`);
      }
      const to = placeMap.get(r.toPlaceId);
      if (!to) {
        errors.push(`Route "${r.id}": toPlaceId "${r.toPlaceId}" 不存在`);
      } else if (to.worldId !== r.worldId) {
        errors.push(`Route "${r.id}" 属于 world "${r.worldId}"，但 to Place "${r.toPlaceId}" 属于 world "${to.worldId}"`);
      }
    }

    // 3. Content → Place（存在性 + World 一致性）
    for (const c of vault.contents) {
      if (!c.placeId) continue;
      const place = placeMap.get(c.placeId);
      if (!place) {
        errors.push(`Content "${c.id}": 关联的 place "${c.placeId}" 不存在`);
      } else if (place.worldId !== c.worldId) {
        errors.push(`Content "${c.id}" 属于 world "${c.worldId}"，但 place "${c.placeId}" 属于 world "${place.worldId}"`);
      }
    }

    // 4. ID 全局唯一 + 安全 slug（覆盖所有 Domain Object：World/Place/Route/Content/Adventure）
    //    - 跨类型同 ID 会导致 Map 覆盖、backlink 渲染按类型猜时歧义、输出路径冲突
    //    - ID 含 / \ .. 或绝对路径会穿出 output directory，破坏站点结构
    const seenIds = new Map<string, string>();
    type DomainKind = 'World' | 'Place' | 'Route' | 'Content' | 'Adventure';
    const unsafeIdPattern = /[\/\\]|^\.\.?$|\.\.[\/\\]/;

    const recordId = (kind: DomainKind, id: string) => {
      if (!id || unsafeIdPattern.test(id)) {
        errors.push(`${kind} ID "${id}" 不安全：不允许为空或包含 / \\ ..`);
        return;
      }
      const prev = seenIds.get(id);
      if (prev) {
        errors.push(`ID "${id}" 同时存在于 ${prev} 与 ${kind}（ID 必须全局唯一）`);
      } else {
        seenIds.set(id, kind);
      }
    };

    for (const w of vault.worlds) recordId('World', w.id);
    for (const p of vault.places) recordId('Place', p.id);
    for (const r of vault.routes) recordId('Route', r.id);
    for (const c of vault.contents) recordId('Content', c.id);
    for (const a of vault.adventures) recordId('Adventure', a.id);

    if (errors.length > 0) {
      throw new Error(
        `领域引用校验失败（${errors.length} 项 error）:\n${errors.map((e) => `  • ${e}`).join('\n')}`,
      );
    }
  }

  /**
   * 构建双向引用关系：
   *   [[wikilink]] 引用 → 目标条目收集反向引用 backlinkIds
   *
   * wikilink 解析（World-scoped，ID 在 Vault 内全局唯一）：
   *   1. 带路径前缀（[[places/Tokyo]] / [[content/Tokyo]]）→ 仅在对应类型中查找
   *   2. 无前缀（[[Tokyo]]）→ place 优先于 content
   *   3. 优先在 source 对象所属 worldId 内查找；找不到再跨 World 回退
   *      （同名对象时，同 World 命中视为正确引用；跨 World 命中仅作 fallback）
   *
   * 未解析的 wikilink 输出 warning，不阻断构建。
   */
  private buildRelations(vault: ParsedVault): void {
    // worldId → (name → id) 的分桶
    const placeByWorld = new Map<string, Map<string, string>>();
    const contentByWorld = new Map<string, Map<string, string>>();
    // 跨 World fallback：name → id（ID 全局唯一，跨 World 同名对象 id 不同）
    const placeAny = new Map<string, string>();
    const contentAny = new Map<string, string>();

    const upsert = (
      byWorld: Map<string, Map<string, string>>,
      any: Map<string, string>,
      worldId: string,
      key: string,
      id: string,
    ) => {
      let inner = byWorld.get(worldId);
      if (!inner) { inner = new Map(); byWorld.set(worldId, inner); }
      if (!inner.has(key)) inner.set(key, id);
      if (!any.has(key)) any.set(key, id);
    };

    for (const p of vault.places) {
      upsert(placeByWorld, placeAny, p.worldId, p.name.toLowerCase(), p.id);
      if (p.localName) upsert(placeByWorld, placeAny, p.worldId, p.localName.toLowerCase(), p.id);
    }
    for (const c of vault.contents) {
      upsert(contentByWorld, contentAny, c.worldId, c.title.toLowerCase(), c.id);
    }

    type Target = { type: 'place' | 'content'; id: string };
    const lookup = (
      byWorld: Map<string, Map<string, string>>,
      any: Map<string, string>,
      worldId: string,
      key: string,
      type: 'place' | 'content',
    ): Target | undefined => {
      const id = byWorld.get(worldId)?.get(key) ?? any.get(key);
      return id ? { type, id } : undefined;
    };

    const resolveRef = (ref: WikilinkRef, sourceWorldId: string): Target | undefined => {
      const key = ref.name.toLowerCase();
      if (ref.path === 'places') {
        return lookup(placeByWorld, placeAny, sourceWorldId, key, 'place');
      }
      if (ref.path === 'content') {
        return lookup(contentByWorld, contentAny, sourceWorldId, key, 'content');
      }
      return lookup(placeByWorld, placeAny, sourceWorldId, key, 'place')
        ?? lookup(contentByWorld, contentAny, sourceWorldId, key, 'content');
    };

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

    const unresolved: string[] = [];
    const trackRef = (sourceId: string, sourceWorldId: string, ref: WikilinkRef) => {
      const target = resolveRef(ref, sourceWorldId);
      if (target) {
        if (target.id !== sourceId) addBacklink(target.type, target.id, sourceId);
      } else {
        const display = ref.path ? `${ref.path}/${ref.name}` : ref.name;
        unresolved.push(`${sourceId} → [[${display}]]`);
      }
    };

    for (const world of vault.worlds) {
      // World 自身即 worldId 边界；其 wikilink 在自身 scope 解析
      for (const ref of world.links || []) trackRef(world.id, world.id, ref);
    }
    for (const place of vault.places) {
      for (const ref of place.links || []) trackRef(place.id, place.worldId, ref);
    }
    for (const content of vault.contents) {
      for (const ref of content.links) trackRef(content.id, content.worldId, ref);
    }

    for (const u of unresolved) {
      console.warn(`⚠ 未解析的 wikilink: ${u}`);
    }
  }
}
