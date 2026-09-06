/**
 * Adventure Guide CLI — Hexo-style commands
 *
 *   ag generate | g     构建静态网站      [-w] [-d] [-v] [-c]
 *   ag server   | s     本地预览服务      [-p] [-w] [--no-build] [-o]
 *   ag clean    | cl    清理输出目录      [-c]
 *   ag new      | n     创建新页面        <title> [-c] [-t]
 *   ag init     [folder]  初始化项目     [-v] [-o] [-f]
 */

import { Command } from 'commander';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import chalk from 'chalk';
import { Builder } from '../core/builder';
import { createDefaultRegistry } from '../registry';
import type { AGConfig } from '../types';

const program = new Command();

program
  .name('ag')
  .description('Adventure Guide — Static World Exploration Site Generator')
  .version('0.1.0');

// ── 共用：构建 ────────────────────────────────────────────

async function runBuild(config: AGConfig, options: { dryRun?: boolean; verbose?: boolean }): Promise<void> {
  const registry = createDefaultRegistry();
  const builder = new Builder(registry, config);
  const stats = await builder.build({ dryRun: options.dryRun, verbose: options.verbose });

  if (!options.dryRun) {
    console.log(chalk.green('✓ 构建完成。'));
    console.log();
    console.log(chalk.cyan('  概要：'));
    console.log(chalk.gray(`    世界:   ${stats.worlds}`));
    console.log(chalk.gray(`    地点:   ${stats.places}`));
    console.log(chalk.gray(`    路线:   ${stats.routes}`));
    console.log(chalk.gray(`    内容:   ${stats.contents}`));
    console.log(chalk.gray(`    冒险:   ${stats.adventures}`));
    console.log(chalk.gray(`    反向引用: ${stats.backlinks}`));
    console.log(chalk.gray(`    输出文件: ${stats.outputFiles}`));
  }
}

// ── 共用：watch ────────────────────────────────────────────

function startWatch(config: AGConfig, onRebuild: () => void): void {
  const watchPaths = [
    path.join(config.vaultPath, 'worlds'),
    path.join(config.vaultPath, 'places'),
    path.join(config.vaultPath, 'routes'),
    path.join(config.vaultPath, 'content'),
    path.join(config.vaultPath, 'adventures'),
  ].filter((p) => fs.existsSync(p));

  if (watchPaths.length === 0) {
    console.log(chalk.yellow('⚠  没有可监听的目录。'));
    return;
  }

  let debounceTimer: NodeJS.Timeout | null = null;
  const triggerRebuild = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(chalk.cyan('\n⚙  检测到变更 — 重新构建...'));
      onRebuild();
    }, 300);
  };

  const isWatchable = (name: string) => {
    const ext = path.extname(name).toLowerCase();
    return ext === '.md' || ext === '.png' || ext === '.jpg' || ext === '.svg';
  };

  // 轮询 fallback：当 fs.watch 不可用时（如某些网络文件系统），
  // 通过定期比对 mtime 真正实现变更检测。
  const startPolling = (watchPath: string) => {
    const mtimes = new Map<string, number>();
    const scan = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
          continue;
        }
        if (!isWatchable(entry.name)) continue;
        try {
          const mtime = fs.statSync(full).mtimeMs;
          if (mtimes.has(full) && mtimes.get(full) !== mtime) {
            triggerRebuild();
          }
          mtimes.set(full, mtime);
        } catch {
          /* 忽略瞬时不可访问的文件 */
        }
      }
    };
    scan(watchPath); // 初始基线
    setInterval(() => scan(watchPath), 1000);
  };

  for (const watchPath of watchPaths) {
    try {
      fs.watch(watchPath, { recursive: true }, (_eventType, filename) => {
        if (!filename || !isWatchable(filename)) return;
        triggerRebuild();
      });
      console.log(chalk.gray(`   监听: ${watchPath}`));
    } catch {
      console.log(chalk.gray(`   轮询: ${watchPath} (fs.watch 不可用，每秒比对 mtime)`));
      startPolling(watchPath);
    }
  }
}

