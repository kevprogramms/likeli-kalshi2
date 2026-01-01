const https = require('https');

const API_KEY = 'CfGAio5BHSeEvCNVwiXV';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function fetchMarkets() {
    return new Promise((resolve, reject) => {
        https.get({
            hostname: 'a.prediction-markets-api.dflow.net',
            path: '/api/v1/markets?status=active&sort=volume&limit=100',
            headers: { 'x-api-key': API_KEY }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function getQuote(inputMint, outputMint, amount) {
    const path = `/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=auto`;
    return new Promise((resolve) => {
        https.get({
            hostname: 'b.quote-api.dflow.net',
            path: path,
            headers: { 'x-api-key': API_KEY }
        }, (res) => {
            let d = '';
            res.on('data', (chunk) => d += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: d }));
        }).on('error', (e) => resolve({ status: 500, data: e.message }));
    });
}

async function run() {
    const data = await fetchMarkets();
    const markets = data.markets || [];
    console.log(`Analyzing ${markets.length} markets...`);

    const liquidMarkets = markets.filter(m => {
        return m.yesBid && m.yesAsk && parseFloat(m.yesBid) > 0;
    });

    console.log(`Found ${liquidMarkets.length} potentially liquid markets.`);

    for (const m of liquidMarkets.slice(0, 20)) {
        console.log(`\nChecking Ticker: ${m.ticker} (Vol: ${m.volume})`);

        const accounts = m.accounts || {};
        for (const [collateralMint, accData] of Object.entries(accounts)) {
            console.log(`  Trying Collateral: ${collateralMint}`);
            if (accData.yesMint) {
                const res = await getQuote(collateralMint, accData.yesMint, '1000000');
                if (res.status === 200) {
                    console.log(`  ✅ SUCCESS! Quote for YES:`, JSON.parse(res.data).outAmount);
                    console.log(`  ROUTE FOUND FOR:`, {
                        ticker: m.ticker,
                        inputMint: collateralMint,
                        outputMint: accData.yesMint
                    });
                    process.exit(0);
                } else {
                    console.log(`  ❌ FAIL (${res.status}): ${res.data.slice(0, 100)}`);
                }
            }
        }
    }
    console.log('\nFinished with no success.');
}

run().catch(console.error);
