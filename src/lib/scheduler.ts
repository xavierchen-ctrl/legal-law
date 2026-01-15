import cron from 'node-cron';
import { checkAndSendOverdueNotifications, sendCeoUnclosedSummary } from './notification-service';

export function initScheduler() {
    // Avoid double initialization in HMR (Hot Module Replacement) during dev
    if ((global as any)._schedulerInit) {
        console.log('Scheduler already running.');
        return;
    }

    console.log('Initializing Global Scheduler...');

    // 1. General Overdue Check: DAILY at 09:30
    cron.schedule('30 09 * * *', async () => {
        console.log('[Scheduler] Running Daily Ops at', new Date().toISOString());
        const result = await checkAndSendOverdueNotifications();
        console.log('[Scheduler] Daily Check Complete:', result);
    }, {
        timezone: "Asia/Taipei"
    });

    // 2. CEO Summary Report: WEEKLY (Monday) at 09:30
    // Cron: Minute Hour Day Month DayOfWeek (1=Monday)
    cron.schedule('30 09 * * 1', async () => {
        console.log('[Scheduler] Running Weekly CEO Report at', new Date().toISOString());
        const result = await sendCeoUnclosedSummary();
        console.log('[Scheduler] CEO Report Complete:', result);
    }, {
        timezone: "Asia/Taipei"
    });

    (global as any)._schedulerInit = true;
    console.log('Scheduler is active: Daily Check (09:30) & Weekly CEO Report (Mon 09:30)');
}
