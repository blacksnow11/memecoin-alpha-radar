export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { start247BotWorker } = await import('./lib/bot-worker');
    start247BotWorker();
  }
}
