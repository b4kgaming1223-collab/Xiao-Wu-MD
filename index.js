const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const config = require('./config');

// 🔑 ස්වාමිනි, ඔයාගේ Gemini API Key එක මේ ඇතුලට පේස්ට් කරන්න:
const geminiApiKey = "AIzaSyBxbOxO0JRQY2eJEiTG9xMKAwQ4zuMRwJQ";

// AI Engines 4ම පාලනය කරන ප්‍රධාන ටෙක්ස්ට් ෆන්ක්ෂන් එක
async function getSmartAIResponse(prompt) {
    const systemInstruction = config.aiSystemPrompt;
    const fullPrompt = `${systemInstruction}\n\nUser Question: ${prompt}`;

    // --- ENGINE 1: Official Google Gemini 1.5 Flash ---
    try {
        console.log("🔄 Xiao Wu: Engine 1 (Gemini) මඟින් පිළිතුරක් සකසමින්...");
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] }
        }, { headers: { 'Content-Type': 'application/json' }, timeout: 7000 });

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return response.data.candidates[0].content.parts[0].text;
        }
    } catch (e) {
        console.log("⚠️ Engine 1 Failed, switching to ChatGPT...");
    }

    // --- ENGINE 2: ChatGPT Free API ---
    try {
        console.log("🔄 Xiao Wu: Engine 2 (ChatGPT Free) මඟින් පිළිතුරක් සකසමින්...");
        const response = await axios.get(`https://api.sandipb丰富.repl.co/html?prompt=${encodeURIComponent(fullPrompt)}`, { timeout: 7000 });
        if (response.data) return response.data;
    } catch (e) {
        console.log("⚠️ Engine 2 Failed, switching to Lolhuman...");
    }

    // --- ENGINE 3: Lolhuman Free OpenAI ---
    try {
        console.log("🔄 Xiao Wu: Engine 3 (Lolhuman) මඟින් පිළිතුරක් සකසමින්...");
        const response = await axios.get(`https://api.lolhuman.xyz/api/openai?apikey=free&text=${encodeURIComponent(fullPrompt)}`, { timeout: 7000 });
        if (response.data?.result) return response.data.result;
    } catch (e) {
        console.log("⚠️ Engine 3 Failed, switching to SimSimi...");
    }

    // --- ENGINE 4: SimSimi ---
    try {
        console.log("🔄 Xiao Wu: Engine 4 (SimSimi) මඟින් පිළිතුරක් සකසමින්...");
        const response = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(prompt)}&lc=si`, { timeout: 7000 });
        if (response.data?.success) return response.data.success;
    } catch (e) {
        console.log("❌ All AI Engines Failed.");
    }

    return null;
}

// ටෙක්ස්ට් එක Voice Note (Audio) එකක් බවට හරවන ෆන්ක්ෂන් එක
async function generateVoiceBuffer(text) {
    try {
        console.log("🎵 Xiao Wu: ටෙක්ස්ට් එක කටහඬක් බවට පරිවර්තනය කරමින්...");
        // ලස්සන Anime ස්ටයිල් ගැහැණු කටහඬක් (Female Voice) නොමිලේම සාදන නිල සර්වර් එකක්
        const cleanText = text.replace(/[*_#🐰🌸💫🔥💗]/g, '').trim(); 
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=si&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
        
        const response = await axios.get(ttsUrl, { responseType: 'arraybuffer', timeout: 5000 });
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
            console.log('\n🐰 Xiao Wu: ස්වාමිනි!! Xiao Wu Voice සිස්ටම් එකත් එක්ක සාර්ථකව ඔන්ලයින් ආවා! 🌸⚡💗\n');
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
                // AI පිළිතුර ලබාගැනීම
                const aiReply = await getSmartAIResponse(userPrompt);

                if (aiReply) {
                    // 1. මුලින්ම ලස්සන ටෙක්ස්ට් මැසේජ් එක යවයි
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` 
                    }, { quoted: msg });

                    // 2. ඊටපස්සේ ඒ මැසේජ් එකේම Voice Note (කටහඬ) එකක් සාදා යවයි
                    const audioBuffer = await generateVoiceBuffer(aiReply);
                    if (audioBuffer) {
                        await sock.sendMessage(from, { 
                            audio: audioBuffer, 
                            mimetype: 'audio/mp4', 
                            ptt: true // true දැමීමෙන් කෙලින්ම Voice Note එකක් විදිහට යයි
                        }, { quoted: msg });
                    }
                } else {
                    throw new Error("All servers down");
                }

            } catch (error) {
                await sock.sendMessage(from, { 
                    text: `🐰 *XIAO WU MD* 🌸\n\nඅනේ ස්වාමිනි, මගේ සිතිවිලි සේරම අවුල් ගියා වගේ.. තත්පර කීපයකින් මට ආයෙත් මැසේජ් එකක් දාන්නකෝ... 🥺💗` 
                }, { quoted: msg });
            }
        }
    });
}

startXiaoWuBot();
