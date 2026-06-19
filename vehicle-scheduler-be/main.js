const Scheduler = require('./scheduler');
const logger = require('../logging-middleware/logger');

async function main() {
    const scheduler = new Scheduler();
    
    logger.log('backend', 'info', 'main', 'Application initialized');
    await logger.authenticate();

    try {
        const results = await scheduler.scheduleAllDepots();
        console.log('Scheduling Results:', JSON.stringify(results, null, 2));
    } catch (e) {
        console.error('Main Execution Error:', e.message);
    } finally {
        logger.log('backend', 'info', 'main', 'Application shutting down');
    }
}

main();
