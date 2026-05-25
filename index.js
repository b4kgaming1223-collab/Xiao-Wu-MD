const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { GoogleGenerativeAI } = require('@google/generative-ai'); 
const config = require('./config');

// config.js එකේ තියෙන API Key එක කියවා නිල වශයෙන් සම්බන්ධ වීම
const aiKey = config.geminiApiKey || config.apiKey; 
const genAI = new GoogleGenerativeAI(aiKey);

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

            // Reaction (🐰) එක දමයි
            try {
                await sock.sendMessage(from, { react: { text: "🐰", key: msg.key } });
            } catch (e) {
                console.log('Reaction Error:', e.message);
            }

            try {
                console.log('🔄 Xiao Wu: නිල Google Gemini සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...');
                
                // නිල SDK එක සඳහා නිවැරදිම සහ ස්ථාවරම මොඩලය (gemini-1.5-flash)
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash" 
                });

                // Xiao Wu ගේ චරිතය (System Prompt) සහ User ගේ ප්‍රශ්නය එකතු කර නිවැරදිව සර්වර් එකට යැවීම
                const fullPrompt = `System: ${config.aiSystemPrompt}\n\nUser: ${userPrompt}`;

                const result = await model.generateContent(fullPrompt);
                const aiReply = result.response.text();

                if (aiReply) {
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` 
                    }, { quoted: msg });
                }

            } catch (error) {
                console.log('❌ Gemini API Error:', error.message);
                await sock.sendMessage(from, { 
                    text: `🐰 *XIAO WU MD* 🌸\n\nඅනේ ස්වාමිනි, මගේ සිතිවිලි පද්ධතියේ පොඩි අවුලක් ආවා. config.js එකේ API Key එක හරිද කියලා පොඩ්ඩක් බලන්නකෝ... 🥺💗` 
                }, { quoted: msg });
            }
        }
    });
}

startXiaoWuBot();
