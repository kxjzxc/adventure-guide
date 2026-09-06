/**
 * Markdown 渲染工具 — 基于 marked，处理 [[wikilink]] 与图片。
 */

import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true,
});

/** 从文本中提取 [[wikilink]] 引用的条目名（排除图片嵌入 ![[...]]） */
export function extractWikilinks(text: string): string[] {
  const links = new Set<string>();
  const regex = /(?<!!)\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    // 取 |alias 之前的部分
    const name = m[1].split('|')[0].trim();
    if (name) links.add(name);
  }
  return Array.from(links);
}

/**
 * 将 Markdown 渲染为 HTML：
 * 1. ![[image.png]] 嵌入 → <img>
 * 2. [[Page Name]] → <a href="#Page Name" class="ag-link">（Renderer 阶段再解析为真实路径）
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

  // [[Page Name|alias]] → [alias](#Page Name)
  processed = processed.replace(
    /\[\[([^\]|]+)\|([^\]]+)\]\]/g,
    (_, name: string, alias: string) =>
      `[${alias.trim()}](#${encodeURIComponent(name.trim())})`,
  );

  // [[Page Name]] → [Page Name](#Page Name)
  processed = processed.replace(
    /\[\[([^\]]+)\]\]/g,
    (_, name: string) =>
      `[${name.trim()}](#${encodeURIComponent(name.trim())})`,
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
