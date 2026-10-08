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
        const isImageMsg = !!realMessage.imageMessage || !!realMessage.documentMessage;

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

        function getAudioConfig(filePath) {
          const lower = filePath.toLowerCase();
          if (lower.endsWith('.opus') || lower.endsWith('.ogg')) return { mimetype: 'audio/ogg; codecs=opus', ptt: true };
          if (lower.endsWith('.m4a')) return { mimetype: 'audio/mp4', ptt: true };
          if (lower.endsWith('.wav')) return { mimetype: 'audio/wav', ptt: false };
          return { mimetype: 'audio/mpeg', ptt: false };
        }

        function getMediaFiles() {
          const mediaDir = path.join(process.cwd(), 'media');
          const demosDir = path.join(mediaDir, 'demos');

          let audioFiles = [];
          let videoDemo = null;
          let tutorialVideo = null;
          let agradecimientoImg = null;
          let allVideos = [];

          // Revisar carpeta media principal
          if (fs.existsSync(mediaDir)) {
            fs.readdirSync(mediaDir).forEach(f => {
              const fullPath = path.join(mediaDir, f);
              if (fs.statSync(fullPath).isFile()) {
                const lower = f.toLowerCase();
                if (f.startsWith('agradecimiento') || lower.includes('agradecimiento') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) {
                  agradecimientoImg = fullPath;
                } else if (f.startsWith('tutorial') || lower.includes('tutorial')) {
                  tutorialVideo = fullPath;
                } else if (f.startsWith('video_demo') || lower.includes('video_demo')) {
                  videoDemo = fullPath;
                } else if (lower.endsWith('.mp3') || lower.endsWith('.mpeg') || lower.endsWith('.ogg') || lower.endsWith('.opus') || lower.endsWith('.wav') || lower.endsWith('.m4a')) {
                  audioFiles.push(fullPath);
                } else if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) {
                  allVideos.push(fullPath);
                }
              }
            });
          }

          // Revisar carpeta demos
          if (fs.existsSync(demosDir)) {
            fs.readdirSync(demosDir).forEach(f => {
              const fullPath = path.join(demosDir, f);
              if (fs.statSync(fullPath).isFile()) {
                const lower = f.toLowerCase();
                if (f.startsWith('video_demo') || lower.includes('video_demo')) {
                  videoDemo = fullPath;
                } else if (f.startsWith('tutorial') || lower.includes('tutorial')) {
                  tutorialVideo = fullPath;
                } else if (lower.endsWith('.mp3') || lower.endsWith('.mpeg') || lower.endsWith('.ogg') || lower.endsWith('.opus') || lower.endsWith('.wav') || lower.endsWith('.m4a')) {
                  audioFiles.push(fullPath);
                } else if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) {
                  allVideos.push(fullPath);
                }
              }
            });
          }

          // Asignar video demo si no se especificó por nombre
          if (!videoDemo && allVideos.length > 0) {
            videoDemo = allVideos.find(v => v !== tutorialVideo) || allVideos[0];
          }

          // Asignar video tutorial si no se especificó por nombre
          if (!tutorialVideo && allVideos.length > 0) {
            tutorialVideo = allVideos.find(v => v !== videoDemo) || allVideos[allVideos.length - 1];
          }

          return { audioFiles, videoDemo, agradecimientoImg, tutorialVideo };
        }

        // DETECCIÓN DE NOTAS DE VOZ
        if (isAudioMsg) {
          console.log(`🎙️ Nota de voz recibida de ${jid}.`);
          const voiceReply = "¡Hola! 🎧 Recibí tu nota de voz. Por este medio automático leo mensajes de texto. Si me escribes tu inquietud o palabras como 'info' o 'lo quiero', con mucho gusto te respondo de inmediato 🙌🔥";
          await sock.sendMessage(jid, { text: voiceReply });
          continue;
        }

        // DETECCIÓN DE COMPROBANTE DE PAGO
        const lowerTxt = textMessage.toLowerCase();
        const isPaymentKeyword = lowerTxt.includes('comprobante') || lowerTxt.includes('ya pague') || lowerTxt.includes('ya transferi') || lowerTxt.includes('pago listo');

        if (isImageMsg || isPaymentKeyword) {
          console.log(`📸 Comprobante de pago recibido de ${jid}. Entregando pack y regalos...`);
          const config = getBusinessConfig();
          const entregaText = config.respuestas_rapidas.entrega;
          await sock.sendMessage(jid, { text: entregaText });
          await new Promise(r => setTimeout(r, 1500));

          const { agradecimientoImg, tutorialVideo } = getMediaFiles();
          if (agradecimientoImg && fs.existsSync(agradecimientoImg)) {
            try {
              console.log(`🖼️ Enviando tarjeta de agradecimiento a ${jid}...`);
              await sock.sendMessage(jid, {
                image: fs.readFileSync(agradecimientoImg),
                caption: '🛖💰🔥 ¡Bienvenido al proceso Construyendo Millones! - DJ Bonsai'
              });
              await new Promise(r => setTimeout(r, 2000));
            } catch (e) {
              console.error('Error enviando imagen:', e.message);
            }
          }

          if (tutorialVideo && fs.existsSync(tutorialVideo)) {
            try {
              console.log(`🎥 Enviando video tutorial a ${jid}...`);
              await sock.sendMessage(jid, {
                video: fs.readFileSync(tutorialVideo),
                caption: '🎥 Video Tutorial: Paso a paso para descargar tu música'
              });
            } catch (e) {
              console.error('Error enviando video:', e.message);
            }
          }
          continue;
        }

        // DEMOS DE AUDIO Y VIDEO
        const isDemoKeyword = lowerTxt.includes('demo') || lowerTxt.includes('muestra') || lowerTxt.includes('escuchar') || lowerTxt.includes('probador') || lowerTxt.includes('audio') || lowerTxt.includes('video') || lowerTxt.includes('carpetas') || lowerTxt.includes('como viene');

        if (isDemoKeyword) {
          const { audioFiles, videoDemo } = getMediaFiles();
          console.log(`🎧 Enviando muestras de audio y video a ${jid}...`);

          await sock.sendMessage(jid, { text: '🎧 ¡Con mucho gusto! Aquí te comparto el video demostrativo y las muestras de nuestras 60 carpetas de música:' });
          await new Promise(r => setTimeout(r, 1500));

          // Enviar hasta 4 canciones completas
          for (const audioPath of audioFiles.slice(0, 4)) {
            try {
              console.log(`🎵 Enviando muestra audio: ${path.basename(audioPath)}...`);
              const audioConf = getAudioConfig(audioPath);
              await sock.sendMessage(jid, {
                audio: fs.readFileSync(audioPath),
                mimetype: audioConf.mimetype,
                ptt: audioConf.ptt
              });
              await new Promise(r => setTimeout(r, 1500));
            } catch (err) {
              console.error('Error enviando audio:', err.message);
            }
          }

          if (videoDemo && fs.existsSync(videoDemo)) {
            try {
              console.log(`🎥 Enviando video demo: ${path.basename(videoDemo)}...`);
              await sock.sendMessage(jid, {
                video: fs.readFileSync(videoDemo),
                caption: '🎥 Vista Previa: Así vienen organizadas nuestras 60 carpetas de música'
              });
            } catch (err) {
              console.error('Error enviando video demo:', err.message);
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
