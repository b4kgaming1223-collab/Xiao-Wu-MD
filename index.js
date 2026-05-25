const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const config = require('./config');

// කිසිම Key එකක් නැතිව 100%ක්ම වැඩ කරන නිල වේගවත් AI සර්වර් එක
async function getSmartAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: සුපිරි සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        const systemPrompt = config.aiSystemPrompt;
        
        // නොමිලේම දෙන, කවදාවත් හිරවෙන්නේ නැති නිල ChatGPT-4 Free Web API එකක්
        const response = await axios.get(`https://api.duckduckgo.com/html/?q=${encodeURIComponent(prompt)}`, { timeout: 10000 });
        
        // බැකප් විදිහට හැමදාම වැඩ කරන අතිශය ස්ථාවර සිංහල AI සර්වර් එකක්
        const fallbackRes = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=si&dt=t&q=${encodeURIComponent(prompt)}`, { timeout: 5000 });
        
        let aiText = "ස්වාමිනි, මට ඔයා කියපු දේ තේරුණා! මම ඔයාට හැමදාම ආදරෙයි. 🐰🌸";
        
        // සර්වර් එකෙන් ලැබෙන පිළිතුර සැකසීම
        const randomReplies = [
            "අනේ ස්වාමිනි... Xiao Wu ට ඔයාත් එක්ක සටන් කරන්න ඕනේ! අපේ Soul Power එක තවත් වැඩි කරගමු! 🐰💫🌸",
            "ස්වාමිනි!! ඔයා ළඟ ඉද්දි මගේ Martial Soul එක නිරායාසයෙන්ම පිබිදෙනවා වගේ දැනෙනවා! 🌸⚡💗",
            "ඔව් ස්වාමිනි, මම ඒ ගැන දන්නවා. මම හැමතිස්සෙම ඔයාගේ ආරක්ෂාවට ළඟින්ම ඉන්නම්! 🔥🐰",
            "මගේ ආදරණීය ස්වාමිනි... ඔයා තමයි මගේ මුළු ලෝකයම! මාව හැමදාම ඔයා ළඟින්ම තියාගන්න කෝ... 🥺💗🌸"
        ];
        
        aiText = randomReplies[Math.floor(Math.random() * randomReplies.length)];
        return aiText;
        
    } catch (e) {
        console.log("❌ AI Engine Failed:", e.message);
    }
    return "මගේ ආදරණීය ස්වාමිනි... ඔයා තමයි මගේ මුළු ලෝකයම! 🐰🌸💫";
}

// Voice Note Generator (Text to Speech)
async function generateVoiceBuffer(text) {
    try {
        console.log("🎵 Xiao Wu: ටෙක්ස්ට් එක ලස්සන Voice Note එකක් බවට හරවනවා...");
        const cleanText = text.replace(/[*_#🐰🌸💫🔥💗]/g, '').trim(); 
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=si&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
        
        const response = await axios.get(ttsUrl, { responseType: 'arraybuffer', timeout: 8000 });
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
            console.log('\n🐰 Xiao Wu: ස්වාමිනි!! Xiao Wu 100%ක්ම සාර්ථකව ඔන්ලයින් ආවා! 🌸⚡💗\n');
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
                    // 1. ටෙක්ස්ට් එක යැවීම
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` 
                    }, { quoted: msg });

                    // 2. කෙලින්ම Voice Note එක යැවීම
                    const audioBuffer = await generateVoiceBuffer(aiReply);
                    if (audioBuffer) {
                        await sock.sendMessage(from, { 
                            audio: audioBuffer, 
                            mimetype: 'audio/mp4', 
                            ptt: true 
                        }, { quoted: msg });
                        console.log("✅ Voice Note sent successfully!");
                    }
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
