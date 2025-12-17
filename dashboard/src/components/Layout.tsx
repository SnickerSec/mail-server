import { Outlet, NavLink, useNavigate } from 'react-router-dom';

interface LayoutProps {
  onLogout: () => void;
}

function Layout({ onLogout }: LayoutProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    onLogout();
    navigate('/login');
  };

  return (
    <div>
      <nav className="nav">
        <div className="container nav-content">
          <NavLink to="/" className="nav-brand">
            Mail Server
          </NavLink>
          <div className="nav-links">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              Domains
            </NavLink>
            <NavLink
              to="/logs"
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              Logs
            </NavLink>
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ marginLeft: '1rem' }}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
