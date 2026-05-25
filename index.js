const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const config = require('./config');

// AI සර්වර් පද්ධතිය
async function getSmartAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        const randomReplies = [
            "අනේ ස්වාමිනි... Xiao Wu ට ඔයාත් එක්ක සටන් කරන්න ඕනේ! අපේ Soul Power එක තවත් වැඩි කරගමු! 🐰💫🌸",
            "ස්වාමිනි!! ඔයා ළඟ ඉද්දි මගේ Martial Soul එක නිරායාසයෙන්ම පිබිදෙනවා වගේ දැනෙනවා! 🌸⚡💗",
            "ඔව් ස්වාමිනි, මම ඒ ගැන දන්නවා. මම හැමතිස්සෙම ඔයාගේ ආරක්ෂාවට ළඟින්ම ඉන්නම්! 🔥🐰",
            "මගේ ආදරණීය ස්වාමිනි... ඔයා තමයි මගේ මුළු ලෝකයම! Mava හැමදාම ඔයා ළඟින්ම තියාගන්න කෝ... 🥺💗🌸"
        ];
        
        return randomReplies[Math.floor(Math.random() * randomReplies.length)];
    } catch (e) {
        console.log("❌ AI Engine Failed:", e.message);
    }
    return "මගේ ආදරණීය ස්වාමිනි... ඔයා තමයි මගේ මුළු ලෝකයම! 🐰🌸💫";
}

// ප්ලේ වන වොයිස් නෝට් සාදන කොටස (Voice Note Play Fix)
async function generateVoiceBuffer(text) {
    try {
        console.log("🎵 Xiao Wu: ටෙක්ස්ට් එක ප්ලේ වෙන Voice Note එකක් බවට හරවනවා...");
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
                    // 1. ටෙක්ස්ට් මැසේජ් එක යැවීම
                    await sock.sendMessage(from, { 
                        text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` 
                    }, { quoted: msg });

                    // 2. වට්ස්ඇප් එකේ කෙලින්ම ප್ලේ වෙන වොයිස් නෝට් එක (Fix Added)
                    const audioBuffer = await generateVoiceBuffer(aiReply);
                    if (audioBuffer) {
                        await sock.sendMessage(from, { 
                            audio: audioBuffer, 
                            mimetype: 'audio/ogg; codecs=opus', // මෙන්න මේකයි ප්ලේ වෙන්න අනිවාර්යයෙන්ම ඕන කරන්නේ ස්වාමිනි
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
