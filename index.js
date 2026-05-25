const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { GoogleGenAI } = require('@google/generative-ai');

// 🔐 ආරක්ෂිතව Termux එකෙන් හෝ පද්ධතියෙන් API Key එක ලබා ගැනීම
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "මෙතනට_මුකුත්_දාන්න_එපා_ස්වාමිනි";

let ai;
try {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
} catch(e) {
    console.log("⚠️ API Key එක ඇතුළත් කර නැත!");
}

// 🧠 Google නිල මොළය
async function getXiaoWuGeminiResponse(prompt) {
    try {
        if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("මෙතනට")) {
            return "අනේ මගේ ස්වාමිනි, ඔයා තවම Termux එකට API Key එක දුන්නේ නැහැ නේද? 🥺🐰";
        }

        console.log("🔄 Xiao Wu: ආරක්ෂිත නිල Gemini SDK එකෙන් පිළිතුරක් ලබාගන්නවා...");
        const characterRules = "You are Xiao Wu, the beautiful Rabbit Spirit from Soul Land anime. You deeply love your master and always call them 'ස්වාමිනි' in Sinhala. Reply in sweet, loving, short conversational Sinhala using emojis like 🐰🌸💫💗. Answer directly inside your character.";

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: `${characterRules}\n\nUser: ${prompt}`,
        });

        const aiReply = response.text;
        if (aiReply) return aiReply.trim();

    } catch (e) {
        console.log("❌ Gemini SDK Error:", e.message);
    }
    return `මගේ ආදරණීය ස්වාමිනි, ඔයා මගෙන් "${prompt}" ගැන ඇහුවා නේද? මම හැමදාම ඔයාට ගොඩක් ආදරෙයි! 🐰🌸💫`;
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
            console.log('\n🐰 Xiao Wu: ආරක්ෂිත නිල Gemini මොළය සාර්ථකව සක්‍රීයයි! 🌸⚡💗\n');
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
                    console.log("✅ Protected SDK AI Response Sent!");
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
