import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

// Customer pages (lazy-loaded)
const Home = lazy(() => import("./pages/Home"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));

// Auth callback
const AuthCallback = lazy(() => import("./pages/auth/Callback"));

// Admin pages (lazy-loaded)
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const SlotManagement = lazy(() => import("./pages/admin/SlotManagement"));
const SkuManagement = lazy(() => import("./pages/admin/SkuManagement"));
const OrderManagement = lazy(() => import("./pages/admin/OrderManagement"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Suspense fallback={null}>
      <Routes>
        {/* Customer-facing routes with shared layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:id" element={<OrderConfirmation />} />
        </Route>

        {/* Auth callback — shared by customer + admin Google OAuth */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Admin login (no layout) */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Protected admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/slots"
          element={
            <ProtectedRoute>
              <SlotManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/skus"
          element={
            <ProtectedRoute>
              <SkuManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <ProtectedRoute>
              <OrderManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute>
              <AdminSettings />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
