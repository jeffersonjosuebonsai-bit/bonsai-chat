/**
 * remarketingJob.js — Motor de recuperación de leads para Bonsai Chat
 *
 * ARQUITECTURA SEGURA:
 *  - Este módulo es 100% independiente. No modifica salesAgent.js ni el
 *    razonamiento de Gemini. Solo lee el historial del chat para elegir
 *    el mensaje más relevante, pero nunca modifica ese historial.
 *  - Si el cliente responde, el bot normal toma el control inmediatamente.
 *  - Máximo 1 mensaje de remarketing por contacto, nunca más.
 *
 * SELECCIÓN INTELIGENTE DE MENSAJE:
 *  Lee el historial de la conversación y detecta qué temas ya se trataron
 *  (demos, precio, confianza, géneros) para NO repetir lo mismo que ya
 *  preguntó el bot. Siempre elige algo que aún no se mencionó.
 */

import { chatState } from '../state/chatState.js';

// ── Configuración de tiempos ──────────────────────────────────────────────────
const REMARKETING_DELAY_MS  = 2 * 60 * 60 * 1000;  // 2 horas de silencio del cliente
const CHECK_INTERVAL_MS     = 15 * 60 * 1000;        // revisar cada 15 minutos
const LIMITE_SUPERIOR_MS    = 23 * 60 * 60 * 1000;   // descartar leads > 23h fríos
const MIN_HISTORY_MSGS      = 1;                      // solo si el cliente escribió algo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pool de mensajes con etiquetas de tema.
 *
 * Cada variante tiene:
 *  - topic: palabras clave que indican que ya se habló de esto en el chat.
 *           Si el historial contiene esas palabras, este mensaje se descarta.
 *  - text:  el mensaje que se envía.
 *
 * Psicología aplicada en todos:
 *  ✅ Empatía genuina, NO venta agresiva
 *  ✅ Pregunta abierta que invita a responder
 *  ✅ Sin palabras de spam ("oferta urgente", "descuento", "última oportunidad")
 *  ✅ Tono de DJ Bonsai escribiendo desde el celular, no de robot
 */
const REMARKETING_POOL = [

  {
    // Se descarta si el cliente ya habló de dudas o preguntas generales
    topic: ['duda', 'pregunta', 'ayuda', 'claro', 'información'],
    text: `Hola, soy DJ Bonsai 🎧 vi que estuviste viendo el pack de música hace un rato y quería saber si te quedó alguna duda sin resolver. A veces la gente se va con preguntas y no pregunta por pena, y yo prefiero que me pregunten todo 🙌 ¿Hay algo en lo que te pueda ayudar?`
  },

  {
    // Se descarta si el cliente ya pidió demos, audios o videos
    topic: ['demo', 'muestra', 'audio', 'escuchar', 'video', 'carpeta', 'como viene'],
    text: `Hola, te habla DJ Bonsai 🎵 ¿Quieres que te mande unas muestras de audio antes de decidirte? Así escuchas la calidad del pack y ves cómo vienen organizadas las carpetas, sin ningún compromiso. Avísame y te las comparto de una 🔥`
  },

  {
    // Se descarta si el cliente ya preguntó por confianza, estafa o redes
    topic: ['confiar', 'confianza', 'estafa', 'seguro', 'garantia', 'real', 'tiktok', 'redes'],
    text: `Hola, DJ Bonsai por acá 👋 Si en algo dudaste fue tal vez en si esto es confiable, y te entiendo perfectamente. Te cuento que subo contenido todos los días en TikTok mostrando mi proyecto desde mi cabaña 🛖 Puedes verme en vivo en: https://www.tiktok.com/@jeffer.1997 y confirmar que soy una persona real. Cuéntame con total confianza si tienes alguna duda 🤝`
  },

  {
    // Se descarta si el cliente ya preguntó para qué sirve o el uso
    topic: ['negocio', 'bar', 'carro', 'gym', 'casa', 'mezclar', 'dj', 'serato', 'para que'],
    text: `Hola 😊 soy DJ Bonsai, vi que preguntaste por la música. ¿Para qué la necesitas tú — para el negocio, para el carro, para mezclar o para escuchar en casa? Te cuento que el pack sirve para todo eso y me gustaría asegurarme de que te sirva perfecto 🎧🔥`
  },

  {
    // Se descarta si el cliente ya preguntó por precio, pago o cómo comprar
    topic: ['precio', 'cuanto', 'pagar', 'nequi', 'transferir', 'comprar', '9900', 'costo'],
    text: `Ey, te habla DJ Bonsai 🌱 ¿Llegaste a ver bien todo lo que trae el pack? Más de 10.000 canciones en 60 carpetas por solo $9.900 COP — y con la promo de hoy te llegan dos packs completos más el acceso a la app Bonsai Play. Sin compromiso, pregunta lo que quieras 🙌`
  }

];

