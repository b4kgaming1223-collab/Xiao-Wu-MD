const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const config = require('./config');

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

            // Reaction එක කලින්ම වදිනවා
            try {
                await sock.sendMessage(from, { react: { text: "🐰", key: msg.key } });
            } catch (e) {
                console.log('Reaction Error:', e.message);
            }

            const fullPrompt = `${config.aiSystemPrompt}\n\nUser Message: ${userPrompt}`;
            let aiReply = null;

            // --- API 1: Hercai API ---
            try {
                console.log('🔄 Xiao Wu: පළමු AI මාර්ගයෙන් පිළිතුරක් සොයනවා...');
                const response = await axios.get(`https://hercai.onrender.com/v3/hercai`, {
                    params: { model: "v3", content: fullPrompt },
                    timeout: 10000 // තත්පර 10කින් උත්තර නැත්නම් Backup එකට යනවා
                });
                if (response.data && response.data.reply) {
                    aiReply = response.data.reply;
                }
            } catch (error) {
                console.log('⚠️ Xiao Wu: පළමු AI එක කාර්යබහුලයි (503/Timeout). Backup AI එකට මාරු වෙනවා...');
            }

            // --- API 2: DeepSeek/Llama Backup API (පළමු එක වැඩ නැත්නම් විතරක් ක්‍රියාත්මක වේ) ---
            if (!aiReply) {
                try {
                    const response = await axios.get(`https://api.sandipbbaruwal.gq/llama`, {
                        params: { prompt: fullPrompt },
                        timeout: 15000
                    });
                    if (response.data && response.data.answer) {
                        aiReply = response.data.answer;
                    }
                } catch (error) {
                    console.log('❌ Xiao Wu: දෙවන AI එකත් කාර්යබහුලයි:', error.message);
                }
            }

            // --- වට්ස්ඇප් එකට පිළිතුර යැවීම ---
            if (aiReply) {
                try {
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` 
                    }, { quoted: msg });
                } catch (e) {
                    console.log('Message Send Error:', e.message);
                }
            } else {
                // AI දෙකම වැඩ නැත්නම් විතරක් වැටෙන පණිවිඩය
                await sock.sendMessage(from, { 
                    text: `🐰 *XIAO WU MD* 🌸\n\nඅනේ ස්වාමිනි, මගේ සිතුවිලි ජාලයන් (AI Servers) මේ වෙලාවේ ගොඩක් කාර්යබහුලයි. චුට්ටක් වෙලා ගිහින් ආයෙමත් මට කතා කරන්නකෝ... 🥺💗` 
                }, { quoted: msg });
            }
        }
    });
}

startXiaoWuBot();
