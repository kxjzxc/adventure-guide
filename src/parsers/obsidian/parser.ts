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
        coords: this.parseCoords(data),
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
        path: this.parsePath(data),
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

  private parseCoords(data: Record<string, unknown>): Coordinates {
    const lat = Number(data.lat ?? data.latitude ?? 0);
    const lng = Number(data.lng ?? data.lon ?? data.longitude ?? 0);
    return { lat, lng };
  }

  private parsePath(data: Record<string, unknown>): Coordinates[] | undefined {
    const raw = data.path;
    if (!raw) return undefined;
    if (Array.isArray(raw)) {
      return (raw as unknown[])
        .map((p) => {
          if (typeof p === 'string') {
            const [lat, lng] = p.split(',').map((n) => Number(n.trim()));
            return { lat, lng };
          }
          const obj = p as Record<string, unknown>;
          return {
            lat: Number(obj.lat ?? obj.latitude),
            lng: Number(obj.lng ?? obj.lon ?? obj.longitude),
          };
        })
        .filter((c) => !isNaN(c.lat) && !isNaN(c.lng));
    }
    // 字符串格式 "lat,lng;lat,lng;..."
    if (typeof raw === 'string') {
      return raw
        .split(';')
        .map((pair) => {
          const [lat, lng] = pair.split(',').map((n) => Number(n.trim()));
          return { lat, lng };
        })
        .filter((c) => !isNaN(c.lat) && !isNaN(c.lng));
    }
    return undefined;
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
