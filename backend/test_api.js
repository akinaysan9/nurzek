import fetch from 'node-fetch';

async function testResult() {
    try {
        console.log("Testing /api/references...");
        const res = await fetch('http://localhost:3001/api/references', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: "iman ve küfür" })
        });

        console.log("Status:", res.status);
        if (res.ok) {
            const data = await res.json();
            console.log("Response:", JSON.stringify(data, null, 2));
        } else {
            console.log("Error Text:", await res.text());
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testResult();
