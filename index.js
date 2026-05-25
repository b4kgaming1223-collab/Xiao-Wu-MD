const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 7860;

// ⚙️ config.js ෆයිල් එක මෙතනට සම්බන්ධ කිරීම
const config = require('./config');

app.use(cors());
app.use(express.json());

// 🧠 සැබෑ AI මොළය (config.js එකේ තියෙන රූල්ස් අනුව වැඩ කරයි)
async function getXiaoWuAIResponse(prompt) {
    try {
        const response = await axios.post('https://chataidemo.soland.workers.dev/', {
            model: "@hf/thebloke/zephyr-7b-beta-awq",
            messages: [
                { role: "system", content: config.aiSystemPrompt },
                { role: "user", content: prompt }
            ]
        }, { headers: { 'Content-Type': 'application/json' }, timeout: 25000 });
        
        const aiReply = response.data?.choices?.[0]?.message?.content;
        if (aiReply) return aiReply.trim();
    } catch (e) {
        console.log("AI Error:", e.message);
    }
    return `මගේ ආදරණීය ස්වාමිනි, ඔයා මගෙන් "${prompt}" ගැන ඇහුවා නේද? මම හැමදාම ඔයාට උදව් කරන්න ළඟින්ම ඉන්නවා! 🐰🌸💫`;
}

app.get('/', (req, res) => res.send(`${config.botName} Host is Active! 🐰🌸`));

// වෙබ් සයිට් එකෙන් නම්බර් එක එවනකොට මේක වැඩ කරනවා
app.post('/start-connection', async (req, res) => {
    let { number } = req.body;
    if (!number) return res.status(400).json({ error: "Number is required!" });
    number = number.replace(/[^0-9]/g, '');

    try {
        const { state, saveCreds } = await useMultiFileAuthState('xiao_wu_session');
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: state,
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        sock.ev.on('creds.update', saveCreds);

        // වට්ස්ඇප් මැසේජ් පාලනය
        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const from = msg.key.remoteJid;
            const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;
            if (!textMessage) return;

            const isGroup = from.endsWith('@g.us');
            const isTarget = isGroup ? textMessage.toLowerCase().includes(config.botName.toLowerCase()) : true;

            if (isTarget) {
                const userPrompt = textMessage.replace(new RegExp(config.botName, 'gi'), '').trim();
                try { await sock.sendMessage(from, { react: { text: "🐰", key: msg.key } }); } catch (e) {}
                const aiReply = await getXiaoWuAIResponse(userPrompt);
                await sock.sendMessage(from, { text: `🐰 *${config.botName}* 🌸\n\n${aiReply}` }, { quoted: msg });
            }
        });

        setTimeout(async () => {
            if (!sock.authState.creds.registered) {
                try {
                    let code = await sock.requestPairingCode(number);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    return res.json({ code: code });
                } catch (err) {
                    return res.status(500).json({ error: err.message });
                }
            } else {
                return res.json({ status: "Already connected!" });
            }
        }, 3000);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
