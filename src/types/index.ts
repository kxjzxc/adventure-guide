/**
 * Adventure Guide — Core Types & Plugin Interfaces
 *
 * 领域模型 + 插件契约。Builder 只与接口对话，不碰具体实现。
 */

// ─── 领域模型 ──────────────────────────────────────────────

export type WorldKind = 'real' | 'historical' | 'virtual';

/** World — 最高层级领域概念，由空间、时间、内容共同描述 */
export interface World {
  id: string;
  name: string;
  kind: WorldKind;
  /** 时间锚点：present / 1920 / middle-earth */
  timeAnchor: string;
  description: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export type PlaceType = 'country' | 'region' | 'city' | 'landmark' | 'nature' | 'building';

/** Place — 可被探索的具体空间节点 */
export interface Place {
  id: string;
  worldId: string;
  name: string;
  localName?: string;
  type: PlaceType;
  coords: Coordinates;
  country?: string;
  summary: string;
  tags: string[];
  /** 正文 Markdown 渲染后的 HTML */
  bodyHtml?: string;
  /** 原始 Markdown 正文 */
  bodyRaw?: string;
  /** 页面中引用的其它条目名（[[wikilink]]） */
  links?: string[];
  /** 反向引用：哪些条目链接到了这里 */
  backlinkIds?: string[];
}

/** Route — 两个 Place 之间的无向边 */
export interface Route {
  id: string;
  worldId: string;
  fromPlaceId: string;
  toPlaceId: string;
  /** 折线坐标，用于地图绘制（可空） */
  path?: Coordinates[];
  distanceLabel?: string;
  highlights: string[];
  bodyHtml?: string;
  bodyRaw?: string;
}

export type ContentKind =
  | 'article'
  | 'history'
  | 'geography'
  | 'culture'
  | 'food'
  | 'people'
  | 'architecture'
  | 'image';

/** Content — 独立的知识内容，可在多个页面复用 */
export interface ContentItem {
  id: string;
  kind: ContentKind;
  title: string;
  /** 正文 HTML */
  bodyHtml: string;
  /** 原始 Markdown */
  bodyRaw: string;
  /** 关联的地点 ID */
  placeId?: string;
  /** 所属 World */
  worldId: string;
  source?: string;
  imageUrl?: string;
  tags: string[];
  readingMinutes?: number;
  /** 页面中引用的其它条目名 */
  links: string[];
  /** 反向引用 */
  backlinkIds: string[];
}

/** Adventure — 一次探索过程，由有序 Place + Route 序列构成 */
export interface Adventure {
  id: string;
  worldId: string;
  title: string;
  theme?: string;
  /** 路线上按顺序的地点 ID */
  placeIds: string[];
  /** 相邻地点之间的路线 ID（长度 = placeIds.length - 1） */
  routeIds: string[];
  coverNote?: string;
  bodyHtml?: string;
  bodyRaw?: string;
}

// ─── 聚合视图（用于展示） ──────────────────────────────────

export interface AdventureStep {
  index: number;
  place: Place;
  incomingRoute?: Route;
  contents: ContentItem[];
}

// ─── 轻量索引（用于 index.json） ───────────────────────────

export interface WorldIndexEntry {
  id: string;
  name: string;
  kind: WorldKind;
  timeAnchor: string;
  placeCount: number;
  contentCount: number;
  adventureCount: number;
}

export interface PlaceIndexEntry {
  id: string;
  name: string;
  type: PlaceType;
  worldId: string;
  lat: number;
  lng: number;
  tags: string[];
  contentCount: number;
}

export interface ContentIndexEntry {
  id: string;
  title: string;
  kind: ContentKind;
  placeId?: string;
  worldId: string;
  tags: string[];
}

export interface AdventureIndexEntry {
  id: string;
  title: string;
  worldId: string;
  theme?: string;
  placeCount: number;
}

// ─── 插件接口 ──────────────────────────────────────────────

/** Parser — 读取 Obsidian Vault 并输出领域对象 */
export interface IParser {
  readonly name: string;
  parse(vaultPath: string): Promise<ParsedVault>;
}

/** 解析后的 Vault 内容 */
export interface ParsedVault {
  worlds: World[];
  places: Place[];
  routes: Route[];
  contents: ContentItem[];
  adventures: Adventure[];
}

/** Storage — 抽象文件系统，用于写输出 */
export interface IStorage {
  readonly name: string;
  save(filePath: string, content: Buffer | string): Promise<void>;
  read(filePath: string): Promise<Buffer>;
  exists(filePath: string): Promise<boolean>;
}

/** Renderer — 将领域对象渲染为静态网站 */
export interface IRenderer {
  readonly name: string;
  render(
    vault: ParsedVault,
    ctx: RenderContext,
  ): Promise<void>;
}

// ─── 配置 ──────────────────────────────────────────────────

export interface SiteConfig {
  title: string;
  subtitle: string;
  base: string;
}

export interface AGConfig {
  vaultPath: string;
  outputPath: string;
  storage: string;
  theme: string;
  site: SiteConfig;
}

export interface RenderContext {
  outputPath: string;
  storage: IStorage;
  config: AGConfig;
}

// ─── 插件注册表 ─────────────────────────────────────────────

export interface PluginRegistry {
  parsers: Map<string, () => IParser>;
  storages: Map<string, () => IStorage>;
  renderers: Map<string, () => IRenderer>;
}
