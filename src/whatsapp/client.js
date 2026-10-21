import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion,
  Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { chatState } from '../state/chatState.js';
import { SalesAgent } from '../ai/salesAgent.js';
import { getBusinessConfig } from '../config.js';
import { codeDispenser } from '../codeDispenser.js';
import { detectPackFromText } from '../packDetector.js';

let isWhatsAppConnected = false;
let isInitializing = false;
let activeSocket = null;
let latestQRDataUrl = null;
let latestPairingCode = null;

export function getWhatsAppStatus() {
  return {
    isConnected: isWhatsAppConnected,
    isInitializing: isInitializing,
    qrDataUrl: latestQRDataUrl,
    pairingCode: latestPairingCode
  };
}

/** Devuelve el socket activo para que el remarketing pueda enviar mensajes */
export function getActiveSocket() {
  return isWhatsAppConnected ? activeSocket : null;
}

const salesAgent = new SalesAgent();

export async function connectWhatsApp(pairingPhoneNumber = null) {
  if (activeSocket && isWhatsAppConnected) {
    console.log('ℹ️ WhatsApp (Baileys) ya está conectado y activo.');
    return activeSocket;
  }

  isInitializing = true;
  const authFolder = path.join(process.cwd(), 'baileys_auth');
  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
  }

  if (activeSocket) {
    try {
      activeSocket.ev?.removeAllListeners();
      activeSocket.end();
    } catch (e) {}
    activeSocket = null;
  }

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const logger = pino({ level: 'silent' });

  const { version } = await fetchLatestWaWebVersion({}).catch(() => ({ version: [2, 3000, 1015901307] }));

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    generateHighQualityLinkPreview: true,
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: true,
    syncFullHistory: false
  });

  activeSocket = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      isWhatsAppConnected = false;
      console.log('\n======================================================');
      console.log('📱 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP BUSINESS:');
      console.log('======================================================\n');
      qrcodeTerminal.generate(qr, { small: true });

      try {
        latestQRDataUrl = await QRCode.toDataURL(qr);
        console.log('🖼️ Código QR listo en la página web: http://localhost:3000');
      } catch (err) {}
    }

    if (connection === 'open') {
      isWhatsAppConnected = true;
      isInitializing = false;
      latestQRDataUrl = null;
      latestPairingCode = null;
      console.log('\n🟢 ¡BONSAI CHAT (BAILEYS) CONECTADO EXITOSAMENTE A WHATSAPP!');
      console.log('🎧 Asistente DJ Bonsai listo para responder y vender packs de música en vivo.\n');
    } else if (connection === 'close') {
      isWhatsAppConnected = false;
      isInitializing = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`🔴 WhatsApp (Baileys) desconectado. Razón: ${statusCode || 'desconocida'}`);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log('🧹 Sesión desvinculada por el teléfono. Limpiando credenciales...');
        resetWhatsAppSession();
      } else {
        setTimeout(() => {
          connectWhatsApp().catch(e => console.error('Error al reconectar Baileys:', e.message));
        }, 3000);
      }
    }
  });

  const processedMsgIds = new Set();

  // ── PROTECCIONES ANTI-ABUSO ───────────────────────────────────────────────
  // Límite de mensajes por contacto: máximo 20 respuestas por hora
  const msgCountPerJid = new Map(); // jid → { count, windowStart }
  const MAX_MSGS_PER_HOUR = 20;

  // Anti-bucle bot-vs-bot: si un jid responde muy rápido muchas veces seguidas
  // (< 8 segundos entre mensajes), lo detectamos como bot y lo silenciamos.
  const rapidMsgTracker = new Map(); // jid → { lastMsgTs, rapidCount }
  const RAPID_MSG_THRESHOLD_MS = 8000; // menos de 8 seg entre mensajes = sospechoso
  const RAPID_MSG_MAX = 5;           // 5 ráfagas seguidas = es un bot, silenciar
  // ─────────────────────────────────────────────────────────────────────────

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      try {
        if (!msg.message) continue;
        const msgId = msg.key.id;
        if (msgId && processedMsgIds.has(msgId)) continue;
        if (msgId) {
          processedMsgIds.add(msgId);
          if (processedMsgIds.size > 2000) {
            const first = processedMsgIds.values().next().value;
            processedMsgIds.delete(first);
          }
        }

        const jid = msg.key.remoteJid;
        const fromMe = msg.key.fromMe;

        if (!jid || jid.includes('@g.us') || jid.includes('status@broadcast')) continue;

        // Omitir mensajes viejos de sincronización histórica al conectar
        const nowSec = Math.floor(Date.now() / 1000);
        const msgSec = msg.messageTimestamp ? Number(msg.messageTimestamp) : 0;
        if (msgSec > 0 && (nowSec - msgSec) > 120) {
          console.log(`⏰ Omitiendo mensaje antiguo de ${jid} (${nowSec - msgSec}s atrás)`);
          continue;
        }

        // Extraer contenido del mensaje desempaquetando mensajes efímeros/temporales
        const realMessage = msg.message.ephemeralMessage?.message ||
                            msg.message.viewOnceMessage?.message ||
                            msg.message.viewOnceMessageV2?.message ||
                            msg.message.documentWithCaptionMessage?.message ||
                            msg.message.editedMessage?.message?.protocolMessage?.editedMessage ||
                            msg.message;

        let textMessage = (
          realMessage.conversation ||
          realMessage.extendedTextMessage?.text ||
          realMessage.imageMessage?.caption ||
          realMessage.videoMessage?.caption ||
          realMessage.buttonsResponseMessage?.selectedButtonId ||
          realMessage.listResponseMessage?.singleSelectReply?.selectedRowId ||
          realMessage.templateButtonReplyMessage?.selectedId ||
          ''
        ).trim();

        const isAudioMsg = !!realMessage.audioMessage;
        // isImageMsg solo aplica a mensajes ENTRANTES (no fromMe).
        // Si YO envío fotos desde el celular (fromMe=true), NO debe activar la entrega.
        const isImageMsg = !fromMe && (!!realMessage.imageMessage || !!realMessage.documentMessage);

        // EVITAR BUCLE INFINITO: Si no hay texto, audio ni imagen, no procesar ni enviar respuestas
        if (!textMessage && !isAudioMsg && !isImageMsg) {
          continue;
        }

        const lowerCmd = textMessage.toLowerCase();

        // CONTROL HUMANO DE PAUSA / ACTIVACIÓN Y DETECCIÓN DE INTERVENCIÓN DEL DJ
        if (fromMe) {
          if (lowerCmd === '/pausa') {
            chatState.setHumanActive(jid, true);
            console.log(`⏸️ Bot pausado en ${jid} por comando /pausa`);
            await sock.sendMessage(jid, { text: '⚙️ [Bonsai Chat]: Bot pausado para este chat. DJ Bonsai en persona tomará el control.' });
            continue;
          }
          if (lowerCmd === '/bot' || lowerCmd === '/activar') {
            chatState.setHumanActive(jid, false);
            console.log(`▶️ Bot reactivado en ${jid} por comando /bot`);
            await sock.sendMessage(jid, { text: '⚙️ [Bonsai Chat]: Bot reactivado exitosamente.' });
            continue;
          }

          // Si el DJ escribe manualmente a un cliente desde su celular, pausamos el bot en este chat automáticamente
          const isAutomatedMessage = 
            textMessage.startsWith('⚙️ [Bonsai Chat]') || 
            textMessage.startsWith('🎧') || 
            textMessage.startsWith('🤖') || 
            textMessage.startsWith('📸') || 
            textMessage.startsWith('🖼️') || 
            textMessage.startsWith('🎥') || 
            textMessage.startsWith('🎵') || 
            textMessage.startsWith('¡Excelente decisión!') || 
            textMessage.startsWith('Hola, mucho gusto') || 
            textMessage.startsWith('Con mucho gusto');

          if (!isAutomatedMessage && textMessage.length > 0) {
            chatState.setHumanActive(jid, true);
            console.log(`⏸️ Intervención humana detectada en ${jid}. Bot pausado automáticamente.`);
          }
          continue;
        }

        if (textMessage.includes('Este chat se inició a partir de un anuncio') || textMessage.includes('El usuario compartió datos')) {
          textMessage = textMessage.replace(/Este chat se inició a partir de un anuncio.*/gi, '').trim();
          textMessage = textMessage.replace(/El usuario compartió datos.*/gi, '').trim();
          if (!textMessage) textMessage = "Hola, quiero más información";
        }

        console.log(`📩 [Baileys Mensaje Recibido] De ${jid}: "${textMessage}"`);

        const currentState = chatState.getChatState(jid);
        if (currentState.isHumanActive) {
          console.log(`⏸️ Omitiendo respuesta a ${jid}: Chat pausado por intervención humana.`);
          continue;
        }

        // ── DETECTOR DE BUCLE BOT-VS-BOT ──────────────────────────────────────
        // Si el contacto responde en menos de RAPID_MSG_THRESHOLD_MS repetidamente,
        // lo marcamos como bot y pausamos el chat automáticamente.
        const nowMs = Date.now();
        if (!rapidMsgTracker.has(jid)) {
          rapidMsgTracker.set(jid, { lastMsgTs: nowMs, rapidCount: 0 });
        }
        const rapid = rapidMsgTracker.get(jid);
        const timeSinceLast = nowMs - rapid.lastMsgTs;
        rapid.lastMsgTs = nowMs;
        if (timeSinceLast < RAPID_MSG_THRESHOLD_MS) {
          rapid.rapidCount++;
          if (rapid.rapidCount >= RAPID_MSG_MAX) {
            chatState.setHumanActive(jid, true);
            console.log(`🛑 [ANTI-BUCLE] Bot externo detectado en ${jid} (${rapid.rapidCount} msgs rápidos). Chat silenciado 1 hora.`);
            rapid.rapidCount = 0;
            continue;
          }
        } else {
          // Reiniciar contador si hubo pausa suficiente
          rapid.rapidCount = Math.max(0, rapid.rapidCount - 1);
        }
        // ── FIN DETECTOR BOT ──────────────────────────────────────────────────

        // ── RATE LIMITER: máximo MAX_MSGS_PER_HOUR respuestas por contacto/hora ─
        const windowMs = 60 * 60 * 1000; // 1 hora
        if (!msgCountPerJid.has(jid)) {
          msgCountPerJid.set(jid, { count: 0, windowStart: nowMs });
        }
        const rateEntry = msgCountPerJid.get(jid);
        if (nowMs - rateEntry.windowStart > windowMs) {
          // Nueva ventana horaria
          rateEntry.count = 0;
          rateEntry.windowStart = nowMs;
        }
        rateEntry.count++;
        if (rateEntry.count > MAX_MSGS_PER_HOUR) {
          console.log(`⚠️ [RATE LIMIT] ${jid} superó ${MAX_MSGS_PER_HOUR} mensajes/hora. Ignorando.`);
          continue;
        }
        // ── FIN RATE LIMITER ──────────────────────────────────────────────────

        // Registrar timestamp del mensaje entrante para el motor de remarketing
        chatState.updateLastIncoming(jid);

        function getAudioConfig(filePath) {
          const lower = filePath.toLowerCase();
          if (lower.endsWith('.opus') || lower.endsWith('.ogg')) return { mimetype: 'audio/ogg; codecs=opus', ptt: true };
          if (lower.endsWith('.m4a')) return { mimetype: 'audio/mp4', ptt: true };
          if (lower.endsWith('.wav')) return { mimetype: 'audio/wav', ptt: false };
          return { mimetype: 'audio/mpeg', ptt: false };
        }

        function getMediaFiles() {
          const mediaDir = path.join(process.cwd(), 'media');
          const video1Saludo = path.join(mediaDir, 'video_1_saludo.mp4');
          const video2Tutorial = path.join(mediaDir, 'video_2_tutorial.mp4');

          return {
            video1Saludo: fs.existsSync(video1Saludo) ? video1Saludo : null,
            video2Tutorial: fs.existsSync(video2Tutorial) ? video2Tutorial : null
          };
        }

        // DETECCIÓN DE NOTAS DE VOZ
        if (isAudioMsg) {
          console.log(`🎙️ Nota de voz recibida de ${jid}.`);
          const voiceReply = "¡Hola! 🎧 Recibí tu nota de voz. Por este medio automático leo mensajes de texto. Si me escribes tu inquietud o palabras como 'info' o el número de tu pack, con mucho gusto te respondo de inmediato 🙌🔥";
          await sock.sendMessage(jid, { text: voiceReply });
          continue;
        }

        // 1. DETECCIÓN DE MENSAJE DE COMPRA DESDE LA WEB O NÚMERO (SIN IMAGEN AÚN)
        const detectedPack = detectPackFromText(textMessage);
        const lowerTxt = textMessage.toLowerCase();
        const trimmedTxt = lowerTxt.trim().replace('.', '');
        const isNumericChoice = ['1','2','3','4','5','6','7','8'].includes(trimmedTxt);

        if (detectedPack && !isImageMsg && (isNumericChoice || lowerTxt.includes('transferir') || lowerTxt.includes('adquirir') || lowerTxt.includes('activar') || lowerTxt.includes('acceso completo') || lowerTxt.includes('promocion') || lowerTxt.includes('pack') || lowerTxt.includes('combo'))) {
          console.log(`📦 Pedido detectado para ${jid}: ${detectedPack.name} (${detectedPack.key})`);
          chatState.setPendingPack(jid, detectedPack.key, detectedPack.name, detectedPack.subPacks || []);
          const askCaptureReply = `¡Perfecto! 🔥 Solo falta que me envíes la foto o captura del comprobante de pago para entregarte de inmediato tu código de acceso oficial de por vida para el *${detectedPack.name}*.`;
          await sock.sendMessage(jid, { text: askCaptureReply });
          continue;
        }

        // 2. DETECCIÓN DE COMPROBANTE DE PAGO (FOTO O PALABRA CLAVE DE PAGO)
        const isPaymentKeyword = lowerTxt.includes('comprobante') || lowerTxt.includes('ya pague') || lowerTxt.includes('ya transferi') || lowerTxt.includes('pago listo') || lowerTxt.includes('adjunto');

        if (isImageMsg || isPaymentKeyword) {
          console.log(`📸 Comprobante recibido de ${jid}. Verificando pack...`);
          const packToDeliver = detectedPack || chatState.getPendingPack(jid);

          if (packToDeliver) {
            const code = codeDispenser.getNextCode(packToDeliver.key, jid);
            if (code) {
              let autoUrl = `https://bonsai-music-pool.vercel.app/?c=${code}`;
              let specificPackNote = "";

              if (packToDeliver.key === 'VIP') {
                specificPackNote = "Toca el enlace y ve a la plataforma: ¡Absolutamente TODOS los packs de la plataforma han quedado 100% desbloqueados de por vida para ti!";
              } else if (packToDeliver.key === 'DUO' || packToDeliver.key === 'TRIO') {
                const subPacksList = packToDeliver.subPacks || [];
                if (subPacksList.length > 0) {
                  autoUrl += `&p=${subPacksList.join(',')}`;
                  specificPackNote = `Toca el enlace y ve directamente a tus packs elegidos: ¡Ya están totalmente desbloqueados para que escuches todo y descargues tus canciones!`;
                } else {
                  specificPackNote = `Toca el enlace y ve a la plataforma para elegir tus packs de la promoción, ¡ya están listos para desbloquear!`;
                }
              } else {
                specificPackNote = `Toca el enlace y ve directamente a tu *${packToDeliver.name}*: ¡Ya está totalmente desbloqueado para que puedas escuchar todas las canciones en vivo y descargar carpetas completas en limpio formato ZIP!`;
              }

              const deliveryText = `¡Pago confirmado con éxito! 🎉🎧 Bienvenido a *Bonsai Music Pool*.

📦 *Tu compra:* ${packToDeliver.name}
🔑 *Tu código de activación:* ${code}

📲 *CÓMO INGRESAR Y DESCARGAR:*
1️⃣ Toca tu enlace con auto-desbloqueo:
👉 ${autoUrl}

2️⃣ ${specificPackNote}

⚠️ *CONDICIONES Y SEGURIDAD:*
• Tu acceso es *vitalicio (de por vida)* para descargar cuando quieras.
• Código personal válido para *máximo 2 dispositivos* (por ejemplo, tu celular y tu computador).
• Al ingresar desde tu navegador, la web limpia el código de la barra de direcciones para proteger tu acceso personal.

¡A disfrutar de la mejor música con la máxima calidad! 🚀🔥`;
              await sock.sendMessage(jid, { text: deliveryText });
              chatState.markPurchased(jid);
              chatState.clearPendingPack(jid);
              console.log(`✅ Pack ${packToDeliver.name} entregado a ${jid} con código ${code}`);
              continue;
            }
          }

          // Si mandó foto pero no sabemos qué pack pagó:
          console.log(`⚠️ Comprobante sin pack identificado de ${jid}. Solicitando número de pack o validación web...`);
          const redirectMsg = `¡Comprobante recibido con éxito! 🎉👏

Para entregarte de inmediato tu código exacto de activación, indícame cuál pack o combo compraste (puedes responder simplemente con el número):

1️⃣ Pack Samples & Efectos DJ ($5.000 COP)
2️⃣ Pack Decembrino 2026 ($10.000 COP)
3️⃣ Pack 1000 Videos Remix ($10.000 COP)
4️⃣ Pack Crossover Originales & Extended ($10.000 COP)
5️⃣ Pack Halloween 2026 ($10.000 COP)
6️⃣ Combo Dúo (2 Packs a elección) ($15.000 COP)
7️⃣ Combo Trío (3 Packs a elección) ($20.000 COP)
8️⃣ Mega Combo VIP (Todos los packs completos) ($35.000 COP)

O si compraste directamente en nuestra web, ingresa a https://bonsai-music-pool.vercel.app y toca *"Notificar Pago por WhatsApp"* en tu pack. 🎧🔥`;
          await sock.sendMessage(jid, { text: redirectMsg });
          continue;
        }

        // 3. DEMOS / MUESTRAS EN VIVO EN LA WEB (SIN AUDIOS PESADOS POR WHATSAPP)
        const isDemoKeyword = lowerTxt.includes('demo') || lowerTxt.includes('muestra') || lowerTxt.includes('escuchar') || lowerTxt.includes('probador') || lowerTxt.includes('como viene');

        if (isDemoKeyword) {
          console.log(`🎧 Invitando a probar la música en vivo en la web a ${jid}...`);
          const demoReply = "¡Montamos un reproductor en vivo en nuestra web oficial para que escuches todo sin gastar la memoria de tu WhatsApp! 🚀\n\nEntra aquí:\n🌐 https://bonsai-music-pool.vercel.app\n\nPuedes darle play a cualquier canción completa en 320 Kbps sin marcas, ver cuántas carpetas tiene cada pack y cuántos Gigas pesa. ¡Escuchas exactamente lo que te vas a llevar!";
          await sock.sendMessage(jid, { text: demoReply });
          continue;
        }

        // 4. SALUDO INICIAL + VIDEO EXPLICATIVO DE DJ BONSAI
        const history = chatState.getHistory(jid);
        const isInfoOrGreeting = 
          lowerTxt.includes('hola') || 
          lowerTxt.includes('buenas') ||
          lowerTxt.includes('info') || 
          lowerTxt.includes('informacion') ||
          lowerTxt.includes('de que trata') ||
          lowerTxt.includes('mas info');

        if (history.length === 0 || isInfoOrGreeting) {
          const config = getBusinessConfig();
          console.log(`👋 Enviando bienvenida a ${jid}...`);
          await sock.sendMessage(jid, { text: config.respuestas_rapidas.saludo_e_info });
          chatState.addMessage(jid, 'assistant', config.respuestas_rapidas.saludo_e_info);

          // Enviar videos de DJ Bonsai (Video 1: Saludo + Video 2: Tutorial)
          const { video1Saludo, video2Tutorial } = getMediaFiles();
          
          if (video1Saludo && fs.existsSync(video1Saludo)) {
            try {
              await new Promise(r => setTimeout(r, 1500));
              console.log(`🎥 Enviando video 1 (saludo) a ${jid}...`);
              await sock.sendMessage(jid, {
                video: fs.readFileSync(video1Saludo),
                caption: '👋 ¡Hola! Te habla DJ Bonsai en persona. Mira este video antes de empezar 🔥'
              });
            } catch (vErr) {
              console.error('Error enviando video 1:', vErr.message);
            }
          }

          if (video2Tutorial && fs.existsSync(video2Tutorial)) {
            try {
              await new Promise(r => setTimeout(r, 2000));
              console.log(`🎥 Enviando video 2 (tutorial) a ${jid}...`);
              await sock.sendMessage(jid, {
                video: fs.readFileSync(video2Tutorial),
                caption: '📲 Tutorial: Cómo navegar en la web, escuchar canciones en vivo y descargar tus packs 🎧'
              });
            } catch (v2Err) {
              console.error('Error enviando video 2:', v2Err.message);
            }
          }
          continue;
        }

        const botReply = await salesAgent.generateResponse(jid, textMessage);
        await sock.sendMessage(jid, { text: botReply });
        console.log(`🤖 Respuesta enviada por DJ Bonsai a ${jid}`);

      } catch (handlerErr) {
        console.error('⚠️ Error procesando mensaje de WhatsApp:', handlerErr?.message || handlerErr);
      }
    }
  });

  if (pairingPhoneNumber) {
    await new Promise(r => setTimeout(r, 2000));
    console.log(`📱 Solicitando Código de 8 Dígitos de Baileys para: ${pairingPhoneNumber}...`);
    const rawCode = await sock.requestPairingCode(pairingPhoneNumber);
    const formattedCode = rawCode && rawCode.length === 8
      ? `${rawCode.slice(0, 4)}-${rawCode.slice(4)}`
      : rawCode;

    latestPairingCode = formattedCode;
    console.log(`\n======================================================`);
    console.log(`🔑 CÓDIGO DE EMPAREJAMIENTO GENERADO: ${formattedCode}`);
    console.log(`======================================================\n`);
  }

  return sock;
}

