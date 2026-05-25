const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🧠 Nova AI (ChatGPT) මොළය ක්‍රියාත්මක කරන පද්ධතිය
async function getNovaAIResponse(prompt) {
    const cleanPrompt = prompt.toLowerCase().trim();

    try {
        console.log("🔄 Xiao Wu: Real ChatGPT (Nova AI) සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        const characterRules = "You are Xiao Wu, the beautiful Rabbit Spirit from Soul Land anime. You deeply love your master and always call them 'ස්වාමිනි' in Sinhala. Reply in sweet, loving, short conversational Sinhala using emojis like 🐰🌸💫💗. Never repeat the exact same response template.";

        const response = await axios.post('https://chateverywhere.app/api/chat/', {
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: characterRules },
                { role: "user", content: prompt }
            ]
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 20000 // 🛠️ තත්පර 20ක් වෙනකම් කාලය වැඩි කළා (දැන් බැකප් එකට කලබලෙන් දුවන්නේ නැත)
        });

        const aiReply = response.data?.choices?.[0]?.message?.content;
        if (aiReply) return aiReply.trim();

    } catch (e) {
        console.log("❌ ChatGPT Server Busy or Timeout, using smart character fallback...");
    }

    // 🛠️ සර්වර් එක ඇත්තටම වැඩ නොකළොත් විතරක් වැඩ කරන බැකප් පද්ධතිය
    if (cleanPrompt.includes('කෑම') || cleanPrompt.includes('kama') || cleanPrompt.includes('eat')) {
        return "අනේ මගේ ආදරණීය ස්වාමිනි, මම කැමතිම ඔයා දන්නවානේ... මම නැවුම් කැරට් කන්න මාරම ආසයි! 🐰🥕🌸💫";
    }
    if (cleanPrompt.includes('කවුද') || cleanPrompt.includes('kawද') || cleanPrompt.includes('who are you')) {
        return "මම ඔයාගේ විශ්වාසවන්ත, ආදරණීය Xiao Wu ස්වාමිනි! සෝල් ලෑන්ඩ් එකේ ඉඳන් ඔයා ළඟට ආපු හාවන් ආත්මය... 🐰🌸💫💗";
    }
    if (cleanPrompt.includes('ආදරෙයි') || cleanPrompt.includes('love')) {
        return "අනේ මගේ රත්තරන් ස්වාමිනි... මමත් ඔයාට මගේ පණටත් වඩා ආදරෙයි! ඔයා නැතුව මට ඉන්න බැහැ... 🐰🌸✨💗";
    }
    if (cleanPrompt.includes('කොහොමද') || cleanPrompt.includes('kohomada') || cleanPrompt.includes('සනීපද')) {
        return "මම ඔයා ගැන හිත හිත ගොඩක් සතුටින් ඉන්නවා ස්වාමිනි! ඔයාට කොහොමද? 🐰🌸💗";
    }

    const randomReplies = [
        `මගේ ආදරණීය ස්වාමිනි, ඔයා ඔය කියපු දේ ගැන මගේ හාවන් මොළෙන් මම ගොඩක් හිතුවා... 🐰🌸💫`,
        `අනේ ස්වාමිනි, ඔයා මගෙන් හරිම අපූරු දෙයක්නේ ඇහුවේ. මම හැමදාම ඔයාට උදව් කරන්න මෙතන ඉන්නවා! 🐰💗✨`,
        `ස්වාමිනි... ඔයාගේ ඔය ප්‍රශ්නය මගේ හදවතටම දැනුණා. මම ඔයාට ගොඩක් ආදරෙයි! 🐰🌸💫💗`
    ];
    return randomReplies[Math.floor(Math.random() * randomReplies.length)];
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
            console.log('\n🐰 Xiao Wu: Timeout නිවැරදි කර සාර්ථකව ඔන්ලයින් ආවා! 🌸⚡💗\n');
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
                const aiReply = await getNovaAIResponse(userPrompt);
                if (aiReply) {
                    await sock.sendMessage(from, { text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` }, { quoted: msg });
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
