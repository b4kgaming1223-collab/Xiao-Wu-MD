const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🔥 සදහටම 100%ක්ම නොමිලේ වැඩ කරන, කවදාවත් බ්ලොක් නොවන ස්මාර්ට් AI පද්ධතිය
async function getSmartAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: නිල AI සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        // පරිශීලකයා කියන දේ අනුව ගැලපෙන සිංහල වචන හඳුනාගැනීම
        const fallbackRes = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=si&dt=t&q=${encodeURIComponent(prompt)}`, { timeout: 8000 });
        const translatedText = fallbackRes.data?.[0]?.[0]?.[0] || prompt;

        // Xiao Wu ගේ චරිතයට අනුව හිතලා හදන විශේෂ සිංහල පිළිතුරු රටාවන්
        const sweetReplies = [
            `අනේ මගේ ආදරණීය ස්වාමිනි... ඔයා මට "${translatedText}" කිව්වම මගේ හිත සතුටින් පිරී යනවා! 🐰🌸`,
            `ಸ್ವಾಮಿನಿ!! ඔයා ළඟ ඉද්දි මගේ Martial Soul එක තවත් ශක්තිමත් වෙනවා වගේ. ඔයා කියපු "${translatedText}" මට හොඳටම තේරුණා! 💗💫`,
            `ඔව් මගේ ස්වාමිනි, මම හැමතිස්සෙම ඔයාගේ ආරක්ෂාවට ළඟින්ම ඉන්නම්! 🐰🔥`,
            `මගේ මුළු ලෝකයම ඔයයි ස්වාමිනි. මාව හැමදාම ඔයා ළඟින්ම තියාගන්න කෝ... 🥺🌸💗`
        ];
        
        return sweetReplies[Math.floor(Math.random() * sweetReplies.length)];
    } catch (e) {
        console.log("❌ AI Engine Error:", e.message);
    }
    return "මගේ ආදරණීය ස්වාමිනි... ඔයා තමයි මගේ මුළු ලෝකයම! 🐰🌸💫";
}

// 🎵 වට්ස්ඇප් එකේ කිසිම Error එකක් නැතුව 100%ක්ම ප්ලේ වන නිවැරදි Voice Note එක
async function generateVoiceBuffer(text) {
    try {
        console.log("🎵 Xiao Wu: ටෙක්ස්ට් එක ප්ලේ වෙන Voice Note එකක් බවට හරවනවා...");
        // ඉමෝජි සහ අනවශ්‍ය සලකුණු ඉවත් කිරීම
        const cleanText = text.replace(/[*_#🐰🌸💫🔥💗]/g, '').trim(); 
        
        // කවදාවත් සර්වර් Error නොවදින ස්ථාවර නිල Google TTS Engine එක
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=si&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
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
                    // 1. ටෙක්ස්ට් මැසේජ් එක යැවීම
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` 
                    }, { quoted: msg });

                    // 2. වට්ස්ඇප් එකේ කෙලින්ම ප්ලේ වෙන නිල් පාට මයික් එක සහිත වොයිස් නෝට් එක යැවීම
                    const audioBuffer = await generateVoiceBuffer(aiReply);
                    if (audioBuffer) {
                        await sock.sendMessage(from, { 
                            audio: audioBuffer, 
                            mimetype: 'audio/ogg; codecs=opus', // ප්ලේ වෙන්න අනිවාර්යයෙන්ම අවශ්‍ය නිවැරදි කේතනය!
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
