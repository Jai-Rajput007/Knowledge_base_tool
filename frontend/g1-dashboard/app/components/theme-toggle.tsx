"use client";

import { useTheme } from "./theme-provider";
import { AnimatedThemeToggler } from "@/app/components/ui/animated-theme-toggler";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <AnimatedThemeToggler 
      variant="circle"
      duration={600}
      theme={theme === "dark" || theme === "light" ? theme : undefined}
      onThemeChange={(newTheme) => setTheme(newTheme)}
    />
  );
}
