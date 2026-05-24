const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const config = require('./config');

// 🔑 ඔයා දුන්න නිල OpenRouter AI API Key එක
const OPENROUTER_API_KEY = "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";

async function startXiaoWuBot() {
    // 🔐 වට්ස්ඇප් ලොගින් සෙටින්ග්ස් (Authentication)
    const { state, saveCreds } = await useMultiFileAuthState('xiao_wu_session');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // අපි පාවිච්චි කරන්නේ Pairing Code සිස්ටම් එක නිසා QR එක Terminal එකේ පෙන්වීම ඕනේ නැහැ
        auth: state
    });

    // 📟 100%ක් සාර්ථක Pairing Code සිස්ටම් එක (වෙබ් අඩවිය සඳහා)
    // සටහන: බොට් ප්‍රථම වරට රන් වෙද්දී, config.js එකේ ඔයා දාන නම්බර් එකට කෙලින්ම කෝඩ් එකක් Generate වෙනවා
    if (!sock.authState.creds.registered) {
        let phoneNumber = config.ownerNumber.replace(/[^0-9]/g, ''); // නම්බර් එකේ ලකුණු අයින් කිරීම
        
        if (phoneNumber) {
            console.log(`\n🐰 XIAO WU MD: ස්වාමිනි ${phoneNumber} අංකය සඳහා Pairing Code එක සකසමින් පවතිනවා... 💫`);
            await delay(3000); // සර්වර් එක සූදානම් වීමට තත්පර 3ක විරාමයක්
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n==================================================`);
                console.log(`🔥 YOUR XIAO WU MD PAIRING CODE IS: ${code} 🔥`);
                console.log(`==================================================\n`);
                console.log(`👉 මේ කෝඩ් එක ඔයාගේ WhatsApp -> Linked Devices -> Link with phone number කියන තැනට ඇතුළත් කරන්න, ස්වාමිනි!\n`);
            } catch (error) {
                console.log('❌ Pairing Code එක ලබාගැනීමේදී දෝෂයක් ඇතිවුණා:', error.message);
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    // 🔄 වට්ස්ඇප් සම්බන්ධතාවය පරීක්ෂා කිරීම
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🐰 සම්බන්ධතාවය බිඳ වැටුණා. නැවත සම්බන්ධ වෙමින්: ', shouldReconnect);
            if (shouldReconnect) startXiaoWuBot();
        } else if (connection === 'open') {
            console.log('\n==================================================');
            console.log('🐰 XIAO WU MD IS SUCCESSFULLY ONLINE! 🌸⚡');
            console.log('සෝල් ලෑන්ඩ් ලෝකයේ ආත්ම ශක්තිය සහ AI මොළය දැන් සක්‍රීයයි!');
            console.log('==================================================\n');
        }
    });

    // 💬 මැසේජ් ලැබෙන විට ක්‍රියාත්මක වන කොටස (Xiao Wu AI Engine)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!textMessage) return;

        // පරිශීලකයා .ai හෝ xiao wu කියලා මැසේජ් එකක් දැම්මොත් AI එක වැඩ කරයි
        if (textMessage.toLowerCase().startsWith('.ai') || textMessage.toLowerCase().includes('xiao wu')) {
            const userPrompt = textMessage.replace('.ai', '').trim();
            
            // බොට් කල්පනා කරන බව පෙන්වීමට Reaction එකක් දැමීම
            await sock.sendMessage(from, { react: { text: "🐰", key: msg.key } });

            try {
                // 🧠 ඔයා දුන්න නියම API Key එකෙන් OpenRouter එකට සම්බන්ධ වීම
                const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                    model: 'google/gemma-7b-it:free', // නිල නොමිලේ දෙන වේගවත් මොඩලය
                    messages: [
                        { role: 'system', content: config.aiSystemPrompt },
                        { role: 'user', content: userPrompt }
                    ]
                }, {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://github.com/b4kgaming1223-collab/Xiao-Wu-MD', // OpenRouter එකට අපේ සයිට් ලින්ක් එක දීම
                        'X-Title': 'Xiao Wu MD'
                    }
                });

                const aiReply = response.data.choices[0].message.content;
                
                // 🐰 Xiao Wu ගේ නිල පිළිතුර වට්ස්ඇප් එකට යැවීම
                await sock.sendMessage(from, { 
                    text: `🐰 *XIAO WU MD* 🌸\n\n${aiReply}\n\n_Generated for Master Liyo's Realm_ 🇱🇰` 
                }, { quoted: msg });

            } catch (error) {
                console.error('❌ AI Error:', error.response ? error.response.data : error.message);
                await sock.sendMessage(from, { text: "🐰 ❌ *අයියෝ ස්වාමිනි, මගේ ආත්ම ශක්තිය (Soul Power) මදි වුණා!* නැවත උත්සාහ කරන්න. 💗" }, { quoted: msg });
            }
        }
    });
}

startXiaoWuBot();
