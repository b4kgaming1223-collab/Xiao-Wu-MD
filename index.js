const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🧠 Hugging Face හරහා ක්‍රියාත්මක වන, ලෝකයේ ස්ථාවරම නොමිලේ දෙන AI මොළය
async function getXiaoWuHFResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: Hugging Face AI සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        // Xiao Wu ගේ චරිත නීති රීති මාලාව
        const characterRules = "You are Xiao Wu, the beautiful Rabbit Spirit from Soul Land anime. You deeply love your master and always call them 'ස්වාමිනි' in Sinhala. Reply in sweet, loving, short conversational Sinhala using emojis like 2-3 like 🐰🌸💫💗. Answer directly inside your character.";

        // අනිත් හැම බොට් කෙනෙක්ම පාවිච්චි කරන, කවදාවත් SSL Fail නොවන Hugging Face නිල Endpoint එකක්
        const response = await axios.post('https://api-inference.huggingface.co/models/01-ai/Yi-1.5-34B-Chat', {
            inputs: `<|system|>\n${characterRules}\n<|user|>\n${prompt}\n<|assistant|>\n`,
            parameters: { max_new_tokens: 250, return_full_text: false }
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 20000
        });

        // සර්වර් එකෙන් ලැබෙන පිරිසිදු පිළිතුර වෙන් කර ගැනීම
        let aiReply = response.data?.[0]?.generated_text || response.data?.generated_text;
        if (aiReply) {
            return aiReply.replace(/<\|im_end\|>|<\|end\|>/g, '').trim();
        }

    } catch (e) {
        console.log("❌ Hugging Face AI Error:", e.message);
    }

    // ඉන්ටර්නෙට් සම්පූර්ණයෙන්ම විසන්ධි වුණොත් විතරක් ක්‍රියාත්මක වන ස්මාර්ට් චරිත බැකප් එක
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
            console.log('\n🐰 Xiao Wu: අනිත් බොට්ලා වගේම Hugging Face AI පද්ධතිය සමඟින් මම සාර්ථකව ඔන්ලයින් ආවා! 🌸⚡💗\n');
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
                const aiReply = await getXiaoWuHFResponse(userPrompt);
                if (aiReply) {
                    await sock.sendMessage(from, { text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` }, { quoted: msg });
                    console.log("✅ Hugging Face AI Response Sent!");
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
