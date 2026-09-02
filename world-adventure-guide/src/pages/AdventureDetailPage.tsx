import { useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AdventureMap from '../components/AdventureMap';
import { useAdventureStore } from '../store';
import { getPlace, getRoute, getContentsByPlace, ROUTES } from '../data/worldData';
import { useRecordStore } from '../store';
import type { Place, Route } from '../types';

/**
 * 冒险详情页
 * - 顶部：地图 + 当前位置
 * - 左侧：冒险信息 / 进度 / 路线亮点
 * - 右侧：时间线式的地点序列
 */
export default function AdventureDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { adventures, setCurrentStep, deleteAdventure } = useAdventureStore();
  const adventure = adventures.find((a) => a.id === id);

  const getRecordsBy = useRecordStore((s) => s.getRecordsBy);

  const places: Place[] = useMemo(
    () =>
      adventure
        ? adventure.placeIds
            .map((pid) => getPlace(pid))
            .filter((p): p is Place => !!p)
        : [],
    [adventure]
  );
  const routes: Route[] = useMemo(
    () =>
      adventure
        ? adventure.routeIds
            .map((rid) => getRoute(rid))
            .filter((r): r is Route => !!r)
        : [],
    [adventure]
  );

  if (!adventure) {
    return (
      <div className="card-paper" style={{ textAlign: 'center' }}>
        <h1>冒险不存在</h1>
        <p>可能已被删除，或链接有误。</p>
        <Link to="/adventures" className="btn btn-primary">返回冒险列表</Link>
      </div>
    );
  }

  const total = places.length;
  const step = Math.max(0, Math.min(total - 1, adventure.currentStep));
  const currentPlace = places[step];
  const currentRoute =
    step > 0 ? routes.find((r) => r && (r.toPlaceId === currentPlace?.id || r.fromPlaceId === currentPlace?.id)) : undefined;
  const totalRecordsHere = currentPlace
    ? getRecordsBy({ placeId: currentPlace.id, adventureId: adventure.id }).length
    : 0;

  const gotoNext = () => setCurrentStep(adventure.id, step + 1);
  const gotoPrev = () => setCurrentStep(adventure.id, step - 1);

  return (
    <div className="stack-lg">
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="badge">🧭 Adventure</span>
            {adventure.theme && <span className="badge badge-soft">{adventure.theme}</span>}
          </div>
          <h1 style={{ marginTop: '0.6rem', marginBottom: '0.2rem' }}>{adventure.title}</h1>
          {adventure.coverNote && <p style={{ maxWidth: 720 }}>{adventure.coverNote}</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link to="/adventures" className="btn">← 所有冒险</Link>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm(`确定要删除冒险「${adventure.title}」吗？`)) {
                deleteAdventure(adventure.id);
                navigate('/adventures');
              }
            }}
          >
            删除
          </button>
        </div>
      </div>

      {/* 大地图 */}
      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.2rem 0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>
              路线全景 · 第 {step + 1} / {total} 站：{currentPlace?.name}
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--ink-mute)', marginTop: 4 }}>
              {adventure.placeIds.map((pid, i) => (
                <span key={pid}>
                  {i > 0 && (
                    <span style={{ color: i <= step ? 'var(--accent-2)' : 'var(--ink-mute)' }}> → </span>
                  )}
                  <span
                    style={{
                      color: i === step ? 'var(--accent-2)' : i < step ? 'var(--success)' : 'var(--ink-mute)',
                      fontWeight: i === step ? 600 : 400,
                    }}
                  >
                    {getPlace(pid)?.name}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '0 1.2rem 1.2rem' }}>
          <AdventureMap adventure={adventure} height={420} adventureIdForLink={adventure.id} />
        </div>
      </section>

      <div className="grid grid-2" style={{ gridTemplateColumns: '1fr 1.6fr' }}>
        {/* 当前站卡片 */}
        <section className="card stack">
          <div className="badge">📍 当前位置</div>
          {currentPlace ? (
            <>
              <h2 style={{ margin: 0 }}>{currentPlace.name}</h2>
              {currentPlace.localName && (
                <div style={{ color: 'var(--ink-mute)', fontSize: '0.9rem' }}>{currentPlace.localName}</div>
              )}
              <p>{currentPlace.summary}</p>
              <div className="chip-row">
                {currentPlace.tags.map((t) => (
                  <span key={t} className="badge badge-soft">#{t}</span>
                ))}
                <span className="badge">
                  {getContentsByPlace(currentPlace.id).length} 条内容
                </span>
                {totalRecordsHere > 0 && (
                  <span className="badge" style={{ background: 'rgba(92,123,60,0.12)', color: 'var(--success)', borderColor: 'rgba(92,123,60,0.25)' }}>
                    我的 {totalRecordsHere} 条记录
                  </span>
                )}
              </div>

              <Link
                to={`/adventures/${adventure.id}/places/${currentPlace.id}`}
                className="btn btn-primary"
                style={{ marginTop: '0.4rem' }}
              >
                🔍 深入探索 {currentPlace.name}
              </Link>

              {/* 上一段路线亮点 */}
              {currentRoute && (
                <div>
                  <h4>🎒 旅途见闻 · 上一段路线</h4>
                  <ul style={{ paddingLeft: '1.2rem', margin: '0.3rem 0 0' }}>
                    {currentRoute.highlights.map((h, i) => (
                      <li key={i} style={{ marginBottom: 4, color: 'var(--ink-soft)' }}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p>当前没有地点。</p>
          )}

          {/* 前进后退按钮 */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button className="btn" onClick={gotoPrev} disabled={step === 0}>
              ← 上一站
            </button>
            <button className="btn btn-primary" onClick={gotoNext} disabled={step === total - 1}>
              下一站 →
            </button>
          </div>
        </section>

        {/* 时间线 / 地点序列 */}
        <section className="card">
          <div className="section-title">
            <h2 style={{ fontSize: '1.3rem' }}>冒险时间线 Timeline</h2>
            <span className="badge badge-soft">点击任一站直接前往</span>
          </div>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, position: 'relative' }}>
            {places.map((p, i) => {
              const incomingRoute =
                i > 0
                  ? ROUTES.find(
                      (r) =>
                        (r.fromPlaceId === places[i - 1].id && r.toPlaceId === p.id) ||
                        (r.toPlaceId === places[i - 1].id && r.fromPlaceId === p.id)
                    )
                  : undefined;
              const state = i < step ? 'visited' : i === step ? 'current' : 'future';
              const recs = getRecordsBy({ placeId: p.id, adventureId: adventure.id });
              return (
                <li
                  key={p.id}
                  style={{
                    position: 'relative',
                    padding: '0 0 1.2rem 2.2rem',
                    marginLeft: 12,
                    borderLeft: i < places.length - 1 ? '2px solid var(--line)' : 'none',
                  }}
                >
                  {/* 时间线上的点 */}
                  <span
                    style={{
                      position: 'absolute',
                      left: -9,
                      top: 4,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background:
                        state === 'current'
                          ? 'var(--accent)'
                          : state === 'visited'
                          ? 'var(--success)'
                          : 'transparent',
                      border:
                        state === 'future'
                          ? '2px solid var(--ink-mute)'
                          : `2px solid ${
                              state === 'current' ? 'var(--accent-2)' : 'var(--success)'
                            }`,
                      boxShadow:
                        state === 'current' ? '0 0 0 4px rgba(168,98,43,0.2)' : 'none',
                    }}
                  />
                  {/* 上一段路线亮点 */}
                  {incomingRoute && (
                    <div
                      style={{
                        padding: '0.4rem 0.6rem',
                        marginBottom: '0.5rem',
                        borderRadius: 8,
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--line)',
                        fontSize: '0.82rem',
                        color: 'var(--ink-mute)',
                      }}
                    >
                      ✦ {incomingRoute.highlights[0]}
                    </div>
                  )}
                  <button
                    onClick={() => setCurrentStep(adventure.id, i)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.7rem 0.9rem',
                      borderRadius: 'var(--radius-sm)',
                      background:
                        state === 'current' ? 'rgba(168,98,43,0.1)' : 'transparent',
                      border:
                        state === 'current'
                          ? '1px solid rgba(168,98,43,0.4)'
                          : '1px solid var(--line)',
                      transition: 'all 0.15s',
                      display: 'block',
                    }}
                    onMouseEnter={(e) => {
                      if (state !== 'current') {
                        e.currentTarget.style.background = 'var(--bg-elev)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (state !== 'current') {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>
                          第 {i + 1} 站 · {p.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)', marginTop: 2 }}>
                          {p.country} · {p.type === 'city' ? '城市' : p.type}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {state === 'visited' && <span className="badge" style={{ background: 'rgba(92,123,60,0.12)', color: 'var(--success)', borderColor: 'rgba(92,123,60,0.25)' }}>已到</span>}
                        {state === 'current' && <span className="badge">在这里</span>}
                        {state === 'future' && <span className="badge badge-soft">未到</span>}
                        {recs.length > 0 && (
                          <span className="badge badge-soft">📝 {recs.length}</span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: '0.4rem',
                        fontSize: '0.88rem',
                        color: 'var(--ink-soft)',
                      }}
                    >
                      {p.summary.length > 80 ? p.summary.slice(0, 80) + '…' : p.summary}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
