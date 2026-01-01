const https = require('https');

const API_KEY = 'CfGAio5BHSeEvCNVwiXV';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function get(path) {
    return new Promise((resolve) => {
        https.get({
            hostname: 'b.quote-api.dflow.net',
            path,
            headers: { 'x-api-key': API_KEY }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
    });
}

async function getMarket() {
    return new Promise((resolve) => {
        https.get({
            hostname: 'a.prediction-markets-api.dflow.net',
            path: '/api/v1/markets?status=active&sort=volume&limit=5',
            headers: { 'x-api-key': API_KEY }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        });
    });
}

async function run() {
    const data = await getMarket();
    const markets = data.markets || [];

    // Find market with USDC account
    const market = markets.find(m => m.accounts && m.accounts[USDC_MINT]);

    if (!market) {
        console.log('No market with USDC collateral found.');
        return;
    }

    const usdcAccount = market.accounts[USDC_MINT];
    const yesMint = usdcAccount.yesMint;

    console.log(`Testing Market: ${market.ticker}`);
    console.log(`USDC Account YES Mint: ${yesMint}`);

    const inputs = [
        { name: 'USDC(Main)', mint: USDC_MINT },
        { name: 'USDC(Dev)', mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' },
        { name: 'SOL', mint: 'So11111111111111111111111111111111111111112' }
    ];

    for (const input of inputs) {
        const path = `/quote?inputMint=${input.mint}&outputMint=${yesMint}&amount=1000000&slippageBps=auto`;
        console.log(`Requesting [${input.name}]: GET ${path.slice(0, 60)}...`);

        const res = await get(path);
        if (res.status === 200) {
            console.log('✅ SUCCESS!');
            console.log(JSON.parse(res.data));
        } else {
            console.log(`❌ FAILED ${res.status}: ${res.data}`);
        }
    }
}

run();
