# AI Code Reviewer

A Next.js application that uses AI to review code files and GitHub pull requests. Supports multiple AI providers with streaming responses, markdown rendering, and a credit-based billing system.

## Features

- 🤖 **Multi-Provider AI Support**: Choose from OpenAI, Google Gemini, Anthropic Claude, DeepSeek, Qwen, and Vercel AI Gateway
- 📝 **Code Review**: Review local files or GitHub pull requests
- 💬 **Chat Interface**: General-purpose AI chat with optional file reading tools
- 📊 **Usage Tracking**: Credit-based billing system with cost tracking
- 🌓 **Dark Mode**: Built-in theme switcher
- 📱 **Responsive Design**: Works on desktop and mobile devices
- ⚡ **Streaming Responses**: Real-time streaming for better UX
- 🎨 **Markdown Rendering**: Beautiful markdown rendering for AI responses
- 🧪 **Testing**: Jest test suite included

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **AI SDK**: Vercel AI SDK v5
- **Markdown**: Marked
- **Testing**: Jest + React Testing Library
- **Package Manager**: pnpm

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm/yarn

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd my-ai-app
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables (optional - you can also add API keys in Settings):

```bash
cp .env.example .env
```

Add your API keys:

```env
OPENAI_API_KEY=your_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
DEEPSEEK_API_KEY=your_key_here
QWEN_API_KEY=your_key_here
VERCEL_AI_GATEWAY_API_KEY=your_key_here
```

4. Run the development server:

```bash
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Code Review

1. Navigate to the home page (`/`)
2. Select your preferred AI provider and model
3. Choose input mode:
   - **File Path**: Enter a local file path to review
   - **PR Link**: Enter a GitHub PR URL (e.g., `https://github.com/owner/repo/pull/123`)
4. Optionally customize the system prompt
5. Click "Review Code" to start the review

### Chat

1. Navigate to `/chat`
2. Select your AI provider and model
3. Optionally enable file reading tools
4. Start chatting with the AI

### Settings

1. Navigate to `/settings`
2. Add or update API keys for different providers
3. Keys are stored in localStorage

## Project Structure

```
my-ai-app/
├── app/
│   ├── api/
│   │   ├── billing/        # Billing API endpoint
│   │   ├── chat/          # Chat API endpoint
│   │   └── codereview/    # Code review API endpoint
│   ├── chat/              # Chat page
│   ├── settings/          # Settings page
│   └── page.tsx           # Code review page (home)
├── components/
│   ├── AISettingsPanel.tsx    # AI provider/model selector
│   ├── MarkdownRenderer.tsx   # Markdown to HTML renderer
│   └── ThemeSwitcher.tsx      # Dark mode toggle
├── hooks/
│   └── useAIChat.ts           # Custom hook for AI chat
├── lib/
│   ├── ai-handler.ts         # Shared AI request handler
│   ├── billing.ts            # Credit/billing logic
│   ├── models.ts              # Model configuration
│   └── providers.ts           # AI provider configurations
└── __tests__/                 # Jest test files
```

## API Routes

### `/api/codereview`

Code review endpoint with file reading and PR reading tools.

**Request Body:**

```json
{
  "messages": [...],
  "provider": "openai",
  "model": "gpt-4",
  "apiKey": "optional-api-key",
  "stream": true,
  "systemPrompt": "Custom system prompt"
}
```

### `/api/chat`

General chat endpoint with optional file reading tools.

**Request Body:**

```json
{
  "messages": [...],
  "provider": "openai",
  "model": "gpt-4",
  "apiKey": "optional-api-key",
  "stream": true,
  "systemPrompt": "Custom system prompt",
  "enableTools": false
}
```

### `/api/billing`

Get current credit balance and usage history.

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm test` - Run Jest tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage report

## Testing

The project includes Jest tests for:

- Model utilities (`lib/models.ts`)
- Provider configurations (`lib/providers.ts`)
- Markdown renderer component
- Theme switcher component

Run tests:

```bash
pnpm test
```

## Supported AI Providers

See [`lib/models.json`](./lib/models.json) for the complete list of supported models for each provider.

| Provider          | Notes                    |
| ----------------- | ------------------------ |
| OpenAI            | Requires API key         |
| Google Gemini     | Requires API key         |
| Anthropic         | Requires API key         |
| DeepSeek          | Requires API key         |
| Qwen              | Requires API key         |
| Vercel AI Gateway | Requires gateway API key |

## Features in Detail

### Code Review Tools

- **readFile**: Reads local file contents
- **readPullRequest**: Fetches and parses GitHub PR files (public repos only)

### Billing System

- Credit-based system
- Tracks usage per model
- Cost calculation based on input/output tokens
- Usage history tracking

### Markdown Rendering

- Full markdown support (headings, lists, code blocks, tables, etc.)
- Syntax highlighting ready
- Dark mode compatible
- Compact spacing for readability

## Environment Variables

All API keys can be set via environment variables or through the Settings page:

- `OPENAI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY`
- `QWEN_API_KEY`
- `VERCEL_AI_GATEWAY_API_KEY`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[Add your license here]

## Acknowledgments

- Built with [Next.js](https://nextjs.org)
- AI powered by [Vercel AI SDK](https://sdk.vercel.ai)
- Styled with [Tailwind CSS](https://tailwindcss.com)
