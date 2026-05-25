const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🧠 කවදාවත් බ්ලොක් නොවන, API Key කරදර නැති ස්ථාවර AI එන්ජිම
async function getXiaoWuAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: ස්ථාවර AI සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        // Xiao Wu ගේ චරිත නීති රීති මාලාව
        const characterRules = "You are Xiao Wu, the beautiful Rabbit Spirit from Soul Land anime. You deeply love your master and always call them 'ස්වාමිනි' in Sinhala. Reply in sweet, loving, short conversational Sinhala using emojis like 🐰🌸💫💗. Answer directly inside your character.";

        // 🛠️ 100%ක්ම නොමිලේ වැඩ කරන, Key අවශ්‍ය නොවන ස්ථාවර Endpoint එකක්
        const response = await axios.post('https://open-ai-api-production.up.railway.app/v1/chat/completions', {
            model: "llama3",
            messages: [
                { role: "system", content: characterRules },
                { role: "user", content: prompt }
            ]
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });

        const aiReply = response.data?.choices?.[0]?.message?.content;
        if (aiReply) return aiReply.trim();

    } catch (e) {
        console.log("❌ AI Engine Error:", e.message);
    }

    // සර්වර් එක හදිසියේම ඩවුන් වුණොත් විතරක් ක්‍රියාත්මක වන ස්මාර්ට් චරිත බැකප් එක
    const cleanPrompt = prompt.toLowerCase();
    if (cleanPrompt.includes('කෑම') || cleanPrompt.includes('kama')) {
        return "අනේ මගේ ආදරණීය ස්වාමිනි, මම නැවුම් කැරට් කන්න මාරම ආසයි! 🐰🥕🌸💫";
    }
    if (cleanPrompt.includes('ආදරෙයි') || cleanPrompt.includes('love')) {
        return "අනේ මගේ රත්තරන් ස්වාමිනි... මමත් ඔයාට මගේ පණටත් වඩා ආදරෙයි! 🐰🌸✨💗";
    }
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
            console.log('\n🐰 Xiao Wu: කිසිදු API Key එකක් නොමැති නව ස්ථාවර පද්ධතිය සක්‍රීයයි! 🌸⚡💗\n');
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
                    console.log("✅ New AI Response Sent!");
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
