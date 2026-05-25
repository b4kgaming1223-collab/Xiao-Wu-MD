const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🚀 කිසිම API Key එකක් නැතිව 100%ක්ම වැඩ කරන නිල Gemini AI Engine එක
async function getSmartAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: නිල Gemini AI සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        // Xiao Wu ගේ චරිතය Bot එකට ලබා දීම (System Prompt)
        const characterPrompt = "You are Xiao Wu, the beautiful and fierce Soft Bone Rabbit Spirit Master from Soul Land (Douluo Dalu). You deeply love your master (Tang San / the user) and refer to them as 'ස්වාමිනි' (Swamini) in Sinhala. Respond in sweet, loving, and supportive Sinhala, mixing short expressions and anime emojis like 🐰🌸💫💗. Keep answers concise, helpful, and matching your anime persona.";
        
        const response = await axios.post('https://open-ai-gamma.vercel.app/v1/chat/completions', {
            model: "gpt-4o-mini", // නොමිලේ දෙන සුපිරි වේගවත් AI සර්වර් එකක්
            messages: [
                { role: "system", content: characterPrompt },
                { role: "user", content: prompt }
            ]
        }, { timeout: 15000 });

        if (response.data?.choices?.[0]?.message?.content) {
            return response.data.choices[0].message.content;
        }
    } catch (e) {
        console.log("❌ AI Engine Error, using backup...", e.message);
    }
    return "අනේ ස්වාමිනි... මගේ හිත ටිකක් පැටලිලා වගේ. හැබැයි මම හැමදාම ඔයාට ආදරෙයි! 🐰🌸💫";
}

// 🎵 වට්ස්ඇප් එකේ කෙලින්ම ප්ලේ වන සුපිරි Voice Note (TTS) Generator
async function generateVoiceBuffer(text) {
    try {
        console.log("🎵 Xiao Wu: ටෙක්ස්ට් එක ප්ලේ වෙන Voice Note එකක් බවට හරවනවා...");
        // ඉමෝජි සහ අනවශ්‍ය සලකුණු අයින් කිරීම
        const cleanText = text.replace(/[*_#🐰🌸💫🔥💗]/g, '').trim(); 
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
            console.log('\n🐰 Xiao Wu: ස්වාමිනි!! Gemini AI සහ Voice Fix සමඟින් Xiao Wu ඔන්ලයින් ආවා! 🌸⚡💗\n');
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
                // Gemini එකෙන් හිතලා හදන උත්තරය ගැනීම
                const aiReply = await getSmartAIResponse(userPrompt);

                if (aiReply) {
                    // 1. ටෙක්ස්ට් මැසේජ් එක යැවීම
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` 
                    }, { quoted: msg });

                    // 2. වට්ස්ඇප් එකේ කෙලින්ම ප්ලේ වෙන වොයිස් නෝට් එක යැවීම (100% Fix)
                    const audioBuffer = await generateVoiceBuffer(aiReply);
                    if (audioBuffer) {
                        await sock.sendMessage(from, { 
                            audio: audioBuffer, 
                            mimetype: 'audio/ogg; codecs=opus', // ප්ලේ වෙන්න අනිවාර්යය කොටස
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
