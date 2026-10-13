/**
 * remarketingJob.js — Motor de recuperación de leads para Bonsai Chat
 */

import { chatState } from '../state/chatState.js';

const REMARKETING_DELAY_MS  = 2 * 60 * 60 * 1000;  // 2 horas de silencio
const CHECK_INTERVAL_MS     = 15 * 60 * 1000;        // revisar cada 15 min
const LIMITE_SUPERIOR_MS    = 23 * 60 * 60 * 1000;   // descartar > 23h
const MIN_HISTORY_MSGS      = 1;

const REMARKETING_POOL = [
  {
    topic: ['duda', 'pregunta', 'ayuda', 'claro', 'información'],
    text: `Hola, soy DJ Bonsai 🎧 vi que estuviste viendo el pack de música hace un rato y quería saber si te quedó alguna duda sin resolver. A veces la gente se va con preguntas y no pregunta por pena, y yo prefiero que me pregunten todo 🙌 ¿Hay algo en lo que te pueda ayudar?`
  },
  {
    topic: ['demo', 'muestra', 'audio', 'escuchar', 'video', 'carpeta', 'como viene'],
    text: `Hola, te habla DJ Bonsai 🎵 ¿Quieres que te mande unas muestras de audio antes de decidirte? Así escuchas la calidad del pack y ves cómo vienen organizadas las carpetas, sin ningún compromiso. Avísame y te las comparto de una 🔥`
  },
  {
    topic: ['confiar', 'confianza', 'estafa', 'seguro', 'garantia', 'real', 'tiktok', 'redes'],
    text: `Hola, DJ Bonsai por acá 👋 Si en algo dudaste fue tal vez en si esto es confiable, y te entiendo perfectamente. Te cuento que subo contenido todos los días en TikTok mostrando mi proyecto desde mi cabaña 🛖 Puedes verme en vivo en: https://www.tiktok.com/@jeffer.1997 y confirmar que soy una persona real. Cuéntame con total confianza si tienes alguna duda 🤝`
  },
  {
    topic: ['negocio', 'bar', 'carro', 'gym', 'casa', 'mezclar', 'dj', 'serato', 'para que'],
    text: `Hola 😊 soy DJ Bonsai, vi que preguntaste por la música. ¿Para qué la necesitas tú — para el negocio, para el carro, para mezclar o para escuchar en casa? Te cuento que el pack sirve para todo eso y me gustaría asegurarme de que te sirva perfecto 🎧🔥`
  },
  {
    topic: ['precio', 'cuanto', 'pagar', 'nequi', 'transferir', 'comprar', '9900', 'costo'],
    text: `Ey, te habla DJ Bonsai 🌱 ¿Llegaste a ver bien todo lo que trae el pack? Más de 10.000 canciones en 60 carpetas por solo $9.900 COP — y con la promo de hoy te llegan dos packs completos más el acceso a la app Bonsai Play. Sin compromiso, pregunta lo que quieras 🙌`
  }
];

function pickSmartMessage(history) {
  const fullHistory = history
    .map(m => m.content || '')
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const disponibles = REMARKETING_POOL.filter(variant => {
    const yaSeHabloDeEsto = variant.topic.some(keyword => fullHistory.includes(keyword));
    return !yaSeHabloDeEsto;
  });

  if (disponibles.length > 0) {
    const idx = Math.floor(Math.random() * disponibles.length);
    return disponibles[idx].text;
  }

  return `Ey, te habla DJ Bonsai 🌱 ¿Llegaste a decidirte con el pack de música? Aquí estoy por si tienes alguna pregunta o necesitas que te cuente algo más 🙌🔥`;
}

export function startRemarketingJob(getSocketSender) {
  console.log(`📣 [Remarketing] Job iniciado. Revisando leads cada ${CHECK_INTERVAL_MS / 60000} minutos.`);

  setInterval(async () => {
    try {
      const sock = getSocketSender();
      if (!sock) return;

      const now = Date.now();
      const chats = chatState.getAllChats();
      let enviados = 0;

      for (const chat of chats) {
        const {
          jid,
          hasPurchased,
          remarketingSent,
          isHumanActive,
          lastIncomingMessageAt,
          history
        } = chat;

        if (hasPurchased)            continue;
        if (remarketingSent)         continue;
        if (isHumanActive)           continue;
        if (!lastIncomingMessageAt)  continue;
        if (history.length < MIN_HISTORY_MSGS) continue;

        const silencioMs = now - lastIncomingMessageAt;
        if (silencioMs < REMARKETING_DELAY_MS)  continue;
        if (silencioMs > LIMITE_SUPERIOR_MS)    continue;

        const mensaje = pickSmartMessage(history);
        console.log(`📣 [Remarketing] Enviando a ${jid} (silencio: ${Math.round(silencioMs / 60000)} min)`);

        await sock.sendMessage(jid, { text: mensaje });

        chat.remarketingSent = true;
        enviados++;
        await new Promise(r => setTimeout(r, 3000));
      }

      if (enviados > 0) {
        console.log(`📣 [Remarketing] Ciclo completado. Mensajes enviados este ciclo: ${enviados}`);
      }

    } catch (err) {
      console.error('⚠️ [Remarketing] Error en ciclo (no crítico):', err?.message || err);
    }
  }, CHECK_INTERVAL_MS);
}
