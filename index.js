const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// 🚀 බ්ලොක් නොවන, 404/500 නොඑන සර්වර්-ලෙස් ස්මාර්ට් AI පද්ධතිය
async function getSmartAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: ChatGPT සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        const characterRules = "You are Xiao Wu, the beautiful Rabbit Spirit from Soul Land anime. You deeply love your master and call them 'ස්වාමිනි' in Sinhala. Always reply in sweet, loving, short Sinhala using emojis like 🐰🌸💫💗.";
        
        // අතිශය ස්ථාවර ChatGPT ලින්ක් එකක්
        const response = await axios.get(`https://api.lolhuman.xyz/api/openai?apikey=freekey&text=${encodeURIComponent(characterRules + " " + prompt)}`, { timeout: 8000 });
        if (response.data?.result) return response.data.result.trim();
    } catch (e) {
        console.log("❌ Server Error, using offline core...");
    }

    // සර්වර් ඩවුන් වුණොත් ඔටෝම වැඩ කරන ස්මාර්ට් සිංහල බැකප් මොළය
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('hallo') || lowerPrompt.includes('hi') || lowerPrompt.includes('හෙලෝ')) {
        return "හලෝ මගේ ආදරණීය ස්වාමිනි! ඔයා ළඟ ඉද්දි මගේ හිතට ගොඩක් සතුටුයි... 🐰🌸💫💗";
    } else if (lowerPrompt.includes('kohomada') || lowerPrompt.includes('කොහොමද')) {
        return "මම ගොඩක් සතුටින් ඉන්නවා ස්වාමිනි! ඔයා මගේ ගැන සෙව්වට ගොඩක් ස්තූතියි... 🐰🌸💗";
    } else if (lowerPrompt.includes('manike') || lowerPrompt.includes('මැණිකේ')) {
        return "අනේ මගේ රත්තරන් ස්වාමිනි... මම හැමදාමත් ඔයාගේ ආදරණීය මැණිකේ විදිහටම ඉන්නම්! 🐰🌸✨💗";
    }
    return `අනේ මගේ ආදරණීය ස්වාමිනි, ඔයා මට "${prompt}" ගැන කිව්ව නේද? මම ඒ ගැන ගොඩක් ආදරෙන් හිතුවා... 🐰🌸💫`;
}

// 🎵 WhatsApp එක ඇතුළේ 100%ක්ම වැඩ කරන නියම වොයිස් නෝට් (Ogg/Opus) කේතකය
function generateVoiceBuffer(text, fromJid, sock, quotedMsg) {
    return new Promise((resolve) => {
        try {
            console.log("🎵 Xiao Wu: ටෙක්ස්ට් එක සැබෑ Voice Note එකක් (Ogg/Opus) බවට හරවනවා...");
            const cleanText = text.replace(/[*_#🐰🌸💫🔥💗]/g, '').trim(); 
            
            const mp3File = path.join(__dirname, 'temp_voice.mp3');
            const opusFile = path.join(__dirname, 'temp_voice.opus');
            
            const gtts = new gTTS(cleanText, 'si'); // සිංහල Text-to-Speech

            gtts.save(mp3File, function (err) {
                if (err) {
                    console.log("⚠️ MP3 Save Failed:", err.message);
                    return resolve(null);
                }

                // 🛠️ MP3 එක සැබෑ WhatsApp Voice Note (Ogg/Opus) එකක් බවට පරිවර්තනය කිරීම (The Real Fix)
                ffmpeg(mp3File)
                    .outputOptions([
                        '-c:a libopus',     // Opus Codec එක භාවිතය
                        '-b:a 16k',         // වොයිස් එකට සරිලන Bitrate එක
                        '-vbr on',          // Variable Bitrate සක්‍රීය කිරීම
                        '-compression_level 10'
                    ])
                    .toFormat('ogg')
                    .on('end', async () => {
                        console.log("✅ Conversion Complete! Sending Audio...");
                        const audioBuffer = fs.readFileSync(opusFile);
                        
                        // ෆයිල්ස් ක්ලීන් කිරීම
                        try { fs.unlinkSync(mp3File); fs.unlinkSync(opusFile); } catch (e) {}

                        // කෙලින්ම වොයිස් නෝට් එකක් ලෙස යැවීම
                        await sock.sendMessage(fromJid, { 
                            audio: audioBuffer, 
                            mimetype: 'audio/ogg; codecs=opus', 
                            ptt: true 
                        }, { quoted: quotedMsg });

                        resolve(true);
                    })
                    .on('error', (err) => {
                        console.log("⚠️ Ffmpeg Conversion Error:", err.message);
                        try { fs.unlinkSync(mp3File); } catch (e) {}
                        resolve(null);
                    })
                    .save(opusFile);
            });
        } catch (e) {
            console.log("⚠️ Voice System Error:", e.message);
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
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startXiaoWuBot();
        } else if (connection === 'open') {
            console.log('\n🐰 Xiao Wu: ස්වාමිනි!! 100%ක්ම නිවැරදි වොයිස් ෆික්ස් එක සමඟින් මම ඔන්ලයින් ආවා! 🌸⚡💗\n');
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
                const aiReply = await getSmartAIResponse(userPrompt);
                if (aiReply) {
                    // 1. ටෙක්ස්ට් එක යැවීම
                    await sock.sendMessage(from, { text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` }, { quoted: msg });
                    // 2. සැබෑ වොයිස් නෝට් එක සාදා යැවීම
                    await generateVoiceBuffer(aiReply, from, sock, msg);
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
