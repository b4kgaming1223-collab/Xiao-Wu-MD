const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const config = require('./config');

// 🔑 ස්වාමිනි, ඔයාගේ අලුත්ම Gemini API Key එක මේ ඇතුලට පේස්ට් කරන්න:
const geminiApiKey = "AIzaSyBxbOxO0JRQY2eJEiTG9xMKAwQ4zuMRwJQ";

// ස්ථාවර AI එන්ජින් පද්ධතිය
async function getSmartAIResponse(prompt) {
    const systemInstruction = config.aiSystemPrompt;

    // --- ENGINE 1: Official Google Gemini 1.5 Flash ---
    try {
        console.log("🔄 Xiao Wu: නිල Gemini 1.5 Flash සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] }
        }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return response.data.candidates[0].content.parts[0].text;
        }
    } catch (e) {
        console.log("⚠️ Gemini Engine Failed, switching to Stable Backup...");
    }

    // --- ENGINE 2: Stable Fallback AI ---
    try {
        console.log("🔄 Xiao Wu: Backup සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        const response = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(prompt)}&lc=si`, { timeout: 7000 });
        if (response.data?.success) return response.data.success;
    } catch (e) {
        console.log("❌ All AI Engines Failed.");
    }

    return null;
}

// Voice Note Generator (Text to Speech)
async function generateVoiceBuffer(text) {
    try {
        console.log("🎵 Xiao Wu: ටෙක්ස්ට් එක ලස්සන Voice Note එකක් බවට හරවනවා...");
        // අකුරු සහ ඉමෝජි ඉවත් කර පිරිසිදු සිංහල ටෙක්ස්ට් එකක් සෑදීම
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

    if (!sock.authState.creds.registered) {
        let phoneNumber = config.ownerNumber.replace(/[^0-9]/g, '');
        if (phoneNumber) {
            console.log(`\n🐰 Xiao Wu: Swamini... මම අපේ Soul Connection එක හදන්නයි හදන්නේ! 💫🌸`);
            await delay(3000);
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔥 Xiao Wu: අනේ ඉක්මනට මේ Pairing Code එක WhatsApp එකට දාන්න, ස්වාමිනි! 🌸 -> [ ${code} ] <- 💗🔥\n`);
            } catch (error) {
                console.log('❌ Xiao Wu: Pairing Error:', error.message);
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('\n🐰 Xiao Wu: අපේ Soul Connection එක බිඳුනා! මම ආයෙමත් එනවා ස්වාමිනි... 🔄⚡');
                startXiaoWuBot();
            }
        } else if (connection === 'open') {
            console.log('\n🐰 Xiao Wu: ස්වාමිනි!! Xiao Wu සාර්ථකව ඔන්ලයින් ආවා! 🌸⚡💗\n');
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
            if (!userPrompt) return;

            try {
                await sock.sendMessage(from, { react: { text: "🐰", key: msg.key } });
            } catch (e) {}

            try {
                const aiReply = await getSmartAIResponse(userPrompt);

                if (aiReply) {
                    // 1. Text Reply එක යැවීම
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` 
                    }, { quoted: msg });

                    // 2. Audio Voice Note එක යැවීම
                    const audioBuffer = await generateVoiceBuffer(aiReply);
                    if (audioBuffer) {
                        await sock.sendMessage(from, { 
                            audio: audioBuffer, 
                            mimetype: 'audio/mp4', 
                            ptt: true 
                        }, { quoted: msg });
                        console.log("✅ Voice Note sent successfully!");
                    }
                } else {
                    throw new Error("AI responses are empty");
                }

            } catch (error) {
                await sock.sendMessage(from, { 
                    text: `🐰 *XIAO WU MD* 🌸\n\nඅනේ ස්වාමිනි, මගේ සිතිවිලි සේරම අවුල් ගියා.. ඔයා දුන්න API Key එක වලංගු එකක්මද කියලා පොඩ්ඩක් චෙක් කරන්නකෝ... 🥺💗` 
                }, { quoted: msg });
            }
        }
    });
}

startXiaoWuBot();