// ── 共用：静态服务器 ───────────────────────────────────────

function startServer(
  root: string,
  port: number,
  config: AGConfig,
  opts: { watch: boolean; open?: boolean; label: string; server?: http.Server },
): void {
  const server = opts.server || createStaticServer(root);
  const explicitPort = process.argv.includes('-p') || process.argv.includes('--port');

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      if (explicitPort) {
        console.error(chalk.red(`✗ 端口 ${port} 已被占用。`));
        process.exit(1);
      } else {
        const nextPort = port + 1;
        console.log(chalk.yellow(`⚠  端口 ${port} 被占用，尝试 ${nextPort}...`));
        startServer(root, nextPort, config, { ...opts, server });
      }
    } else {
      console.error(chalk.red('✗ 服务器错误:'), err.message);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log();
    console.log(chalk.cyan(`⚙  Adventure Guide — ${opts.label}`));
    console.log(chalk.green(`✓ 服务地址: ${url}`));
    console.log(chalk.gray('  按 Ctrl+C 停止。'));

    if (opts.open) openBrowser(url);

    if (opts.watch) {
      console.log();
      console.log(chalk.cyan('👁  Watch 模式 — 文件变更将自动重建。'));
      startWatch(config, async () => {
        try {
          await runBuild(config, {});
          console.log(chalk.green(`✓ 已重建。刷新浏览器查看。`));
        } catch (err: any) {
          console.error(chalk.red('✗ 重建失败:'), err.message);
        }
      });
    }
  });
}

function openBrowser(url: string): void {
  const platform = os.platform();
  let cmd: string;
  if (platform === 'win32') cmd = `start "" "${url}"`;
  else if (platform === 'darwin') cmd = `open "${url}"`;
  else cmd = `xdg-open "${url}"`;
  exec(cmd, () => {});
}

// ══════════════════════════════════════════════════════════════
// ag generate | g
// ══════════════════════════════════════════════════════════════

function makeGenerateCommand(name: string, alias: string) {
  return program
    .command(name)
    .alias(alias)
    .description('从 Obsidian Vault 构建静态网站')
    .option('-w, --watch', '监听文件变更并自动重建')
    .option('-d, --dry-run', '仅解析，不生成输出')
    .option('-v, --verbose', '详细输出')
    .option('-c, --config <path>', '配置文件路径', 'config.json')
    .action(async (opts: { watch?: boolean; dryRun?: boolean; verbose?: boolean; config: string }) => {
      try {
        const config = loadConfig(opts.config);
        console.log(chalk.cyan('⚙  Adventure Guide — Generate'));
        console.log(chalk.gray(`   Vault:  ${config.vaultPath}`));
        console.log(chalk.gray(`   输出:   ${config.outputPath}`));
        console.log();

        await runBuild(config, { dryRun: opts.dryRun, verbose: opts.verbose });

        if (opts.watch && !opts.dryRun) {
          console.log();
          console.log(chalk.cyan('👁  Watch 模式已启用。按 Ctrl+C 停止。'));
          startWatch(config, async () => {
            try {
              await runBuild(config, { verbose: opts.verbose });
            } catch (err: any) {
              console.error(chalk.red('✗ 重建失败:'), err.message);
            }
          });
        }
      } catch (err: any) {
        console.error(chalk.red('✗ 构建失败:'), err.message);
        process.exit(1);
      }
    });
}

makeGenerateCommand('generate', 'g');
makeGenerateCommand('build', 'b');

// ══════════════════════════════════════════════════════════════
// ag server | s
// ══════════════════════════════════════════════════════════════

