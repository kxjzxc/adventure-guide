/**
 * DefaultRenderer — 将领域对象渲染为静态网站。
 *
 * 输出结构：
 *   dist/
 *   ├── index.html          世界首页（地图 + 冒险入口）
 *   ├── timeline.html       时间线
 *   ├── places/{id}.html    地点详情
 *   ├── content/{id}.html   内容详情
 *   ├── adventures/{id}.html 冒险详情
 *   ├── index.json          全量数据（供客户端导航）
 *   ├── css/style.css
 *   └── js/app.js
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  IRenderer,
  ParsedVault,
  RenderContext,
  Place,
  Route,
  ContentItem,
  Adventure,
  World,
  WorldIndexEntry,
  PlaceIndexEntry,
  ContentIndexEntry,
  AdventureIndexEntry,
  WikilinkRef,
} from '../../types';

export class DefaultRenderer implements IRenderer {
  readonly name = 'default';

  async render(vault: ParsedVault, ctx: RenderContext): Promise<void> {
    const { storage, config } = ctx;
    const base = config.site.base || '/';

    // 建立查询索引
    const index = this.buildIndex(vault);
    // World-scoped wikilink 解析器：同 worldId 优先，跨 world 回退
    const resolve = this.buildWikilinkResolver(vault);

    // 全量数据 JSON —— 仅写入 index.json，site 元信息取自 config
    const siteData = this.buildSiteData(vault, index, config.site);

    // 1. 世界首页（地图 + 冒险列表）
    await storage.save('index.html', this.renderHome(vault, index, config.site, base));

    // 2. 时间线
    await storage.save('timeline.html', this.renderTimeline(vault, config.site, base));

    // 3. 地点详情页（Place→Content 查询带 worldId，避免跨 World 串内容）
    for (const place of vault.places) {
      const placeContents = vault.contents.filter(
        (c) => c.placeId === place.id && c.worldId === place.worldId,
      );
      const html = this.renderPlace(place, placeContents, vault, resolve, config.site, base);
      await storage.save(`places/${place.id}.html`, html);
    }

    // 4. 内容详情页
    for (const content of vault.contents) {
      const html = this.renderContent(content, vault, resolve, config.site, base);
      await storage.save(`content/${content.id}.html`, html);
    }

    // 5. 冒险详情页
    for (const adv of vault.adventures) {
      const html = this.renderAdventure(adv, vault, resolve, config.site, base);
      await storage.save(`adventures/${adv.id}.html`, html);
    }

    // 6. index.json（全量数据，供客户端按需加载）
    await storage.save('index.json', JSON.stringify(siteData, null, 2));

    // 7. 复制主题资源（通过 Storage 写出，不直接操作输出 fs）
    await this.copyThemeAssets(ctx);
  }

  // ─── 索引构建 ────────────────────────────────────────────

  private buildIndex(vault: ParsedVault) {
    const worlds: WorldIndexEntry[] = vault.worlds.map((w) => ({
      id: w.id, name: w.name, kind: w.kind, timeAnchor: w.timeAnchor,
      placeCount: vault.places.filter((p) => p.worldId === w.id).length,
      contentCount: vault.contents.filter((c) => c.worldId === w.id).length,
      adventureCount: vault.adventures.filter((a) => a.worldId === w.id).length,
    }));
    const places: PlaceIndexEntry[] = vault.places.map((p) => ({
      id: p.id, name: p.name, type: p.type, worldId: p.worldId,
      lat: p.coords.lat, lng: p.coords.lng, tags: p.tags,
      contentCount: vault.contents.filter((c) => c.placeId === p.id).length,
    }));
    const contents: ContentIndexEntry[] = vault.contents.map((c) => ({
      id: c.id, title: c.title, kind: c.kind, placeId: c.placeId,
      worldId: c.worldId, tags: c.tags,
    }));
    const adventures: AdventureIndexEntry[] = vault.adventures.map((a) => ({
      id: a.id, title: a.title, worldId: a.worldId, theme: a.theme,
      placeCount: a.placeIds.length,
    }));
    return { worlds, places, contents, adventures };
  }

  private buildSiteData(
    vault: ParsedVault,
    index: ReturnType<DefaultRenderer['buildIndex']>,
    site: { title: string; subtitle: string },
  ) {
    return {
      site: { title: site.title, subtitle: site.subtitle },
      worlds: vault.worlds,
      places: vault.places.map((p) => ({
        id: p.id, worldId: p.worldId, name: p.name, localName: p.localName,
        type: p.type, coords: p.coords, country: p.country, summary: p.summary,
        tags: p.tags, backlinkIds: p.backlinkIds,
      })),
      routes: vault.routes.map((r) => ({
        id: r.id, worldId: r.worldId, fromPlaceId: r.fromPlaceId,
        toPlaceId: r.toPlaceId, path: r.path, distanceLabel: r.distanceLabel,
        highlights: r.highlights,
      })),
      contents: vault.contents.map((c) => ({
        id: c.id, kind: c.kind, title: c.title, bodyHtml: c.bodyHtml,
        placeId: c.placeId, worldId: c.worldId, source: c.source,
        imageUrl: c.imageUrl, tags: c.tags, readingMinutes: c.readingMinutes,
        backlinkIds: c.backlinkIds,
      })),
      adventures: vault.adventures,
      index,
    };
  }

  /**
   * 构建 World-scoped wikilink 解析器。
   * 返回 (ref, sourceWorldId) → { type, id } | undefined
   *   - 带路径前缀（[[places/X]] / [[content/X]]）→ 仅对应类型
   *   - 无前缀（[[X]]）→ place 优先 content
   *   - 优先在 sourceWorldId 内查找；跨 World 仅作 fallback
   * ID 在 Vault 内全局唯一，同名对象在不同 World 间靠 worldId 区分。
   */
  private buildWikilinkResolver(
    vault: ParsedVault,
  ): (ref: WikilinkRef, sourceWorldId: string) => { type: 'place' | 'content'; id: string } | undefined {
    const placeByWorld = new Map<string, Map<string, string>>();
    const contentByWorld = new Map<string, Map<string, string>>();
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

    return (ref, sourceWorldId) => {
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
  }

  /**
   * 把 bodyHtml 中的 wikilink 锚点解析为真实页面路径。
   *
   * 锚点可能带路径前缀（renderMarkdown 保留）：
   *   #places/Tokyo → 仅查 place
   *   #content/Tokyo → 仅查 content
   *   #Tokyo → 通用查找（place 优先）
   * 解析以页面所属 worldId 为 scope（同 world 优先，跨 world 回退）。
   * 找不到目标时渲染为死链 span。
   */
  private resolveWikilinks(
    html: string,
    resolve: (ref: WikilinkRef, sourceWorldId: string) => { type: 'place' | 'content'; id: string } | undefined,
    sourceWorldId: string,
    base: string,
  ): string {
    return html.replace(
      /<a href="#([^"]+)" class="ag-link">/g,
      (_match, encoded: string) => {
        const raw = decodeURIComponent(encoded);
        let path: string | undefined;
        let name = raw;
        const slashIdx = raw.indexOf('/');
        if (slashIdx >= 0) {
          path = raw.slice(0, slashIdx).trim().toLowerCase();
          name = raw.slice(slashIdx + 1).trim();
        }
        const target = resolve({ name, path }, sourceWorldId);
        if (!target) return `<span class="ag-link-dead">`;
        return target.type === 'place'
          ? `<a href="${base}places/${target.id}.html" class="ag-link ag-link-place">`
          : `<a href="${base}content/${target.id}.html" class="ag-link ag-link-content">`;
      },
    ).replace(
      /<span class="ag-link-dead">([^<]+)<\/a>/g,
      '<span class="ag-link-dead">$1</span>',
    );
  }

  // ─── 页面渲染 ────────────────────────────────────────────

  /**
   * 转义 frontmatter 文本字段用于 HTML 文本节点 / 属性值。
   * bodyHtml 已由 marked 生成，不在本方法职责内。
   */
  private escapeHtml(s: unknown): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private renderHome(
    vault: ParsedVault,
    index: ReturnType<DefaultRenderer['buildIndex']>,
    site: { title: string; subtitle: string },
    base: string,
  ): string {
    const worldList = vault.worlds.map((w) => {
      const placeCount = index.places.filter((p) => p.worldId === w.id).length;
      const adventureCount = index.adventures.filter((a) => a.worldId === w.id).length;
      return `
        <div class="world-card">
          <h3>${this.escapeHtml(w.name)}</h3>
          <p class="world-desc">${this.escapeHtml(w.description)}</p>
          <div class="world-meta">
            <span>${placeCount} 个地点</span>
            <span>${adventureCount} 条冒险</span>
            <span class="world-kind world-kind-${w.kind}">${w.kind}</span>
          </div>
        </div>`;
    }).join('');

    const adventureList = vault.adventures.map((a) => {
      const places = a.placeIds.map((pid) => {
        const p = vault.places.find((pl) => pl.id === pid);
        return p ? p.name : pid;
      });
      return `
        <a class="adventure-card" href="${base}adventures/${a.id}.html">
          <h3>${a.title}</h3>
          ${a.theme ? `<div class="adventure-theme">${a.theme}</div>` : ''}
          <div class="adventure-route">${places.join(' → ')}</div>
          <div class="adventure-meta">${a.placeIds.length} 个地点</div>
        </a>`;
    }).join('');

    const placeMarkers = vault.places.map((p) =>
      `{ id: '${p.id}', name: ${JSON.stringify(p.name)}, lat: ${p.coords.lat}, lng: ${p.coords.lng}, url: '${base}places/${p.id}.html' }`,
    ).join(',\n      ');

    // 路线折线：优先使用 Route.path（沿铁路/公路/河流的真实曲线），
    // 缺失时 fallback 为 from→to 两点直线。
    const routeLines = vault.routes.map((r) => {
      const from = vault.places.find((p) => p.id === r.fromPlaceId);
      const to = vault.places.find((p) => p.id === r.toPlaceId);
      if (!from || !to) return '';
      const pts = (r.path && r.path.length >= 2)
        ? r.path
        : [from.coords, to.coords];
      return '[' + pts.map((c) => `[${c.lat},${c.lng}]`).join(',') + ']';
    }).filter(Boolean).join(',');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(site.title)}</title>
  <link rel="stylesheet" href="${base}css/style.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
