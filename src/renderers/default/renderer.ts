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
} from '../../types';

export class DefaultRenderer implements IRenderer {
  readonly name = 'default';

  async render(vault: ParsedVault, ctx: RenderContext): Promise<void> {
    const { storage, config } = ctx;
    const base = config.site.base || '/';

    // 建立查询索引
    const index = this.buildIndex(vault);
    const nameToPlaceId = this.buildNameToPlaceMap(vault);
    const nameToContentId = this.buildNameToContentMap(vault);

    // 全量数据 JSON（供客户端地图、导航用）
    const siteData = this.buildSiteData(vault, index);
    const siteDataJson = JSON.stringify(siteData).replace(/<\/script/gi, '<\\/script');

    // 1. 世界首页（地图 + 冒险列表）
    await storage.save('index.html', this.renderHome(vault, index, siteDataJson, config.site, base));

    // 2. 时间线
    await storage.save('timeline.html', this.renderTimeline(vault, siteDataJson, config.site, base));

    // 3. 地点详情页
    for (const place of vault.places) {
      const placeContents = vault.contents.filter((c) => c.placeId === place.id);
      const html = this.renderPlace(place, placeContents, vault, nameToPlaceId, nameToContentId, siteDataJson, config.site, base);
      await storage.save(`places/${place.id}.html`, html);
    }

    // 4. 内容详情页
    for (const content of vault.contents) {
      const html = this.renderContent(content, vault, nameToPlaceId, nameToContentId, siteDataJson, config.site, base);
      await storage.save(`content/${content.id}.html`, html);
    }

    // 5. 冒险详情页
    for (const adv of vault.adventures) {
      const html = this.renderAdventure(adv, vault, siteDataJson, config.site, base);
      await storage.save(`adventures/${adv.id}.html`, html);
    }

    // 6. index.json
    await storage.save('index.json', JSON.stringify(siteData, null, 2));

    // 7. 复制主题资源
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

  private buildSiteData(vault: ParsedVault, index: ReturnType<DefaultRenderer['buildIndex']>) {
    return {
      site: { title: '', subtitle: '' },
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

  private buildNameToPlaceMap(vault: ParsedVault): Map<string, string> {
    const m = new Map<string, string>();
    for (const p of vault.places) {
      m.set(p.name.toLowerCase(), p.id);
      if (p.localName) m.set(p.localName.toLowerCase(), p.id);
    }
    return m;
  }

  private buildNameToContentMap(vault: ParsedVault): Map<string, string> {
    const m = new Map<string, string>();
    for (const c of vault.contents) {
      m.set(c.title.toLowerCase(), c.id);
    }
    return m;
  }

  /**
   * 把 contentHtml 中的 wikilink 锚点（#Page Name）解析为真实页面路径。
   * 如果找不到目标，渲染为死链 span。
   */
  private resolveWikilinks(
    html: string,
    nameToPlaceId: Map<string, string>,
    nameToContentId: Map<string, string>,
    base: string,
  ): string {
    return html.replace(
      /<a href="#([^"]+)" class="ag-link">/g,
      (_match, encoded: string) => {
        const name = decodeURIComponent(encoded).toLowerCase();
        const placeId = nameToPlaceId.get(name);
        if (placeId) {
          return `<a href="${base}places/${placeId}.html" class="ag-link ag-link-place">`;
        }
        const contentId = nameToContentId.get(name);
        if (contentId) {
          return `<a href="${base}content/${contentId}.html" class="ag-link ag-link-content">`;
        }
        return `<span class="ag-link-dead">`;
      },
    ).replace(
      /<span class="ag-link-dead">([^<]+)<\/a>/g,
      '<span class="ag-link-dead">$1</span>',
    );
  }

  // ─── 页面渲染 ────────────────────────────────────────────

  private renderHome(
    vault: ParsedVault,
    index: ReturnType<DefaultRenderer['buildIndex']>,
    siteDataJson: string,
    site: { title: string; subtitle: string },
    base: string,
  ): string {
    const worldList = vault.worlds.map((w) => {
      const placeCount = index.places.filter((p) => p.worldId === w.id).length;
      const adventureCount = index.adventures.filter((a) => a.worldId === w.id).length;
      return `
        <div class="world-card">
          <h3>${w.name}</h3>
          <p class="world-desc">${w.description}</p>
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

    const routeLines = vault.routes.map((r) => {
      const from = vault.places.find((p) => p.id === r.fromPlaceId);
      const to = vault.places.find((p) => p.id === r.toPlaceId);
      if (!from || !to) return '';
      return `[[${from.coords.lat},${from.coords.lng}],[${to.coords.lat},${to.coords.lng}]]`;
    }).filter(Boolean).join(',');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${site.title}</title>
  <link rel="stylesheet" href="${base}css/style.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
</head>
<body class="home">
  <div id="site-data" style="display:none">${siteDataJson}</div>

  <header class="site-header">
    <h1 class="site-title">${site.title}</h1>
    <p class="site-subtitle">${site.subtitle}</p>
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
    nameToPlaceId: Map<string, string>,
    nameToContentId: Map<string, string>,
    siteDataJson: string,
    site: { title: string; subtitle: string },
    base: string,
  ): string {
    const body = this.resolveWikilinks(place.bodyHtml || '', nameToPlaceId, nameToContentId, base);
    const tagsHtml = place.tags.map((t) => `<span class="tag">${t}</span>`).join('');
    const backlinksHtml = (place.backlinkIds || []).length > 0
      ? `<div class="backlinks"><h4>被引用</h4><div class="link-list">${place.backlinkIds!.map((id) => {
          const p = vault.places.find((x) => x.id === id);
          const c = vault.contents.find((x) => x.id === id);
          if (p) return `<a href="${base}places/${id}.html" class="ag-link">${p.name}</a>`;
          if (c) return `<a href="${base}content/${id}.html" class="ag-link">${c.title}</a>`;
          return '';
        }).join('')}</div></div>`
      : '';

    const contentList = placeContents.length > 0
      ? `<div class="content-list"><h4>相关内容</h4>${placeContents.map((c) =>
          `<a class="content-card" href="${base}content/${c.id}.html">
            <span class="content-kind content-kind-${c.kind}">${c.kind}</span>
            <span class="content-title">${c.title}</span>
            ${c.readingMinutes ? `<span class="content-reading">${c.readingMinutes} 分钟</span>` : ''}
          </a>`).join('')}</div>`
      : '';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${place.name} — ${site.title}</title>
  <link rel="stylesheet" href="${base}css/style.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
</head>
<body class="place-page">
  <div id="site-data" style="display:none">${siteDataJson}</div>

  <header class="site-header">
    <h1 class="site-title"><a href="${base}index.html">${site.title}</a></h1>
    <nav class="site-nav">
      <a href="${base}index.html">世界</a>
      <a href="${base}timeline.html">时间线</a>
    </nav>
  </header>

  <main class="place-detail">
    <div class="place-header">
      <h2>${place.name}</h2>
      ${place.localName ? `<div class="place-local-name">${place.localName}</div>` : ''}
      ${place.country ? `<div class="place-country">${place.country}</div>` : ''}
      <div class="place-tags">${tagsHtml}</div>
    </div>

    <div class="place-map" id="place-map"></div>

    <div class="place-summary">${place.summary}</div>

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
    nameToPlaceId: Map<string, string>,
    nameToContentId: Map<string, string>,
    siteDataJson: string,
    site: { title: string; subtitle: string },
    base: string,
  ): string {
    const body = this.resolveWikilinks(content.bodyHtml, nameToPlaceId, nameToContentId, base);
    const tagsHtml = content.tags.map((t) => `<span class="tag">${t}</span>`).join('');
    const placeLink = content.placeId
      ? `<a class="place-link" href="${base}places/${content.placeId}.html">← ${(vault.places.find((p) => p.id === content.placeId)?.name) || content.placeId}</a>`
      : '';

    const backlinksHtml = content.backlinkIds.length > 0
      ? `<div class="backlinks"><h4>被引用</h4><div class="link-list">${content.backlinkIds.map((id) => {
          const p = vault.places.find((x) => x.id === id);
          const c = vault.contents.find((x) => x.id === id);
          if (p) return `<a href="${base}places/${id}.html" class="ag-link">${p.name}</a>`;
          if (c) return `<a href="${base}content/${id}.html" class="ag-link">${c.title}</a>`;
          return '';
        }).join('')}</div></div>`
      : '';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.title} — ${site.title}</title>
  <link rel="stylesheet" href="${base}css/style.css">
</head>
<body class="content-page">
  <div id="site-data" style="display:none">${siteDataJson}</div>

  <header class="site-header">
    <h1 class="site-title"><a href="${base}index.html">${site.title}</a></h1>
    <nav class="site-nav">
      <a href="${base}index.html">世界</a>
      <a href="${base}timeline.html">时间线</a>
    </nav>
  </header>

  <main class="content-detail">
    <div class="content-header">
      <span class="content-kind content-kind-${content.kind}">${content.kind}</span>
      <h2>${content.title}</h2>
      <div class="content-meta">
        ${content.readingMinutes ? `<span>${content.readingMinutes} 分钟阅读</span>` : ''}
        ${content.source ? `<span>来源：${content.source}</span>` : ''}
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
    siteDataJson: string,
    site: { title: string; subtitle: string },
    base: string,
  ): string {
    const steps = adv.placeIds.map((pid, i) => {
      const place = vault.places.find((p) => p.id === pid);
      if (!place) return '';
      const route = i > 0 ? vault.routes.find((r) => r.id === adv.routeIds[i - 1]) : undefined;
      const contents = vault.contents.filter((c) => c.placeId === pid);
      return `
        <div class="adventure-step" data-step="${i}">
          ${route ? `<div class="step-route">
            <span class="route-arrow">↓</span>
            ${route.distanceLabel ? `<span class="route-distance">${route.distanceLabel}</span>` : ''}
            ${route.highlights.length > 0 ? `<div class="route-highlights">${route.highlights.map((h) => `<span>${h}</span>`).join('')}</div>` : ''}
          </div>` : ''}
          <div class="step-place">
            <span class="step-index">${i + 1}</span>
            <h3><a href="${base}places/${place.id}.html">${place.name}</a></h3>
            <p class="step-summary">${place.summary}</p>
            ${contents.length > 0 ? `<div class="step-contents">${contents.map((c) =>
              `<a class="content-mini" href="${base}content/${c.id}.html">${c.title}</a>`).join('')}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    const placeMarkers = adv.placeIds.map((pid) => {
      const p = vault.places.find((pl) => pl.id === pid);
      return p ? `[[${p.coords.lat},${p.coords.lng}]]` : '';
    }).filter(Boolean).join(',');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${adv.title} — ${site.title}</title>
  <link rel="stylesheet" href="${base}css/style.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
</head>
<body class="adventure-page">
  <div id="site-data" style="display:none">${siteDataJson}</div>

  <header class="site-header">
    <h1 class="site-title"><a href="${base}index.html">${site.title}</a></h1>
    <nav class="site-nav">
      <a href="${base}index.html">世界</a>
      <a href="${base}timeline.html">时间线</a>
    </nav>
  </header>

  <main class="adventure-detail">
    <div class="adventure-header">
      <h2>${adv.title}</h2>
      ${adv.theme ? `<div class="adventure-theme">${adv.theme}</div>` : ''}
      ${adv.coverNote ? `<p class="adventure-cover">${adv.coverNote}</p>` : ''}
    </div>

    <div class="adventure-map" id="adventure-map"></div>

    <div class="adventure-path">${steps}</div>
  </main>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    window.AG_ADVENTURE_PLACES = [${placeMarkers}];
    window.AG_BASE = ${JSON.stringify(base)};
  </script>
  <script src="${base}js/app.js"></script>
</body>
</html>`;
  }

  private renderTimeline(
    vault: ParsedVault,
    siteDataJson: string,
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
            <h3>${w.name}</h3>
            <p>${w.description}</p>
            <div class="timeline-places">
              ${places.map((p) => `<a href="${base}places/${p.id}.html" class="timeline-place">${p.name}</a>`).join('')}
            </div>
          </div>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>时间线 — ${site.title}</title>
  <link rel="stylesheet" href="${base}css/style.css">
</head>
<body class="timeline-page">
  <div id="site-data" style="display:none">${siteDataJson}</div>

  <header class="site-header">
    <h1 class="site-title"><a href="${base}index.html">${site.title}</a></h1>
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

  private async copyThemeAssets(ctx: RenderContext): Promise<void> {
    const themesDir = path.join(process.cwd(), 'themes', 'default');
    const cssSrc = path.join(themesDir, 'css');
    const jsSrc = path.join(themesDir, 'js');
    const cssDest = path.join(ctx.outputPath, 'css');
    const jsDest = path.join(ctx.outputPath, 'js');

    if (fs.existsSync(cssSrc)) {
      fs.mkdirSync(cssDest, { recursive: true });
      for (const file of fs.readdirSync(cssSrc)) {
        if (file.endsWith('.css')) {
          fs.copyFileSync(path.join(cssSrc, file), path.join(cssDest, file));
        }
      }
    }
    if (fs.existsSync(jsSrc)) {
      fs.mkdirSync(jsDest, { recursive: true });
      for (const file of fs.readdirSync(jsSrc)) {
        if (file.endsWith('.js')) {
          fs.copyFileSync(path.join(jsSrc, file), path.join(jsDest, file));
        }
      }
    }
  }
}
