const logger = require('../logging-middleware/logger');
const http = require('http');

/**
 * Vehicle Maintenance Scheduler
 */
class Scheduler {
    constructor() {
        this.baseUrl = '4.224.186.213';
    }

    async fetchData(path) {
        logger.log('backend', 'debug', 'api', `Fetching data from ${path}`);
        const token = await logger.authenticate();
        const options = {
            hostname: this.baseUrl,
            path: path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };

        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const data = JSON.parse(body);
                            logger.log('backend', 'info', 'api', `Successfully fetched data from ${path}`);
                            resolve(data);
                        } catch (e) {
                            logger.log('backend', 'error', 'api', `Failed to parse response from ${path}`);
                            reject(e);
                        }
                    } else {
                        logger.log('backend', 'error', 'api', `API ${path} returned status ${res.statusCode}`);
                        reject(new Error(`API ${path} returned status ${res.statusCode}`));
                    }
                });
            });
            req.on('error', (e) => {
                logger.log('backend', 'error', 'api', `Network error fetching ${path}: ${e.message}`);
                reject(e);
            });
            req.end();
        });
    }

    /**
     * Solve 0/1 Knapsack problem for a single depot
     * @param {Array} tasks - List of tasks {id, duration, score}
     * @param {number} budget - Mechanic-hour budget
     */
    solveKnapsack(tasks, budget) {
        logger.log('backend', 'debug', 'scheduler', `Running Knapsack for budget: ${budget}, tasks: ${tasks.length}`);
        
        // Convert to integers for DP
        const W = Math.floor(budget);
        const n = tasks.length;
        
        if (W <= 0 || n === 0) {
            return { selectedIds: [], totalHours: 0, totalScore: 0 };
        }

        // dp[w] will store the maximum impact score for budget w
        // keepTrack[w] will store indices of selected tasks
        let dp = new Array(W + 1).fill(0);
        let selectedTasksAt = new Array(W + 1).fill(null).map(() => []);

        for (let i = 0; i < n; i++) {
            const weight = Math.ceil(tasks[i].duration);
            const value = tasks[i].score;

            // Rolling array (backwards to avoid using same item twice)
            for (let w = W; w >= weight; w--) {
                if (dp[w - weight] + value > dp[w]) {
                    dp[w] = dp[w - weight] + value;
                    selectedTasksAt[w] = [...selectedTasksAt[w - weight], tasks[i].id];
                }
            }
        }

        const result = {
            selectedIds: selectedTasksAt[W],
            totalHours: selectedTasksAt[W].reduce((sum, id) => {
                const task = tasks.find(t => t.id === id);
                return sum + task.duration;
            }, 0),
            totalScore: dp[W]
        };

        logger.log('backend', 'info', 'scheduler', `Optimal subset found: ${result.selectedIds.length} tasks, score: ${result.totalScore}`);
        return result;
    }

    async scheduleAllDepots() {
        try {
            logger.log('backend', 'info', 'main', 'Starting maintenance scheduling process');
            
            const depots = await this.fetchData('/evaluation-service/depots');
            const vehicles = await this.fetchData('/evaluation-service/vehicles');

            // From debug output we know depots has "depots" array with "ID" and "MechanicHours"
            const depotList = depots.depots || depots;
            const vehicleList = vehicles.vehicles || vehicles;

            const results = {};

            for (const depot of depotList) {
                const depotId = depot.ID || depot.depotId || depot.id;
                const budget = depot.MechanicHours || depot.mechanicHoursAvailable || depot.budget;
                
                logger.log('backend', 'info', 'scheduler', `Processing depot: ${depotId} with budget ${budget}`);

                const depotTasks = vehicleList
                    .filter(v => (v.depotId || v.depot_id || v.DepotID) === depotId)
                    .map(v => ({
                        id: v.vehicleId || v.id || v.VehicleID,
                        duration: v.serviceDurationHours || v.duration || v.ServiceDuration,
                        score: v.impactScore || v.score || v.ImpactScore
                    }));

                if (depotTasks.length === 0) {
                    logger.log('backend', 'warn', 'scheduler', `No tasks found for depot ${depotId}`);
                    results[depotId] = { selectedIds: [], totalHours: 0, totalScore: 0 };
                    continue;
                }

                results[depotId] = this.solveKnapsack(depotTasks, budget);
            }

            logger.log('backend', 'success', 'main', 'Completed scheduling for all depots');
            return results;
        } catch (e) {
            logger.log('backend', 'fatal', 'main', `Scheduler failed: ${e.message}`);
            throw e;
        }
    }
}

module.exports = Scheduler;
