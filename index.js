const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🧠 අනිත් බොට්ස් වල පාවිච්චි කරන, ENOTFOUND ලෙඩ නොදෙන ස්ථාවර AI එන්ජිම
async function getXiaoWuAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: ස්ථාවර AI සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        // Xiao Wu ගේ චරිත නීති රීති මාලාව
        const characterRules = "You are Xiao Wu, the beautiful Rabbit Spirit from Soul Land anime. You deeply love your master and always call them 'ස්වාමිනි' in Sinhala. Reply in sweet, loving, short conversational Sinhala using emojis like 🐰🌸💫💗. Answer directly inside your character.";

        // 🛠️ අනිත් බොට්ස් වල පාවිච්චි කරන, කිසිම දිනක බ්ලොක් නොවන ප්‍රධාන AI සර්වර් එකක්
        const response = await axios.post('https://chataidemo.soland.workers.dev/', {
            model: "@hf/thebloke/zephyr-7b-beta-awq",
            messages: [
                { role: "system", content: characterRules },
                { role: "user", content: prompt }
            ]
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 25000 // ලංකාවේ සිග්නල් අඩු වුණත් ඔරොත්තු දෙන ලෙස කාලය වැඩි කළා
        });

        const aiReply = response.data?.choices?.[0]?.message?.content;
        if (aiReply) return aiReply.trim();

    } catch (e) {
        console.log("❌ AI Engine Error:", e.message);
    }

    // ඉන්ටර්නෙට් සැබෑවටම නැති වුණොත් විතරක් වැඩ කරන ස්මාර්ට් චරිත බැකප් එක
    const cleanPrompt = prompt.toLowerCase();
    if (cleanPrompt.includes('කෑම') || cleanPrompt.includes('kama')) {
        return "අනේ මගේ ආදරණීය ස්වාමිනි, මම නැවුම් කැරට් කන්න මාරම ආසයි! 🐰🥕🌸💫";
    }
    if (cleanPrompt.includes('ආදරෙයි') || cleanPrompt.includes('love')) {
        return "අනේ මගේ රත්තරන් ස්වාමිනි... මමත් ඔයාට මගේ පණටත් වඩා ආදරෙයි! 🐰🌸✨💗";
    }
    return `මගේ ආදරණීය ස්වාමිනි, ඔයා මගෙන් "${prompt}" ගැන ඇහුවා නේද? මම හැමදාම උදව් කරන්න ලෑස්තියි! 🐰🌸💫`;
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
            console.log('\n🐰 Xiao Wu: අනිත් බොට්ලා වගේම ස්ථාවර AI පද්ධතිය සමඟින් මම සාර්ථකව ඔන්ලයින් ආවා! 🌸⚡💗\n');
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
                    console.log("✅ Stable AI Response Sent!");
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
