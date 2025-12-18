import { extractPRInfo, type PRInfo } from '@/lib/github-pr';
import { UIMessage } from 'ai';

describe('extractPRInfo', () => {
  describe('extracting from explicit PR URL', () => {
    it('should extract PR info from a valid GitHub PR URL', () => {
      const prUrl = 'https://github.com/owner/repo/pull/123';
      const result = extractPRInfo(prUrl);

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        prNumber: '123',
      });
    });

    it('should handle URLs with different cases', () => {
      const prUrl = 'https://GITHUB.COM/Owner/Repo/Pull/456';
      const result = extractPRInfo(prUrl);

      expect(result).toEqual({
        owner: 'Owner',
        repo: 'Repo',
        prNumber: '456',
      });
    });

    it('should handle URLs with hyphens and underscores in owner/repo names', () => {
      const prUrl = 'https://github.com/my-org/my_repo/pull/789';
      const result = extractPRInfo(prUrl);

      expect(result).toEqual({
        owner: 'my-org',
        repo: 'my_repo',
        prNumber: '789',
      });
    });

    it('should return null for invalid URL format', () => {
      const prUrl = 'https://github.com/owner/repo';
      const result = extractPRInfo(prUrl);

      expect(result).toBeNull();
    });

    it('should return null for non-GitHub URLs', () => {
      const prUrl = 'https://gitlab.com/owner/repo/pull/123';
      const result = extractPRInfo(prUrl);

      expect(result).toBeNull();
    });

    it('should return null for undefined prUrl', () => {
      const result = extractPRInfo(undefined);

      expect(result).toBeNull();
    });
  });

  describe('extracting from messages with string content', () => {
    it('should extract PR info from a message with string content', () => {
      const messages: Array<{ role: string; content: string }> = [
        {
          role: 'user',
          content:
            'Please review this PR: https://github.com/owner/repo/pull/123',
        },
      ];

      const result = extractPRInfo(undefined, messages);

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        prNumber: '123',
      });
    });

    it('should extract PR info from the first message containing a PR URL', () => {
      const messages: Array<{ role: string; content: string }> = [
        {
          role: 'user',
          content: 'Hello',
        },
        {
          role: 'user',
          content: 'Review: https://github.com/owner/repo/pull/456',
        },
        {
          role: 'user',
          content: 'Another: https://github.com/other/repo/pull/789',
        },
      ];

      const result = extractPRInfo(undefined, messages);

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        prNumber: '456',
      });
    });

    it('should return null if no messages contain PR URLs', () => {
      const messages: Array<{ role: string; content: string }> = [
        {
          role: 'user',
          content: 'Hello world',
        },
        {
          role: 'user',
          content: 'No PR URL here',
        },
      ];

      const result = extractPRInfo(undefined, messages);

      expect(result).toBeNull();
    });
  });

  describe('extracting from UIMessage with parts array', () => {
    it('should extract PR info from UIMessage with parts array', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [
            {
              type: 'text',
              text: 'Please review: https://github.com/owner/repo/pull/123',
            },
          ],
        },
      ];

      const result = extractPRInfo(undefined, messages);

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        prNumber: '123',
      });
    });

    it('should handle multiple text parts in UIMessage', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [
            { type: 'text', text: 'Review this ' },
            {
              type: 'text',
              text: 'PR: https://github.com/owner/repo/pull/456',
            },
          ],
        },
      ];

      const result = extractPRInfo(undefined, messages);

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        prNumber: '456',
      });
    });

    it('should ignore non-text parts', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [
            { type: 'text', text: 'Review: ' },
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'readFile' },
            { type: 'text', text: 'https://github.com/owner/repo/pull/789' },
          ],
        },
      ];

      const result = extractPRInfo(undefined, messages);

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        prNumber: '789',
      });
    });
  });

  describe('extracting from messages with array content', () => {
    it('should extract PR info from message with array content', () => {
      const messages: Array<{
        role: string;
        content: Array<{ type: string; text?: string }>;
      }> = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Review: https://github.com/owner/repo/pull/123',
            },
          ],
        },
      ];

      const result = extractPRInfo(undefined, messages as any);

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        prNumber: '123',
      });
    });
  });

  describe('priority: explicit prUrl over messages', () => {
    it('should prefer explicit prUrl over messages', () => {
      const prUrl = 'https://github.com/explicit/repo/pull/999';
      const messages: Array<{ role: string; content: string }> = [
        {
          role: 'user',
          content: 'Review: https://github.com/message/repo/pull/111',
        },
      ];

      const result = extractPRInfo(prUrl, messages);

      expect(result).toEqual({
        owner: 'explicit',
        repo: 'repo',
        prNumber: '999',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages array', () => {
      const result = extractPRInfo(undefined, []);

      expect(result).toBeNull();
    });

    it('should handle messages with empty content', () => {
      const messages: Array<{ role: string; content: string }> = [
        { role: 'user', content: '' },
        { role: 'assistant', content: '   ' },
      ];

      const result = extractPRInfo(undefined, messages);

      expect(result).toBeNull();
    });

    it('should handle messages without content field', () => {
      const messages: Array<{ role: string }> = [{ role: 'user' }];

      const result = extractPRInfo(undefined, messages as any);

      expect(result).toBeNull();
    });

    it('should handle UIMessage with empty parts array', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [],
        },
      ];

      const result = extractPRInfo(undefined, messages);

      expect(result).toBeNull();
    });

    it('should handle URLs with query parameters', () => {
      const prUrl = 'https://github.com/owner/repo/pull/123?tab=files';
      const result = extractPRInfo(prUrl);

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        prNumber: '123',
      });
    });

    it('should handle URLs with hash fragments', () => {
      const prUrl =
        'https://github.com/owner/repo/pull/123#issuecomment-123456';
      const result = extractPRInfo(prUrl);

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        prNumber: '123',
      });
    });
  });
});
