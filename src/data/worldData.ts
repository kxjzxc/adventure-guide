import type { World, Place, Route, ContentItem } from '../types';

/**
 * MVP 数据 —— 现实世界 × 当前时间
 * 设计一条经典的东南亚 → 中国西南 → 古都之路，用于验证核心体验
 */

// ============================================================
// World 世界
// ============================================================
export const WORLDS: World[] = [
  {
    id: 'earth-present',
    name: '地球 · 现在',
    kind: 'real',
    timeAnchor: 'present',
    description: '我们所处的真实世界，2026 年。',
  },
  {
    id: 'earth-1920',
    name: '地球 · 1920 年代',
    kind: 'historical',
    timeAnchor: '1920',
    description: '一战结束后的黄金二十年。（扩展）',
  },
];

// ============================================================
// Place 地点 — 所有 Place 均显式绑定到 worldId = 'earth-present'
// 后续扩展 earth-1920 时，为每个地理地点创建独立的 Place 对象，
// 并使用不同的 id（如 'singapore-1920'）保持数据隔离。
// ============================================================
const _WORLD_PRESENT = 'earth-present';

export const PLACES: Place[] = [
  {
    id: 'singapore',
    worldId: _WORLD_PRESENT,
    name: '新加坡',
    localName: 'Singapore / 新加坡',
    type: 'city',
    coords: { lat: 1.3521, lng: 103.8198 },
    country: '新加坡',
    summary:
      '一座位于马来半岛南端的城市国家，以多元文化、整洁与高效率闻名。这里是东西方文化交汇的港口，也是探索东南亚的完美起点。',
    tags: ['城市', '多元文化', '港口', '美食'],
  },
  {
    id: 'bangkok',
    worldId: _WORLD_PRESENT,
    name: '曼谷',
    localName: 'กรุงเทพฯ / Krung Thep',
    type: 'city',
    coords: { lat: 13.7563, lng: 100.5018 },
    country: '泰国',
    summary:
      '泰国的首都与最大城市，被称为「天使之城」。古老的寺庙与现代商场并存，运河与高架轨道交织，永远充满喧嚣与活力。',
    tags: ['佛教', '夜市', '文化', '美食'],
  },
  {
    id: 'hanoi',
    worldId: _WORLD_PRESENT,
    name: '河内',
    localName: 'Hà Nội',
    type: 'city',
    coords: { lat: 21.0285, lng: 105.8542 },
    country: '越南',
    summary:
      '越南北部的千年古都，还剑湖、老街区、法式建筑和越南咖啡共同构成了这里独特的气质：温柔而坚韧，怀旧又充满生机。',
    tags: ['古都', '法式', '咖啡', '文化'],
  },
  {
    id: 'kunming',
    worldId: _WORLD_PRESENT,
    name: '昆明',
    localName: '昆明 / ᏀᏅᏢᏒ',
    type: 'city',
    coords: { lat: 25.0389, lng: 102.7183 },
    country: '中国',
    summary:
      '位于云贵高原的「春城」，常年花开不败。这里是中国通往东南亚的门户，也是多民族文化、多样地貌与野生菌美食的故乡。',
    tags: ['高原', '春城', '多民族', '自然'],
  },
  {
    id: 'chengdu',
    worldId: _WORLD_PRESENT,
    name: '成都',
    localName: '成都',
    type: 'city',
    coords: { lat: 30.5728, lng: 104.0668 },
    country: '中国',
    summary:
      '天府之国的省会，一座以「慢生活」闻名的城市。茶馆、火锅、大熊猫、诗圣草堂……在这里你会明白什么叫「巴适」。',
    tags: ['美食', '茶馆', '熊猫', '历史'],
  },
  {
    id: 'xian',
    worldId: _WORLD_PRESENT,
    name: '西安',
    localName: '西安',
    type: 'city',
    coords: { lat: 34.3416, lng: 108.9398 },
    country: '中国',
    summary:
      '十三朝古都，丝绸之路的东方起点。兵马俑、古城墙、钟鼓楼与回民街——这里保存着中国最厚重的一段历史记忆。',
    tags: ['古都', '兵马俑', '丝绸之路', '历史'],
  },
  {
    id: 'beijing',
    worldId: _WORLD_PRESENT,
    name: '北京',
    localName: '北京',
    type: 'city',
    coords: { lat: 39.9042, lng: 116.4074 },
    country: '中国',
    summary:
      '中华人民共和国的首都，一座拥有三千多年历史的文化名城。紫禁城、长城、胡同、798——古老与现代在这里激烈对话。',
    tags: ['首都', '故宫', '长城', '文化'],
  },
];

