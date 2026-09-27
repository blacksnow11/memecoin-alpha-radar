export async function register() {
  // Only start in-process background worker in persistent Node environments (self-hosted, Docker, PM2)
  // In serverless environments (Vercel), ticks are driven via Vercel Cron (vercel.json) and on-demand requests
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const { start247BotWorker } = await import('./lib/bot-worker');
    start247BotWorker();
  }
}
