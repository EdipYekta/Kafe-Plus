'use client';
import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { Sun, Moon } from 'lucide-react';
import clsx from 'clsx';

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, setTheme } = useThemeStore();

  useEffect(() => {
    // Sync initial theme with DOM
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [theme]);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={clsx(
        'p-2 rounded-2xl bg-card hover:bg-card-hover border border-theme shadow-theme transition-all active:scale-95 flex items-center justify-center text-main',
        className
      )}
      title={theme === 'light' ? 'Koyu Temaya Geç' : 'Açık Temaya Geç'}
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4 text-slate-700" />
      ) : (
        <Sun className="w-4 h-4 text-amber-400" />
      )}
    </button>
  );
}
