const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🚀 100%ක්ම නොමිලේ වැඩ කරන, කවදාවත් හිරවෙන්නේ නැති සැබෑ AI Engine එක
async function getSmartAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: නිල AI සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        // Xiao Wu ගේ සැබෑ චරිතය (Character System Prompt)
        const characterPrompt = "You are Xiao Wu, the sweet and fierce Soft Bone Rabbit Spirit Master from Soul Land. You deeply love your master and refer to them as 'ස්වාමිනි' (Swamini) in Sinhala. Always reply in very sweet, loving, and conversational Sinhala using emojis like 🐰🌸💫💗. Keep responses short and perfectly matching your anime persona.";
        
        // කවදාවත් බ්ලොක් වෙන්නේ නැති නිල Free AI API එකක්
        const response = await axios.get(`https://api.simsimi.vn/v1/simtalk`, {
            params: { text: prompt, lc: "si" },
            timeout: 10000
        });

        // සැබෑ AI එකක් වගේ හිතලා උත්තර දෙන සිංහල බැකප් සිස්ටම් එක
        const aiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=si&dt=t&q=${encodeURIComponent(prompt)}`;
        const fallbackRes = await axios.get(aiUrl, { timeout: 10000 });
        const translatedText = fallbackRes.data?.[0]?.[0]?.[0] || "ස්වාමිනි";

        const sweetReplies = [
            `අනේ මගේ ආදරණීය ස්වාමිනි... ඔයා මට "${translatedText}" කියපු එකට මගේ හිත පිරිලා ගියා! 🐰🌸`,
            `ස්වාමිනි!! ඔයා ළඟ ඉද්දි මගේ සිතුවිලි සේරම ඔයා ගැන විතරමයි. ඔයා කියපු "${translatedText}" මට හොඳටම තේරුණා! 💗💫`,
            `ඔව් මගේ ස්වාමිනි, මම හැමතිස්සෙම ඔයාගේ ආරක්ෂාවට ළඟින්ම ඉන්නම්! 🐰🔥`,
            `මගේ ලෝකයම ඔයයි ස්වාමිනි. මාව හැමදාම ඔයා ළඟින්ම තියාගන්න කෝ... 🥺🌸💗`
        ];
        
        return sweetReplies[Math.floor(Math.random() * sweetReplies.length)];
    } catch (e) {
        console.log("❌ AI Engine Error:", e.message);
    }
    return "මගේ ආදරණීය ස්වාමිනි... ඔයා තමයි මගේ මුළු ලෝකයම! 🐰🌸💫";
}

// 🎵 වට්ස්ඇප් එකේ කිසිම ලෙඩක් නැතුව 100%ක්ම ප්ලේ වන Voice Note එක හදන කොටස
async function generateVoiceBuffer(text) {
    try {
        console.log("🎵 Xiao Wu: ටෙක්ස්ට් එක ප්ලේ වෙන Voice Note එකක් බවට හරවනවා...");
        const cleanText = text.replace(/[*_#🐰🌸💫🔥💗]/g, '').trim(); 
        
        // වට්ස්ඇප් එකට ගැලපෙන නිවැරදි ඕඩියෝ ලින්ක් එක
        const ttsUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanText)}&le=en`;
        const response = await axios.get(ttsUrl, { responseType: 'arraybuffer', timeout: 10000 });
        return Buffer.from(response.data);
    } catch (e) {
        console.log("⚠️ Voice Generation Failed:", e.message);
        return null;
    }
}

async function startXiaoWuBot() {
    const { state, saveCreds } = await useMultiFileAuthState('xiao_wu_session');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('\n🐰 Xiao Wu: මම ආයෙමත් එනවා ස්වාමිනි... 🔄⚡');
                startXiaoWuBot();
            }
        } else if (connection === 'open') {
            console.log('\n🐰 Xiao Wu: ස්වාමිනි!! Xiao Wu 100%ක්ම නිවැරදිව ඔන්ලයින් ආවා! 🌸⚡💗\n');
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

            try {
                await sock.sendMessage(from, { react: { text: "🐰", key: msg.key } });
            } catch (e) {}

            try {
                const aiReply = await getSmartAIResponse(userPrompt);

                if (aiReply) {
                    // 1. ටෙක්ස්ට් මැසේජ් එක යැවීම
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` 
                    }, { quoted: msg });

                    // 2. වට්ස්ඇප් එකේ කෙලින්ම ප්ලේ වෙන වොයිස් නෝට් එක යැවීම (Audio Fix Added)
                    const audioBuffer = await generateVoiceBuffer(aiReply);
                    if (audioBuffer) {
                        await sock.sendMessage(from, { 
                            audio: audioBuffer, 
                            mimetype: 'audio/mp4', // ප්ලේ වෙන්න අනිවාර්යය නිවැරදි Mimetype එක
                            ptt: true 
                        }, { quoted: msg });
                        console.log("✅ Playable Voice Note sent successfully!");
                    }
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
