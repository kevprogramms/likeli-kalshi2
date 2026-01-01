const https = require('https');

const API_KEY = 'CfGAio5BHSeEvCNVwiXV';

const DOMAINS = [
    'a.prediction-markets-api.dflow.net',
    'b.quote-api.dflow.net'
];

const PATHS = [
    '/api/v1/orders',
    '/api/v1/order',
    '/api/v1/trade',
    '/api/v1/execute',
    '/orders',
    '/order',
    '/trade',
    '/execute',
    '/submit_order',
    '/rpc'
];

function check(hostname, path) {
    return new Promise((resolve) => {
        const req = https.request({
            hostname,
            path,
            method: 'POST',
            headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' }
        }, (res) => {
            resolve({ hostname, path, status: res.statusCode });
        });
        req.on('error', () => resolve({ hostname, path, status: 'ERR' }));
        req.write('{}');
        req.end();
    });
}

async function run() {
    console.log('Scanning endpoints...');
    for (const domain of DOMAINS) {
        for (const path of PATHS) {
            process.stdout.write(`Testing https://${domain}${path}... `);
            const res = await check(domain, path);
            console.log(res.status);
            if (res.status === 400 || res.status === 401 || res.status === 422 || res.status === 200) {
                console.log(`FOUND POSSIBLE ENDPOINT! ${res.status}`);
            }
        }
    }
}

run();
