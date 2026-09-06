/**
 * Obsidian Parser — 读取 Obsidian Vault 并输出领域对象。
 *
 * Vault 目录结构：
 *   vault/
 *   ├── worlds/earth-present.md
 *   ├── places/singapore.md
 *   ├── routes/singapore-bangkok.md
 *   ├── content/singapore-history.md
 *   └── adventures/singapore-to-beijing.md
 *
 * 每个 .md 文件通过 YAML Frontmatter 描述结构化属性，
 * 正文为 Markdown + [[wikilink]]。
 */

import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import type {
  IParser,
  ParsedVault,
  World,
  Place,
  Route,
  ContentItem,
  Adventure,
  WorldKind,
  PlaceType,
  ContentKind,
  Coordinates,
} from '../../types';
import { renderMarkdown, extractWikilinks, estimateReadingMinutes } from '../../utils/markdown';

export class ObsidianParser implements IParser {
  readonly name = 'obsidian';

  async parse(vaultPath: string): Promise<ParsedVault> {
    const vault: ParsedVault = {
      worlds: [],
      places: [],
      routes: [],
      contents: [],
      adventures: [],
    };

    vault.worlds = this.parseWorlds(vaultPath);
    vault.places = this.parsePlaces(vaultPath);
    vault.routes = this.parseRoutes(vaultPath);
    vault.contents = this.parseContents(vaultPath);
    vault.adventures = this.parseAdventures(vaultPath);

    return vault;
  }

  // ─── Worlds ───────────────────────────────────────────────

  private parseWorlds(vaultPath: string): World[] {
    const dir = path.join(vaultPath, 'worlds');
    const files = this.findMarkdown(dir);
    const worlds: World[] = [];

    for (const file of files) {
      const { data, content } = this.readFrontmatter(file);
      if (data.type !== 'world') continue;

      worlds.push({
        id: String(data.id || path.basename(file, '.md')),
        name: String(data.name || data.id || ''),
        kind: (data.kind as WorldKind) || 'real',
        timeAnchor: String(data.time_anchor || data.timeAnchor || 'present'),
        description: String(data.description || ''),
      });
    }
    return worlds;
  }

  // ─── Places ───────────────────────────────────────────────

  private parsePlaces(vaultPath: string): Place[] {
    const dir = path.join(vaultPath, 'places');
    const files = this.findMarkdown(dir);
    const places: Place[] = [];

    for (const file of files) {
      const { data, content } = this.readFrontmatter(file);
      if (data.type !== 'place') continue;

      const id = String(data.id || path.basename(file, '.md'));
      const bodyHtml = renderMarkdown(content);
      const links = extractWikilinks(content);

      places.push({
        id,
        worldId: String(data.world || 'earth-present'),
        name: String(data.name || id),
        localName: data.local_name ? String(data.local_name) : undefined,
        type: (data.place_type as PlaceType) || 'city',
        coords: this.parseCoords(data, `Place "${id}"`),
        country: data.country ? String(data.country) : undefined,
        summary: String(data.summary || ''),
        tags: this.parseTags(data.tags),
        bodyHtml,
        bodyRaw: content,
        links,
        backlinkIds: [],
      });
    }
    return places;
  }

  // ─── Routes ───────────────────────────────────────────────

  private parseRoutes(vaultPath: string): Route[] {
    const dir = path.join(vaultPath, 'routes');
    const files = this.findMarkdown(dir);
    const routes: Route[] = [];

    for (const file of files) {
      const { data, content } = this.readFrontmatter(file);
      if (data.type !== 'route') continue;

      const id = String(data.id || path.basename(file, '.md'));
      const bodyHtml = renderMarkdown(content);

      routes.push({
        id,
        worldId: String(data.world || 'earth-present'),
        fromPlaceId: String(data.from || data.from_place || ''),
        toPlaceId: String(data.to || data.to_place || ''),
        path: this.parsePath(data, `Route "${id}"`),
        distanceLabel: data.distance ? String(data.distance) : undefined,
        highlights: this.parseTags(data.highlights),
        bodyHtml,
        bodyRaw: content,
      });
    }
    return routes;
  }

  // ─── Content ──────────────────────────────────────────────

