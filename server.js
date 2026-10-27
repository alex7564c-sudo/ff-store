const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Apnar Bot Token ebong Chat ID ekhane boshan
const token = '8379623803:AAGkXj3HikDkQkX1YMV7PGwH9ifwAnwJPg8';
const chatId = '6782089696';
const bot = new TelegramBot(token, { polling: true });

// Store messages in memory for simplicity (Live chat history)
let chatMessages = [];

// Buyer Payment Submit API
app.post('/api/buy', (req, res) => {
    const { buyerNumber, cashoutNumber, trxId, selectedId } = req.body;
    const message = `🛒 *New Buy Request!*\n\n🎮 ID: ${selectedId}\n📱 Buyer Number: ${buyerNumber}\n💸 Cashout Number: ${cashoutNumber}\n📝 TrxID: \`${trxId}\``;
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    res.json({ success: true, message: 'Order submitted successfully!' });
});

// Seller ID Submit API
app.post('/api/sell', (req, res) => {
    const { sellerEmail, sellerPassword, price } = req.body;
    const message = `📤 *New ID Submission!*\n\n📧 Email: \`${sellerEmail}\`\n🔑 Password: \`${sellerPassword}\`\n💰 Asking Price: ${price} BDT`;
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    res.json({ success: true, message: 'ID submitted successfully!' });
});

// Get chat messages for website
app.get('/api/messages', (req, res) => {
    res.json(chatMessages);
});

// Send message from website to admin Telegram
app.post('/api/chat', (req, res) => {
    const { sender, message } = req.body;
    chatMessages.push({ sender: sender || 'User', message, time: new Date().toLocaleTimeString() });
    
    const tgMessage = `💬 *New Chat Message from Website:*\n\n${message}`;
    bot.sendMessage(chatId, tgMessage, { parse_mode: 'Markdown' });
    
    res.json({ success: true });
});

// Listen to Telegram messages from Admin to reply back
bot.on('message', (msg) => {
    if (msg.chat.id.toString() === chatId && msg.text) {
        // If admin replies with text (or /reply format)
        if (!msg.text.startsWith('/')) {
            chatMessages.push({ sender: 'Admin', message: msg.text, time: new Date().toLocaleTimeString() });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
