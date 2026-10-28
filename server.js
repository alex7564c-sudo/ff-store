const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Bot Credentials
const token = '8379623803:AAGkXj3HikDkQkX1YMV7PGwH9ifwAnwJPg8';
const chatId = '6782089696';
const bot = new TelegramBot(token, { polling: true });

// File Paths for Data Persistence
const USERS_FILE = path.join(__dirname, 'users.json');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const CHATS_FILE = path.join(__dirname, 'chats.json');

function loadData(filePath, defaultVal) {
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            return defaultVal;
        }
    }
    return defaultVal;
}

function saveData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

let users = loadData(USERS_FILE, []);
let products = loadData(PRODUCTS_FILE, []);
let chatMessages = loadData(CHATS_FILE, {});

// Auto Cleanup Routine (3 Days Expiry)
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    const initialLen = users.length;
    users = users.filter(user => {
        const isExpired = (now - (user.createdAt || now)) > THREE_DAYS_MS;
        if (isExpired) {
            delete chatMessages[user.customId];
        }
        return !isExpired;
    });
    if (users.length !== initialLen) {
        saveData(USERS_FILE, users);
        saveData(CHATS_FILE, chatMessages);
    }
}, 60 * 60 * 1000);

/* ================= AUTHENTICATION & FLEXIBLE PHONE VALIDATION ================= */

app.post('/api/register', (req, res) => {
    let { username, phone, password } = req.body;
    
    if (!username || !phone || !password) {
        return res.json({ success: false, message: 'সবগুলো তথ্য সঠিকভাবে পূরণ করুন!' });
    }

    // Username Validation: Alphanumeric only
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
        return res.json({ success: false, message: 'ইউজারনেমে শুধু ইংরেজি অক্ষর ও সংখ্যা ব্যবহার করুন!' });
    }

    // Clean phone input (remove spaces/dashes if any)
    phone = phone.trim();

    // Flexible Bangladeshi Phone Validation:
    // Accepts either 10 digits starting with '1' (e.g. 17xxxxxxxx) or 11 digits starting with '01' (e.g. 017xxxxxxxx)
    const phoneRegex10 = /^1[3-9]\d{8}$/; // 10 digits starting with 1
    const phoneRegex11 = /^01[3-9]\d{8}$/; // 11 digits starting with 01

    let formattedPhone = '';
    if (phoneRegex10.test(phone)) {
        formattedPhone = '+880' + phone; // Automatically adds 0 if typed without 0
    } else if (phoneRegex11.test(phone)) {
        formattedPhone = '+88' + phone; // Keeps full number with 0
    } else {
        return res.json({ success: false, message: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 17xxxxxxxx অথবা 017xxxxxxxx)!' });
    }

    const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
        return res.json({ success: false, message: 'এই ইউজারনেমটি দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট খোলা আছে!' });
    }

    let customId;
    do {
        customId = Math.floor(1000 + Math.random() * 9000).toString();
    } while (users.some(u => u.customId === customId));

    const newUser = { username, phone: formattedPhone, password, customId, createdAt: Date.now() };
    users.push(newUser);
    chatMessages[customId] = [];

    saveData(USERS_FILE, users);
    saveData(CHATS_FILE, chatMessages);

    res.json({ success: true, message: `রেজিস্ট্রেশন সফল! আপনার ইউজার আইডি: ${customId}`, customId, username });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
    if (user) {
        res.json({ success: true, message: 'লগইন সফল হয়েছে!', customId: user.customId, username: user.username });
    } else {
        res.json({ success: false, message: 'ইউজারনেম অথবা পাসওয়ার্ড ভুল হয়েছে!' });
    }
});

/* ================= PRODUCTS & ACTION APIS ================= */

app.get('/api/products', (req, res) => {
    res.json(products);
});

app.post('/api/autobuy', (req, res) => {
    const { productId, productTitle, productPrice, customId } = req.body;
    const user = users.find(u => u.customId === customId);
    const usernameStr = user ? user.username : 'N/A';

    const message = `🛒 *Instant Buy Request!*\n\nUsername : ${usernameStr}\nUser ID : ${customId}\n🎮 Item : ${productTitle}\n💰 Price : ${productPrice}\n🔢 Code : \`${productId}\``;
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    if (!chatMessages[customId]) chatMessages[customId] = [];
    const autoBotMsg = `Robot: আপনার অর্ডার রিকোয়েস্ট (${productTitle} - ${productPrice}) সফলভাবে রিসিভ করা হয়েছে! পেমেন্ট ও অন্যান্য বিষয়ে এখন সরাসরি চ্যাটে কথা বলুন।`;
    chatMessages[customId].push({ sender: 'Robot', message: autoBotMsg, time: new Date().toLocaleTimeString() });
    saveData(CHATS_FILE, chatMessages);

    res.json({ success: true, message: 'Order sent!' });
});