// ============================================================
// Route 路线
// 连接两个地点的路径。Route 是 graph 的有向边；
// Place 是 graph 的节点。Adventure = 节点序列 + 边序列。
//
// MVP 限制：buildAdventurePath 仅支持在预设链路（SG→BK→HN→KM→CD→XA→BJ）
// 上查找连续子段。这是实现限制，不是模型限制——
// 模型允许任意 Place + Route 图，可在后续版本扩展。
// ============================================================
function makeRoute(
  id: string,
  worldId: string,
  from: Place,
  to: Place,
  highlights: string[],
  midOffset = 0.15
): Route {
  const midLat = (from.coords.lat + to.coords.lat) / 2 + (to.coords.lng - from.coords.lng) * midOffset;
  const midLng = (from.coords.lng + to.coords.lng) / 2 - (to.coords.lat - from.coords.lat) * midOffset;
  return {
    id,
    worldId,
    fromPlaceId: from.id,
    toPlaceId: to.id,
    path: [from.coords, { lat: midLat, lng: midLng }, to.coords],
    highlights,
  };
}

const [S, B, H, K, C, X, BJ] = PLACES;

export const ROUTES: Route[] = [
  makeRoute('r-sg-bk', _WORLD_PRESENT, S, B, [
    '穿越暹罗湾，感受海洋与陆地的交替',
    '途经马来半岛的丛林与橡胶园',
    '从花园都市过渡到寺庙之城',
  ]),
  makeRoute('r-bk-hn', _WORLD_PRESENT, B, H, [
    '沿湄公河逆流而上，进入东南亚腹地',
    '经过泰东北依善地区的田园',
    '从佛教之国进入越南的红色大地',
  ]),
  makeRoute('r-hn-km', _WORLD_PRESENT, H, K, [
    '翻越黄连山脉，告别红河三角洲',
    '穿过老街口岸，进入云贵高原',
    '海拔逐渐升高，天气越来越凉爽',
  ]),
  makeRoute('r-km-cd', _WORLD_PRESENT, K, C, [
    '横断山脉的壮丽山河：金沙江、大渡河',
    '从热带过渡到亚热带内陆盆地',
    '途经乐山大佛与峨眉山麓',
  ]),
  makeRoute('r-cd-xa', _WORLD_PRESENT, C, X, [
    '翻越秦岭，地理上的南北分界',
    '从巴蜀天府进入八百里秦川',
    '剑门蜀道、嘉陵江、汉中平原',
  ]),
  makeRoute('r-xa-bj', _WORLD_PRESENT, X, BJ, [
    '沿汾渭平原北上，穿过黄河',
    '途经平遥、太原，触摸晋商的故园',
    '太行山脉之后，便是燕山脚下的北京',
  ]),
];

