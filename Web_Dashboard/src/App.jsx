// src/App.jsx

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

import Login          from "./login";
import Signup         from "./signup";
import ForgotPassword from "./forgotpassword";
import ResetPassword  from "./reset-password";
import Home           from "./home";

import Dashboard      from "./pages/dashboard";
import SAEDashboard   from "./pages/admin-dashboard";
import LGUDashboard   from "./pages/lgu-dashboard";
import GuestDashboard from "./pages/guest-dashboard";

function App() {
  return (
    <Router>
      <Routes>

        {/* ── Public routes — no login required ── */}
        <Route path="/"                element={<Home />}           />
        <Route path="/login"           element={<Login />}          />
        <Route path="/signup"          element={<Signup />}         />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />}  />
        <Route path="/home"            element={<Home />}           />

        {/* Guest dashboard — open, no account needed */}
        <Route path="/guest-dashboard" element={<GuestDashboard />} />

        {/* ── Protected routes ── */}

        {/* Admin only */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/sae-dashboard"
          element={
            <ProtectedRoute allowedRoles={["admin", "sae"]}>
              <SAEDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/admin-dashboard" element={<Navigate to="/sae-dashboard" replace />} />

        {/* LGU only */}
        <Route
          path="/lgu-dashboard"
          element={
            <ProtectedRoute allowedRoles={["lgu"]}>
              <LGUDashboard />
            </ProtectedRoute>
          }
        />

      </Routes>
    </Router>
  );
}

export default App;
