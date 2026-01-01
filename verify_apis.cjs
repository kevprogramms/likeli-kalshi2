const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testEndpoint(name, url, method = 'GET', body = null) {
    console.log(`\n--- Testing ${name} ---`);
    console.log(`${method} ${url}`);

    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const status = response.status;
        const text = await response.text();

        if (status >= 200 && status < 300) {
            console.log(`✅ SUCCESS (${status})`);
            try {
                const json = JSON.parse(text);
                if (Array.isArray(json)) {
                    console.log(`   Count: ${json.length}`);
                } else if (json.markets) {
                    console.log(`   Markets Count: ${json.markets.length}`);
                } else {
                    console.log(`   Response: ${JSON.stringify(json).slice(0, 100)}...`);
                }
            } catch (e) {
                console.log(`   Response: ${text.slice(0, 100)}...`);
            }
        } else {
            console.log(`❌ FAILED (${status})`);
            console.log(`   Error: ${text.slice(0, 500)}`);
        }
    } catch (error) {
        console.log(`❌ CRITICAL ERROR: ${error.message}`);
    }
}

async function runTests() {
    console.log('Starting API Connectivity Verification...');

    // 1. DFlow Markets
    console.log(`\n--- Testing DFlow Markets ---`);
    const marketsUrl = `${BASE_URL}/api/dflow/markets?status=active&limit=5`;
    const marketsRes = await fetch(marketsUrl);
    const marketsData = await marketsRes.json();

    if (marketsRes.ok && marketsData.markets && marketsData.markets.length > 0) {
        console.log(`✅ SUCCESS (200)`);
        console.log(`   Markets Count: ${marketsData.markets.length}`);

        let foundQuote = false;
        for (const market of marketsData.markets) {
            if (foundQuote) break;
            console.log(`\n   Checking Market: ${market.ticker}`);

            const accounts = market.accounts || {};
            for (const collateralMint of Object.keys(accounts)) {
                if (foundQuote) break;

                const data = accounts[collateralMint];
                const mints = [
                    { name: 'YES', mint: data.yesMint },
                    { name: 'NO', mint: data.noMint }
                ];

                for (const m of mints) {
                    if (!m.mint) continue;

                    console.log(`   Attempting Quote: ${collateralMint} -> ${m.mint} (${m.name})`);

                    const quoteRes = await fetch(`${BASE_URL}/api/dflow/quote`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            inputMint: collateralMint,
                            outputMint: m.mint,
                            amount: '1000000',
                            slippageBps: 100
                        })
                    });

                    const quoteData = await quoteRes.json();
                    if (quoteRes.ok) {
                        console.log(`   ✅ SUCCESS! Out Amount: ${quoteData.outAmount}`);
                        foundQuote = true;
                        break;
                    } else {
                        console.log(`   ❌ FAILED: ${quoteData.error || 'Unknown error'}`);
                    }
                }
            }
        }

        if (!foundQuote) {
            console.log('\n❌ FAILED to find any working quote route in the first 5 markets.');
        }
    } else {
        console.log(`❌ FAILED to fetch DFlow markets`);
    }

    // 3. Polymarket Gamma Events
    await testEndpoint('Polymarket Gamma Events', `${BASE_URL}/api/markets/polymarket/events?limit=5`);

    // 4. Polymarket CLOB Proxy (Mid-tick)
    // Using a known token ID for testing
    const testTokenId = '21650291141401019994354144332545131614137162357591410110011116141113110211011';
    await testEndpoint('Polymarket CLOB Mid-tick', `${BASE_URL}/api/clob-proxy/mid-tick?token_id=${testTokenId}`);

    console.log('\nVerification Complete.');
}

runTests().catch(console.error);
