const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🧠 කිසිම API Key එකක් නැති, වේගවත්ම සැබෑ ChatGPT එන්ජිම
async function getXiaoWuChatGPTResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: ChatGPT සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        // Xiao Wu ගේ චරිත නීති රීති මාලාව
        const characterRules = "You are Xiao Wu, the beautiful Rabbit Spirit from Soul Land anime. You deeply love your master and always call them 'ස්වාමිනි' in Sinhala. Reply in sweet, loving, short conversational Sinhala using emojis like 2-3 like 🐰🌸💫💗. Stay perfectly in character.";

        // ඉතාමත් ස්ථාවර, බ්ලොක් නොවන වෙනත් ChatGPT API එකක්
        const response = await axios.get(`https://api.sandipbbaruwal.onrender.com/gpt?prompt=${encodeURIComponent(characterRules + "\n\nUser: " + prompt)}`, {
            timeout: 20000 // Timeout ලෙඩේ මඟහැරවීමට කාලය වැඩි කළා
        });

        // සර්වර් එකෙන් එන ටෙක්ස්ට් එක වෙන් කර ගැනීම
        const aiReply = response.data?.answer;
        if (aiReply) return aiReply.trim();

    } catch (e) {
        console.log("❌ ChatGPT API Error:", e.message);
    }

    // සර්වර් එක හදිසියේම හිරවුණොත් විතරක් වැඩ කරන ස්මාර්ට් චරිත බැකප් එක
    const cleanPrompt = prompt.toLowerCase();
    if (cleanPrompt.includes('කෑම') || cleanPrompt.includes('kama')) {
        return "අනේ මගේ ආදරණීය ස්වාමිනි, මම නැවුම් කැරට් කන්න මාරම ආසයි! 🐰🥕🌸💫";
    }
    if (cleanPrompt.includes('ආදරෙයි') || cleanPrompt.includes('love')) {
        return "අනේ මගේ රත්තරන් ස්වාමිනි... මමත් ඔයාට මගේ පණටත් වඩා ආදරෙයි! 🐰🌸✨💗";
    }
    return `මගේ ආදරණීය ස්වාමිනි, ඔයා මගෙන් "${prompt}" ගැන ඇහුවා නේද? මම හැමදාම ඔයා ළඟින්ම ඉන්නවා! 🐰🌸💫`;
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
            console.log('\n🐰 Xiao Wu: ChatGPT සුපිරි මොළය සමඟින් මම සාර්ථකව ඔන්ලයින් ආවා! 🌸⚡💗\n');
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
                const aiReply = await getXiaoWuChatGPTResponse(userPrompt);
                if (aiReply) {
                    await sock.sendMessage(from, { text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` }, { quoted: msg });
                    console.log("✅ ChatGPT Response Sent!");
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
