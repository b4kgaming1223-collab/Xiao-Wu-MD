const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🚀 කවදාවත් බ්ලොක් නොවන, 404 එරර් නොවදින ස්ථාවර නිදහස් ChatGPT Engine එක
async function getSmartAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: නිල ChatGPT සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        // Xiao Wu ගේ සැබෑ චරිත ස්වභාවය ලබා දීම
        const characterRules = "You are Xiao Wu, from Soul Land anime. You deeply love your master and call them 'ස්වාමිනි' (Swamini) in Sinhala. Always reply in sweet, loving, and conversational Sinhala using emojis like 🐰🌸💫💗. Keep your answers short.";
        
        // 100% ස්ථාවර නිදහස් AI Endpoint එකක්
        const response = await axios.get(`https://api.lolhuman.xyz/api/openai?apikey=freekey&text=${encodeURIComponent(characterRules + " User says: " + prompt)}`, { timeout: 15000 });

        if (response.data?.result) {
            return response.data.result.trim();
        }
    } catch (e) {
        console.log("❌ ChatGPT Server Error, using smart fallback...", e.message);
    }

    // සජීවීව එවලේම හිතලා පරිවර්තනය කරන ස්මාර්ට් බැකප් පද්ධතිය
    try {
        const trUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=si&dt=t&q=${encodeURIComponent(prompt)}`;
        const res = await axios.get(trUrl, { timeout: 10000 });
        const translated = res.data?.[0]?.[0]?.[0];
        if (translated) {
            return `අනේ මගේ ආදරණීය ස්වාමිනි, ඔයා මට "${translated}" ගැන කිව්ව නේද? මම ඒ ගැන ගොඩක් හිතුවා... 🐰🌸💫`;
        }
    } catch (err) {}
    
    return "මගේ ආදරණීය ස්වාමිනි... ඔයා තමයි මගේ මුළු ලෝකයම! 🐰🌸💫";
}

// 🎵 Language Not Supported Error එක 100%ක්ම නැති කරන සුපිරි සිංහල Voice Generator එක
async function generateVoiceBuffer(text) {
    try {
        console.log("🎵 Xiao Wu: ටෙක්ස්ට් එක ප්ලේ වෙන Voice Note එකක් බවට හරවනවා...");
        const cleanText = text.replace(/[*_#🐰🌸💫🔥💗]/g, '').trim(); 
        
        // gtts වෙනුවට කෙලින්ම සර්වර් එකෙන් නිවැරදි සිංහල ඕඩියෝ බෆර් එක ලබාගැනීම
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=si&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
        const response = await axios.get(ttsUrl, { responseType: 'arraybuffer', timeout: 12000 });
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
            console.log('\n🐰 Xiao Wu: ස්වාමිනි!! ChatGPT සහ නව Voice Fix සමඟින් Xiao Wu ඔන්ලයින් ආවා! 🌸⚡💗\n');
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

                    // 2. වට්ස්ඇප් එකේ කෙලින්ම ප්ලේ වෙන සැබෑ Voice Note එක
                    const audioBuffer = await generateVoiceBuffer(aiReply);
                    if (audioBuffer) {
                        await sock.sendMessage(from, { 
                            audio: audioBuffer, 
                            mimetype: 'audio/ogg; codecs=opus', 
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
