import fetch from 'node-fetch';

async function testSimplify() {
    console.log('Testing /api/analyze/simplify endpoint...');

    const text = 'Binaenaleyh, her kim hayat-ı faniyi esas maksat yapsa, zahiren bir cennet içinde olsa da, manen cehennemdedir.';

    try {
        const response = await fetch('http://localhost:3000/api/analyze/simplify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        console.log(`Status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error Response:', errorText);
            return;
        }

        const reader = response.body; // node-fetch body is a stream
        reader.on('data', (chunk) => {
            console.log('Received chunk:', chunk.toString());
        });

        reader.on('end', () => {
            console.log('Stream ended.');
        });

    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

testSimplify();