program
  .command('server')
  .alias('s')
  .description('本地预览（先自动构建，再启动服务）')
  .option('-p, --port <number>', '端口号', '4173')
  .option('-c, --config <path>', '配置文件路径', 'config.json')
  .option('--no-build', '跳过初始构建（使用已有 dist/）')
  .option('-w, --watch', '监听文件变更并重建', true)
  .option('-o, --open', '自动打开浏览器')
  .action(async (opts: { port: string; config: string; build: boolean; watch: boolean; open?: boolean }) => {
    const config = loadConfig(opts.config);
    const port = parseInt(opts.port, 10);
    const root = path.resolve(config.outputPath);

    if (opts.build) {
      console.log(chalk.cyan('⚙  Adventure Guide — 预览前自动构建'));
      console.log();
      try {
        await runBuild(config, {});
        console.log();
      } catch (err: any) {
        console.error(chalk.red('✗ 构建失败:'), err.message);
        if (!fs.existsSync(root)) process.exit(1);
        console.log(chalk.yellow('⚠  构建失败，改为预览已有的 dist/。'));
      }
    }

    if (!fs.existsSync(root)) {
      console.error(chalk.red(`✗ 输出目录不存在: ${root}`));
      console.error(chalk.gray('  先运行 `ag g`，或去掉 --no-build 参数。'));
      process.exit(1);
    }

    startServer(root, port, config, {
      watch: opts.watch,
      open: opts.open,
      label: 'Server',
    });
  });

// ══════════════════════════════════════════════════════════════
// ag clean | cl
// ══════════════════════════════════════════════════════════════

program
  .command('clean')
  .alias('cl')
  .description('清理输出目录')
  .option('-c, --config <path>', '配置文件路径', 'config.json')
  .action((opts: { config: string }) => {
    const config = loadConfig(opts.config);
    const outputDir = path.resolve(config.outputPath);
    if (!fs.existsSync(outputDir)) {
      console.log(chalk.gray('✓ 输出目录不存在，无需清理。'));
      return;
    }
    console.log(chalk.cyan('⚙  Adventure Guide — Clean'));
    console.log(chalk.gray(`   删除: ${outputDir}`));
    fs.rmSync(outputDir, { recursive: true, force: true });
    console.log(chalk.green('✓ 已清理。'));
    console.log(chalk.gray('  运行 `ag g` 重新构建。'));
  });

// ══════════════════════════════════════════════════════════════
// ag new | n
// ══════════════════════════════════════════════════════════════