</head>
<body class="home">
  <header class="site-header">
    <h1 class="site-title">${this.escapeHtml(site.title)}</h1>
    <p class="site-subtitle">${this.escapeHtml(site.subtitle)}</p>
    <nav class="site-nav">
      <a href="${base}index.html" class="active">世界</a>
      <a href="${base}timeline.html">时间线</a>
    </nav>
  </header>

  <section class="world-map-section">
    <h2>世界地图</h2>
    <div id="world-map" class="world-map"></div>
  </section>

  <section class="worlds-section">
    <h2>世界</h2>
    <div class="world-grid">${worldList}</div>
  </section>

  <section class="adventures-section">
    <h2>冒险</h2>
    <div class="adventure-grid">${adventureList}</div>
  </section>

  <footer class="site-footer">
    <p>Adventure Guide · 通过一次冒险，认识一个原本不了解的世界</p>
  </footer>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    window.AG_PLACES = [
      ${placeMarkers}
    ];
    window.AG_ROUTES = [${routeLines}];
    window.AG_BASE = ${JSON.stringify(base)};
  </script>
  <script src="${base}js/app.js"></script>
</body>
</html>`;
  }

  private renderPlace(
    place: Place,
    placeContents: ContentItem[],
    vault: ParsedVault,
    resolve: (ref: WikilinkRef, sourceWorldId: string) => { type: 'place' | 'content'; id: string } | undefined,
    site: { title: string; subtitle: string },
    base: string,
  ): string {
    const body = this.resolveWikilinks(place.bodyHtml || '', resolve, place.worldId, base);
    const tagsHtml = place.tags.map((t) => `<span class="tag">${this.escapeHtml(t)}</span>`).join('');
    const backlinksHtml = (place.backlinkIds || []).length > 0
      ? `<div class="backlinks"><h4>被引用</h4><div class="link-list">${place.backlinkIds!.map((id) => {
          const p = vault.places.find((x) => x.id === id);
          const c = vault.contents.find((x) => x.id === id);
          if (p) return `<a href="${base}places/${id}.html" class="ag-link">${this.escapeHtml(p.name)}</a>`;
          if (c) return `<a href="${base}content/${id}.html" class="ag-link">${this.escapeHtml(c.title)}</a>`;
          return '';
        }).join('')}</div></div>`
      : '';

    const contentList = placeContents.length > 0
      ? `<div class="content-list"><h4>相关内容</h4>${placeContents.map((c) =>
          `<a class="content-card" href="${base}content/${c.id}.html">
            <span class="content-kind content-kind-${c.kind}">${c.kind}</span>
            <span class="content-title">${this.escapeHtml(c.title)}</span>
            ${c.readingMinutes ? `<span class="content-reading">${c.readingMinutes} 分钟</span>` : ''}
          </a>`).join('')}</div>`
      : '';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(place.name)} — ${this.escapeHtml(site.title)}</title>
  <link rel="stylesheet" href="${base}css/style.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
</head>
<body class="place-page">
  <header class="site-header">
    <h1 class="site-title"><a href="${base}index.html">${this.escapeHtml(site.title)}</a></h1>
    <nav class="site-nav">
      <a href="${base}index.html">世界</a>
      <a href="${base}timeline.html">时间线</a>
    </nav>
  </header>

  <main class="place-detail">
    <div class="place-header">
      <h2>${this.escapeHtml(place.name)}</h2>
      ${place.localName ? `<div class="place-local-name">${this.escapeHtml(place.localName)}</div>` : ''}
      ${place.country ? `<div class="place-country">${this.escapeHtml(place.country)}</div>` : ''}
      <div class="place-tags">${tagsHtml}</div>
    </div>

    <div class="place-map" id="place-map"></div>

    <div class="place-summary">${this.escapeHtml(place.summary)}</div>

    ${body ? `<article class="place-body">${body}</article>` : ''}

    ${contentList}

    ${backlinksHtml}
  </main>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    window.AG_PLACE = { lat: ${place.coords.lat}, lng: ${place.coords.lng}, name: ${JSON.stringify(place.name)} };
    window.AG_BASE = ${JSON.stringify(base)};
  </script>
  <script src="${base}js/app.js"></script>
</body>
</html>`;
  }

  private renderContent(
    content: ContentItem,
    vault: ParsedVault,
    resolve: (ref: WikilinkRef, sourceWorldId: string) => { type: 'place' | 'content'; id: string } | undefined,
    site: { title: string; subtitle: string },
    base: string,
  ): string {
    const body = this.resolveWikilinks(content.bodyHtml, resolve, content.worldId, base);
    const tagsHtml = content.tags.map((t) => `<span class="tag">${this.escapeHtml(t)}</span>`).join('');
    const placeLink = content.placeId
      ? `<a class="place-link" href="${base}places/${content.placeId}.html">← ${this.escapeHtml((vault.places.find((p) => p.id === content.placeId)?.name) || content.placeId)}</a>`
      : '';

    const backlinksHtml = content.backlinkIds.length > 0
      ? `<div class="backlinks"><h4>被引用</h4><div class="link-list">${content.backlinkIds.map((id) => {
          const p = vault.places.find((x) => x.id === id);
          const c = vault.contents.find((x) => x.id === id);
          if (p) return `<a href="${base}places/${id}.html" class="ag-link">${this.escapeHtml(p.name)}</a>`;
          if (c) return `<a href="${base}content/${id}.html" class="ag-link">${this.escapeHtml(c.title)}</a>`;
          return '';
        }).join('')}</div></div>`
      : '';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(content.title)} — ${this.escapeHtml(site.title)}</title>
  <link rel="stylesheet" href="${base}css/style.css">
