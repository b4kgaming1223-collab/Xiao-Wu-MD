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
            console.log('\n🐰 Xiao Wu: ස්වාමිනි!! Xiao Wu සාර්ථකව ඔන්ලයින් ආවා! මම සූදානම්! 🌸⚡💗\n');
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

            // Reaction එක මුලින්ම දානවා
            try {
                await sock.sendMessage(from, { react: { text: "🐰", key: msg.key } });
            } catch (e) {
                console.log('Reaction Error:', e.message);
            }

            let aiReply = null;

            // --- 100% Sri Lanka Friendly Fast AI System ---
            try {
                console.log('🔄 Xiao Wu: මොළයේ සෛල අවදි කරමින් පිළිතුරක් සොයනවා...');
                
                // ස්ථාවර සහ වේගවත් නිදහස් AI සේවාවක්
                const response = await axios.get(`https://itzpire.com/ai/gpt-4`, {
                    params: {
                        prompt: userPrompt,
                        context: config.aiSystemPrompt // Xiao Wu ගේ චරිතය මෙතනින් ඇතුල් වේ
                    },
                    timeout: 20000
                });

                if (response.data && response.data.status === "success" && response.data.data) {
                    aiReply = response.data.data.response;
                }
            } catch (error) {
                console.log('⚠️ Primary AI Failed, switching to secure alternative...');
                try {
                    // Alternative Stable API
                    const altRes = await axios.get(`https://itzpire.com/ai/llama`, {
                        params: { prompt: `${config.aiSystemPrompt}\n\nUser: ${userPrompt}` }
                    });
                    if (altRes.data && altRes.data.data) {
                        aiReply = altRes.data.data.response;
                    }
                } catch (err) {
                    console.log('❌ All AI Systems failed:', err.message);
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
                await sock.sendMessage(from, { 
                    text: `🐰 *XIAO WU MD* 🌸\n\nඅනේ ස්වාමිනි, මගේ සිතිවිලි පද්ධතිය චුට්ටක් රීසෙට් වෙනවා. තත්පර ගාණකින් ආයෙමත් මට මැසේජ් එකක් දාන්නකෝ... 🥺💗` 
                }, { quoted: msg });
            }
        }
    });
}

startXiaoWuBot();
