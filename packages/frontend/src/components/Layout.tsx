import { Outlet, NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Today', exact: true },
  { to: '/pipeline', label: 'Pipeline', exact: false },
  { to: '/companies', label: 'Companies', exact: false },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-bg text-foreground flex flex-col">
      {/* Top nav */}
      <header className="border-b border-border bg-surface sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-8 h-14">
          <span className="font-semibold text-accent tracking-widest text-sm uppercase">
            War Room
          </span>
          <nav className="flex gap-1">
            {navItems.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-accent bg-accent/10'
                      : 'text-muted hover:text-foreground hover:bg-white/5'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
