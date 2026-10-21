import { createApp } from './app.js';
import { runScheduler } from './services/scheduler.js';

const port = Number(process.env.PORT) || 3000;
createApp().listen(port, () => console.log(`Pics Beauty Pros API on http://localhost:${port}`));

// Reminders, request expiry, completions and renewals run every 10 minutes (and once at start-up).
const tick = () => {
  try {
    const s = runScheduler();
    if (Object.values(s).some(Boolean)) console.log('scheduler', s);
  } catch (err) {
    console.error('scheduler failed', err);
  }
};
tick();
setInterval(tick, 10 * 60 * 1000);
