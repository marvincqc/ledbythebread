import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

const Home             = lazy(() => import("./pages/Home"));
const Checkout         = lazy(() => import("./pages/Checkout"));
const OrderConfirmation= lazy(() => import("./pages/OrderConfirmation"));
const AuthCallback     = lazy(() => import("./pages/auth/Callback"));
const AdminLogin       = lazy(() => import("./pages/admin/Login"));
const AdminDashboard   = lazy(() => import("./pages/admin/Dashboard"));
const SlotManagement   = lazy(() => import("./pages/admin/SlotManagement"));
const SkuManagement    = lazy(() => import("./pages/admin/SkuManagement"));
const OrderManagement  = lazy(() => import("./pages/admin/OrderManagement"));
const AdminSettings    = lazy(() => import("./pages/admin/Settings"));
const AdminWaitlist    = lazy(() => import("./pages/admin/Waitlist"));

const PageSpinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    initialize().then((unsub) => { unsubscribe = unsub; });
    return () => { unsubscribe?.(); };
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order/:id" element={<OrderConfirmation />} />
          </Route>

          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/slots" element={<ProtectedRoute><SlotManagement /></ProtectedRoute>} />
          <Route path="/admin/skus" element={<ProtectedRoute><SkuManagement /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute><OrderManagement /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
          <Route path="/admin/waitlist" element={<ProtectedRoute><AdminWaitlist /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
