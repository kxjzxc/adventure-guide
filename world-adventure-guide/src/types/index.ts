// ============================================================
// 世界冒险指南 - 核心数据模型
// 内容是什么，与内容如何展示，是两个完全独立的问题。
// ============================================================

/** 世界类型：支持现实世界、历史世界、虚拟世界等扩展 */
export type WorldKind = 'real' | 'historical' | 'virtual';

/**
 * World 世界
 * 定义「正在探索的世界」。
 * MVP 仅实现：地球 × 当前时间（real × present）
 */
export interface World {
  id: string;
  name: string;
  kind: WorldKind;
  /** 时间锚点，如 "present" / "1920" / "2120" / "middle-earth" */
  timeAnchor: string;
  description: string;
}

/**
 * 地理位置坐标
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * 地点类型：国家 / 城市 / 地标 / 自然景观 / 建筑 等
 */
export type PlaceType = 'country' | 'city' | 'landmark' | 'nature' | 'building' | 'region';

/**
 * Space -> Place 地点
 * 描述世界中的一个具体空间节点。
 *
 * 语义约束（对应 #1 World 数据隔离）：
 *   Place 始终属于某个 World。"同一个地理地点"在不同 World/时代
 *   下是不同的 Place 实例（不同的 id），以便保存不同上下文的
 *   简介、内容、标签等。查询层统一通过 worldId 过滤。
 */
export interface Place {
  id: string;
  /** 所属 World */
  worldId: string;
  name: string;
  /** 本地名称（如东京 / Tokyo / 東京） */
  localName?: string;
  type: PlaceType;
  coords: Coordinates;
  /** 所属国家 / 地区 */
  country?: string;
  /** 简介 */
  summary: string;
  /** 覆盖此地点的不同时间视角（用于 Timeline 切换） */
  timePerspectives?: string[];
  /** 标签：如 "文化"、"美食"、"历史"、"自然" */
  tags: string[];
  /**
   * ⚠️ 注意：Place 与 Content 的关系使用单一事实源：
   *   ContentItem.placeId (+ worldId)  → 唯一 canonical 关系
   *   不再维护 Place.contentIds 反向列表，避免双写造成不一致。
   *   需要取"某地点的全部内容"时调用 getContentsByPlace(placeId) / getContentsByPlaceAndWorld。
   */
}

/**
 * Space -> Route 路线
 * 连接两个地点的路径，带可选的中间停靠点。
 *
 * 语义约束（对应 re-review #1 方向统一）：
 *   Place = graph node         图节点
 *   Route = graph UNDIRECTED edge  图无向边（可以从 fromPlaceId 到 toPlaceId，也可反向）
 *   Adventure.placeIds = 路径上按顺序的节点序列
 *   Adventure.routeIds = 相邻节点之间的边序列
 *
 *   fromPlaceId / toPlaceId 在此"无向边"模型里仅作为 Route 两端点的稳定标识符，
 *   不起方向约束作用。后续若需要单向路线（例如单行道、禁行方向）时，可把
 *   Route 拆成两条不同 id 的边，或新增 direction 字段。
 *
 * MVP 限制：buildAdventurePath 只能在预设链路上查找"连续子段"，
 * 但这不影响"Route 无向边"这一模型层的抽象。
 */
export interface Route {
  id: string;
  /** 所属 World（用于跨世界隔离查询） */
  worldId: string;
  /** 端点 A。在无向边模型里不代表方向约束。 */
  fromPlaceId: string;
  /** 端点 B。在无向边模型里不代表方向约束。 */
  toPlaceId: string;
  /** 折线坐标，用于地图绘制 */
  path: Coordinates[];
  /** 预计的探索距离感（不代表真实交通） */
  distanceLabel?: string;
  /** 沿途可发现的内容简介 */
  highlights: string[];
}

/**
 * Adventure 冒险
 * 用户在一个 World 中进行的一次探索过程
 *
 * 结构不变量（对应 #3 invariant）：
 *   routeIds.length === placeIds.length - 1
 *   routeIds[i] 是连接 placeIds[i] → placeIds[i+1] 的边
 *   currentStep ∈ [0, placeIds.length - 1]
 * 这些约束在 createAdventure / setCurrentStep 层统一保证。
 */
export interface Adventure {
  id: string;
  worldId: string;
  title: string;
  /** 冒险主题，如 "东南亚到古都" */
  theme?: string;
  /** 路线上按顺序排列的地点 ID */
  placeIds: string[];
  /** 相邻地点之间的路线 ID — 长度必须为 placeIds.length - 1 */
  routeIds: string[];
  /** 创建时间 */
  createdAt: number;
  /** 最近访问时间 */
  lastVisitedAt: number;
  /** 当前探索进度（在 placeIds 中的下标） */
  currentStep: number;
  /** 用户给此次冒险的封面描述 */
  coverNote?: string;
}

/**
 * 内容类型
 */
export type ContentKind =
  | 'article'    // 文章 / 介绍
  | 'history'    // 历史
  | 'geography'  // 地理
  | 'culture'    // 文化
  | 'food'       // 美食
  | 'people'     // 人物
  | 'architecture' // 建筑
  | 'image';     // 图集

/**
 * Content 内容
 * 内容独立存在，不依赖具体页面。
 * 相同内容可以在地图、冒险、时间线、搜索中复用。
 *
 * World 归属：Content 通过 placeId → Place.worldId 取得所属 World；
 * 对于"同一内容跨 World 复用"的场景，保持内容独立对象更合适。
 */
export interface ContentItem {
  id: string;
  kind: ContentKind;
  title: string;
  /** 内容主体（Markdown 纯文本） */
  body: string;
  /** 适用的时间视角，如 ["present"] / ["1920", "present"] */
  timeRelevance: string[];
  /** 关联的地点 ID */
  placeId: string;
  /** 所属 World（冗余存储，用于查询层直接按 worldId 过滤，避免 join Place） */
  worldId: string;
  /** 作者 / 来源 */
  source?: string;
  /** 图片 URL（当 kind=image 或其他内容带插图） */
  imageUrl?: string;
  /** 标签 */
  tags: string[];
  /** 阅读时间估算（分钟） */
  readingMinutes?: number;
}

/**
 * Record 记录
 * 用户在探索过程中留下的个人信息。
 * 记录属于用户，而不是页面。
 */
export type RecordKind =
  | 'note'       // 笔记
  | 'favorite'   // 收藏
  | 'wishlist'   // 想去的地方
  | 'thought';   // 个人理解/感悟

export interface UserRecord {
  id: string;
  kind: RecordKind;
  /** 关联的世界 */
  worldId: string;
  /** 关联的时间视角（可选） */
  timePerspective?: string;
  /** 关联的地点 */
  placeId?: string;
  /** 关联的内容 */
  contentId?: string;
  /** 关联的冒险 */
  adventureId?: string;
  /** 用户自由文本 */
  text: string;
  /** 0-5 星评分（可选） */
  rating?: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

// ============================================================
// 聚合视图（用于展示系统，不改变核心模型）
// ============================================================

export interface AdventureStep {
  index: number;
  place: Place;
  /** 进入此地点前的路线 */
  incomingRoute?: Route;
  /** 关联内容 */
  contents: ContentItem[];
  /** 用户个人记录 */
  records: UserRecord[];
}
