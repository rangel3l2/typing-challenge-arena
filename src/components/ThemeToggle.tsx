import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return true; // default dark
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="flex items-center bg-muted/60 backdrop-blur-md rounded-full p-1 gap-1 border border-border/40">
      <button
        onClick={() => setDark(false)}
        className={`p-2 rounded-full transition-all ${!dark ? "bg-accent text-accent-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
        aria-label="Modo claro"
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        onClick={() => setDark(true)}
        className={`p-2 rounded-full transition-all ${dark ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
        aria-label="Modo escuro"
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  );
}
