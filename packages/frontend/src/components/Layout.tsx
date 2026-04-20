import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/today', label: 'Today' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/companies', label: 'Companies' },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-bg text-foreground flex">
      <aside className="w-[220px] shrink-0 bg-surface border-r border-border flex flex-col">
        <div className="px-6 py-6">
          <span className="font-serif text-2xl text-accent">War Room</span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-3 py-2 rounded text-sm font-medium transition-colors ${
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
      </aside>
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