export async function requestWhatsAppPairingCode(phoneNumber) {
  if (!phoneNumber) throw new Error('Se requiere número de teléfono (ej. 573104531477)');
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

  if (activeSocket) {
    try {
      activeSocket.ev?.removeAllListeners();
      activeSocket.end();
    } catch (e) {}
    activeSocket = null;
  }
  await new Promise(r => setTimeout(r, 500));

  const authFolder = path.join(process.cwd(), 'baileys_auth');
  if (fs.existsSync(authFolder)) {
    try {
      fs.rmSync(authFolder, { recursive: true, force: true });
    } catch (e) {}
  }

  isWhatsAppConnected = false;
  isInitializing = false;

  await connectWhatsApp(cleanPhone);
  return { success: true, pairingCode: latestPairingCode };
}

export async function resetWhatsAppSession() {
  console.log('🔄 Reiniciando sesión de Baileys y limpiando credenciales...');
  isWhatsAppConnected = false;
  isInitializing = false;
  latestQRDataUrl = null;
  latestPairingCode = null;

  if (activeSocket) {
    try {
      activeSocket.ev?.removeAllListeners();
      activeSocket.end();
    } catch (e) {}
    activeSocket = null;
  }
  await new Promise(r => setTimeout(r, 500));

  const authFolder = path.join(process.cwd(), 'baileys_auth');
  if (fs.existsSync(authFolder)) {
    try {
      fs.rmSync(authFolder, { recursive: true, force: true });
      console.log('🧹 Carpeta baileys_auth eliminada correctamente.');
    } catch (e) {}
  }

  return connectWhatsApp();
}
