const { Connection } = require('@solana/web3.js');

async function checkTx() {
    const signature = 'GwCRzRQtvEcuYRAXub7ywKDcLycigFzAvR8bvPQ2UPhmpGXKHS3rYDRg1q5j77YG4Cdaybazp3dXggHb8sq3CYf';
    // Use mainnet public RPC
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

    console.log(`Checking signature: ${signature}`);

    try {
        const { value } = await connection.getSignatureStatus(signature);
        console.log('Status:', JSON.stringify(value, null, 2));

        if (value?.confirmationStatus) {
            console.log(`Transaction is ${value.confirmationStatus}`);
        } else {
            console.log('Transaction not found or expired');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkTx();
