# AI Code Reviewer

A Next.js application that uses AI to review code files and GitHub pull requests. Supports multiple AI providers with streaming responses, markdown rendering, and a credit-based billing system.

## Features

- 🤖 **Multi-Provider AI Support**: Choose from OpenAI, Google Gemini, Anthropic Claude, DeepSeek, Qwen, Cohere, and Vercel AI Gateway
- 📝 **Code Review**: Review local files or GitHub pull requests
- 💬 **Chat Interface**: General-purpose AI chat with optional file reading tools
- 🔄 **GitHub Actions Integration**: Automated PR reviews via GitHub Actions workflow
- 📊 **Usage Tracking**: Real-time token usage display and cost tracking
- 💰 **Billing Dashboard**: View total costs and token consumption
- 🛑 **Stop Button**: Cancel requests mid-stream for better control
- 📁 **Context Files**: Upload repository context files for better code understanding
- 🔄 **Fallback Models**: Automatic fallback support for Vercel AI Gateway
- 🌓 **Dark Mode**: Built-in theme switcher
- 📱 **Responsive Design**: Works on desktop and mobile devices
- ⚡ **Streaming & Non-Streaming**: Choose between real-time streaming or complete responses
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
4. Optionally:
   - Customize the system prompt
   - Upload a repository context file (e.g., README, architecture docs)
   - Configure fallback models (for Vercel AI Gateway)
5. Click "Review Code" to start the review
6. Use the "Stop" button to cancel a request if needed
7. View token usage for each review in the response

### Chat

1. Navigate to `/chat`
2. Select your AI provider and model
3. Optionally:
   - Customize the system prompt
   - Enable file reading tools
   - Configure fallback models (for Vercel AI Gateway)
4. Start chatting with the AI
5. Use the "Stop" button to cancel a request if needed
6. View token usage for each message in the conversation

### Settings

1. Navigate to `/settings`
2. Add or update API keys for different providers
3. Optionally add a GitHub token (for future private repository support)
4. Keys are stored securely in localStorage
5. View billing information (total cost and tokens consumed)

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
│   ├── Billing.tsx             # Billing context and provider
│   ├── MarkdownRenderer.tsx    # Markdown to HTML renderer
│   ├── ThemeSwitcher.tsx       # Dark mode toggle
│   └── VercelGatewayFallbackModels.tsx  # Fallback models hook
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
  "systemPrompt": "Custom system prompt",
  "contextFile": {
    "name": "README.md",
    "content": "...",
    "hash": "sha256-hash"
  },
  "fallbackModels": ["deepseek/deepseek-coder", "qwen/qwen-turbo"]
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
  "enableTools": false,
  "fallbackModels": ["deepseek/deepseek-coder", "qwen/qwen-turbo"]
}
```

### `/api/billing`

Get current billing information including total cost and total tokens consumed.

**Response:**

```json
{
  "totalCost": 0.123,
  "totalTokens": 12345,
  "usageHistory": [...]
}
```

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
| Cohere            | Requires API key         |
| Vercel AI Gateway | Requires gateway API key, supports fallback models |

## Features in Detail

### Code Review Tools

- **readFile**: Reads local file contents
- **readPullRequest**: Fetches and parses GitHub PR files (public repos only)

### Billing System

- Real-time token usage tracking (prompt tokens, completion tokens, total tokens)
- Cost calculation based on provider-specific pricing
- Total cost and total tokens displayed in settings panel
- Usage history tracking per request
- Automatic billing updates after each AI interaction

### GitHub Actions Integration

Automated code reviews for pull requests using GitHub Actions.

**Setup:**

1. Deploy your app to a publicly accessible URL (e.g., Vercel)
2. Configure GitHub Secrets:
   - `AI_REVIEW_API_ENDPOINT`: Your deployed API endpoint URL
   - `AI_API_KEY`: Your AI provider API key
   - `AI_PROVIDER`: (Optional) Provider name (default: `openai`)
   - `AI_MODEL`: (Optional) Model name

**Features:**

- Automatically triggers on PR events (opened, reopened, synchronize, etc.)
- Posts review comments directly to PRs
- Updates existing bot comments to avoid duplicates
- Supports streaming and non-streaming modes
- Includes token usage in comments

See [`.github/workflows/ai-code-review.yml`](.github/workflows/ai-code-review.yml) for the workflow configuration.

### Markdown Rendering

- Full markdown support (headings, lists, code blocks, tables, etc.)
- Syntax highlighting ready
- Dark mode compatible
- Compact spacing for readability

### Error Handling

- Input field preserved on API errors for easy retry
- Clear error messages with troubleshooting tips
- Graceful handling of network errors and API failures
- Stop button to cancel requests mid-stream

## Environment Variables

All API keys can be set via environment variables or through the Settings page:

- `OPENAI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY`
- `QWEN_API_KEY`
- `COHERE_API_KEY`
- `VERCEL_AI_GATEWAY_API_KEY`

**Note:** API keys set in the Settings page take precedence over environment variables and are stored in localStorage.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[Add your license here]

## Blog Post

Learn more about building AI agents and the technical details behind this project:

📖 **[Create an AI Agent with Vercel AI SDK](https://medium.com/@emilyxiong/create-an-ai-agent-with-vercel-ai-sdk-e690b807eb2a)**

The blog post covers:
- What is an AI Agent vs a ChatGPT wrapper
- Tech stack deep dive
- Cost analysis: Self-hosted vs commercial tools
- Real-world usage scenarios

## Acknowledgments

- Built with [Next.js](https://nextjs.org)
- AI powered by [Vercel AI SDK](https://sdk.vercel.ai)
- Styled with [Tailwind CSS](https://tailwindcss.com)
