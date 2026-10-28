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

// Helper Functions to Load/Save JSON Data
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

// Auto Cleanup Routine (Deletes accounts & chats older than 3 days)
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
}, 60 * 60 * 1000); // Check every hour

/* =========================================
   USER AUTHENTICATION API
   ========================================= */

app.post('/api/register', (req, res) => {
    const { fullName, username, phone, password } = req.body;
    
    if (!fullName || !username || !phone || !password) {
        return res.json({ success: false, message: 'সবগুলো তথ্য সঠিকভাবে পুরন করুন!' });
    }

    const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
        return res.json({ success: false, message: 'এই ইউজারনেমটি দিয়ে অলরেডি একাউন্ট খোলা আছে!' });
    }

    let customId;
    do {
        customId = Math.floor(1000 + Math.random() * 9000).toString();
    } while (users.some(u => u.customId === customId));

    const newUser = {
        fullName,
        username,
        phone,
        password,
        customId,
        createdAt: Date.now()
    };

    users.push(newUser);
    chatMessages[customId] = [];

    saveData(USERS_FILE, users);
    saveData(CHATS_FILE, chatMessages);

    res.json({
        success: true,
        message: `রেজিস্ট্রেশন সফল হয়েছে! আপনার অনন্য আইডি: ${customId}`,
        customId,
        username,
        fullName
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
    if (user) {
        res.json({
            success: true,
            message: 'লগইন সফল হয়েছে!',
            customId: user.customId,
            username: user.username,
            fullName: user.fullName
        });
    } else {
        res.json({ success: false, message: 'ইউজারনেম অথবা পাসওয়ার্ড ভুল হয়েছে!' });
    }
});

/* =========================================
   MARKETPLACE & PRODUCTS API
   ========================================= */

app.get('/api/products', (req, res) => {
    res.json(products);
});

app.post('/api/buy', (req, res) => {
    const { buyerNumber, cashoutNumber, trxId, selectedId, customId } = req.body;
    const user = users.find(u => u.customId === customId);
    const nameStr = user ? user.fullName : 'N/A';
    const usernameStr = user ? user.username : 'N/A';

    const message = `🛒 *New Buy Request!*\n\nName : ${nameStr}\nUsername : ${usernameStr}\nUser ID : ${customId}\n🎮 Selected ID : ${selectedId}\n📱 Buyer Phone : ${buyerNumber}\n💸 Cashout Phone : ${cashoutNumber}\n📝 TrxID : \`${trxId}\``;
    bot.sendMessage(chatId, message);
    res.json({ success: true, message: 'আপনার কেনার অনুরোধটি Robot এর কাছে জমা হয়েছে!' });
});

app.post('/api/sell', (req, res) => {
    const { sellerEmail, sellerPassword, price, customId } = req.body;
    const user = users.find(u => u.customId === customId);
    const nameStr = user ? user.fullName : 'N/A';
    const usernameStr = user ? user.username : 'N/A';

    const message = `📤 *New ID Sale Submission!*\n\nName : ${nameStr}\nUsername : ${usernameStr}\nUser ID : ${customId}\n📧 Account Email/Phone : \`${sellerEmail}\`\n🔑 Password : \`${sellerPassword}\`\n💰 Asking Price : ${price} BDT`;
    bot.sendMessage(chatId, message);
    res.json({ success: true, message: 'আপনার বিক্রি করার অনুরোধটি Robot এর কাছে সফলভাবে পাঠানো হয়েছে!' });
});

/* =========================================
   LIVE CHAT SYSTEM API
   ========================================= */

app.get('/api/messages/:customId', (req, res) => {
    const { customId } = req.params;
    res.json(chatMessages[customId] || []);
});

app.post('/api/chat', (req, res) => {
    const { customId, username, message } = req.body;
    if (!chatMessages[customId]) chatMessages[customId] = [];

    const user = users.find(u => u.customId === customId);
    const fullName = user ? user.fullName : (username || 'User');
    const uName = user ? user.username : (username || 'N/A');

    chatMessages[customId].push({ sender: fullName, message, time: new Date().toLocaleTimeString() });
    saveData(CHATS_FILE, chatMessages);

    const tgMessage = `Name : ${fullName}\nUsername : ${uName}\nUser ID : ${customId}\nText : ${message}`;
    bot.sendMessage(chatId, tgMessage);

    res.json({ success: true });
});

/* =========================================
   TELEGRAM BOT CONTROLLER (CMS & ADMIN REPLIES)
   ========================================= */

bot.on('message', async (msg) => {
    if (msg.chat.id.toString() !== chatId) return;

    const text = msg.text ? msg.text.trim() : '';
    const caption = msg.caption ? msg.caption.trim() : '';

    // 1. Add Product via Photo Upload with Caption (/add ID: Title | Price: 1000 BDT)
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

        bot.sendMessage(chatId, `✅ *Product Added Successfully!*\n\n🏷️ *ID:* ${newProd.title}\n💰 *Price:* ${newProd.price}\n🔢 *Code:* \`${newProd.id}\``, { parse_mode: 'Markdown' });
        return;
    }

    // 2. Command: /sold <title_or_code>
    if (text.startsWith('/sold')) {
        const query = text.replace('/sold', '').trim().toLowerCase();
        const prod = products.find(p => p.id.toLowerCase() === query || p.title.toLowerCase().includes(query));
        if (prod) {
            prod.status = 'SOLD OUT';
            saveData(PRODUCTS_FILE, products);
            bot.sendMessage(chatId, `❌ Product Marked as *SOLD OUT*: ${prod.title}`, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, `⚠️ Product not found matching "${query}"`);
        }
        return;
    }

    // 3. Command: /delete <title_or_code>
    if (text.startsWith('/delete')) {
        const query = text.replace('/delete', '').trim().toLowerCase();
        const initialLen = products.length;
        products = products.filter(p => p.id.toLowerCase() !== query && !p.title.toLowerCase().includes(query));
        if (products.length < initialLen) {
            saveData(PRODUCTS_FILE, products);
            bot.sendMessage(chatId, `🗑️ Product deleted matching "${query}"`);
        } else {
            bot.sendMessage(chatId, `⚠️ Product not found matching "${query}"`);
        }
        return;
    }

    // 4. Command: /stock
    if (text === '/stock') {
        if (products.length === 0) {
            bot.sendMessage(chatId, `📦 Stock is currently empty.`);
            return;
        }
        let listStr = `📦 *Current Stock List (${products.length} Items):*\n\n`;
        products.forEach((p, idx) => {
            listStr += `${idx + 1}. *${p.title}* (${p.price}) - \`${p.status}\` | Code: \`${p.id}\`\n`;
        });
        bot.sendMessage(chatId, listStr, { parse_mode: 'Markdown' });
        return;
    }

    // 5. Admin Reply to Live Chat (Format: /0987 Hello)
    if (text.startsWith('/')) {
        const parts = text.split(' ');
        const targetId = parts[0].replace('/', '');
        const replyText = parts.slice(1).join(' ');

        if (targetId && replyText) {
            if (!chatMessages[targetId]) chatMessages[targetId] = [];
            chatMessages[targetId].push({ sender: 'Robot', message: replyText, time: new Date().toLocaleTimeString() });
            saveData(CHATS_FILE, chatMessages);
            bot.sendMessage(chatId, `✅ Message delivered to User ID \`${targetId}\`!`, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, `⚠️ Format Error! Use: \`/ID message\` (e.g., \`/0987 Hello\`)`, { parse_mode: 'Markdown' });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
