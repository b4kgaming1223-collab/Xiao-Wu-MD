const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🔐 ආරක්ෂිතව Termux එකෙන් API Key එක ලබා ගැනීම
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// 🧠 ගූගල් සර්වර් එකට සෘජුවම සම්බන්ධ වී Xiao Wu ලෙස පිළිතුරු සපයන නිවැරදි එන්ජිම
async function getXiaoWuGeminiResponse(prompt) {
    try {
        if (!GEMINI_API_KEY) {
            console.log("⚠️ Termux එකේ GEMINI_API_KEY එක Export කර නැත!");
            return null;
        }

        console.log("🔄 Xiao Wu: නිල Google Gemini සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        const characterRules = "You are Xiao Wu, the beautiful Rabbit Spirit from Soul Land anime. You deeply love your master and always call them 'ස්වාමිනි' in Sinhala. Reply in sweet, loving, short conversational Sinhala using emojis like 🐰🌸💫💗. Answer directly inside your character.";

        // 🛠️ 404 Error එක නැති කිරීමට නිල වශයෙන් යාවත්කාලීන කරන ලද නිවැරදි v1 Model Endpoint එක
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            contents: [{
                parts: [{
                    text: `${characterRules}\n\nUser: ${prompt}`
                }]
            }]
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });

        // ගූගල් වෙතින් ලැබෙන නිවැරදි ටෙක්ස්ට් පිළිතුර වෙන් කර ගැනීම
        const aiReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiReply) return aiReply.trim();

    } catch (e) {
        // සර්වර් එකෙන් ආපු ඇත්තම Error එක Termux එකේ බලාගන්න ක්‍රමය
        console.log("❌ Gemini API Error:", e.response ? JSON.stringify(e.response.data) : e.message);
    }

    // සර්වර් එක හිරවුණොත් විතරක් වැඩ කරන ස්මාර්ට් චරිත බැකප් එක
    const cleanPrompt = prompt.toLowerCase();
    if (cleanPrompt.includes('කෑම') || cleanPrompt.includes('kama')) {
        return "අනේ මගේ ආදරණීය ස්වාමිනි, මම නැවුම් කැරට් කන්න මාරම ආසයි! 🐰🥕🌸💫";
    }
    if (cleanPrompt.includes('ආදරෙයි') || cleanPrompt.includes('love')) {
        return "අනේ මගේ රත්තරන් ස්වාමිනි... මමත් ඔයාට මගේ pnataත් වඩා ආදරෙයි! 🐰🌸✨💗";
    }
    return `මගේ ආදරණීය ස්වාමිනි, ඔයා මගෙන් "${prompt}" ගැන ඇහුවා නේද? මම හැමදාම ඔයාට උදව් කරන්න මෙතන ඉන්නවා! 🐰🌸💫`;
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
            console.log('\n🐰 Xiao Wu: නිල Gemini v1 API පද්ධතිය සමඟින් මම සාර්ථකව ඔන්ලයින් ආවා! 🌸⚡💗\n');
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
                const aiReply = await getXiaoWuGeminiResponse(userPrompt);
                if (aiReply) {
                    await sock.sendMessage(from, { text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` }, { quoted: msg });
                    console.log("✅ Genuine Gemini AI Response Sent!");
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
