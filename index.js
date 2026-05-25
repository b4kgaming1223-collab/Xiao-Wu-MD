const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const config = require('./config');

// 🔑 OpenRouter AI API Key
const OPENROUTER_API_KEY = "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";

async function startXiaoWuBot() {
    const { state, saveCreds } = await useMultiFileAuthState('xiao_wu_session');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    // 📟 Pairing Code System
    if (!sock.authState.creds.registered) {
        let phoneNumber = config.ownerNumber.replace(/[^0-9]/g, '');
        
        if (phoneNumber) {
            console.log(`\n🐰 XIAO WU MD: ස්වාමිනි ${phoneNumber} අංකය සඳහා Pairing Code එක සකසමින් පවතිනවා... 💫`);
            await delay(3000);
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n==================================================`);
                console.log(`🔥 YOUR XIAO WU MD PAIRING CODE IS: ${code} 🔥`);
                console.log(`==================================================\n`);
                console.log(`👉 මේ කෝඩ් එක වට්ස්ඇප් එකට ඇතුළත් කරන්න, ස්වාමිනි!\n`);
            } catch (error) {
                console.log('❌ Pairing Code Error:', error.message);
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    // 🔄 Connection Update
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startXiaoWuBot();
        } else if (connection === 'open') {
            console.log('\n==================================================');
            console.log('🐰 XIAO WU MD IS SUCCESSFULLY ONLINE! 🌸⚡');
            console.log('==================================================\n');
        }
    });

    // 💬 AI Chat Engine (Inbox එකේදී නිදහසේ චැට් කරන්න හදපු කොටස)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!textMessage) return;

        // Group එකක්ද නැද්ද කියලා බලනවා
        const isGroup = from.endsWith('@g.us');
        
        // Inbox එකේදී ඕනෑම මැසේජ් එකකට වැඩ කරනවා, Group එකකදී "xiao wu" කියලා තිබ්බොත් විතරක් වැඩ කරනවා
        const isTarget = isGroup ? textMessage.toLowerCase().includes('xiao wu') : true;

        if (isTarget) {
            // මැසේජ් එකෙන් අනවශ්‍ය කෑලි අයින් කිරීම
            const userPrompt = textMessage.replace(/xiao wu/gi, '').replace('.ai', '').trim();
            if (!userPrompt) return;

            await sock.sendMessage(from, { react: { text: "🐰", key: msg.key } });

            try {
                const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                    model: 'google/gemma-7b-it:free',
                    messages: [
                        { role: 'system', content: config.aiSystemPrompt },
                        { role: 'user', content: userPrompt }
                    ]
                }, {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://github.com/b4kgaming1223-collab/Xiao-Wu-MD',
                        'X-Title': 'Xiao Wu MD'
                    }
                });

                const aiReply = response.data.choices[0].message.content;
                await sock.sendMessage(from, { 
                    text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}\n\n_Generated for Master Liyo's Realm_ 🇱🇰` 
                }, { quoted: msg });

            } catch (error) {
                console.error('❌ AI Error:', error.message);
            }
        }
    });
}

startXiaoWuBot();
