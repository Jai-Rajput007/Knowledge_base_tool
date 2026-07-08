"use client";

import { useTheme } from "./theme-provider";
import { AnimatedThemeToggler } from "@/app/components/ui/animated-theme-toggler";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <AnimatedThemeToggler 
      variant="circle"
      duration={600}
      theme={theme === "system" ? resolvedTheme : theme}
      onThemeChange={(newTheme) => setTheme(newTheme)}
    />
  );
}
