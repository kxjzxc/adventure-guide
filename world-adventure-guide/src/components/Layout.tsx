import { NavLink, Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">🧭</span>
            <span>世界冒险指南</span>
          </Link>

          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
              首页
            </NavLink>
            <NavLink to="/adventures" className={({ isActive }) => (isActive ? 'active' : '')}>
              我的冒险
            </NavLink>
            <NavLink to="/create" className={({ isActive }) => (isActive ? 'active' : '')}>
              开始新冒险
            </NavLink>
            <NavLink to="/records" className={({ isActive }) => (isActive ? 'active' : '')}>
              我的记录
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        «内容是什么，与内容如何展示，是两个完全独立的问题。» — 世界冒险指南
      </footer>
    </div>
  );
}
