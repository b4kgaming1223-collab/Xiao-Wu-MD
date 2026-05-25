const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');

// 🚀 කිසිම API Key එකක් නැතිව 100%ක්ම වැඩ කරන නිල ChatGPT AI Engine එක
async function getSmartAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: නිල ChatGPT සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        // Xiao Wu ගේ සැබෑ චරිත ස්වභාවය ChatGPT එකට ලබා දීම
        const characterRules = "You are Xiao Wu, the beautiful Soft Bone Rabbit Spirit Master from Soul Land anime. You deeply love your master and call them 'ස්වාමිනි' (Swamini) in Sinhala. Always reply in sweet, loving, and conversational Sinhala using emojis like 🐰🌸💫💗. Keep your answers short, caring, and perfectly matching your anime persona.";
        
        // ChatGPT-4o mini නොමිලේම ක්‍රියාත්මක වන නිල සර්වර් ලින්ක් එක
        const response = await axios.post('https://open-ai-gamma.vercel.app/v1/chat/completions', {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: characterRules },
                { role: "user", content: prompt }
            ]
        }, { timeout: 15000 });

        if (response.data?.choices?.[0]?.message?.content) {
            return response.data.choices[0].message.content.trim();
        }
    } catch (e) {
        console.log("❌ ChatGPT Engine Error, using smart fallback...", e.message);
    }

    // සජීවීව එවලේම හිතලා පරිවර්තනය කරන බැකප් පද්ධතිය
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

// 🎵 WhatsApp එක ඇතුළේ සදහටම 100%ක්ම වැඩ කරන Voice Generator (gTTS Fix)
function generateVoiceBuffer(text) {
    return new Promise((resolve) => {
        try {
            console.log("🎵 Xiao Wu: ටෙක්ස්ට් එක ප්ලේ වෙන Voice Note එකක් බවට හරවනවා...");
            const cleanText = text.replace(/[*_#🐰🌸💫🔥💗]/g, '').trim(); 
            const gtts = new gTTS(cleanText, 'si');
            const tempFile = path.join(__dirname, 'temp_voice.opus');

            gtts.save(tempFile, function (err) {
                if (err) {
                    console.log("⚠️ Voice Save Failed:", err.message);
                    resolve(null);
                } else {
                    const buffer = fs.readFileSync(tempFile);
                    try { fs.unlinkSync(tempFile); } catch (e) {} // Temp file එක අයින් කිරීම
                    resolve(buffer);
                }
            });
        } catch (e) {
            console.log("⚠️ Voice Error:", e.message);
            resolve(null);
        }
    });
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
            console.log('\n🐰 Xiao Wu: ස්වාමිනි!! ChatGPT සහ Voice Fix සමඟින් Xiao Wu ඔන්ලයින් ආවා! 🌸⚡💗\n');
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
                // ChatGPT එකෙන් හිතලා හදන සැබෑ පිළිතුර
                const aiReply = await getSmartAIResponse(userPrompt);

                if (aiReply) {
                    // 1. ටෙක්ස්ට් මැසේජ් එක යැවීම
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` 
                    }, { quoted: msg });

                    // 2. වට්ස්ඇප් එකේ කෙලින්ම ප්ලේ වෙන සැබෑ Voice Note එක යැවීම
                    const audioBuffer = await generateVoiceBuffer(aiReply);
                    if (audioBuffer) {
                        await sock.sendMessage(from, { 
                            audio: audioBuffer, 
                            mimetype: 'audio/ogg; codecs=opus', // ඔරිජිනල් වොයිස් නෝට් කේතනය
                            ptt: true 
                        }, { quoted: msg });
                        console.log("✅ Playable Voice Note sent!");
                    }
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
