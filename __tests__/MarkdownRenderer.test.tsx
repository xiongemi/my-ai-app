import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

// Mock marked to avoid ESM issues in Jest
jest.mock('marked', () => ({
  marked: {
    parse: (text: string) => {
      // Simple mock markdown parser for testing
      return text
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^- (.+)$/gm, '<ul><li>$1</li></ul>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
        .replace(/```javascript\n([\s\S]+?)```/g, '<pre><code>$1</code></pre>');
    },
    setOptions: jest.fn(),
  },
}));

import { MarkdownRenderer } from '@/components/MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('should render markdown headings', () => {
    const markdown = '# Heading 1\n## Heading 2\n### Heading 3';
    render(<MarkdownRenderer content={markdown} />);

    const h1 = screen.getByText('Heading 1');
    expect(h1.tagName).toBe('H1');

    const h2 = screen.getByText('Heading 2');
    expect(h2.tagName).toBe('H2');

    const h3 = screen.getByText('Heading 3');
    expect(h3.tagName).toBe('H3');
  });

  it('should render markdown lists', () => {
    const markdown = '- Item 1\n- Item 2\n- Item 3';
    render(<MarkdownRenderer content={markdown} />);

    const list = screen.getByText('Item 1').closest('ul');
    expect(list).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('should render markdown code blocks', () => {
    const markdown = '```javascript\nconst x = 1;\n```';
    render(<MarkdownRenderer content={markdown} />);

    const codeBlock = screen.getByText('const x = 1;');
    expect(codeBlock.closest('pre')).toBeInTheDocument();
  });

  it('should render markdown links', () => {
    const markdown = '[Link Text](https://example.com)';
    render(<MarkdownRenderer content={markdown} />);

    const link = screen.getByText('Link Text');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('should render markdown bold and italic text', () => {
    const markdown = '**bold** and *italic*';
    render(<MarkdownRenderer content={markdown} />);

    const bold = screen.getByText('bold');
    expect(bold.tagName).toBe('STRONG');

    const italic = screen.getByText('italic');
    expect(italic.tagName).toBe('EM');
  });

  it('should handle empty content', () => {
    const { container } = render(<MarkdownRenderer content="" />);
    const markdownContent = container.querySelector('.markdown-content');
    expect(markdownContent).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<MarkdownRenderer content="Test" className="custom-class" />);
    const container = screen.getByText('Test').closest('.markdown-content');
    expect(container).toHaveClass('custom-class');
  });
});
