'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
    >
      {theme === 'dark' ? 'Light' : 'Dark'} Mode
    </button>
  );
};

export default ThemeSwitcher;
