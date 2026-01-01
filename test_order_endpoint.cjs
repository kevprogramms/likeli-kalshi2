const https = require('https');

const API_KEY = 'CfGAio5BHSeEvCNVwiXV';
const API_BASE_URL = 'b.quote-api.dflow.net'; // Try 'quote-api' if this fails
// const API_BASE_URL = 'quote-api.dflow.net'; 

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// Example outcome mint from recent logs
const YES_MINT = '8U2gUJpbtQoZrPJnA186spoQk3Jkgg3yucXUcPHgAcFy';
const DUMMY_USER = 'D1W6s4WRllCTDRGYTRxVnVIX6X6'; // Invalid
const VALID_USER_KEY = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'; // Valid example


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
    const amount = 1000000; // 1 USDC
    const slippageBps = 500;

    // Construct query params
    const params = new URLSearchParams({
        inputMint: USDC_MINT,
        outputMint: YES_MINT,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        userPublicKey: VALID_USER_KEY
    });

    const path = `/order?${params.toString()}`;
    console.log(`Testing GET https://${API_BASE_URL}${path}`);

    const res = await get(API_BASE_URL, path);
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${res.data.slice(0, 500)}`);
}

run();
