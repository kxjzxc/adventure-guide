import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PLACES, WORLDS, buildAdventurePath } from '../data/worldData';
import { useAdventureStore } from '../store';
import AdventureMap from '../components/AdventureMap';
import type { Adventure } from '../types';

export default function CreateAdventurePage() {
  const navigate = useNavigate();
  const createAdventure = useAdventureStore((s) => s.createAdventure);

  const [worldId, setWorldId] = useState(WORLDS[0].id);
  const [fromId, setFromId] = useState(PLACES[0].id);
  const [toId, setToId] = useState(PLACES[PLACES.length - 1].id);
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [coverNote, setCoverNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 临时 Adventure 结构用于预览地图
  const preview = useMemo<Adventure | undefined>(() => {
    const built = buildAdventurePath(fromId, toId);
    if (!built) return undefined;
    return {
      id: 'preview',
      worldId,
      title: '预览路线',
      theme,
      placeIds: built.placeIds,
      routeIds: built.routeIds,
      createdAt: 0,
      lastVisitedAt: 0,
      currentStep: 0,
      coverNote,
    };
  }, [fromId, toId, worldId, theme, coverNote]);

  const placeOptions = PLACES.map((p) => ({ value: p.id, label: `${p.name}（${p.country ?? '—'}）` }));

  const swap = () => {
    const a = fromId;
    setFromId(toId);
    setToId(a);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fromId === toId) {
      setError('起点和终点不能相同');
      return;
    }
    const resolvedTitle = title.trim()
      ? title.trim()
      : `${PLACES.find((p) => p.id === fromId)?.name} → ${PLACES.find((p) => p.id === toId)?.name} 的冒险`;
    const adv = createAdventure({
      title: resolvedTitle,
      theme: theme.trim() || undefined,
      worldId,
      fromPlaceId: fromId,
      toPlaceId: toId,
      coverNote: coverNote.trim() || undefined,
    });
    if (!adv) {
      setError('无法创建冒险：所选起点与终点之间不存在预设路线。');
      return;
    }
    navigate(`/adventures/${adv.id}`);
  };

  return (
    <div className="stack-lg">
      <div>
        <div className="badge" style={{ marginBottom: '0.6rem' }}>🧭 新建冒险</div>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.3rem' }}>选择起点与终点，创造属于你的路线。</h1>
        <p>冒险的意义不是模拟真实交通，而是为探索世界提供一条路径和过程。</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-2">
          {/* 左：表单 */}
          <section className="card">
            <h2 style={{ fontSize: '1.3rem' }}>冒险信息</h2>

            <div className="form-row">
              <label className="label">世界 World</label>
              <select
                className="select"
                value={worldId}
                onChange={(e) => setWorldId(e.target.value)}
              >
                {WORLDS.map((w) => (
                  <option key={w.id} value={w.id} disabled={w.kind !== 'real'}>
                    {w.name} {w.kind !== 'real' ? '（扩展内容）' : ''}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.78rem', color: 'var(--ink-mute)', marginTop: 4 }}>
                MVP 仅开放 «地球 × 当前时间»，历史 / 虚拟世界为后续扩展。
              </div>
            </div>

            <div className="form-row">
              <label className="label">冒险标题</label>
              <input
                className="input"
                placeholder="留空则自动根据起终点生成"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-row">
              <label className="label">主题</label>
              <input
                className="input"
                placeholder="如：美食之旅 / 铁路线 / 历史穿越"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              />
            </div>

            <div className="grid grid-2">
              <div className="form-row">
                <label className="label">起点</label>
                <select
                  className="select"
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                >
                  {placeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="label">终点</label>
                <select
                  className="select"
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                >
                  {placeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: -6, marginBottom: '1rem' }}>
              <button type="button" className="btn btn-ghost" onClick={swap}>
                ⇅ 交换起点与终点
              </button>
            </div>

            <div className="form-row">
              <label className="label">冒险笔记 / 封面语（可选）</label>
              <textarea
                className="textarea"
                placeholder="写下你对这次冒险的期待或介绍……"
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: '0.7rem 0.9rem',
                  borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fecaca',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={() => navigate('/')}
              >
                取消
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!preview}
              >
                🚀 创建并出发
              </button>
            </div>
          </section>

          {/* 右：预览 */}
          <section className="card">
            <div className="section-title">
              <h2 style={{ fontSize: '1.3rem' }}>路线预览</h2>
              {preview ? (
                <div className="badge">
                  {preview.placeIds.length} 个地点 · {preview.routeIds.length} 段路线
                </div>
              ) : null}
            </div>
            {preview ? (
              <div className="stack">
                <AdventureMap adventure={preview} height={380} />
                <div>
                  <h4>沿途地点</h4>
                  <ol style={{ padding: '0 0 0 1.2rem', margin: 0 }}>
                    {preview.placeIds.map((pid) => {
                      const p = PLACES.find((x) => x.id === pid);
                      return (
                        <li key={pid} style={{ padding: '0.1rem 0', color: '#cbd5e1' }}>
                          <strong style={{ color: '#f1f5f9' }}>{p?.name}</strong>
                          <span style={{ color: 'var(--ink-mute)', marginLeft: 4, fontSize: '0.85rem' }}>
                            {p?.country}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            ) : (
              <div className="empty">该起终点组合暂不支持（请选择同一预设路线上的城市）。</div>
            )}
          </section>
        </div>
      </form>
    </div>
  );
}
