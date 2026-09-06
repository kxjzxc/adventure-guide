/**
 * Markdown 渲染工具 — 基于 marked，处理 [[wikilink]] 与图片。
 */

import { marked } from 'marked';
import type { WikilinkRef } from '../types';

marked.setOptions({
  breaks: true,
  gfm: true,
});

/** 解析单个 wikilink target（`Page` / `path/Page` / `Page|alias` / `path/Page|alias`） */
function parseWikilinkTarget(target: string): WikilinkRef & { alias?: string } {
  const [left, alias] = target.split('|');
  const t = (left || '').trim();
  let path: string | undefined;
  let name = t;
  const slashIdx = t.indexOf('/');
  if (slashIdx >= 0) {
    path = t.slice(0, slashIdx).trim().toLowerCase();
    name = t.slice(slashIdx + 1).trim();
  }
  const trimmedAlias = alias?.trim();
  return { name, path, alias: trimmedAlias || undefined };
}

/** 从文本中提取 [[wikilink]] 引用（排除图片嵌入 ![[...]]），保留路径前缀以消歧义 */
export function extractWikilinks(text: string): WikilinkRef[] {
  const seen = new Set<string>();
  const refs: WikilinkRef[] = [];
  const regex = /(?<!!)\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const { name, path } = parseWikilinkTarget(m[1]);
    if (!name) continue;
    const key = `${path || ''}/${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ name, path });
  }
  return refs;
}

/**
 * 将 Markdown 渲染为 HTML：
 * 1. ![[image.png]] 嵌入 → <img>
 * 2. [[Page]] / [[path/Page]] / [[Page|alias]] → <a href="#..." class="ag-link">
 *    （锚点保留路径前缀，显示文本为 name 或 alias；Renderer 再解析为真实路径）
 * 3. marked 渲染
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return '';

  let processed = markdown;

  // ![[image.png]] → <img>
  processed = processed.replace(
    /!\[\[([^\]]+\.(?:jpg|jpeg|png|gif|webp|svg))\]\]/gi,
    (_, src: string) =>
      `<img class="ag-img" src="assets/${src.trim()}" alt="" loading="lazy">`,
  );

  // [[...]] → [display](#anchor)
  // 一条正则同时覆盖 alias / 路径前缀两种形式，避免重复匹配
  processed = processed.replace(
    /\[\[([^\]]+)\]\]/g,
    (_, target: string) => {
      const { name, path, alias } = parseWikilinkTarget(target);
      const display = alias || name;
      const anchor = path ? `${path}/${name}` : name;
      return `[${display}](#${encodeURIComponent(anchor)})`;
    },
  );

  const html = marked.parse(processed, { async: false }) as string;

  // 给 wikilink 锚点加 class
  return html.replace(
    /<a href="#([^"]+)">/g,
    '<a href="#$1" class="ag-link">',
  );
}

/** 估算阅读时间（分钟） */
export function estimateReadingMinutes(text: string): number {
  // 中文约 300 字/分钟，英文约 200 词/分钟
  const chars = text.replace(/\s/g, '').length;
  return Math.max(1, Math.ceil(chars / 300));
}
