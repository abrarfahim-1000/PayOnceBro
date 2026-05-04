import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { UrlProvider, UrlState } from './context/AuthContext';

// Kept eager: small guard + shell used on every navigation
import ProtectedRoute from './components/common/ProtectedRoute';

import { Toaster } from './components/ui/sonner';
import { getRoleHome } from './utils/roleHome';

const Auth = lazy(() => import('./pages/auth/Auth'));

const RestaurantLayout = lazy(() => import('./layouts/RestaurantLayout'));
const RestaurantDashboard = lazy(() => import('./pages/restaurant/Dashboard'));
const MenuManagement = lazy(() => import('./pages/restaurant/MenuManagement'));
const RestaurantReviews = lazy(() => import('./pages/restaurant/Reviews'));

const UserLayout = lazy(() => import('./layouts/UserLayout'));
const Home = lazy(() => import('./pages/user/Home'));
const RestaurantProfile = lazy(() => import('./pages/user/RestaurantProfile'));
const Cart = lazy(() => import('./pages/user/Cart'));
const Orders = lazy(() => import('./pages/user/Orders'));
const OrderTracking = lazy(() => import('./pages/user/OrderTracking'));

const RiderLayout = lazy(() => import('./layouts/RiderLayout'));
const RiderDashboard = lazy(() => import('./pages/rider/Dashboard'));
const RouteView = lazy(() => import('./pages/rider/RouteView'));
const Earnings = lazy(() => import('./pages/rider/Earnings'));

const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
    <p className="text-sm font-medium">Loading…</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <UrlProvider>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Auth page — Login & Register tabs */}
          <Route path="/" element={<SmartRedirect />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />

          {/* Protected Rider Routes */}
          <Route element={<ProtectedRoute role="rider" />}>
            <Route path="/rider" element={<RiderLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<RiderDashboard />} />
              <Route path="route" element={<RouteView />} />
              <Route path="earnings" element={<Earnings />} />
            </Route>
          </Route>

          {/* User Routes (Member A) */}
          <Route element={<ProtectedRoute role="user" />}>
            <Route element={<UserLayout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/search" element={<Navigate to="/home" replace />} />
              <Route path="/restaurants/:id" element={<RestaurantProfile />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderTracking />} />
            </Route>
          </Route>

          {/* Admin Routes (Member D) */}
          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="analytics" replace />} />
              <Route path="analytics" element={<Analytics />} />
            </Route>
          </Route>

          {/* Restaurant Routes (Member C) */}
          <Route element={<ProtectedRoute role="restaurant_owner" />}>
            <Route path="/restaurant" element={<RestaurantLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<RestaurantDashboard />} />
              <Route path="menu" element={<MenuManagement />} />
              <Route path="reviews" element={<RestaurantReviews />} />
            </Route>
          </Route>

          {/* Catch-all for 404s */}
          <Route path="*" element={<h1>404 - Not Found</h1>} />
        </Routes>
        </Suspense>
        <Toaster position="top-right" richColors />
      </UrlProvider>
    </BrowserRouter>
  );
}

export default App;

const SmartRedirect = () => {
  const { user, loading, isSessionLoaded } = UrlState()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || !isSessionLoaded) return
    if (!user) {
      navigate('/auth', { replace: true })
      return
    }
    navigate(getRoleHome(user?.role), { replace: true })
  }, [user, loading, isSessionLoaded, navigate])

  if (loading || !isSessionLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        <p className="text-sm font-medium">Loading session...</p>
      </div>
    )
  }

  return null
}
