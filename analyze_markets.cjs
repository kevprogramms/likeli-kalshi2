const fs = require('fs');

const data = JSON.parse(fs.readFileSync('markets_all.json', 'utf8'));
const markets = data.markets || [];

console.log(`Analyzing ${markets.length} markets...`);

const liquidMarkets = markets.filter(m => {
    // Check if yesBid and yesAsk exist and are valid decimals
    const bid = parseFloat(m.yesBid);
    const ask = parseFloat(m.yesAsk);
    return !isNaN(bid) && !isNaN(ask) && bid > 0 && ask > 0;
});

console.log(`Found ${liquidMarkets.length} markets with bid/ask.`);

liquidMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));

for (const m of liquidMarkets.slice(0, 10)) {
    console.log(`Market: ${m.ticker}`);
    console.log(`  Volume: ${m.volume}`);
    console.log(`  Yes Bid/Ask: ${m.yesBid} / ${m.yesAsk}`);
    console.log(`  No Bid/Ask: ${m.noBid} / ${m.noAsk}`);
    console.log(`  Accounts:`, Object.keys(m.accounts || {}));
}
