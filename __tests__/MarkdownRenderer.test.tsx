import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
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
    render(<MarkdownRenderer content="" />);
    const container = screen.getByText('').closest('.markdown-content');
    expect(container).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<MarkdownRenderer content="Test" className="custom-class" />);
    const container = screen.getByText('Test').closest('.markdown-content');
    expect(container).toHaveClass('custom-class');
  });
});

