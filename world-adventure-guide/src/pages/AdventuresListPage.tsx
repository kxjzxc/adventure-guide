import { Link, useNavigate } from 'react-router-dom';
import { useAdventureStore, useRecordStore } from '../store';
import { getPlace } from '../data/worldData';

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdventuresListPage() {
  const navigate = useNavigate();
  const { adventures, setActiveAdventure, deleteAdventure } = useAdventureStore();
  const { records } = useRecordStore();

  return (
    <div className="stack-lg">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="badge" style={{ marginBottom: '0.6rem' }}>📚 My Adventures</div>
          <h1 style={{ marginBottom: '0.3rem' }}>我的冒险列表</h1>
          <p>重新查看过去的冒险，继续你还没走完的路。</p>
        </div>
        <Link to="/create" className="btn btn-primary">🧭 开始新冒险</Link>
      </div>

      {adventures.length === 0 ? (
        <div className="card-paper" style={{ textAlign: 'center' }}>
          <h2>还没有冒险。</h2>
          <p>创建你的第一次冒险，去认识原本不了解的世界吧。</p>
          <Link to="/create" className="btn btn-primary">创建第一次冒险</Link>
        </div>
      ) : (
        <div className="grid grid-2">
          {adventures.map((a) => {
            const placeCount = a.placeIds.length;
            const pct = Math.round(
              (a.currentStep / Math.max(1, placeCount - 1)) * 100
            );
            const recsHere = records.filter((r) => r.adventureId === a.id);
            return (
              <article
                key={a.id}
                className="card stack"
                onClick={() => {
                  setActiveAdventure(a.id);
                  navigate(`/adventures/${a.id}`);
                }}
                style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = 'rgba(212,160,23,0.4)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: '1.35rem' }}>{a.title}</h2>
                  {a.theme && <span className="badge badge-soft">{a.theme}</span>}
                </div>

                {a.coverNote && (
                  <p style={{ fontSize: '0.92rem', color: '#cbd5e1' }}>
                    {a.coverNote.length > 120 ? a.coverNote.slice(0, 120) + '…' : a.coverNote}
                  </p>
                )}

                {/* 路线串 */}
                <div
                  style={{
                    padding: '0.5rem 0.7rem',
                    borderRadius: 8,
                    background: 'var(--bg-elev)',
                    fontSize: '0.85rem',
                    color: 'var(--ink-mute)',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.placeIds.map((pid, i) => (
                    <span key={pid}>
                      <span
                        style={{
                          color:
                            i < a.currentStep
                              ? '#9ae6b4'
                              : i === a.currentStep
                              ? 'var(--accent-2)'
                              : 'var(--ink-mute)',
                          fontWeight: i === a.currentStep ? 600 : 400,
                        }}
                      >
                        {getPlace(pid)?.name}
                      </span>
                      {i < a.placeIds.length - 1 && ' → '}
                    </span>
                  ))}
                </div>

                {/* 进度条 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--ink-mute)', marginBottom: 4 }}>
                    <span>
                      进度：第 {a.currentStep + 1} / {placeCount} 站
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 6,
                      borderRadius: 999,
                      background: 'var(--bg-elev)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background:
                          'linear-gradient(90deg, var(--accent), var(--accent-2))',
                      }}
                    />
                  </div>
                </div>

                {/* 元信息 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--ink-mute)' }}>
                    创建：{formatDate(a.createdAt)} · 最近访问：{formatDate(a.lastVisitedAt)}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {recsHere.length > 0 && (
                      <span className="badge badge-soft">📝 {recsHere.length}</span>
                    )}
                    <button
                      className="btn btn-danger"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`确定删除冒险「${a.title}」吗？`)) {
                          deleteAdventure(a.id);
                        }
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
