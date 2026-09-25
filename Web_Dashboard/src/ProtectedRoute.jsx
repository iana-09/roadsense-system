// src/ProtectedRoute.jsx

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetchCurrentUser, getStoredSession } from "./auth";

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const [session] = useState(getStoredSession);
  const [state, setState] = useState({
    loading: Boolean(session?.access_token),
    user: null,
  });

  useEffect(() => {
    let active = true;
    if (!session?.access_token) {
      return () => { active = false; };
    }

    fetchCurrentUser()
      .then((user) => {
        if (!active) return;
        localStorage.setItem("user", JSON.stringify({ ...session, ...user }));
        setState({ loading: false, user });
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem("user");
        setState({ loading: false, user: null });
      });

    return () => { active = false; };
  }, [session]);

  if (state.loading) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  const role = typeof state.user?.role === "string" ? state.user.role.toLowerCase() : "";
  if (!state.user || !role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    const roleHome = {
      admin: "/dashboard",
      sae:   "/sae-dashboard",
      lgu:   "/lgu-dashboard",
      guest: "/guest-dashboard",
    };
    return <Navigate to={roleHome[role] ?? "/login"} replace />;
  }

  return children;
}
