# GitHub Actions Workflows

## AI Code Review Workflow

The `ai-code-review.yml` workflow automatically reviews pull requests using your AI code review API.

### Setup

1. **Deploy your AI Code Review app** to a publicly accessible URL (e.g., Vercel, Railway, etc.)

2. **Configure GitHub Secrets** in your repository settings (Settings → Secrets and variables → Actions):
   - `AI_REVIEW_API_ENDPOINT`: The full URL to your deployed API endpoint
     - Example: `https://ai-agent-86bjedhz7-xiongemis-projects.vercel.app/api/codereview`
   - `AI_API_KEY`: Your AI provider API key (OpenAI, Anthropic, etc.)
   - `AI_PROVIDER`: (Optional) AI provider to use (default: `openai`). Options: `openai`, `gemini`, `anthropic`, `deepseek`, `qwen`, `vercel-ai-gateway`
   - `AI_MODEL`: (Optional) Specific model to use. If not provided, uses the default model for the selected provider

   **Example Configuration:**
   ```
   AI_REVIEW_API_ENDPOINT: https://ai-agent-86bjedhz7-xiongemis-projects.vercel.app/api/codereview
   AI_API_KEY: sk-... (your OpenAI API key)
   AI_PROVIDER: openai
   ```

### How it Works

1. Triggers automatically on:
   - Pull request opened
   - Pull request updated (new commits pushed)

2. The workflow:
   - Checks out the PR code
   - Calls your AI code review API with the PR URL
   - Posts the review as a comment on the PR

### Example Configuration

```yaml
# In your workflow file, you can customize:
env:
  AI_PROVIDER: 'openai'  # or 'anthropic', 'gemini', etc.
  AI_MODEL: 'gpt-4'      # optional, uses default if not specified
```

### Customization

You can customize the workflow by:
- Changing the trigger events
- Modifying the system prompt
- Adding additional review criteria
- Customizing the comment format

### Troubleshooting

- **API endpoint not found**: Make sure `AI_REVIEW_API_ENDPOINT` secret is set correctly
- **No review posted**: Check the workflow logs for API errors
- **Authentication errors**: Verify your `AI_API_KEY` secret is correct

