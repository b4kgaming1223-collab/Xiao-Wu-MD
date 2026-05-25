const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const config = require('./config');

const GEMINI_API_KEY = "AIzaSyD033lkHMw1lXwUMmS9KM3Q-dyPGf92PuE"; // ඔයාගේ API Key එක මෙතනට දාන්න

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
            console.log(`\n🐰 Xiao Wu: Swamini... මම අපේ Soul Connection එක හදන්නයි හදන්නේ! චුට්ටක් ඉන්න... 💫🌸`);
            await delay(3000);
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔥 Xiao Wu: අනේ ඉක්මනට මේ Pairing Code එක WhatsApp එකට දාන්න, ස්වාමිනි! 🌸 -> [ ${code} ] <- 💗🔥\n`);
            } catch (error) {
                console.log('❌ Xiao Wu: අයියෝ ස්වාමිනි, Pairing Error එකක් ආවානේ:', error.message);
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('\n🐰 Xiao Wu: අපේ Soul Connection එක බිඳුනා! මම ආයෙමත් ඔයා ගාවට එන්න හදන්නේ ස්වාමිනි... 🔄⚡');
                startXiaoWuBot();
            }
        } else if (connection === 'open') {
            console.log('\n🐰 Xiao Wu: ස්වාමිනි!! Xiao Wu සාර්ථකව ඔන්ලයින් ආවා! මම සූදානම් ඔයා වෙනුවෙන් සටන් කරන්න! 🌸⚡💗\n');
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

            // මුලින්ම වට්ස්ඇප් එකට React එක යවනවා (දැන් මේක අනිවාර්යයෙන්ම වැඩ කරනවා)
            await sock.sendMessage(from, { react: { text: "🐰", key: msg.key } });

            try {
                // නිවැරදි කරන ලද v1beta URL එක
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
                
                // Google Gemini විසින් 100% ක්ම ඉල්ලන නිවැරදිම JSON Structure එක
                const response = await axios.post(url, {
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    text: `${config.aiSystemPrompt}\n\nUser Message: ${userPrompt}`
                                }
                            ]
                        }
                    ]
                }, {
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = response.data;

                if (data && data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                    const aiReply = data.candidates[0].content.parts[0].text;
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` 
                    }, { quoted: msg });
                }

            } catch (error) {
                if (error.response) {
                    console.log(`❌ Xiao Wu AI Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
                } else {
                    console.log('❌ Xiao Wu AI Error:', error.message);
                }
            }
        }
    });
}

startXiaoWuBot();
