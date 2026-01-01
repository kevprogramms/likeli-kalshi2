const https = require('https');

const API_KEY = 'CfGAio5BHSeEvCNVwiXV';

function request(path) {
    return new Promise((resolve, reject) => {
        https.get({
            hostname: 'a.prediction-markets-api.dflow.net',
            path,
            headers: { 'x-api-key': API_KEY }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function run() {
    console.log('Fetching markets...');
    const data = await request('/api/v1/markets?status=active&sort=volume&limit=50');
    const markets = data.markets || [];

    // Filter for markets with actual bids/asks
    const liquid = markets.filter(m => {
        return m.yesBid && m.yesAsk && m.yesBid !== '0' && m.yesAsk !== '0';
    });

    console.log(`Total Active: ${markets.length}`);
    console.log(`With Liquidity: ${liquid.length}`);

    if (liquid.length > 0) {
        const top = liquid[0];
        console.log(`\nTop Market: ${top.ticker}`);
        console.log(`  YES Bid: ${top.yesBid}`);
        console.log(`  YES Ask: ${top.yesAsk}`);
        console.log(`  NO Bid: ${top.noBid}`);
        console.log(`  NO Ask: ${top.noAsk}`);
        console.log(`  Volume: ${top.volume}`);
        console.log(`  Accounts:`, JSON.stringify(top.accounts, null, 2));

        // Let's verify Mints for this specific market
        const acc = Object.values(top.accounts)[0];
        console.log(`  YES Mint: ${acc.yesMint}`);
        console.log(`  NO Mint: ${acc.noMint}`);
    } else {
        console.log('No liquid markets found!');
    }
}

run();
