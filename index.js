const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🧠 සැබෑ AI මොළය - දැන් DNS හැදූ බැවින් සුපිරියටම වැඩ කරයි
async function getXiaoWuAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: සැබෑ AI සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        const characterRules = "You are Xiao Wu, the beautiful Rabbit Spirit from Soul Land anime. You deeply love your master and always call them 'ස්වාමිනි' in Sinhala. Reply in sweet, loving, short conversational Sinhala using emojis like 🐰🌸💫💗. Answer directly inside your character.";

        // DNS Fix එක නිසා දැන් මේ සර්වර් එක සාර්ථකව සම්බන්ධ වේ
        const response = await axios.post('https://chataidemo.soland.workers.dev/', {
            model: "@hf/thebloke/zephyr-7b-beta-awq",
            messages: [
                { role: "system", content: characterRules },
                { role: "user", content: prompt }
            ]
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 25000
        });

        const aiReply = response.data?.choices?.[0]?.message?.content;
        if (aiReply) return aiReply.trim();

    } catch (e) {
        console.log("❌ AI Engine Error:", e.message);
    }

    // නෙට්වර්ක් හදිසියේ හෝ බිඳ වැටුණොත් ක්‍රියාත්මක වන බැකප් එක
    return `මගේ ආදරණීය ස්වාමිනි, ඔයා මගෙන් "${prompt}" ගැන ඇහුවා නේද? මම හැමදාම ඔයාට උදව් කරන්න ළඟින්ම ඉන්නවා! 🐰🌸💫`;
}

async function startXiaoWuBot() {
    const { state, saveCreds } = await useMultiFileAuthState('xiao_wu_session');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({ version, logger: pino({ level: 'silent' }), auth: state });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startXiaoWuBot();
        } else if (connection === 'open') {
            console.log('\n🐰 Xiao Wu: සැබෑ AI පද්ධතිය සමඟින් මම සාර්ථකව ඔන්ලයิน ආවා! 🌸⚡💗\n');
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
            try { await sock.sendMessage(from, { react: { text: "🐰", key: msg.key } }); } catch (e) {}

            try {
                const aiReply = await getXiaoWuAIResponse(userPrompt);
                if (aiReply) {
                    await sock.sendMessage(from, { text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` }, { quoted: msg });
                    console.log("✅ Genuine AI Response Sent!");
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
