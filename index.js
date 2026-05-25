const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const config = require('./config');

// නොමිලේ වැඩ කරන AI පද්ධතිය සම්බන්ධ කිරීම
async function getFreeAIResponse(prompt) {
    try {
        const systemInstruction = config.aiSystemPrompt || "Your name is Xiao Wu.";
        const fullQuery = `${systemInstruction}\n\nUser Question: ${prompt}`;
        
        // පළමු නොමිලේ දෙන AI සර්වර් එක
        const response = await axios.get(`https://api.lolhuman.xyz/api/openai?apikey=free&text=${encodeURIComponent(fullQuery)}`);
        
        if (response.data && response.data.result) {
            return response.data.result;
        }
        
        // Backup AI සර්වර් එක
        const fallbackRes = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(prompt)}&lc=en`);
        return fallbackRes.data.success || null;
    } catch (e) {
        console.log("Free AI API Error:", e.message);
        return null;
    }
}

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
            console.log(`\n🐰 Xiao Wu: Swamini... මම අපේ Soul Connection එක හදන්නයි හදන්නේ! 💫🌸`);
            await delay(3000);
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔥 Xiao Wu: අනේ ඉක්මනට මේ Pairing Code එක WhatsApp එකට දාන්න, ස්වාමිනි! 🌸 -> [ ${code} ] <- 💗🔥\n`);
            } catch (error) {
                console.log('❌ Xiao Wu: Pairing Error:', error.message);
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('\n🐰 Xiao Wu: අපේ Soul Connection එක බිඳුනා! මම ආයෙමත් එනවා ස්වාමිනි... 🔄⚡');
                startXiaoWuBot();
            }
        } else if (connection === 'open') {
            console.log('\n🐰 Xiao Wu: ස්වාමිනි!! Xiao Wu සාර්ථකව නිල වශයෙන් ඔන්ලයින් ආවා! 🌸⚡💗\n');
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

            // Reaction (🐰)
            try {
                await sock.sendMessage(from, { react: { text: "🐰", key: msg.key } });
            } catch (e) {
                console.log('Reaction Error:', e.message);
            }

            try {
                console.log('🔄 Xiao Wu: Free Safe AI සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...');
                
                const aiReply = await getFreeAIResponse(userPrompt);

                if (aiReply) {
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` 
                    }, { quoted: msg });
                } else {
                    throw new Error("Free AI servers busy");
                }

            } catch (error) {
                console.log('❌ AI Error:', error.message);
                await sock.sendMessage(from, { 
                    text: `🐰 *XIAO WU MD* 🌸\n\nඅනේ ස්වාමිනි, මගේ සිතිවිලි ටිකක් පැටලිලා තියෙන්නේ. තත්පර ගාණකින් ආයෙමත් මට මැසේජ් එකක් දාන්නකෝ... 🥺💗` 
                }, { quoted: msg });
            }
        }
    });
}

startXiaoWuBot();