// ============================================================
// Content 内容
// ============================================================
export const CONTENTS: ContentItem[] = [
  // —— 新加坡 ——
  {
    id: 'sg-intro',
    kind: 'article',
    title: '花园城市的由来',
    body:
      '1965 年新加坡独立时，李光耀提出了「花园城市」的构想。五十年后，这里从一个拥挤的贸易港变成了人均绿地面积居世界前列的城市：滨海湾花园的超级树、垂直绿化的组屋、以及贯穿全岛的公园连道，让每一步都能遇见植物。',
    timeRelevance: ['present'],
    placeId: 'singapore',
    worldId: 'earth-present',
    source: '世界冒险指南',
    tags: ['城市规划', '现代'],
    readingMinutes: 3,
  },
  {
    id: 'sg-history',
    kind: 'history',
    title: '从小渔村到全球枢纽',
    body:
      '1819 年，莱佛士登陆新加坡，将其建为自由港。此后的两个世纪里，它历经英国殖民、日占、加入马来西亚再独立的曲折历程。今天的新加坡，是一个华人、马来人、印度人和欧亚裔共同生活的多元社会。',
    timeRelevance: ['present', '1920'],
    placeId: 'singapore',
    worldId: 'earth-present',
    tags: ['历史', '殖民史'],
    readingMinutes: 5,
  },
  {
    id: 'sg-food',
    kind: 'food',
    title: '小贩中心：新加坡的味觉联合国',
    body:
      '海南鸡饭、叻沙、辣椒螃蟹、肉骨茶、印度罗渣……小贩中心的每一个档口都代表一个族群的记忆。2020 年，新加坡小贩文化被列入人类非物质文化遗产。',
    timeRelevance: ['present'],
    placeId: 'singapore',
    worldId: 'earth-present',
    tags: ['美食', '文化'],
    readingMinutes: 3,
  },
  {
    id: 'sg-architecture',
    kind: 'architecture',
    title: '未来主义的天际线',
    body:
      '滨海湾金沙、艺术科学博物馆、DUO 双景坊——新加坡的城市天际线就像一部当代建筑博物馆。政府通过建筑竞赛和绿色认证，鼓励建筑师在热带气候下创造既高效又诗意的空间。',
    timeRelevance: ['present'],
    placeId: 'singapore',
    worldId: 'earth-present',
    tags: ['建筑', '现代'],
    readingMinutes: 4,
  },

  // —— 曼谷 ——
  {
    id: 'bk-intro',
    kind: 'article',
    title: '天使之城的 24 小时',
    body:
      '清晨 5 点，寺庙的法鼓声响起；早餐摊的泰式奶茶冒着热气；正午的商场冷气逼人；黄昏的昭披耶河上，长尾船划开金色的水波；午夜的考山路，街头艺人还在弹吉他。曼谷从不睡觉。',
    timeRelevance: ['present'],
    placeId: 'bangkok',
    worldId: 'earth-present',
    tags: ['城市', '日常'],
    readingMinutes: 3,
  },
  {
    id: 'bk-temple',
    kind: 'culture',
    title: '大皇宫与玉佛寺：拉达那哥欣的心脏',
    body:
      '建于 1782 年的大皇宫，是曼谷却克里王朝的正式居所。金瓦红墙之间，供奉着被视为泰国国宝玉佛的 Phra Kaew。当你脱下鞋子，踏入玉佛寺的回廊，壁画《罗摩衍那》正无声地讲述着印度史诗的故事。',
    timeRelevance: ['present'],
    placeId: 'bangkok',
    worldId: 'earth-present',
    tags: ['佛教', '建筑', '文化遗产'],
    readingMinutes: 5,
  },
  {
    id: 'bk-food',
    kind: 'food',
    title: '街头就是最好的厨房',
    body:
      '冬阴功、青木瓜沙拉、泰式炒河粉、芒果糯米饭——曼谷的街头美食有着教科书级别的平衡：酸、辣、咸、甜、香。Jay Fai 的蟹肉煎蛋、Raan Jay Fai 获得米其林二星，证明街头也能封神。',
    timeRelevance: ['present'],
    placeId: 'bangkok',
    worldId: 'earth-present',
    tags: ['美食', '街头'],
    readingMinutes: 4,
  },

  // —— 河内 ——
  {
    id: 'hn-intro',
    kind: 'article',
    title: '被时间慢慢拥抱的河内',
    body:
      '还剑湖畔的早晨，老人们在打太极；三十六行街的正午，摩托车汇成河；晚上的小酒馆里，现场乐队唱着 Trịnh Công Sơn 的歌。河内的节奏不赶，适合慢慢走、慢慢喝、慢慢看。',
    timeRelevance: ['present'],
    placeId: 'hanoi',
    worldId: 'earth-present',
    tags: ['城市', '生活'],
    readingMinutes: 3,
  },
  {
    id: 'hn-history',
    kind: 'history',
    title: '一千年的升龙',
    body:
      '1010 年，李太祖下诏迁都，将此地命名为「升龙」。此后历代王朝在此留下痕迹：文庙的国子监、独柱寺的一枝独秀、以及法国殖民时期的歌剧院与总督府。它们共同构成了河内的历史层次。',
    timeRelevance: ['present', '1920'],
    placeId: 'hanoi',
    worldId: 'earth-present',
    tags: ['历史', '王朝'],
    readingMinutes: 6,
  },
  {
    id: 'hn-coffee',
    kind: 'culture',
    title: '越南咖啡：一杯缓慢的革命',
    body:
      '法属时期引入的罗布斯塔豆，在越南被赋予了自己的表达：滴滴壶、炼乳、冰、椰子、鸡蛋……鸡蛋咖啡（Cà Phê Trứng）是河内的特产，口感像融化的提拉米苏。',
    timeRelevance: ['present'],
    placeId: 'hanoi',
    worldId: 'earth-present',
    tags: ['咖啡', '文化'],
    readingMinutes: 3,
  },

  // —— 昆明 ——
  {
    id: 'km-intro',
    kind: 'article',
    title: '春城：为什么四季都是花',
    body:
      '北纬 25°、海拔 1900 米，让昆明拥有了「冬无严寒、夏无酷暑」的气候。翠湖的红嘴鸥、圆通山的樱花、斗南花市的夜晚拍卖——花朵以各种方式进入这座城市的日常。',
    timeRelevance: ['present'],
    placeId: 'kunming',
    worldId: 'earth-present',
    tags: ['气候', '花卉'],
    readingMinutes: 3,
  },
  {
    id: 'km-nature',
    kind: 'geography',
    title: '从滇池到三江并流',
    body:
      '昆明坝子卧在滇池北岸，而往西两小时车程，就是横断山脉的纵深：怒江、澜沧江、金沙江三条大江在崇山峻岭中并肩南下，形成举世无双的三江并流奇观。',
    timeRelevance: ['present'],
    placeId: 'kunming',
    worldId: 'earth-present',
    tags: ['地理', '自然'],
    readingMinutes: 5,
  },
  {
    id: 'km-culture',
    kind: 'culture',
    title: '二十六种民族的厨房',
    body:
      '云南有 26 个世居民族。昆明作为省会，成了他们的味道汇集地：傣味的酸、彝家的辣、白族的乳扇、纳西的火锅、以及随处可见的过桥米线和汽锅鸡。',
    timeRelevance: ['present'],
    placeId: 'kunming',
    worldId: 'earth-present',
    tags: ['民族', '美食'],
    readingMinutes: 4,
  },

  // —— 成都 ——
  {
    id: 'cd-intro',
    kind: 'article',
    title: '成都：一座来了就走不脱的城市',
    body:
      '这句话是成都人的自我调侃，也是最真实的城市宣传。杜甫写下「窗含西岭千秋雪，门泊东吴万里船」的那一刻，成都的闲适基因就已经定型。',
    timeRelevance: ['present'],
    placeId: 'chengdu',
    worldId: 'earth-present',
    tags: ['城市', '闲适'],
    readingMinutes: 3,
  },
  {
    id: 'cd-food',
    kind: 'food',
    title: '不止辣：川菜的二十四味',
    body:
      '很多人以为川菜就是辣，但真正的川菜讲究「一菜一格，百菜百味」。鱼香、家常、怪味、椒麻、蒜泥、陈皮……麻辣只是其中一种，在宫保鸡丁和麻婆豆腐里，甜酸咸鲜各司其职。',
    timeRelevance: ['present'],
    placeId: 'chengdu',
    worldId: 'earth-present',
    tags: ['美食', '川菜'],
    readingMinutes: 4,
  },
  {
    id: 'cd-panda',
    kind: 'culture',
    title: '大熊猫：从野外到城市',
    body:
      '大熊猫的自然栖息地在川西的岷山和邛崃山脉。成都通过繁育研究基地，让它们也走进了城市。清晨 7:30 到 9:30 是它们最活跃的进食时间，其他时间基本都在补觉。',
    timeRelevance: ['present'],
    placeId: 'chengdu',
    worldId: 'earth-present',
    tags: ['动物', '自然'],
    readingMinutes: 3,
  },

  // —— 西安 ——
  {
    id: 'xa-intro',
    kind: 'article',
    title: '一座被城墙围起来的古都',
    body:
      '西安明城墙是中国现存规模最大、保存最完整的古代城垣。周长 13.74 公里，步行绕城一圈大约需要四小时。在城墙上骑自行车，是认识这座城市最好的方式。',
    timeRelevance: ['present'],
    placeId: 'xian',
    worldId: 'earth-present',
    tags: ['城墙', '古都'],
    readingMinutes: 3,
  },
  {
    id: 'xa-terracotta',
    kind: 'history',
    title: '兵马俑：两千年前的地下军团',
    body:
      '1974 年，临潼的农民在打井时意外发现了陶俑碎片。随后几十年的考古发掘，让秦始皇陵的地下军团重见天日：八千余件兵俑、百余辆战车，面部表情无一雷同。',
    timeRelevance: ['present'],
    placeId: 'xian',
    worldId: 'earth-present',
    tags: ['考古', '秦代'],
    readingMinutes: 6,
  },
  {
    id: 'xa-history',
    kind: 'history',
    title: '长安：丝绸之路的东方起点',
    body:
      '西汉张骞凿空西域，盛唐长安城容纳百万人口，其中胡人、僧侣、商人云集。西安博物院里的胡旋舞陶俑、何家村的金银窖藏，诉说着那个「万国来朝」的年代。',
    timeRelevance: ['present'],
    placeId: 'xian',
    worldId: 'earth-present',
    tags: ['唐朝', '丝绸之路'],
    readingMinutes: 6,
  },

  // —— 北京 ——
  {
    id: 'bj-intro',
    kind: 'article',
    title: '中轴线上的北京',
    body:
      '北京的骨架是一条 7.8 公里长的南北中轴线：永定门、天坛、正阳门、故宫、景山、万宁桥、钟楼。2024 年，这条轴线被正式列入世界遗产名录。',
    timeRelevance: ['present'],
    placeId: 'beijing',
    worldId: 'earth-present',
    tags: ['中轴线', '世界遗产'],
    readingMinutes: 4,
  },
  {
    id: 'bj-forbidden',
    kind: 'architecture',
    title: '紫禁城：九百年的皇家宫殿',
    body:
      '始建于明永乐四年（1406 年）的故宫，占地 72 万平方米，有九千余间房屋。红墙、黄瓦、汉白玉台基——每一色、每一根柱子的尺寸，都来自《周礼·考工记》与阴阳五行。',
    timeRelevance: ['present', '1920'],
    placeId: 'beijing',
    worldId: 'earth-present',
    tags: ['故宫', '明代建筑'],
    readingMinutes: 7,
  },
  {
    id: 'bj-greatwall',
    kind: 'geography',
    title: '长城：山脊上的巨龙',
    body:
      '北京周边最著名的三段长城各有性格：八达岭最完整，慕田峪风景最秀，箭扣最险峻。日落时分站在敌楼上看山峦起伏，你会理解为什么它是中国最具辨识度的符号。',
    timeRelevance: ['present'],
    placeId: 'beijing',
    worldId: 'earth-present',
    tags: ['长城', '自然'],
    readingMinutes: 4,
  },
];

