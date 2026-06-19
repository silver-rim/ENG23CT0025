const http = require('http');

/**
 * Logging Middleware with internal auth token management.
 */
class Logger {
    constructor() {
        this.baseUrl = '4.224.186.213';
        this.token = null;
        this.isAuthenticating = false;
        
        // Placeholder credentials - MUST be updated with real ones
        this.credentials = {
            email: 'agrimk2023@gmail.com',
            name: 'Agrim Sanjeev Kaushal',
            rollNo: 'ENG23CT0025',
            accessCode: 'BgWZSW', // Example code
            clientID: 'fa141625-a626-4f9d-9935-219031040a02',
            clientSecret: 'AxqUXQTEfkhPvRqP'
        };

        // Whitelisted enums (based on typical evaluation server patterns)
        this.STACKS = ['backend', 'frontend'];
        this.LEVELS = ['debug', 'info', 'warn', 'error', 'fatal', 'success'];
        this.PACKAGES = ['service', 'api', 'scheduler', 'auth', 'main'];
    }

    async authenticate() {
        // If we already have a valid token, just return it
        if (this.token) {
            return this.token;
        }
        // If we're already authenticating, wait and try again
        if (this.isAuthenticating) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return this.authenticate();
        }
        this.isAuthenticating = true;

        const data = JSON.stringify(this.credentials);
        const options = {
            hostname: this.baseUrl,
            path: '/evaluation-service/auth',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        try {
                            const response = JSON.parse(body);
                            this.token = response.access_token; // Use 'access_token' from real response
                            this.isAuthenticating = false;
                            resolve(this.token);
                        } catch (e) {
                            this.isAuthenticating = false;
                            reject(new Error('Failed to parse auth response'));
                        }
                    } else {
                        this.isAuthenticating = false;
                        reject(new Error(`Auth failed with status ${res.statusCode}: ${body}`));
                    }
                });
            });

            req.on('error', (e) => {
                this.isAuthenticating = false;
                reject(e);
            });
            req.write(data);
            req.end();
        });
    }

    async log(stack, level, pkg, message) {
        // Validation (optional, but good for local debugging)
        if (!this.STACKS.includes(stack)) stack = 'backend';
        if (!this.LEVELS.includes(level)) level = 'info';
        if (!this.PACKAGES.includes(pkg)) pkg = 'service';

        try {
            if (!this.token) {
                await this.authenticate();
            }

            const payload = JSON.stringify({
                stack: stack,
                level: level,
                package: pkg,
                message: message
            });

            const options = {
                hostname: this.baseUrl,
                path: '/evaluation-service/logs',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Length': payload.length
                }
            };

            const req = http.request(options, (res) => {
                if (res.statusCode === 401) {
                    this.token = null; // Token expired, reset for next call
                }
                // Silently consume response to avoid hanging
                res.on('data', () => {});
            });

            req.on('error', (e) => {
                console.error('Logger Error (API Unreachable):', e.message);
            });

            req.write(payload);
            req.end();
        } catch (e) {
            console.error('Logger Error (Internal):', e.message);
        }
    }
}

const loggerInstance = new Logger();

module.exports = loggerInstance;
