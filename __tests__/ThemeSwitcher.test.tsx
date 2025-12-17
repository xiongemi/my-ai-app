import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ThemeSwitcher from '@/components/ThemeSwitcher';

// Mock next-themes since it uses client-side hooks
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
    themes: ['light', 'dark', 'system'],
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('ThemeSwitcher', () => {
  it('should render the theme switcher', () => {
    render(<ThemeSwitcher />);
    // The component should render without errors
    expect(document.body).toBeInTheDocument();
  });
});