// ============================================================
// 工具函数
// 注：带 worldId 参数的版本才是推荐的隔离查询入口；
//     不带 worldId 的辅助函数保留做兼容，方便 "全局 id 查找" 场景。
// ============================================================

export function getWorld(id: string = 'earth-present'): World | undefined {
  return WORLDS.find((w) => w.id === id);
}

export function getPlace(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}

export function getRoute(id: string): Route | undefined {
  return ROUTES.find((r) => r.id === id);
}

export function getContent(id: string): ContentItem | undefined {
  return CONTENTS.find((c) => c.id === id);
}

/** 获取某个 World 下的全部 Place（推荐作为列表查询入口） */
export function getPlacesByWorld(worldId: string): Place[] {
  return PLACES.filter((p) => p.worldId === worldId);
}

/** 获取某个 World 下的全部 Route */
export function getRoutesByWorld(worldId: string): Route[] {
  return ROUTES.filter((r) => r.worldId === worldId);
}

/** 获取某个地点的全部内容（会根据 Place.worldId 再过滤一次，保证跨世界不串内容） */
export function getContentsByPlace(placeId: string): ContentItem[] {
  const p = getPlace(placeId);
  if (!p) return [];
  return CONTENTS.filter((c) => c.placeId === placeId && c.worldId === p.worldId);
}

