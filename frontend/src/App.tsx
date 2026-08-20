import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Analytics from "./pages/Analytics";
import Campaigns from "./pages/Campaigns";
import ChangePassword from "./pages/ChangePassword";
import Dashboard from "./pages/Dashboard";
import Database from "./pages/Database";
import Login from "./pages/Login";
import MyCreators from "./pages/MyCreators";
import PartnershipHub from "./pages/PartnershipHub";
import Settings from "./pages/Settings";
import Team from "./pages/Team";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <ChangePassword />;
  return <AppLayout />;
}

function ChangePasswordRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <ChangePassword />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ChangePasswordRoute />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/partnership" element={<PartnershipHub />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/database" element={<Database />} />
        <Route path="/my-creators" element={<MyCreators />} />
        <Route path="/team" element={<Team />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
