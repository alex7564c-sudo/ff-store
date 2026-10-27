const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const token = '8379623803:AAGkXj3HikDkQkX1YMV7PGwH9ifwAnwJPg8'; // Apnar bot token
const chatId = '6782089696'; // Apnar chat ID
const bot = new TelegramBot(token, { polling: true });

let users = []; // User storage ({ username, password, customId })
let chatMessages = {}; // Store messages per customId

// Register API (Unique 4-digit ID generation)
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        return res.json({ success: false, message: 'Username already exists!' });
    }
    
    let customId;
    do {
        customId = Math.floor(1000 + Math.random() * 9000).toString();
    } while (users.some(u => u.customId === customId));

    users.push({ username, password, customId });
    chatMessages[customId] = [];

    res.json({ success: true, message: `Registration successful! Your ID is: ${customId}`, customId });
});

// Login API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({ success: true, message: 'Login successful!', customId: user.customId, username: user.username });
    } else {
        res.json({ success: false, message: 'Invalid username or password!' });
    }
});

// Buy API
app.post('/api/buy', (req, res) => {
    const { buyerNumber, cashoutNumber, trxId, selectedId, customId } = req.body;
    const message = `🛒 *New Buy Request!*\n\nUser ID: \`${customId}\`\n🎮 Game ID: ${selectedId}\n📱 Buyer Number: ${buyerNumber}\n💸 Cashout Number: ${cashoutNumber}\n📝 TrxID: \`${trxId}\``;
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    res.json({ success: true, message: 'Order submitted successfully to RoBo!' });
});

// Sell API
app.post('/api/sell', (req, res) => {
    const { sellerEmail, sellerPassword, price, customId } = req.body;
    const message = `📤 *New ID Submission!*\n\nUser ID: \`${customId}\`\n📧 Email: \`${sellerEmail}\`\n🔑 Password: \`${sellerPassword}\`\n💰 Asking Price: ${price} BDT`;
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    res.json({ success: true, message: 'ID submitted successfully to RoBo!' });
});

// Get chat messages for specific user ID
app.get('/api/messages/:customId', (req, res) => {
    const { customId } = req.params;
    res.json(chatMessages[customId] || []);
});

// Send message from website to RoBo (Telegram)
app.post('/api/chat', (req, res) => {
    const { customId, username, message } = req.body;
    if (!chatMessages[customId]) chatMessages[customId] = [];

    chatMessages[customId].push({ sender: username || 'User', message, time: new Date().toLocaleTimeString() });
    
    // Telegram format specified by user
    const tgMessage = `user id : ${customId}\ntext : ${message}`;
    bot.sendMessage(chatId, tgMessage);
    
    res.json({ success: true });
});

// Listen to Telegram messages from RoBo (Admin format: /0987 Hello)
bot.on('message', (msg) => {
    if (msg.chat.id.toString() === chatId && msg.text) {
        const text = msg.text.trim();
        if (text.startsWith('/')) {
            const parts = text.split(' ');
            const targetId = parts[0].replace('/', '');
            const replyText = parts.slice(1).join(' ');

            if (targetId && replyText) {
                if (!chatMessages[targetId]) chatMessages[targetId] = [];
                chatMessages[targetId].push({ sender: 'RoBo', message: replyText, time: new Date().toLocaleTimeString() });
                bot.sendMessage(chatId, `✅ Message sent to ID ${targetId} successfully!`);
            } else {
                bot.sendMessage(chatId, `⚠️ Format error! Use: /ID message (e.g., /${targetId || '0987'} Hello)`);
            }
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
