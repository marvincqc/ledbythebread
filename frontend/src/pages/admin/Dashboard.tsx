import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type { Order } from "../../types";
import { STATUS_COLORS } from "../../types";

interface DashboardStats {
  totalOrdersToday: number;
  morningOrdersToday: number;
  eveningOrdersToday: number;
  revenueToday: number;
  pendingOrders: number;
  totalOrdersAllTime: number;
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuthStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats>({
    totalOrdersToday: 0,
    morningOrdersToday: 0,
    eveningOrdersToday: 0,
    revenueToday: 0,
    pendingOrders: 0,
    totalOrdersAllTime: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
      const [todayRes, allOrdersRes, recentRes] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .eq("delivery_date", today)
          .neq("status", "cancelled"),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .neq("status", "cancelled"),
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (todayRes.data) {
        const todayOrders = todayRes.data as Order[];
        const morning = todayOrders.filter((o) => o.slot_type === "morning");
        const evening = todayOrders.filter((o) => o.slot_type === "evening");
        const pending = todayOrders.filter((o) => o.status === "pending");
        const revenue = todayOrders
          .filter((o) => !["pending", "cancelled"].includes(o.status))
          .reduce((sum, o) => sum + o.subtotal, 0);

        setStats({
          totalOrdersToday: todayOrders.length,
          morningOrdersToday: morning.length,
          eveningOrdersToday: evening.length,
          revenueToday: revenue,
          pendingOrders: pending.length,
          totalOrdersAllTime: allOrdersRes.count ?? 0,
        });
      }

      if (recentRes.data) {
        setRecentOrders(recentRes.data as Order[]);
      }
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();

    // Live subscription
    const channel = supabase
      .channel("dashboard-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        loadDashboard();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [today]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  const statCards = [
    {
      label: "Orders Today",
      value: stats.totalOrdersToday,
      icon: "📦",
      color: "bg-blue-50 border-blue-200",
    },
    {
      label: "Morning Slot",
      value: stats.morningOrdersToday,
      icon: "🌅",
      color: "bg-yellow-50 border-yellow-200",
    },
    {
      label: "Evening Slot",
      value: stats.eveningOrdersToday,
      icon: "🌇",
      color: "bg-orange-50 border-orange-200",
    },
    {
      label: "Revenue Today",
      value: `S$${stats.revenueToday.toFixed(2)}`,
      icon: "💰",
      color: "bg-green-50 border-green-200",
    },
    {
      label: "Pending Orders",
      value: stats.pendingOrders,
      icon: "⏳",
      color: "bg-amber-50 border-amber-200",
    },
    {
      label: "Total Orders",
      value: stats.totalOrdersAllTime,
      icon: "📊",
      color: "bg-purple-50 border-purple-200",
    },
  ];

  const navLinks = [
    { to: "/admin/orders", label: "Order Management", icon: "📋", desc: "View and update order statuses" },
    { to: "/admin/slots", label: "Slot Management", icon: "📅", desc: "Manage delivery slots and availability" },
    { to: "/admin/skus", label: "Product Management", icon: "🍞", desc: "Add, edit, and manage pandesal SKUs" },
    { to: "/admin/settings", label: "Settings", icon: "⚙️", desc: "Configure min order, max weeks out" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-heading text-xl font-bold">🍞 Led by the Bread</Link>
          <span className="text-white/50 hidden sm:block">|</span>
          <span className="text-white/80 text-sm hidden sm:block">Admin Panel</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/70 text-sm hidden sm:block">
            Hi, {profile?.full_name ?? profile?.role ?? "Admin"}
          </span>
          <button
            onClick={handleSignOut}
            className="text-white/80 hover:text-white text-sm border border-white/30 hover:border-white/60 px-3 py-1.5 rounded-button transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="font-heading text-3xl font-bold text-primary mb-2">Dashboard</h1>
        <p className="text-text-muted mb-8">
          {new Date().toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {statCards.map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-card border p-4 ${stat.color}`}
                >
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="font-bold text-xl text-text-main">{stat.value}</div>
                  <div className="text-xs text-text-muted mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Quick nav */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="card p-5 hover:shadow-md hover:border-primary/30 transition-all group"
                >
                  <span className="text-3xl block mb-2">{link.icon}</span>
                  <h3 className="font-semibold text-text-main group-hover:text-primary transition-colors">
                    {link.label}
                  </h3>
                  <p className="text-text-muted text-xs mt-1">{link.desc}</p>
                </Link>
              ))}
            </div>

            {/* Recent orders */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-primary/10 flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold text-primary">
                  Recent Orders
                </h2>
                <Link
                  to="/admin/orders"
                  className="text-sm text-primary hover:text-primary-dark font-medium"
                >
                  View all →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background">
                    <tr>
                      {["Order ID", "Customer", "Date", "Slot", "Subtotal", "Status"].map(
                        (h) => (
                          <th key={h} className="px-5 py-3 text-left text-text-muted font-medium text-xs uppercase tracking-wide">
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                          No orders yet
                        </td>
                      </tr>
                    ) : (
                      recentOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-background/50 transition-colors">
                          <td className="px-5 py-3 font-mono text-xs text-text-muted">
                            {order.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="px-5 py-3">
                            {order.guest_info?.name ?? "Registered user"}
                          </td>
                          <td className="px-5 py-3 text-text-muted">
                            {order.delivery_date}
                          </td>
                          <td className="px-5 py-3 capitalize text-text-muted">
                            {order.slot_type}
                          </td>
                          <td className="px-5 py-3 font-medium">
                            S${order.subtotal.toFixed(2)}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`badge ${STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] ?? "bg-gray-100 text-gray-800"}`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
