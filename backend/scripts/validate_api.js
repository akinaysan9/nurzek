
import fetch from 'node-fetch';

async function testChat() {
    console.log("Testing Chat API...");
    try {
        const response = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: "Risale-i Nur nedir?",
                history: []
            })
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        if (data.answer) {
            console.log("✅ API Success! Answer prefix:", data.answer.substring(0, 50));
        } else {
            console.error("❌ API Failed:", data);
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}
testChat();
