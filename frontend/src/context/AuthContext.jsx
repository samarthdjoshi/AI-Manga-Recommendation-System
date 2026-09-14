import { useEffect, useState } from "react";
import { getMe, loginUser, registerUser } from "../api/client";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(token));

  useEffect(() => {
    let cancelled = false;
    if (!token) return undefined;

    getMe(token)
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setUser(null);
          localStorage.removeItem("token");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function login({ email, password }) {
    const data = await loginUser({ email, password });
    localStorage.setItem("token", data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    setLoading(false);
    return data;
  }

  async function register({ email, username, password }) {
    const data = await registerUser({ email, username, password });
    localStorage.setItem("token", data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    setLoading(false);
    return data;
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setLoading(false);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
