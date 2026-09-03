import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdventureMap from '../components/AdventureMap';
import { getPlace, getContentsByPlace } from '../data/worldData';
import { useAdventureStore, useRecordStore } from '../store';
import type { ContentKind, RecordKind } from '../types';

const KIND_META: Record<ContentKind, { label: string; icon: string }> = {
  article: { label: '文章', icon: '📖' },
  history: { label: '历史', icon: '🏛️' },
  geography: { label: '地理', icon: '🏔️' },
  culture: { label: '文化', icon: '🎭' },
  food: { label: '美食', icon: '🍜' },
  people: { label: '人物', icon: '👤' },
  architecture: { label: '建筑', icon: '🏗️' },
  image: { label: '图集', icon: '🖼️' },
};

interface Props {
  /** 是否处于「在冒险下查看地点」的上下文 */
  inAdventure?: boolean;
}

export default function PlaceDetailPage({ inAdventure = false }: Props) {
  const { placeId, adventureId } = useParams();

  const place = getPlace(placeId ?? '');
  const allContents = useMemo(
    () => (place ? getContentsByPlace(place.id) : []),
    [place]
  );
  const contents = allContents;

  const [kindFilter, setKindFilter] = useState<ContentKind | 'all'>('all');
  const filtered = kindFilter === 'all' ? contents : contents.filter((c) => c.kind === kindFilter);

  // 记录面板
  const worldId = 'earth-present';
  const {
    records: allRecords,
    addRecord,
    deleteRecord,
    toggleFavorite,
    isFavorited,
  } = useRecordStore();
  const relatedRecords = allRecords.filter(
    (r) =>
      (r.placeId === place?.id || r.contentId) &&
      (!adventureId || r.adventureId === adventureId)
  );

  const notes = relatedRecords.filter((r) => r.kind === 'note' || r.kind === 'thought');
  const wishlist = relatedRecords.filter((r) => r.kind === 'wishlist');

  const [newNote, setNewNote] = useState('');
  const [wishText, setWishText] = useState('想去一次');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [activeKind, setActiveKind] = useState<RecordKind>('note');

  const adventures = useAdventureStore((s) => s.adventures);
  const containingAdventures = adventures.filter((a) => place && a.placeIds.includes(place.id));

  if (!place) {
    return (
      <div className="card-paper" style={{ textAlign: 'center' }}>
        <h1>地点不存在</h1>
        <p>无法找到这个地点。</p>
        <Link to="/" className="btn btn-primary">返回首页</Link>
      </div>
    );
  }

  const placeFav = isFavorited({ placeId: place.id, worldId });

  const submitRecord = () => {
    if (activeKind === 'favorite') return;
    if (activeKind === 'wishlist') {
      if (!wishText.trim()) return;
      addRecord({
        kind: 'wishlist',
        text: wishText.trim(),
        worldId,
        placeId: place.id,
        adventureId,
      });
      setWishText('想去一次');
      return;
    }
    if (!newNote.trim()) return;
    addRecord({
      kind: activeKind,
      text: newNote.trim(),
      worldId,
      placeId: place.id,
      adventureId,
      rating,
    });
    setNewNote('');
    setRating(undefined);
  };

  // 构造一个「仅包含当前地点的单步伪冒险」用于渲染小地图，避免无 route 时地图无法显示
  const miniAdventure = useMemo(() => {
    return {
      id: 'mini',
      worldId,
      title: place.name,
      placeIds: [place.id],
      routeIds: [] as string[],
      createdAt: 0,
      lastVisitedAt: 0,
      currentStep: 0,
    };
  }, [place, worldId]);

  const backLink = inAdventure && adventureId ? `/adventures/${adventureId}` : '/';

  return (
    <div className="stack-lg">
      <div>
        <Link to={backLink} className="btn btn-ghost" style={{ padding: 0, paddingBottom: 6 }}>
          ← 返回
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
          <div>
            <div className="chip-row">
              <span className="badge">📍 Place · {place.type === 'city' ? '城市' : place.type}</span>
              {place.country && <span className="badge badge-soft">{place.country}</span>}
              {placeFav && (
                <span
                  className="badge"
                  style={{ background: 'rgba(180,54,28,0.1)', color: 'var(--danger)', borderColor: 'rgba(180,54,28,0.25)' }}
                >
                  ❤ 已收藏
                </span>
              )}
            </div>
            <h1 style={{ marginTop: '0.6rem', marginBottom: '0.2rem' }}>{place.name}</h1>
            {place.localName && <div style={{ color: 'var(--ink-mute)' }}>{place.localName}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <button
              className={placeFav ? 'btn' : 'btn btn-primary'}
              onClick={() => toggleFavorite({ placeId: place.id, worldId, adventureId })}
            >
              {placeFav ? '❤ 已收藏 · 取消' : '🤍 收藏此地'}
            </button>
            {inAdventure && adventureId && (
              <Link to={`/adventures/${adventureId}`} className="btn">
                回到冒险路线
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 主信息卡：羊皮纸 */}
      <div className="grid grid-2" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <section className="card-paper">
          <h2 style={{ marginTop: 0 }}>关于 {place.name}</h2>
          <p style={{ fontSize: '1rem' }}>{place.summary}</p>
          <div className="chip-row">
            {place.tags.map((t) => (
              <span key={t} className="badge badge-soft">#{t}</span>
            ))}
          </div>
          <hr className="divider" style={{ borderTop: '1px dashed rgba(61,43,31,0.25)' }} />
          <div className="grid grid-2">
            <div>
              <h4 style={{ color: 'var(--ink)', marginTop: 0 }}>🌐 坐标</h4>
              <p style={{ margin: 0 }}>
                北纬 {place.coords.lat.toFixed(3)}°，东经 {place.coords.lng.toFixed(3)}°
              </p>
            </div>
            <div>
              <h4 style={{ color: 'var(--ink)', marginTop: 0 }}>⏳ 时间视角</h4>
              <p style={{ margin: 0 }}>
                MVP 默认：现在 · Present
                {place.timePerspectives && ` (可扩展: ${place.timePerspectives.join(', ')})`}
              </p>
            </div>
          </div>
          {containingAdventures.length > 0 && (
            <>
              <hr className="divider" style={{ borderTop: '1px dashed rgba(61,43,31,0.25)' }} />
              <div>
                <h4 style={{ color: 'var(--ink)', marginTop: 0 }}>包含此地的冒险</h4>
                <div className="stack">
                  {containingAdventures.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '0.5rem 0.7rem',
                        background: 'rgba(168,98,43,0.05)',
                        borderRadius: 8,
                        border: '1px solid rgba(61,43,31,0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: '0.9rem', color: 'var(--ink-soft)' }}>
                        {a.title}
                      </div>
                      <Link to={`/adventures/${a.id}`} className="btn btn-ghost" style={{ padding: '0.2rem 0.7rem', fontSize: '0.8rem' }}>
                        进入 →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <AdventureMap adventure={miniAdventure} height={280} />
          <div style={{ padding: '1rem 1.1rem' }}>
            <div className="stack">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0 }}>内容统计</h4>
                <span className="badge">{contents.length} 条内容</span>
              </div>
              <div className="grid grid-2">
                {Object.entries(
                  contents.reduce<Record<string, number>>((acc, c) => {
                    acc[c.kind] = (acc[c.kind] ?? 0) + 1;
                    return acc;
                  }, {})
                ).map(([k, v]) => (
                  <div key={k} style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-elev)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span className={`kind-${k}`}>
                      {KIND_META[k as ContentKind]?.icon} {KIND_META[k as ContentKind]?.label}
                    </span>
                    <span style={{ color: 'var(--ink-mute)' }}>× {v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 内容列表 + 记录 */}
      <div className="grid grid-2" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        {/* 左：内容 */}
        <section className="card stack">
          <div className="section-title" style={{ marginBottom: '0.2rem' }}>
            <h2 style={{ fontSize: '1.4rem' }}>📚 探索内容 Content</h2>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <KindButton active={kindFilter === 'all'} onClick={() => setKindFilter('all')}>
              全部（{contents.length}）
            </KindButton>
            {(Object.keys(KIND_META) as ContentKind[])
              .filter((k) => contents.some((c) => c.kind === k))
              .map((k) => {
                const count = contents.filter((c) => c.kind === k).length;
                return (
                  <KindButton key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
                    {KIND_META[k].icon} {KIND_META[k].label}（{count}）
                  </KindButton>
                );
              })}
          </div>

          {filtered.length === 0 ? (
            <div className="empty">该分类下暂无内容。</div>
          ) : (
            <div className="stack">
              {filtered.map((c) => {
                const contentFav = isFavorited({ contentId: c.id, placeId: place.id, worldId });
                const contentRecords = allRecords.filter(
                  (r) =>
                    r.contentId === c.id && (!adventureId || r.adventureId === adventureId)
                );
                return (
                  <article
                    key={c.id}
                    className="card-paper"
                    style={{
                      borderLeft: `3px solid ${
                        c.kind === 'history'
                          ? 'var(--accent)'
                          : c.kind === 'culture'
                          ? '#7a4c93'
                          : c.kind === 'geography'
                          ? 'var(--success)'
                          : c.kind === 'food'
                          ? '#b6426a'
                          : c.kind === 'architecture'
                          ? '#9a5b20'
                          : c.kind === 'people'
                          ? '#1e6e66'
                          : '#4a6fa5'
                      }`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <div>
                        <div className={`kind-${c.kind}`} style={{ fontSize: '0.78rem', marginBottom: 4, fontWeight: 600 }}>
                          {KIND_META[c.kind].icon} {KIND_META[c.kind].label}
                          {c.readingMinutes && ` · ${c.readingMinutes} 分钟阅读`}
                          {c.source && ` · ${c.source}`}
                        </div>
                        <h3 style={{ margin: 0 }}>{c.title}</h3>
                      </div>
                      <button
                        className={contentFav ? 'btn' : 'btn btn-ghost'}
                        onClick={() =>
                          toggleFavorite({ contentId: c.id, placeId: place.id, worldId, adventureId })
                        }
                        title="收藏此内容"
                      >
                        {contentFav ? '❤' : '🤍'}
                      </button>
                    </div>
                    <p style={{ marginTop: '0.5rem', lineHeight: 1.8 }}>{c.body}</p>
                    {(c.tags.length > 0 || contentRecords.length > 0) && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div className="chip-row">
                          {c.tags.map((t) => (
                            <span key={t} className="badge badge-soft" style={{ background: 'rgba(61,43,31,0.06)', color: 'var(--ink-soft)' }}>
                              #{t}
                            </span>
                          ))}
                        </div>
                        {contentRecords.length > 0 && (
                          <span className="badge badge-soft">📝 我的 {contentRecords.length} 条记录</span>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* 右：记录面板 */}
        <section className="card stack">
          <h2 style={{ fontSize: '1.4rem' }}>📝 我的记录 Record</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--ink-mute)' }}>
            记录属于你自己，而不是某个页面。
          </div>

          {/* Tab 类型 */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['note', 'thought', 'wishlist'] as RecordKind[]).map((k) => (
              <button
                key={k}
                className={activeKind === k ? 'btn btn-primary' : 'btn'}
                onClick={() => setActiveKind(k)}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                {k === 'note' ? '📒 笔记' : k === 'thought' ? '💭 个人理解' : '✈️ 想去'}
              </button>
            ))}
          </div>

          <div className="form-row">
            <textarea
              className="textarea"
              placeholder={
                activeKind === 'note'
                  ? '记录下你对这个地方的笔记…'
                  : activeKind === 'thought'
                  ? '写点个人的理解或感受…'
                  : '写下「为什么想去」或者「想做的事」…'
              }
              value={activeKind === 'wishlist' ? wishText : newNote}
              onChange={(e) => {
                if (activeKind === 'wishlist') setWishText(e.target.value);
                else setNewNote(e.target.value);
              }}
            />
          </div>

          {(activeKind === 'note' || activeKind === 'thought') && (
            <div className="form-row">
              <label className="label">个人评分（可选）</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? undefined : n)}
                    style={{
                      fontSize: '1.4rem',
                      color: rating && n <= rating ? '#c68a1e' : 'var(--ink-mute)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0 4px',
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={submitRecord}
            disabled={
              (activeKind !== 'wishlist' && !newNote.trim()) ||
              (activeKind === 'wishlist' && !wishText.trim())
            }
          >
            保存记录
          </button>

          <hr className="divider" />

          {/* 已有记录 */}
          <div className="stack">
            <h4>📒 笔记 / 理解（{notes.length}）</h4>
            {notes.length === 0 ? (
              <div className="empty" style={{ padding: '1rem 0', fontSize: '0.85rem' }}>
                暂无笔记。
              </div>
            ) : (
              notes.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: '0.8rem',
                    background: 'var(--bg-elev)',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'baseline', gap: 6 }}>
                    <span className="badge badge-soft">
                      {r.kind === 'thought' ? '💭 个人理解' : '📒 笔记'}
                    </span>
                    {r.rating && (
                      <span style={{ color: '#c68a1e', fontSize: '0.85rem' }}>
                        {'★'.repeat(r.rating)}
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--ink-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.text}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.75rem', color: 'var(--ink-mute)' }}>
                    <span>{new Date(r.updatedAt).toLocaleString('zh-CN')}</span>
                    <button className="btn btn-ghost" style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem' }} onClick={() => deleteRecord(r.id)}>删除</button>
                  </div>
                </div>
              ))
            )}

            <h4 style={{ marginTop: 8 }}>✈️ 想去清单（{wishlist.length}）</h4>
            {wishlist.length === 0 ? (
              <div className="empty" style={{ padding: '1rem 0', fontSize: '0.85rem' }}>
                还未加入想去清单。
              </div>
            ) : (
              wishlist.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: '0.8rem',
                    background: 'rgba(92,123,60,0.08)',
                    borderRadius: 8,
                    border: '1px solid rgba(92,123,60,0.25)',
                  }}
                >
                  <div style={{ color: 'var(--success)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    ✈️ {r.text}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.75rem', color: 'var(--ink-mute)' }}>
                    <span>{new Date(r.updatedAt).toLocaleString('zh-CN')}</span>
                    <button className="btn btn-ghost" style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem' }} onClick={() => deleteRecord(r.id)}>已完成/删除</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function KindButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="btn"
      style={{
        padding: '0.4rem 0.85rem',
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
