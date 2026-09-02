import { Link } from 'react-router-dom';
import AdventureMap from '../components/AdventureMap';
import { useAdventureStore } from '../store';
import { PLACES, getContentsByPlace, getPlace } from '../data/worldData';

function formatRelativeTime(ts: number) {
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / 3600_000)} 小时前`;
  if (diff < day * 30) return `${Math.floor(diff / day)} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

export default function HomePage() {
  const { adventures, activeAdventureId, setActiveAdventure } = useAdventureStore();
  const active = adventures.find((a) => a.id === activeAdventureId) ?? adventures[0];

  return (
    <div className="stack-lg">
      {/* Hero */}
      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.8rem 1.6rem 1.2rem' }}>
          <div className="badge" style={{ marginBottom: '0.8rem' }}>
            🌍 World · 地球 × 现在
          </div>
          <h1 style={{ fontSize: '2.4rem', marginBottom: '0.5rem' }}>
            通过一次冒险，认识一个原本不了解的世界。
          </h1>
          <p style={{ maxWidth: 720 }}>
            世界冒险指南不是传统地图，也不是旅行规划工具。它以现实世界地图为基础，
            通过「冒险」连接不同地点，让你沿着一条路线不断发现、了解和记录沿途的城市、地点与内容。
          </p>
          <div style={{ marginTop: '1.2rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Link to="/create" className="btn btn-primary">
              🧭 开始新冒险
            </Link>
            <Link to="/adventures" className="btn">
              查看我的冒险
            </Link>
          </div>
        </div>
        {/* 世界地图概览 */}
        <div style={{ padding: '0 1.2rem 1.2rem' }}>
          <AdventureMap height={420} />
        </div>
      </section>

      {/* 当前活跃冒险 + 冒险列表 */}
      <div className="grid grid-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* 当前正在进行的冒险 */}
        <section className="card">
          <div className="section-title">
            <h2>{active ? '正在进行的冒险' : '开始你的第一次冒险'}</h2>
            {active && (
              <Link to={`/adventures/${active.id}`} className="btn btn-ghost">
                进入冒险 →
              </Link>
            )}
          </div>
          {active ? (
            <div className="stack">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{active.title}</h3>
                  {active.theme && <div className="badge badge-soft" style={{ marginTop: 6 }}>{active.theme}</div>}
                </div>
                <div style={{ color: 'var(--ink-mute)', fontSize: '0.85rem' }}>
                  最后访问：{formatRelativeTime(active.lastVisitedAt)}
                </div>
              </div>
              {active.coverNote && (
                <p style={{ color: 'var(--ink-soft)', marginTop: '0.4rem' }}>{active.coverNote}</p>
              )}
              <Progress adventure={active} />
              <AdventureMap
                adventure={active}
                height={320}
                adventureIdForLink={active.id}
              />
            </div>
          ) : (
            <div className="empty">
              <p>还没有冒险。创建一次，出发吧。</p>
              <Link to="/create" className="btn btn-primary">创建冒险</Link>
            </div>
          )}
        </section>

        {/* 冒险列表 */}
        <section className="card">
          <div className="section-title">
            <h2 style={{ fontSize: '1.3rem' }}>最近的冒险</h2>
            <Link to="/adventures" className="btn btn-ghost" style={{ padding: '0.2rem 0.6rem', fontSize: '0.82rem' }}>
              全部
            </Link>
          </div>
          {adventures.length === 0 ? (
            <div className="empty">暂无冒险</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
              {adventures.slice(0, 6).map((a) => (
                <li
                  key={a.id}
                  style={{
                    padding: '0.7rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    background: a.id === active?.id ? 'var(--bg-elev)' : 'transparent',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setActiveAdventure(a.id);
                    window.location.href = `/adventures/${a.id}`;
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{a.title}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--ink-mute)' }}>
                      {a.placeIds.length} 站
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-mute)', marginTop: 4 }}>
                    {a.placeIds.map((pid) => getPlace(pid)?.name).filter(Boolean).join(' → ')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 探索入口：所有可探索的地点 */}
      <section className="card">
        <div className="section-title">
          <h2>从这些城市开始探索</h2>
          <div className="badge badge-soft">共 {PLACES.length} 个地点 · 内置丰富内容</div>
        </div>
        <div className="grid grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {PLACES.map((p) => (
            <Link
              key={p.id}
              to={`/places/${p.id}`}
              style={{ textDecoration: 'none' }}
              className="place-card"
            >
              <div
                style={{
                  padding: '1.1rem',
                  background: 'linear-gradient(180deg, var(--bg-elev) 0%, var(--bg-soft) 100%)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  height: '100%',
                  transition: 'transform 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'rgba(168,98,43,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.borderColor = '';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3 style={{ margin: 0 }}>{p.name}</h3>
                  <span className="badge badge-soft" style={{ fontSize: '0.7rem' }}>
                    {p.type === 'city' ? '城市' : p.type}
                  </span>
                </div>
                {p.localName && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)', marginTop: 2 }}>
                    {p.localName}
                  </div>
                )}
                <p style={{ marginTop: '0.7rem', fontSize: '0.9rem', lineHeight: 1.6, minHeight: 68 }}>
                  {p.summary.length > 90 ? p.summary.slice(0, 90) + '…' : p.summary}
                </p>
                <div className="chip-row">
                  {p.tags.slice(0, 3).map((t) => (
                    <span key={t} className="badge badge-soft">#{t}</span>
                  ))}
                  <span className="badge">
                    {getContentsByPlace(p.id).length} 条内容
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Progress({ adventure }: { adventure: ReturnType<typeof useAdventureStore.getState>['adventures'][number] }) {
  const pct = Math.round(((adventure.currentStep) / Math.max(1, adventure.placeIds.length - 1)) * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--ink-mute)', marginBottom: 4 }}>
        <span>
          当前：第 {adventure.currentStep + 1} / {adventure.placeIds.length} 站
          （{getPlace(adventure.placeIds[adventure.currentStep])?.name ?? '-'}）
        </span>
        <span>{pct}%</span>
      </div>
      <div
        style={{
          width: '100%',
          height: 8,
          borderRadius: 999,
          background: 'var(--bg-elev)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
            borderRadius: 999,
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  );
}
