import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecordStore, useAdventureStore } from '../store';
import { getPlace, getContent } from '../data/worldData';
import type { RecordKind } from '../types';

const KIND_LABEL: Record<RecordKind, { label: string; icon: string; color: string }> = {
  note: { label: '笔记', icon: '📒', color: 'rgba(96,165,250,0.15)' },
  thought: { label: '个人理解', icon: '💭', color: 'rgba(168,85,247,0.15)' },
  favorite: { label: '收藏', icon: '❤', color: 'rgba(244,63,94,0.12)' },
  wishlist: { label: '想去', icon: '✈️', color: 'rgba(16,185,129,0.12)' },
};

export default function RecordsPage() {
  const { records, deleteRecord, updateRecord } = useRecordStore();
  const adventures = useAdventureStore((s) => s.adventures);

  const [kind, setKind] = useState<RecordKind | 'all'>('all');
  const [scope, setScope] = useState<'all' | 'place' | 'content' | 'adventure'>('all');

  const filtered = useMemo(() => {
    return records
      .filter((r) => (kind === 'all' ? true : r.kind === kind))
      .filter((r) =>
        scope === 'all'
          ? true
          : scope === 'place'
          ? !!r.placeId && !r.contentId
          : scope === 'content'
          ? !!r.contentId
          : scope === 'adventure'
          // re-review P1-2 修复：只要记录是在某 adventure 上下文中产生的（adventureId 非空）
          // 就计入"冒险相关"。不再附加 !r.placeId：
          // PlaceDetailPage 里从 Adventure 出发写的 note/thought/favorite 通常
          // 同时携带 adventureId + placeId，之前被误排除。
          ? !!r.adventureId
          : true
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [records, kind, scope]);

  // 统计面板
  const stats = useMemo(() => {
    const s = { total: records.length, notes: 0, thoughts: 0, favs: 0, wishes: 0, places: new Set<string>() };
    for (const r of records) {
      if (r.kind === 'note') s.notes++;
      if (r.kind === 'thought') s.thoughts++;
      if (r.kind === 'favorite') s.favs++;
      if (r.kind === 'wishlist') s.wishes++;
      if (r.placeId) s.places.add(r.placeId);
    }
    return s;
  }, [records]);

  return (
    <div className="stack-lg">
      <div>
        <div className="badge" style={{ marginBottom: '0.6rem' }}>📓 My Records</div>
        <h1 style={{ marginBottom: '0.3rem' }}>我的记录</h1>
        <p>记录属于你，而不是某个页面。所有的笔记、收藏、想去、感悟都集中在这里。</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-4">
        <Stat label="记录总数" value={stats.total} icon="📚" />
        <Stat label="笔记 / 理解" value={stats.notes + stats.thoughts} icon="📝" />
        <Stat label="收藏" value={stats.favs} icon="❤" />
        <Stat label="想去清单" value={stats.wishes} icon="✈️" />
      </div>

      {/* 筛选 */}
      <section className="card stack">
        <div>
          <div className="label">记录类型</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['all', 'note', 'thought', 'favorite', 'wishlist'] as const).map((k) => (
              <FilterChip
                key={k}
                active={kind === k}
                onClick={() => setKind(k)}
              >
                {k === 'all' ? '全部' : KIND_LABEL[k].icon + ' ' + KIND_LABEL[k].label}
              </FilterChip>
            ))}
          </div>
        </div>
        <div>
          <div className="label">关联范围</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {([
              ['all', '全部'],
              ['place', '地点关联'],
              ['content', '内容关联'],
              ['adventure', '冒险关联'],
            ] as const).map(([v, label]) => (
              <FilterChip
                key={v}
                active={scope === v}
                onClick={() => setScope(v as any)}
              >
                {label}
              </FilterChip>
            ))}
          </div>
        </div>
      </section>

      {/* 列表 */}
      <section className="card">
        <div className="section-title">
          <h2 style={{ fontSize: '1.3rem' }}>共 {filtered.length} 条记录</h2>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            还没有记录。进入某个地点详情页，记录下你的第一个想法吧。
            <div style={{ marginTop: 12 }}>
              <Link to="/" className="btn btn-primary">去首页探索</Link>
            </div>
          </div>
        ) : (
          <div className="stack">
            {filtered.map((r) => {
              const place = r.placeId ? getPlace(r.placeId) : undefined;
              const content = r.contentId ? getContent(r.contentId) : undefined;
              const adventure = r.adventureId
                ? adventures.find((a) => a.id === r.adventureId)
                : undefined;
              const meta = KIND_LABEL[r.kind];
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '1rem 1.1rem',
                    borderRadius: 'var(--radius-sm)',
                    background: meta.color,
                    border: '1px solid var(--line)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="badge">{meta.icon} {meta.label}</span>
                      {r.kind === 'note' || r.kind === 'thought' ? (
                        r.rating && (
                          <span style={{ color: '#c68a1e', fontSize: '0.85rem' }}>
                            {'★'.repeat(r.rating)}
                          </span>
                        )
                      ) : null}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-mute)' }}>
                      {new Date(r.updatedAt).toLocaleString('zh-CN')}
                    </div>
                  </div>

                  {r.text && (
                    <div style={{ color: 'var(--ink-soft)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 8 }}>
                      {r.text}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {place && (
                      <Link to={`/places/${place.id}`} className="badge badge-soft" style={{ fontSize: '0.78rem' }}>
                        📍 {place.name}
                      </Link>
                    )}
                    {content && (
                      <Link
                        to={place ? `/places/${place.id}` : '#'}
                        className="badge badge-soft"
                        style={{ fontSize: '0.78rem' }}
                        title={content.body}
                      >
                        📄 内容：{content.title.length > 18 ? content.title.slice(0, 18) + '…' : content.title}
                      </Link>
                    )}
                    {adventure && (
                      <Link to={`/adventures/${adventure.id}`} className="badge badge-soft" style={{ fontSize: '0.78rem' }}>
                        🧭 冒险：{adventure.title.length > 14 ? adventure.title.slice(0, 14) + '…' : adventure.title}
                      </Link>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                      {r.kind === 'note' || r.kind === 'thought' ? (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}
                          onClick={() => {
                            const t = prompt('编辑记录', r.text);
                            if (t !== null) updateRecord(r.id, { text: t });
                          }}
                        >
                          编辑
                        </button>
                      ) : null}
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}
                        onClick={() => {
                          if (confirm('删除该条记录？')) deleteRecord(r.id);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="card" style={{ padding: '1rem 1.1rem' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.1rem', fontWeight: 600, color: 'var(--accent-2)' }}>
          {value}
        </div>
        <div style={{ fontSize: '1.6rem', opacity: 0.7 }}>{icon}</div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="btn"
      style={{
        padding: '0.35rem 0.9rem',
        fontSize: '0.85rem',
        background: active ? 'var(--accent)' : 'var(--bg-elev)',
        color: active ? '#fff7ec' : 'var(--ink)',
        borderColor: active ? 'transparent' : 'var(--line)',
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  );
}
