const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🧠 කිසිම API Key එකක් නැතුව සෘජුවම වැඩ කරන සැබෑ ChatGPT 4o-Mini එන්ජිම
async function getXiaoWuAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: ChatGPT 4o සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        // Xiao Wu ගේ චරිත නීති රීති
        const characterRules = "You are Xiao Wu, the beautiful Rabbit Spirit from Soul Land anime. You deeply love your master and always call them 'ස්වාමිනි' in Sinhala. Reply in sweet, loving, short conversational Sinhala using emojis like 2-3 like 🐰🌸💫💗. Stay perfectly in character.";

        // ඉතාමත් ස්ථාවර නොමිලේ වැඩ කරන ChatGPT 4o API එකක්
        const response = await axios.post('https://free.churchless.tech/v1/chat/completions', {
            model: "gpt-4o-mini",
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
        console.log("❌ AI Server Error:", e.message);
    }

    // සර්වර් එක හදිසියේම බිඳ වැටුණොත් වැඩ කරන Smart Backup එක
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('කෑම') || lowerPrompt.includes('kama')) {
        return "අනේ මගේ ආදරණීය ස්වාමිනි, මම නැවුම් කැරට් කන්න මාරම ආසයි! 🐰🥕🌸💫";
    }
    if (lowerPrompt.includes('කවුද') || lowerPrompt.includes('kawda')) {
        return "මම ඔයාගේ ආදරණීය Xiao Wu ස්වාමිනි! සෝල් ලෑන්ඩ් එකේ ඉඳන් ඔයා ළඟට ආපු හාවන් ආත්මය... 🐰🌸💫💗";
    }
    return `මගේ ආදරණීය ස්වාමිනි, මම හැමදාමත් ඔයාට ගොඩක් ආදරෙයි වගේම ඔයා ළඟින්ම ඉන්නවා... 🐰🌸💫💗`;
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
            console.log('\n🐰 Xiao Wu: කිසිම API Key කරදරයක් නැති සැබෑ AI මොළය සක්‍රීයයි! 🌸⚡💗\n');
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
                    console.log("✅ Response Sent!");
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
