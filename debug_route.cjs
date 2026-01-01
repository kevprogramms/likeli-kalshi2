const https = require('https');

const API_KEY = 'CfGAio5BHSeEvCNVwiXV';

// Known Mints
const MINT_USDC_MAIN = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MINT_USDC_DEV = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const MINT_SOL = 'So11111111111111111111111111111111111111112';
const DUMMY_USER = 'D1W6s4WRllCTDRGYTRxVnVI'; // Random pubkey from logs

function get(hostname, path) {
    return new Promise((resolve) => {
        const req = https.get({
            hostname, path, headers: { 'x-api-key': API_KEY }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', (e) => resolve({ status: 500, data: e.message }));
    });
}

async function run() {
    console.log('Fetching top market...');
    const mRes = await get('a.prediction-markets-api.dflow.net', '/api/v1/markets?status=active&sort=volume&limit=1');
    const market = JSON.parse(mRes.data).markets[0];

    if (!market) { console.log('No markets found'); return; }

    console.log(`Target Market: ${market.ticker}`);
    console.log('Accounts:', JSON.stringify(market.accounts, null, 2));

    // Extract mints
    const accounts = Object.values(market.accounts || {});
    const yesMint = accounts[0]?.yesMint;
    const cashMint = Object.keys(market.accounts || {})[0];

    if (!yesMint) { console.log('No YES mint found'); return; }

    const inputs = [
        { name: 'USDC(Main)', mint: MINT_USDC_MAIN },
        { name: 'SOL', mint: MINT_SOL },
        { name: 'CASH(Internal)', mint: cashMint },
        { name: 'USDC(Dev)', mint: MINT_USDC_DEV }
    ];

    const paramsList = [
        { name: 'Basic', extra: '' },
        { name: 'With Ticker', extra: `&marketTicker=${market.ticker}` },
        { name: 'With User', extra: `&userPublicKey=${DUMMY_USER}` },
    ];

    for (const input of inputs) {
        if (!input.mint) continue;
        console.log(`\n--- Testing Input: ${input.name} (${input.mint}) -> YES (${yesMint}) ---`);

        // Also try swapping to CASH first if input is NOT CASH
        if (input.mint !== cashMint) {
            process.stdout.write(`  [Swap to CASH] GET /quote?input=${input.mint}&output=${cashMint}... `);
            const cashRes = await get('b.quote-api.dflow.net', `/quote?inputMint=${input.mint}&outputMint=${cashMint}&amount=1000000&slippageBps=auto`);
            if (cashRes.status === 200) {
                console.log('✅ SUCCESS (USDC->CASH)!');
            } else {
                console.log(`❌ ${cashRes.status}`);
            }
        }

        // Also try REVERSE: YES -> Input (Selling?)
        if (input.mint !== yesMint) {
            process.stdout.write(`  [REVERSE: YES->${input.name}] GET /quote?input=${yesMint}&output=${input.mint}... `);
            const sellRes = await get('b.quote-api.dflow.net', `/quote?inputMint=${yesMint}&outputMint=${input.mint}&amount=1000000&slippageBps=auto`);
            if (sellRes.status === 200) {
                console.log('✅ SUCCESS (YES->Input)!');
            } else {
                console.log(`❌ ${sellRes.status}`);
            }
        }

        for (const p of paramsList) {
            // Try Quote
            const path = `/quote?inputMint=${input.mint}&outputMint=${yesMint}&amount=1000000&slippageBps=auto${p.extra}`;
            process.stdout.write(`  [${p.name}] GET ${path.slice(0, 60)}... `);

            const qRes = await get('b.quote-api.dflow.net', path);
            if (qRes.status === 200) {
                console.log('✅ SUCCESS!');
                console.log(qRes.data);
                return;
            } else {
                console.log(`❌ ${qRes.status} ${qRes.data}`);
            }
        }
    }
}

run();
