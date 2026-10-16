const puppeteer = require('puppeteer');

let currentBrowser = null;

async function startIvaSmsPuppeteer(botToken, groupId, cookieString) {
    try {
        if (currentBrowser) {
            await currentBrowser.close().catch(()=>{});
        }

        console.log("🚀 Launching Low-RAM Puppeteer Chromium Instance...");

        currentBrowser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-dev-tools',
                '--no-default-browser-check',
                '--disable-extensions',
                '--disable-component-extensions-with-background-pages'
            ]
        });

        currentBrowser.on('disconnected', async () => {
            console.error("⚠️ Puppeteer Browser Disconnected!");
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: groupId,
                    text: `⚠️ <b>Puppeteer Disconnected!</b>\n🔄 Automatically reconnecting in 5s...`,
                    parse_mode: 'HTML'
                })
            }).catch(()=>{});

            setTimeout(() => {
                startIvaSmsPuppeteer(botToken, groupId, cookieString);
            }, 5000);
        });

        const page = await currentBrowser.newPage();

        page.on('error', async (err) => {
            console.error("❌ Puppeteer Page Error/Crash:", err.message);
            await currentBrowser.close().catch(()=>{});
        });

        // Save RAM by blocking heavy resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Set Cookie if available
        if (cookieString) {
            const cookies = cookieString.split(';').map(pair => {
                const [name, ...val] = pair.trim().split('=');
                if (!name || val.length === 0) return null;
                return {
                    name: name.trim(),
                    value: val.join('=').trim(),
                    domain: '.ivasms.com'
                };
            }).filter(Boolean);

            if (cookies.length > 0) {
                await page.setCookie(...cookies);
            }
        }

        // Intercept Response Data to capture OTPs
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('socket.io') || url.includes('auth2026clean') || url.includes('my_sms')) {
                try {
                    const text = await response.text();
                    const otpMatch = text.match(/\b\d{4,8}\b/);

                    if (otpMatch) {
                        const otpCode = otpMatch[0];
                        console.log("⚡ Puppeteer Live OTP Found:", otpCode);

                        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: groupId,
                                text: `🚀 <b>IvaSMS Live OTP:</b> <code>${otpCode}</code>`,
                                parse_mode: 'HTML'
                            })
                        }).catch(()=>{});
                    }
                } catch (e) {}
            }
        });

        await page.goto('https://www.ivasms.com/portal/live/my_sms', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        const currentUrl = page.url();
        const pageTitle = await page.title();

        if (currentUrl.includes('/login')) {
            console.log("❌ Login Failed! Cookie Expired.");

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: groupId,
                    text: `❌ <b>IvaSMS Login Failed!</b>\n\n⚠️ Cookie-টি expired হয়ে গেছে।\n\n👉 <code>/admin</code> panel-এ গিয়ে <b>⚡ IvaSMS Settings > 🔄 Update Cookie</b> থেকে নতুন Cookie দিন।`,
                    parse_mode: 'HTML'
                })
            }).catch(()=>{});

            await currentBrowser.close().catch(()=>{});
        } else {
            console.log("🟢 Puppeteer connected & logged in successfully on IvaSMS!");

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: groupId,
                    text: `🟢 <b>IvaSMS Cookie Verified & Login Successful!</b>\n\n📌 <b>Panel:</b> <code>${pageTitle}</code>\n⚡ Puppeteer Live OTP monitoring active!`,
                    parse_mode: 'HTML'
                })
            }).catch(()=>{});
        }

    } catch (err) {
        console.error("❌ Puppeteer Launch Error:", err.message);

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: groupId,
                text: `❌ <b>Puppeteer Error:</b> <code>${err.message}</code>\n🔄 Retrying in 10s...`,
                parse_mode: 'HTML'
            })
        }).catch(()=>{});

        setTimeout(() => {
            startIvaSmsPuppeteer(botToken, groupId, cookieString);
        }, 10000);
    }
}

module.exports = { startIvaSmsPuppeteer };
