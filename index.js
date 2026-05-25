const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./config');
const { GoogleGenAI } = require('@google/genai');

// 🔑 ඔයා ලබාගත් Gemini API Key එක මෙතනට දාන්න ලියෝ 👇
const GEMINI_API_KEY = "AIzaSyBTQfOdu6081-7_XOVomUN-UVI__ONCADo";

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function startXiaoWuBot() {
    const { state, saveCreds } = await useMultiFileAuthState('xiao_wu_session');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    if (!sock.authState.creds.registered) {
        let phoneNumber = config.ownerNumber.replace(/[^0-9]/g, '');
        if (phoneNumber) {
            console.log(`\n🐰 XIAO WU MD: Pairing Code එක සකසමින් පවතිනවා... 💫`);
            await delay(3000);
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔥 YOUR XIAO WU MD PAIRING CODE IS: ${code} 🔥\n`);
            } catch (error) {
                console.log('❌ Pairing Code Error:', error.message);
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startXiaoWuBot();
        } else if (connection === 'open') {
            console.log('\n🐰 XIAO WU MD IS SUCCESSFULLY ONLINE! 🌸⚡\n');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!textMessage) return;

        const isGroup = from.endsWith('@g.us');
        const isTarget = isGroup ? textMessage.toLowerCase().includes('xiao wu') : true;

        if (isTarget) {
            const userPrompt = textMessage.replace(/xiao wu/gi, '').trim();
            if (!userPrompt) return;

            await sock.sendMessage(from, { react: { text: "🐰", key: msg.key } });

            try {
                // 🚀 Bulletproof Official Google GenAI SDK Call
                const response = await ai.models.generateContent({
                    model: 'gemini-1.5-flash',
                    contents: `${config.aiSystemPrompt}\n\nUser Message: ${userPrompt}`,
                });

                if (response && response.text) {
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${response.text}` 
                    }, { quoted: msg });
                } else {
                    console.log('❌ Response empty');
                }

            } catch (error) {
                console.log('❌ Official Gemini SDK Error:', error.message);
            }
        }
    });
}

startXiaoWuBot();