  private parseContents(vaultPath: string): ContentItem[] {
    const dir = path.join(vaultPath, 'content');
    const files = this.findMarkdown(dir);
    const contents: ContentItem[] = [];

    for (const file of files) {
      const { data, content } = this.readFrontmatter(file);
      if (data.type !== 'content') continue;

      const id = String(data.id || path.basename(file, '.md'));
      const bodyHtml = renderMarkdown(content);
      const links = extractWikilinks(content);

      contents.push({
        id,
        kind: (data.kind as ContentKind) || 'article',
        title: String(data.title || id),
        bodyHtml,
        bodyRaw: content,
        placeId: data.place ? String(data.place) : undefined,
        worldId: String(data.world || 'earth-present'),
        source: data.source ? String(data.source) : undefined,
        imageUrl: data.image ? String(data.image) : undefined,
        tags: this.parseTags(data.tags),
        readingMinutes: estimateReadingMinutes(content),
        links,
        backlinkIds: [],
      });
    }
    return contents;
  }

  // ─── Adventures ──────────────────────────────────────────

  private parseAdventures(vaultPath: string): Adventure[] {
    const dir = path.join(vaultPath, 'adventures');
    const files = this.findMarkdown(dir);
    const adventures: Adventure[] = [];

    for (const file of files) {
      const { data, content } = this.readFrontmatter(file);
      if (data.type !== 'adventure') continue;

      const id = String(data.id || path.basename(file, '.md'));
      const bodyHtml = renderMarkdown(content);

      // places 字段可以是 "singapore, bangkok, ..." 或数组
      const placeIds = this.parseIdList(data.places);
      const routeIds = this.parseIdList(data.routes);

      adventures.push({
        id,
        worldId: String(data.world || 'earth-present'),
        title: String(data.title || id),
        theme: data.theme ? String(data.theme) : undefined,
        placeIds,
        routeIds,
        coverNote: data.cover_note ? String(data.cover_note) : undefined,
        bodyHtml,
        bodyRaw: content,
      });
    }
    return adventures;
  }

  // ─── 工具方法 ─────────────────────────────────────────────

  private readFrontmatter(filePath: string): { data: Record<string, unknown>; content: string } {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);
    return { data: parsed.data as Record<string, unknown>, content: parsed.content.trim() };
  }

  private findMarkdown(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.findMarkdown(full));
      } else if (entry.name.endsWith('.md')) {
        results.push(full);
      }
    }
    return results.sort();
  }

  /**
   * 解析坐标并严格校验：缺失 / 非数字 / 超出范围一律抛错，
   * 避免 Place 被静默渲染到 (0,0)。
   */
  private parseCoords(data: Record<string, unknown>, context: string): Coordinates {
    const latRaw = data.lat ?? data.latitude;
    const lngRaw = data.lng ?? data.lon ?? data.longitude;
    if (latRaw === undefined || lngRaw === undefined) {
      throw new Error(`${context}: 缺少坐标 (lat/lng 或 latitude/longitude)`);
    }
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error(`${context}: 坐标非数字 (lat=${String(latRaw)}, lng=${String(lngRaw)})`);
    }
    if (lat < -90 || lat > 90) {
      throw new Error(`${context}: 纬度越界 lat=${lat}（应在 -90~90）`);
    }
    if (lng < -180 || lng > 180) {
      throw new Error(`${context}: 经度越界 lng=${lng}（应在 -180~180）`);
    }
    return { lat, lng };
  }

  private parsePath(data: Record<string, unknown>, context: string): Coordinates[] | undefined {
    const raw = data.path;
    if (!raw) return undefined;

    const toCoord = (val: unknown): Coordinates | undefined => {
      if (typeof val === 'string') {
        const [lat, lng] = val.split(',').map((n) => Number(n.trim()));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
        return { lat, lng };
      }
      const obj = val as Record<string, unknown>;
      const lat = Number(obj.lat ?? obj.latitude);
      const lng = Number(obj.lng ?? obj.lon ?? obj.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
      return { lat, lng };
    };

    const coords: Coordinates[] = [];
    let dropped = 0;
    const items: unknown[] = Array.isArray(raw) ? (raw as unknown[]) : String(raw).split(';');

    for (const item of items) {
      const c = toCoord(item);
      if (c) {
        // 范围校验（缺失或越界视为非法点，warning 后丢弃）
        if (c.lat < -90 || c.lat > 90 || c.lng < -180 || c.lng > 180) {
          dropped++;
          continue;
        }
        coords.push(c);
      } else {
        dropped++;
      }
    }

    if (dropped > 0) {
      console.warn(`⚠ ${context}: Route.path 有 ${dropped} 个非法点已丢弃（缺失/非数字/越界）`);
    }

    return coords.length >= 2 ? coords : undefined;
  }

  private parseTags(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') {
      return value
        .split(/[,，]/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean);
    }
    return [];
  }

  private parseIdList(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') {
      return value
        .split(/[,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }
}
