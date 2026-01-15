export async function register() {
    // Local scheduler (node-cron) is NOT utilized in Vercel Serverless environment.
    // We rely on Vercel Cron to hit /api/cron/* endpoints.

    // However, if you want to run scheduler locally for dev, you can uncomment below:
    /*
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV !== 'production') {
        const { initScheduler } = await import('./lib/scheduler');
        initScheduler();
    }
    */
}
