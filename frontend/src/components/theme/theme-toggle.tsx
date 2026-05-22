"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "ninjasec_theme";

function getCurrentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setTheme(getCurrentTheme());
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    window.localStorage.setItem(THEME_KEY, next);
  }

  return (
    <button className="button button-ghost button-icon" type="button" onClick={toggleTheme} aria-label="Cambiar tema">
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <path
            fill="currentColor"
            d="M12 4a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7-4a1 1 0 0 1 1-1h1.5a1 1 0 1 1 0 2H20a1 1 0 0 1-1-1zM3.5 11a1 1 0 1 1 0-2H5a1 1 0 1 1 0 2H3.5zm12.02-6.52a1 1 0 0 1 1.41 0l1.06 1.06a1 1 0 1 1-1.41 1.41l-1.06-1.06a1 1 0 0 1 0-1.41zM6.06 15.94a1 1 0 0 1 1.41 0l1.06 1.06a1 1 0 0 1-1.41 1.41l-1.06-1.06a1 1 0 0 1 0-1.41zM18.94 15.94a1 1 0 0 1 0 1.41l-1.06 1.06a1 1 0 1 1-1.41-1.41l1.06-1.06a1 1 0 0 1 1.41 0zM6.06 4.52a1 1 0 0 1 0 1.41L5 6.99A1 1 0 1 1 3.6 5.58l1.06-1.06a1 1 0 0 1 1.4 0z"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <path
            fill="currentColor"
            d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 1 0 11.5 11.5z"
          />
        </svg>
      )}
    </button>
  );
}
