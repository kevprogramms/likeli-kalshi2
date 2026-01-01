const https = require('https');

const API_KEY = 'CfGAio5BHSeEvCNVwiXV';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function request(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.status, data }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function runTest() {
    console.log('Fetching top markets...');
    const marketsRes = await new Promise((resolve, reject) => {
        https.get({
            hostname: 'a.prediction-markets-api.dflow.net',
            path: '/api/v1/markets?status=active&sort=volume&limit=5',
            headers: { 'x-api-key': API_KEY }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    for (const market of marketsRes.markets) {
        console.log(`\n--- Market: ${market.ticker} ---`);
        console.log(`  Full Market Data:`, JSON.stringify(market, null, 2));
        const accounts = market.accounts || {};

        // Check all collaterals
        for (const [collateralMint, data] of Object.entries(accounts)) {
            console.log(`  Testing Collateral: ${collateralMint}`);

            const mints = [
                { name: 'YES', mint: data.yesMint },
                { name: 'NO', mint: data.noMint }
            ];

            for (const m of mints) {
                if (!m.mint) continue;

                // Try two different amounts
                for (const amount of ['1000000', '10000000', '100000000']) {
                    const path = `/quote?inputMint=${collateralMint}&outputMint=${m.mint}&amount=${amount}&slippageBps=auto`;
                    console.log(`    Requesting Quote for ${m.name} (${amount / 1e6} USDC): GET ${path}`);

                    try {
                        const res = await new Promise((resolve) => {
                            https.get({
                                hostname: 'b.quote-api.dflow.net',
                                path: path,
                                headers: { 'x-api-key': API_KEY }
                            }, (res) => {
                                let d = '';
                                res.on('data', (chunk) => d += chunk);
                                res.on('end', () => resolve({ status: res.statusCode, data: d }));
                            });
                        });

                        if (res.status === 200) {
                            console.log(`    ✅ SUCCESS! Result:`, JSON.parse(res.data).outAmount);
                            return; // Stop if we find a working one!
                        } else {
                            console.log(`    ❌ FAILED (${res.status}):`, res.data);
                        }
                    } catch (err) {
                        console.log(`    ❌ ERROR:`, err.message);
                    }
                }
            }
        }
    }
}

runTest().catch(console.error);