/**
 * Analiza el historial de la conversación y elige el mensaje de remarketing
 * más relevante: aquel cuyo tema NO se haya tocado aún en el chat.
 *
 * Si todos los temas ya fueron mencionados (conversación larga), usa el
 * mensaje más genérico (índice 0 — dudas generales).
 *
 * @param {Array} history — historial de mensajes [{role, content}]
 * @returns {string} — el texto del mensaje a enviar
 */
function pickSmartMessage(history) {
  // Unir todo el texto del historial en minúsculas para buscar palabras clave
  const fullHistory = history
    .map(m => m.content || '')
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quitar tildes para comparar mejor

  // Filtrar los mensajes cuyos temas ya fueron mencionados en el chat
  const disponibles = REMARKETING_POOL.filter(variant => {
    const yaSeHabloDeEsto = variant.topic.some(keyword => fullHistory.includes(keyword));
    return !yaSeHabloDeEsto;
  });

  // Si quedan variantes disponibles, elegir una al azar entre ellas
  if (disponibles.length > 0) {
    const idx = Math.floor(Math.random() * disponibles.length);
    console.log(`📣 [Remarketing] Tema elegido (no mencionado antes): variante disponible ${idx + 1}/${disponibles.length}`);
    return disponibles[idx].text;
  }

  // Si todos los temas ya se cubrieron (conversación muy completa),
  // usar el mensaje más neutral como fallback
  console.log(`📣 [Remarketing] Todos los temas cubiertos. Usando mensaje neutral de fallback.`);
  return `Ey, te habla DJ Bonsai 🌱 ¿Llegaste a decidirte con el pack de música? Aquí estoy por si tienes alguna pregunta o necesitas que te cuente algo más 🙌🔥`;
}

/**
 * Inicia el job de remarketing en background.
 * Se llama una vez desde index.js al arrancar el servidor.
 *
 * @param {Function} getSocketSender — función que retorna el socket Baileys activo
 */
export function startRemarketingJob(getSocketSender) {
  console.log(`📣 [Remarketing] Job iniciado. Revisando leads cada ${CHECK_INTERVAL_MS / 60000} minutos.`);

  setInterval(async () => {
    try {
      const sock = getSocketSender();
      if (!sock) {
        // WhatsApp aún no está conectado, esperar al próximo ciclo
        return;
      }

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

        // ── Condiciones de exclusión (orden de prioridad) ──────────────────
        if (hasPurchased)            continue; // ya compró → no molestar jamás
        if (remarketingSent)         continue; // ya recibió remarketing → nunca 2 veces
        if (isHumanActive)           continue; // DJ está en el chat → no interferir
        if (!lastIncomingMessageAt)  continue; // nunca escribió → nada que recuperar
        if (history.length < MIN_HISTORY_MSGS) continue; // conversación vacía

        const silencioMs = now - lastIncomingMessageAt;

        if (silencioMs < REMARKETING_DELAY_MS)  continue; // todavía muy pronto (< 2h)
        if (silencioMs > LIMITE_SUPERIOR_MS)    continue; // lead frío (> 23h), descartar

        // ── Elegir mensaje inteligente según el historial ─────────────────
        const mensaje = pickSmartMessage(history);

        console.log(`📣 [Remarketing] Enviando a ${jid} (silencio: ${Math.round(silencioMs / 60000)} min | historial: ${history.length} msgs)`);

        await sock.sendMessage(jid, { text: mensaje });

        // Marcar: nunca volver a enviar remarketing a este contacto
        chat.remarketingSent = true;
        enviados++;

        // Pausa entre envíos para no saturar WhatsApp
        await new Promise(r => setTimeout(r, 3000));
      }

      if (enviados > 0) {
        console.log(`📣 [Remarketing] Ciclo completado. Mensajes enviados este ciclo: ${enviados}`);
      }

    } catch (err) {
      // El remarketing NUNCA debe tumbar el proceso principal
      console.error('⚠️ [Remarketing] Error en ciclo (no crítico):', err?.message || err);
    }
  }, CHECK_INTERVAL_MS);
}