</head>
<body class="content-page">
  <header class="site-header">
    <h1 class="site-title"><a href="${base}index.html">${this.escapeHtml(site.title)}</a></h1>
    <nav class="site-nav">
      <a href="${base}index.html">世界</a>
      <a href="${base}timeline.html">时间线</a>
    </nav>
  </header>

  <main class="content-detail">
    <div class="content-header">
      <span class="content-kind content-kind-${content.kind}">${content.kind}</span>
      <h2>${this.escapeHtml(content.title)}</h2>
      <div class="content-meta">
        ${content.readingMinutes ? `<span>${content.readingMinutes} 分钟阅读</span>` : ''}
        ${content.source ? `<span>来源：${this.escapeHtml(content.source)}</span>` : ''}
      </div>
      <div class="content-tags">${tagsHtml}</div>
    </div>

    ${placeLink}

    <article class="content-body">${body}</article>

    ${backlinksHtml}
  </main>

  <script src="${base}js/app.js"></script>
</body>
</html>`;
  }

  private renderAdventure(
    adv: Adventure,
    vault: ParsedVault,
    resolve: (ref: WikilinkRef, sourceWorldId: string) => { type: 'place' | 'content'; id: string } | undefined,
    site: { title: string; subtitle: string },
    base: string,
  ): string {
    const steps = adv.placeIds.map((pid, i) => {
      const place = vault.places.find((p) => p.id === pid);
      if (!place) return '';
      const route = i > 0 ? vault.routes.find((r) => r.id === adv.routeIds[i - 1]) : undefined;
      const contents = vault.contents.filter((c) => c.placeId === pid && c.worldId === place.worldId);
      // Route 正文闭环：在 Adventure step 中渲染 route.bodyHtml（经 wikilink 解析）
      const routeBody = route?.bodyHtml
        ? this.resolveWikilinks(route.bodyHtml, resolve, adv.worldId, base)
        : '';
      return `
        <div class="adventure-step" data-step="${i}">
          ${route ? `<div class="step-route">
            <span class="route-arrow">↓</span>
            ${route.distanceLabel ? `<span class="route-distance">${this.escapeHtml(route.distanceLabel)}</span>` : ''}
            ${route.highlights.length > 0 ? `<div class="route-highlights">${route.highlights.map((h) => `<span>${this.escapeHtml(h)}</span>`).join('')}</div>` : ''}
            ${routeBody ? `<div class="route-body">${routeBody}</div>` : ''}
          </div>` : ''}
          <div class="step-place">
            <span class="step-index">${i + 1}</span>
            <h3><a href="${base}places/${place.id}.html">${this.escapeHtml(place.name)}</a></h3>
            <p class="step-summary">${this.escapeHtml(place.summary)}</p>
            ${contents.length > 0 ? `<div class="step-contents">${contents.map((c) =>
              `<a class="content-mini" href="${base}content/${c.id}.html">${this.escapeHtml(c.title)}</a>`).join('')}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    // 地点标记坐标（用于地图标记）
    const placeMarkers = adv.placeIds.map((pid) => {
      const p = vault.places.find((pl) => pl.id === pid);
      return p ? `[[${p.coords.lat},${p.coords.lng}]]` : '';
    }).filter(Boolean).join(',');

    // 路线段：每段 route 优先用 path（真实曲线），fallback 到两端点直线。
    // app.js 按段画 polyline，拼接出沿 Route.path 的完整冒险路线。
    const segments = adv.routeIds.map((rid, i) => {
      const r = vault.routes.find((x) => x.id === rid);
      if (!r) return '';
      const from = vault.places.find((p) => p.id === r.fromPlaceId);
      const to = vault.places.find((p) => p.id === r.toPlaceId);
      if (!from || !to) return '';
      const pts = (r.path && r.path.length >= 2) ? r.path : [from.coords, to.coords];
      return '[' + pts.map((c) => `[${c.lat},${c.lng}]`).join(',') + ']';
    }).filter(Boolean).join(',');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(adv.title)} — ${this.escapeHtml(site.title)}</title>
  <link rel="stylesheet" href="${base}css/style.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
</head>
<body class="adventure-page">
  <header class="site-header">
    <h1 class="site-title"><a href="${base}index.html">${this.escapeHtml(site.title)}</a></h1>
    <nav class="site-nav">
      <a href="${base}index.html">世界</a>
      <a href="${base}timeline.html">时间线</a>
    </nav>
  </header>

  <main class="adventure-detail">
    <div class="adventure-header">
      <h2>${this.escapeHtml(adv.title)}</h2>
      ${adv.theme ? `<div class="adventure-theme">${this.escapeHtml(adv.theme)}</div>` : ''}
      ${adv.coverNote ? `<p class="adventure-cover">${this.escapeHtml(adv.coverNote)}</p>` : ''}
    </div>

    <div class="adventure-map" id="adventure-map"></div>

    <div class="adventure-path">${steps}</div>
  </main>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    window.AG_ADVENTURE_PLACES = [${placeMarkers}];
    window.AG_ADVENTURE_SEGMENTS = [${segments}];
    window.AG_BASE = ${JSON.stringify(base)};
  </script>
  <script src="${base}js/app.js"></script>
</body>
</html>`;
  }

  private renderTimeline(
    vault: ParsedVault,
    site: { title: string; subtitle: string },
    base: string,
  ): string {
    // 按 timeAnchor 排序世界，渲染为时间线
    const sortedWorlds = [...vault.worlds].sort((a, b) =>
      a.timeAnchor.localeCompare(b.timeAnchor),
    );
    const timeline = sortedWorlds.map((w) => {
      const places = vault.places.filter((p) => p.worldId === w.id);
      return `
        <div class="timeline-item">
          <div class="timeline-anchor">${w.timeAnchor}</div>
          <div class="timeline-content">
            <h3>${this.escapeHtml(w.name)}</h3>
            <p>${this.escapeHtml(w.description)}</p>
            <div class="timeline-places">
              ${places.map((p) => `<a href="${base}places/${p.id}.html" class="timeline-place">${this.escapeHtml(p.name)}</a>`).join('')}
            </div>
          </div>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>时间线 — ${this.escapeHtml(site.title)}</title>
  <link rel="stylesheet" href="${base}css/style.css">
</head>
<body class="timeline-page">
  <header class="site-header">
    <h1 class="site-title"><a href="${base}index.html">${this.escapeHtml(site.title)}</a></h1>
    <nav class="site-nav">
      <a href="${base}index.html">世界</a>
      <a href="${base}timeline.html" class="active">时间线</a>
    </nav>
  </header>

  <main class="timeline">
    <h2>时间线</h2>
    <div class="timeline-list">${timeline}</div>
  </main>

  <script src="${base}js/app.js"></script>
</body>
</html>`;
  }

  // ─── 主题资源复制 ────────────────────────────────────────

  /**
   * 复制主题资源到输出目录。
   *
   * 主题目录解析优先级：
   *   1. config.themePath（显式指定，最可靠）
   *   2. 从本文件位置推导（__dirname/../../../themes/<theme>），
   *      适配「从任意目录执行 CLI」的场景，不依赖 process.cwd()
   *   3. process.cwd()/themes/<theme>（兼容旧行为）
   *
   * 任一候选目录存在即采用；全部找不到 → 抛错终止 build，
   * 避免生成引用了 css/js 但实际缺失的坏站点。
   */
  private async copyThemeAssets(ctx: RenderContext): Promise<void> {
    const themeName = ctx.config.theme || 'default';
    const candidates = [
      ctx.config.themePath,
      path.resolve(__dirname, '..', '..', '..', 'themes', themeName),
      path.resolve(process.cwd(), 'themes', themeName),
    ].filter((p): p is string => !!p);

    let themesDir: string | undefined;
    for (const c of candidates) {
      if (fs.existsSync(c)) { themesDir = c; break; }
    }
    if (!themesDir) {
      throw new Error(
        `找不到主题资源目录 themes/${themeName}（尝试过: ${candidates.join(', ')}）。请在 config 中设置 themePath，或将 themes/ 放到项目根。`,
      );
    }

    const cssSrc = path.join(themesDir, 'css');
    const jsSrc = path.join(themesDir, 'js');

    const copyDir = async (srcDir: string, destRel: string, ext: string) => {
      if (!fs.existsSync(srcDir)) return;
      for (const file of fs.readdirSync(srcDir)) {
        if (!file.endsWith(ext)) continue;
        const content = fs.readFileSync(path.join(srcDir, file));
        await ctx.storage.save(`${destRel}/${file}`, content);
      }
    };

    await copyDir(cssSrc, 'css', '.css');
    await copyDir(jsSrc, 'js', '.js');
  }
}
