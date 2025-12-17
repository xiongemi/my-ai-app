'use client';

import { marked } from 'marked';
import { useEffect, useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({
  content,
  className = '',
}: MarkdownRendererProps) {
  // Configure marked options
  useEffect(() => {
    marked.setOptions({
      breaks: true, // Convert line breaks to <br>
      gfm: true, // GitHub Flavored Markdown
    });
  }, []);

  // Convert markdown to HTML
  const htmlContent = useMemo(() => {
    try {
      return marked.parse(content) as string;
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return content; // Fallback to raw content
    }
  }, [content]);

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

