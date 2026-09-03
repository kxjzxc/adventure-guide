# 世界冒险指南 · World Adventure Guide

> 认识一个原本不了解的世界，从一次冒险开始。

「世界冒险指南」是一款基于 **现实世界地图** 的个人探索工具：通过"冒险"把不同地点连接成一条路线，让你沿着路线不断发现、了解和记录沿途的城市、地点与内容。

它 **不是传统地图**，也 **不是旅行规划器**。核心体验是：**通过一次冒险，认识一个原本不了解的世界**。

---

## ✨ 产品特性

- 🌍 **多世界扩展**：现实世界、历史世界（如 1920）、虚拟世界等都作为独立的 `World` 管理，所有 Place/Route/Content 均按 `worldId` 隔离。
- 🧭 **冒险 = 一条有序路径**：选择起点 → 终点，自动生成一条「地点序列 + 路线序列」的冒险。
- 🗺️ **Leaflet 地图**：真实世界坐标 + 路线折线，实时预览当前冒险的全部点位。
- 📚 **内容与展示解耦**：Content（文章/历史/地理/文化/美食/人物/建筑/图集）独立存在，可在地图、冒险、时间线、地点详情中任意复用。
- 📝 **个人记录**：笔记 / 个人理解 / 想去清单 / 收藏，数据存在 LocalStorage 中，属于用户而不是页面。
- 🎨 **白底 × 棕字 × 赭石**：复古牛皮纸质感的视觉风格。

---

## 🧱 技术栈

| 层 | 选型 |
|---|---|
| 框架 | **React 18** + **TypeScript 5** |
| 构建 | **Vite 5**（Oxc React Plugin） |
| 路由 | **React Router 6** |
| 地图 | **Leaflet 1.9** + CARTO Positron 底图 |
| 状态 | **Zustand** + `persist` 中间件（LocalStorage） |
| 样式 | 原生 CSS，CSS 变量做主题化 |
| 代码规范 | **Oxlint** |

---

## 🏛️ 核心数据模型

遵循「内容是什么 vs 内容如何展示是两件事」的解耦原则。

```
World
 └─ Place   (graph node)   世界中的空间节点
    ├─ Route (graph edge)  两个 Place 之间的路径（有向）
    └─ ContentItem         独立存在的知识内容（文章 / 历史 / 地理 / ...）

Adventure  一次冒险
 ├─ placeIds[]  →  路径上按顺序的 Place 序列
 ├─ routeIds[]  →  相邻 Place 之间的 Route 序列（长度 === placeIds.length - 1）
 └─ currentStep →  当前在 placeIds 中的下标

UserRecord  用户留下的个人信息
 └─ kind: note | favorite | wishlist | thought
```

**关键不变量（Adventure）：**
```
routeIds.length === placeIds.length - 1
routeIds[i]  连接  placeIds[i] ↔ placeIds[i+1]
currentStep ∈ [0, placeIds.length - 1]
```
所有不变量在 `store.createAdventure` / `data.buildAdventurePath` 层统一校验，不把约束下沉到页面逻辑。

**Favorite 的 identity：**
```
worldId + placeId (+ contentId)
```
`adventureId` 仅作为该收藏产生时的冒险上下文，不参与唯一键判断。这样同一个"地理地点"在不同 World（如 earth-present vs earth-1920）下是彼此独立的收藏项。

---

## 📁 目录结构

```
world-adventure-guide/
├── public/                 静态资源（favicon、icons svg sprite 等）
├── src/
│   ├── types/index.ts      ✱ 核心数据模型
│   ├── data/worldData.ts   ✱ MVP 内置数据（World / Place / Route / Content）与工具函数
│   ├── store/index.ts      ✱ Zustand：AdventureStore + RecordStore（持久化）
│   ├── styles/global.css   ✱ 全局样式 + CSS 变量主题
│   ├── components/         复用组件：AdventureMap、Layout
│   └── pages/              页面
│       ├── HomePage.tsx            首页（地图 + 活跃冒险）
│       ├── AdventuresListPage.tsx  全部冒险列表
│       ├── CreateAdventurePage.tsx 创建新冒险
│       ├── AdventureDetailPage.tsx 冒险详情：地图 + 时间线
│       ├── PlaceDetailPage.tsx     地点详情：内容列表 + 记录面板
│       └── RecordsPage.tsx         全局个人记录 / 统计 / 筛选
│   ├── App.tsx             路由
│   └── main.tsx            入口
└── README.md
```

---

## 🚀 本地运行

```bash
# 安装依赖
npm install

# 开发（默认 http://localhost:5173）
npm run dev

# 类型检查
npx tsc -b --noEmit

# 生产构建
npm run build

# 预览构建产物
npm run preview
```

首次打开会自动注入一条示例冒险「从花园城市到古都：一次穿越山海的冒险」，路线是：
**新加坡 → 曼谷 → 河内 → 昆明 → 成都 → 西安 → 北京**。

---

## 🧭 MVP 限制 & 后续扩展

| 点 | MVP 现状 | 后续方向 |
|---|---|---|
| 路径生成 | 仅在预设链路上查找连续子段 | 全图 Dijkstra / A* 寻路、多条候选路径 |
| 图结构 | Route 仍是单向边 + 反向匹配 | 真正的有向图 + 多 Route 复用节点 |
| 数据来源 | 内置静态 JSON | 接入 Wiki / Wikidata / OpenStreetMap POI 等 |
| 多世界 | 只实现了 `earth-present` | `earth-1920`（历史世界）与虚拟世界 |
| 记录同步 | LocalStorage | 多端同步 / 导出 Markdown / 分享链接 |