app.post('/api/autosell', (req, res) => {
    const { customId } = req.body;
    const user = users.find(u => u.customId === customId);
    const usernameStr = user ? user.username : 'N/A';

    const message = `📤 *New ID Sell Request Clicked!*\n\nUsername : ${usernameStr}\nUser ID : ${customId}\n📝 Status : User wants to sell an account. Chat opened!`;
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    if (!chatMessages[customId]) chatMessages[customId] = [];
    const autoBotMsg = `Robot: আপনার আইডি বিক্রির রিকোয়েস্ট অ্যাডমিনের কাছে পাঠানো হয়েছে! এখন এই চ্যাটেই আপনার আইডির ডিটেইলস (Gmail, Password, Price) দিন।`;
    chatMessages[customId].push({ sender: 'Robot', message: autoBotMsg, time: new Date().toLocaleTimeString() });
    saveData(CHATS_FILE, chatMessages);

    res.json({ success: true, message: 'Sell request sent!' });
});

/* ================= CHAT API ================= */

app.get('/api/messages/:customId', (req, res) => {
    const { customId } = req.params;
    res.json(chatMessages[customId] || []);
});

app.post('/api/chat', (req, res) => {
    const { customId, username, message } = req.body;
    if (!chatMessages[customId]) chatMessages[customId] = [];

    const user = users.find(u => u.customId === customId);
    const uName = user ? user.username : (username || 'N/A');

    chatMessages[customId].push({ sender: uName, message, time: new Date().toLocaleTimeString() });
    saveData(CHATS_FILE, chatMessages);

    const tgMessage = `Username : ${uName}\nUser ID : ${customId}\nText : ${message}`;
    bot.sendMessage(chatId, tgMessage);

    res.json({ success: true });
});

/* ================= TELEGRAM BOT ADMIN COMMANDS ================= */

bot.on('message', async (msg) => {
    if (msg.chat.id.toString() !== chatId) return;

    const text = msg.text ? msg.text.trim() : '';
    const caption = msg.caption ? msg.caption.trim() : '';

    if (msg.photo && caption.startsWith('/add')) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const imageUrl = await bot.getFileLink(fileId);
        
        const rawContent = caption.replace('/add', '').trim();
        const parts = rawContent.split('|');
        const titlePart = parts[0] || 'Free Fire Rare Account';
        const pricePart = parts[1] || 'Negotiable';

        const title = titlePart.replace(/ID:\s*/i, '').trim();
        const price = pricePart.replace(/Price:\s*/i, '').trim();

        const newProd = {
            id: 'FF-' + Math.floor(100 + Math.random() * 900),
            title: title || 'Free Fire ID',
            price: price || 'Contact Admin',
            imageUrl: imageUrl,
            status: 'AVAILABLE',
            createdAt: Date.now()
        };

        products.unshift(newProd);
        saveData(PRODUCTS_FILE, products);
        bot.sendMessage(chatId, `✅ *Product Added!*\n🏷️ ${newProd.title}\n💰 ${newProd.price}\n🔢 Code: \`${newProd.id}\``, { parse_mode: 'Markdown' });
        return;
    }

    if (text.startsWith('/sold')) {
        const query = text.replace('/sold', '').trim().toLowerCase();
        const prod = products.find(p => p.id.toLowerCase() === query || p.title.toLowerCase().includes(query));
        if (prod) {
            prod.status = 'SOLD OUT';
            saveData(PRODUCTS_FILE, products);
            bot.sendMessage(chatId, `❌ Marked SOLD OUT: ${prod.title}`);
        } else {
            bot.sendMessage(chatId, `⚠️ Product not found!`);
        }
        return;
    }

    if (text.startsWith('/delete')) {
        const query = text.replace('/delete', '').trim().toLowerCase();
        const initialLen = products.length;
        products = products.filter(p => p.id.toLowerCase() !== query && !p.title.toLowerCase().includes(query));
        if (products.length < initialLen) {
            saveData(PRODUCTS_FILE, products);
            bot.sendMessage(chatId, `🗑️ Product deleted.`);
        } else {
            bot.sendMessage(chatId, `⚠️ Product not found!`);
        }
        return;
    }

    if (text === '/stock') {
        if (products.length === 0) {
            bot.sendMessage(chatId, `📦 Stock is empty.`);
            return;
        }
        let listStr = `📦 *Stock List (${products.length}):*\n\n`;
        products.forEach((p, idx) => {
            listStr += `${idx + 1}. *${p.title}* (${p.price}) - \`${p.status}\` [${p.id}]\n`;
        });
        bot.sendMessage(chatId, listStr, { parse_mode: 'Markdown' });
        return;
    }

    if (text.startsWith('/')) {
        const parts = text.split(' ');
        const targetId = parts[0].replace('/', '');
        const replyText = parts.slice(1).join(' ');

        if (targetId && replyText) {
            if (!chatMessages[targetId]) chatMessages[targetId] = [];
            chatMessages[targetId].push({ sender: 'Robot', message: replyText, time: new Date().toLocaleTimeString() });
            saveData(CHATS_FILE, chatMessages);
            bot.sendMessage(chatId, `✅ Reply sent to ID \`${targetId}\`!`, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, `⚠️ Error! Use: \`/ID message\``);
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
