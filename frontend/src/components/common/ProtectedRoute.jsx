import { Navigate, Outlet } from 'react-router-dom';
import { UrlState } from '../../context/AuthContext';
import { BeatLoader } from 'react-spinners';
import { getRoleHome } from '../../utils/roleHome';

const ProtectedRoute = ({ role }) => {
  const { user, isAuthenticated, loading, authSyncing, isSessionLoaded } = UrlState();

  // Only block the UI if the session isn't loaded yet, OR if we're fetching and don't have a user
  const stillLoading = !isSessionLoaded || authSyncing || (loading && !user);
  if (stillLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
        <BeatLoader color="#1e293b" />
      </div>
    );
  }

  // Not logged in → send to auth
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Wrong role → send to auth
  const userRole = user?.role?.trim().toLowerCase();
  const requiredRole = role?.trim().toLowerCase();

  const isRoleAllowed = () => {
    if (!requiredRole) return true;
    if (userRole === requiredRole) return true;
    if (requiredRole === 'restaurant_owner' && userRole === 'restaurant') return true;
    if (requiredRole === 'restaurant' && userRole === 'restaurant_owner') return true;
    return false;
  };

  if (!isRoleAllowed()) {
    console.warn('ProtectedRoute: Expected role:', requiredRole, 'but got:', userRole);
    return <Navigate to={getRoleHome(userRole)} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
