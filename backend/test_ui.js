import puppeteer from 'puppeteer';

(async () => {
    console.log('Starting puppeteer...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER ERROR:', msg.text());
        } else {
            console.log('BROWSER LOG:', msg.text());
        }
    });

    try {
        await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });

        console.log('Switching to map tab...');
        await page.evaluate(() => {
            if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('map');
        });
        await new Promise(r => setTimeout(r, 1000));

        console.log('Entering "rahmet" and generating map...');
        await page.waitForSelector('#concept-map-input');
        await page.evaluate(() => {
            const input = document.getElementById('concept-map-input');
            input.value = 'rahmet';
            const btn = document.querySelector('button[onclick="generateMap()"]');
            btn.click();
        });

        await page.waitForFunction(() => {
            const container = document.getElementById('concept-map-container');
            return container && container.innerHTML.includes('canvas');
        }, { timeout: 15000 });

        console.log('Map drawn successfully. Waiting for physics stabilization...');
        await new Promise(r => setTimeout(r, 2000));

        console.log('Clicking the "rahmet" root node to open Concept Card...');
        await page.evaluate(() => {
            window.showConceptCard('rahmet');
        });

        await page.waitForSelector('.occurrence-item', { timeout: 10000 });
        console.log('Concept Card opened. Clicking first occurrence...');

        await page.evaluate(() => {
            const item = document.querySelector('.occurrence-item');
            if (item) item.click();
        });

        console.log('Navigation triggered. Waiting 3 seconds to catch errors...');
        await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
        console.log('TEST SCRIPT HATA:', e);
    } finally {
        await browser.close();
        console.log('Test completed.');
    }
})();