/** 同时按 World + 地点过滤内容 */
export function getContentsByPlaceAndWorld(placeId: string, worldId: string): ContentItem[] {
  return CONTENTS.filter((c) => c.placeId === placeId && c.worldId === worldId);
}

/**
 * 结构不变量校验（对应 review #3 + re-review #1 方向语义）：
 *   routeIds.length === placeIds.length - 1
 *   routeIds[i] 以无向边语义连接 placeIds[i] ↔ placeIds[i+1]
 *   （Route 在模型层面被定义为 UNDIRECTED 边，fromPlaceId/toPlaceId 只是两端点稳定 id）
 */
export function validateAdventureInvariant(placeIds: string[], routeIds: string[]): string | null {
  if (placeIds.length === 0) return 'placeIds 不能为空';
  if (routeIds.length !== placeIds.length - 1) {
    return `routeIds 数量 (${routeIds.length}) 必须等于 placeIds.length - 1 (${placeIds.length - 1})`;
  }
  for (let i = 0; i < routeIds.length; i++) {
    const r = getRoute(routeIds[i]);
    if (!r) return `routeIds[${i}] = ${routeIds[i]} 不存在`;
    const a = placeIds[i];
    const b = placeIds[i + 1];
    // Route 是无向边：两端点相等即可（不分 A→B 还是 B→A）
    const endpoints = new Set([r.fromPlaceId, r.toPlaceId]);
    if (!endpoints.has(a) || !endpoints.has(b)) {
      return `routeIds[${i}] = ${r.id} 不连接 ${a} ↔ ${b}（端点是 {${r.fromPlaceId}, ${r.toPlaceId}}）`;
    }
  }
  return null;
}