program
  .command('new <title>')
  .alias('n')
  .description('在 Vault 中创建新页面')
  .option('-c, --config <path>', '配置文件路径', 'config.json')
  .option('-t, --type <type>', '页面类型: place / content / route / adventure / world', 'place')
  .action((title: string, opts: { config: string; type: string }) => {
    const config = loadConfig(opts.config);
    const type = opts.type;
    const typeDir = type === 'world' ? 'worlds' : type === 'adventure' ? 'adventures' : `${type}s`;
    const dir = path.join(config.vaultPath, typeDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const slug = title.toLowerCase().replace(/\s+/g, '-');
    const filePath = path.join(dir, `${slug}.md`);
    if (fs.existsSync(filePath)) {
      console.error(chalk.red(`✗ 页面已存在: ${filePath}`));
      process.exit(1);
    }

    const template = getTemplate(type, title, slug);
    fs.writeFileSync(filePath, template, 'utf-8');
    console.log(chalk.green('✓ 已创建。'));
    console.log(chalk.gray(`   ${filePath}`));
    console.log();
    console.log(chalk.gray('  运行 `ag g` 重建，或 `ag s` 预览。'));
  });

function getTemplate(type: string, title: string, slug: string): string {
  switch (type) {
    case 'place':
      return `---
type: place
id: ${slug}
world: earth-present
name: ${title}
place_type: city
lat: 0
lng: 0
country: 
tags: []
---

# ${title}

${title} 的简介写在这里。

## 历史

参考 [[相关内容]] 了解更多。
`;
    case 'content':
      return `---
type: content
id: ${slug}
kind: article
title: ${title}
place: 
world: earth-present
tags: []
---

# ${title}

正文写在这里。使用 [[地点名]] 链接到地点。
`;
    case 'route':
      return `---
type: route
id: ${slug}
world: earth-present
from: 
to: 
distance: 
highlights: []
---

# ${title}

路线说明写在这里。
`;
    case 'adventure':
      return `---
type: adventure
id: ${slug}
world: earth-present
title: ${title}
theme: 
places: 
routes: 
cover_note: 
---

# ${title}

冒险简介写在这里。
`;
    case 'world':
      return `---
type: world
id: ${slug}
name: ${title}
kind: real
time_anchor: present
description: ${title} 的描述。
---

# ${title}

世界说明写在这里。
`;
    default:
      return `# ${title}\n`;
  }
}

// ══════════════════════════════════════════════════════════════
// ag init
// ══════════════════════════════════════════════════════════════

program
  .command('init [folder]')
  .description('初始化一个新的 Adventure Guide 项目')
  .option('-v, --vault <path>', 'Vault 目录路径', './vault')
  .option('-o, --output <path>', '输出目录路径', './dist')
  .option('-f, --force', '覆盖已有文件')
  .action((folder: string | null, opts: { vault: string; output: string; force?: boolean }) => {
    const targetDir = folder ? path.resolve(folder) : process.cwd();
    if (folder && !fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    console.log(chalk.cyan('⚙  Adventure Guide — Init'));
    console.log(chalk.gray(`   目标: ${targetDir}`));
    console.log();

    const force = opts.force || false;
    const vaultDir = path.resolve(targetDir, opts.vault);
    const outputDir = path.resolve(targetDir, opts.output);

    // 1. 目录结构
    const dirs = ['worlds', 'places', 'routes', 'content', 'adventures'].map((d) =>
      path.join(vaultDir, d),
    );
    for (const d of dirs) {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
        console.log(chalk.gray(`   ${path.relative(targetDir, d)}/`));
      }
    }

    // 2. config.json
    const configPath = path.join(targetDir, 'config.json');
    if (fs.existsSync(configPath) && !force) {
      console.log(chalk.yellow('   config.json (已存在，跳过)'));
    } else {
      const config = {
        vaultPath: opts.vault,
        outputPath: opts.output,
        storage: 'local',
        theme: 'default',
        site: {
          title: '世界冒险指南',
          subtitle: '通过一次冒险，认识一个原本不了解的世界',
          base: '/',
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      console.log(chalk.green('   config.json ✓'));
    }

    // 3. .gitignore
    const gitignorePath = path.join(targetDir, '.gitignore');
    if (!fs.existsSync(gitignorePath) || force) {
      fs.writeFileSync(gitignorePath, 'node_modules/\nlib/\ndist/\n.DS_Store\nThumbs.db\n', 'utf-8');
      console.log(chalk.green('   .gitignore ✓'));
    }

    console.log();
    console.log(chalk.green('✓ 项目已创建。'));
    console.log();
    console.log(chalk.gray('  下一步：'));
    console.log(chalk.gray('    1. 在 vault/ 下创建 Markdown 文件'));
    console.log(chalk.cyan('    2. ag g') + chalk.gray(' 构建'));
    console.log(chalk.cyan('    3. ag s') + chalk.gray(' 预览'));
  });

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function createStaticServer(root: string): http.Server {
  return http.createServer((req, res) => {
    let urlPath = req.url || '/';
    const qIdx = urlPath.indexOf('?');
    if (qIdx >= 0) urlPath = urlPath.slice(0, qIdx);
    try { urlPath = decodeURIComponent(urlPath); } catch { /* keep */ }
    if (urlPath === '/') urlPath = '/index.html';

    let filePath = path.join(root, urlPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!filePath.startsWith(root)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (!fs.existsSync(filePath)) {
      const htmlPath = filePath + '.html';
      if (fs.existsSync(htmlPath)) {
        filePath = htmlPath;
      } else {
        res.writeHead(404); res.end('Not found'); return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function loadConfig(configPath: string): AGConfig {
  const fullPath = path.resolve(configPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`配置文件不存在: ${fullPath}`);
  }
  const raw = fs.readFileSync(fullPath, 'utf-8');
  const config = JSON.parse(raw) as AGConfig;
  config.vaultPath = path.resolve(path.dirname(fullPath), config.vaultPath);
  config.outputPath = path.resolve(path.dirname(fullPath), config.outputPath);
  return config;
}

// ══════════════════════════════════════════════════════════════

program.parse(process.argv);
