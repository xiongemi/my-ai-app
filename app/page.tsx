'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect } from 'react';

export default function Home() {
  const [credits, setCredits] = useState(0);

  const fetchCredits = async () => {
    const response = await fetch('/api/billing');
    const data = await response.json();
    setCredits(data.credits);
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/codereview',
    onFinish: () => {
      fetchCredits();
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            AI Code Reviewer
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Enter the path to a file to have it reviewed by an AI agent.
          </p>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Remaining Credits: <span className="font-semibold text-black dark:text-white">${credits.toFixed(4)}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full">
          <div className="flex flex-col gap-4">
            <input
              className="w-full max-w-md p-2 border border-gray-300 rounded shadow-sm dark:bg-zinc-800 dark:text-white"
              value={input}
              placeholder="Enter file path..."
              onChange={handleInputChange}
            />
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            >
              Review Code
            </button>
          </div>
        </form>

        <div className="flex flex-col-reverse w-full mt-8">
          {messages.map(m => (
            <div key={m.id} className="whitespace-pre-wrap">
              <strong>{m.role === 'user' ? 'User: ' : 'AI: '}</strong>
              {m.content}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