/**
 * 根据起点终点生成一条冒险的 routeIds 与 placeIds（按已有数据组合）
 *
 * ⚠️ MVP 实现限制（对应 review #2 / re-review #1）：
 *   当前只支持在预设链路（SG↔BK↔HN↔KM↔CD↔XA↔BJ）上查找**连续子段**，
 *   正向 / 反向都合法（因为 Route 是无向边）。
 *
 *   这是实现限制，不是模型限制：
 *     Place     = graph node
 *     Route     = graph UNDIRECTED edge
 *     Adventure = ordered path
 *   后续可扩展：分叉路线、多条候选路径、World 内全图 Dijkstra 查找。
 */
export function buildAdventurePath(fromId: string, toId: string, worldId?: string): {
  placeIds: string[];
  routeIds: string[];
} | null {
  const fromPlace = getPlace(fromId);
  const toPlace = getPlace(toId);
  if (!fromPlace || !toPlace || fromId === toId) return null;
  // 跨 World 校验
  if (worldId && (fromPlace.worldId !== worldId || toPlace.worldId !== worldId)) return null;
  if (fromPlace.worldId !== toPlace.worldId) return null;

  // MVP：按 PLACES 数组顺序（预设链路）做连续子段匹配
  const sameWorld = PLACES.filter((p) => p.worldId === fromPlace.worldId);
  const fromIdx = sameWorld.findIndex((p) => p.id === fromId);
  const toIdx = sameWorld.findIndex((p) => p.id === toId);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return null;

  const step = fromIdx < toIdx ? 1 : -1;
  const placeIds: string[] = [];
  for (let i = fromIdx; i !== toIdx + step; i += step) {
    placeIds.push(sameWorld[i].id);
  }

  const routeIds: string[] = [];
  for (let i = 0; i < placeIds.length - 1; i++) {
    const a = placeIds[i];
    const b = placeIds[i + 1];
    // Route 按无向边语义查找：两端点都匹配即可
    const r = ROUTES.find(
      (rr) => {
        if (rr.worldId !== fromPlace.worldId) return false;
        const eps = new Set([rr.fromPlaceId, rr.toPlaceId]);
        return eps.has(a) && eps.has(b);
      }
    );
    if (!r) return null; // 相邻节点缺失 route → 该路径不合法
    routeIds.push(r.id);
  }

  const err = validateAdventureInvariant(placeIds, routeIds);
  if (err) {
    // 理论上不会触发，作为 invariant 防线保留
    console.warn('[buildAdventurePath] invariant 失败:', err);
    return null;
  }
  return { placeIds, routeIds };
}

/** 生成一条预设的「东南亚到古都」冒险样板 */
export const SAMPLE_ADVENTURE_TEMPLATE = {
  worldId: 'earth-present',
  title: '从花园城市到古都：一次穿越山海的冒险',
  theme: '东南亚 · 中国西南 · 古都',
  placeIds: PLACES.map((p) => p.id),
  routeIds: ROUTES.map((r) => r.id),
};
