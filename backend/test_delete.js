import puppeteer from 'puppeteer';

(async () => {
    console.log('Starting puppeteer...');
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('BROWSER ERROR:', msg.text());
            } else {
                console.log('BROWSER LOG:', msg.text());
            }
        });

        await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });

        // ensure side panel is open
        await page.evaluate(() => {
            if (typeof window.toggleNav === 'function' && !document.getElementById('mySidebar').classList.contains('open')) {
                window.toggleNav();
            }
            if (typeof window.switchTab === 'function') {
                window.switchTab('notes');
            }
        });

        await new Promise(r => setTimeout(r, 1000));

        // We evaluate and click the delete button. If there's no note, let's create one first
        await page.evaluate(async () => {
            const delBtns = document.querySelectorAll('button[onclick*="deleteNote"]');
            if (delBtns.length > 0) {
                console.log('Found delete button, clicking...');
                delBtns[0].click();
            } else {
                console.log('BROWSER ERROR: No delete button found. Simulating deleteNote call directly on an empty string.');
                if (typeof window.deleteNote === 'function') {
                    window.deleteNote('dummy_id');
                } else {
                    console.log('BROWSER ERROR: deleteNote function is not found on window object.');
                }
            }
        });

        await new Promise(r => setTimeout(r, 3000));
        await browser.close();
        console.log('Test completed.');
    } catch (e) {
        console.log('TEST SCRIPT HATA:', e);
    }
})();
