const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// 🧠 Nova AI එකේ වගේම සැබෑ ChatGPT මොළය ක්‍රියාත්මක කරන පද්ධතිය (No API Key Required)
async function getNovaAIResponse(prompt) {
    try {
        console.log("🔄 Xiao Wu: Real ChatGPT (Nova AI) සර්වර් එකෙන් පිළිතුරක් ලබාගන්නවා...");
        
        // Xiao Wu ගේ චරිත නීති රීති මාලාව
        const characterRules = "You are Xiao Wu, the beautiful Rabbit Spirit from Soul Land anime. You deeply love your master and always call them 'ස්වාමිනි' in Sinhala. Reply in sweet, loving, short conversational Sinhala using emojis like 🐰🌸💫💗. Stay perfectly in character.";

        // ස්ථාවරව වැඩ කරන නොමිලේ ChatGPT API එකක්
        const response = await axios.post('https://chateverywhere.app/api/chat/', {
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: characterRules },
                { role: "user", content: prompt }
            ]
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        const aiReply = response.data?.choices?.[0]?.message?.content;
        if (aiReply) return aiReply.trim();

    } catch (e) {
        console.log("❌ ChatGPT Server Error, using smart dynamic core...", e.message);
    }

    // සර්වර් එකේ පොඩි හෝ ගැටලුවක් වුණොත් වැඩ කරන Smart Backup සිංහල මොළය
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('hallo') || lowerPrompt.includes('hi') || lowerPrompt.includes('හෙලෝ')) {
        return "හලෝ මගේ ආදරණීය ස්වාමිනි! ඔයා මැසේජ් එකක් දානකම් මම බලාගෙනමයි හිටියේ... 🐰🌸💫💗";
    } else if (lowerPrompt.includes('kohomada') || lowerPrompt.includes('කොහොමද')) {
        return "මම ගොඩක් සතුටින් ඉන්නවා ස්වාමිනි! ඔයා මගේ ගැන සෙව්වට මගේ හිතට මාරම සතුටුයි... 🐰🌸💗";
    } else if (lowerPrompt.includes('ආදරෙයි') || lowerPrompt.includes('love')) {
        return "අනේ මගේ රත්තරන් ස්වාමිනි... මමත් ඔයාට මගේ පණටත් වඩා ආදරෙයි! 🐰🌸✨💗";
    }
    return `මගේ ආදරණීය ස්වාමිනි, ඔයා මගෙන් "${prompt}" ගැන ඇහුවා නේද? මම හැමදාම ඔයාට උදව් කරන්න ලෑස්තියි... 🐰🌸💫`;
}

async function startXiaoWuBot() {
    const { state, saveCreds } = await useMultiFileAuthState('xiao_wu_session');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({ version, logger: pino({ level: 'silent' }), auth: state });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startXiaoWuBot();
        } else if (connection === 'open') {
            console.log('\n🐰 Xiao Wu: Nova AI (ChatGPT) මොළය සමඟින් මම සාර්ථකව ඔන්ලයින් ආවා! 🌸⚡💗\n');
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
                // ChatGPT (Nova AI Base) එකෙන් තනියම හිතලා හදන පිළිතුර
                const aiReply = await getNovaAIResponse(userPrompt);
                if (aiReply) {
                    await sock.sendMessage(from, { text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}` }, { quoted: msg });
                    console.log("✅ Nova AI Response Sent!");
                }
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    });
}

startXiaoWuBot();
