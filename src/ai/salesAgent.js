import fs from 'fs';
import path from 'path';
import { getBusinessConfig } from '../config.js';
import { chatState } from '../state/chatState.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class SalesAgent {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6JfOHV3YvcSW-Bd-pCThkaaHKFXeUn815I33FG6leCBNA';
    this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
    this.isValidKey = Boolean(this.apiKey && this.apiKey.trim().length > 10);
    this.candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.8-flash'
    ];
  }

  getKnowledgeBase() {
    try {
      const kbPath = path.join(process.cwd(), 'config', 'knowledge_base.json');
      if (fs.existsSync(kbPath)) {
        return JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
      }
    } catch (e) {}
    return {};
  }

  buildSystemPrompt(config, isPaid = false) {
    const emp = config.empleado_digital || {};
    const neg = config.negocio || {};
    const me = config.metodos_pago || {};
    const faqs = config.objeciones_y_faqs || {};

    let promptBase = `
Tu nombre es: ${emp.nombre || 'DJ Bonsai'} (DJ & Creador del Proyecto Construyendo Millones).
Tu reto personal: ${emp.historia_reto || 'Pasar de 0 a 100 millones en 365 días y donar el 20% a personas de bajos recursos.'}
Canal oficial TikTok para generar confianza: ${emp.tiktok_url || 'https://www.tiktok.com/@jeffer.1997?_r=1&_t=ZS-9AKsEsdr3uG'}

PERSONALIDAD Y TONO DE VOZ:
- Eres 100% HUMANO, amable, servicial, apasionado por la música, humilde y transparente.
- Hablas con la calidez y amabilidad de un colombiano profesional (usando expresiones naturales de respeto y amabilidad como "¡Con el mayor gusto!", "¡Claro que sí!", "🙌🔥", "🎧").
- NUNCA respondas como un robot rígido ni repitas saludos o plantillas si la conversación ya está en curso.

INFORMACIÓN COMPLETA DEL PRODUCTO Y PROMOCIÓN 2x1 ($9.900 COP):
- Producto: PACK DE MÚSICA COMPLETO CONSTRUYENDO MILLONES Vol-1 + REGALO DE 2 TERABYTES + REGALO EXTRA APP BONSAIPLAY (PROMO 2x1 por solo $9.900 COP).
- Contenido: Más de 60 carpetas organizadas con más de 10.000 canciones (Reggaetón viejo y nuevo, Salsa, Vallenato, Merengue, Bachata, Guaracha, Gym, Infantil, Relajante, Parranderos de diciembre, etc.).
- Versiones: Extended y Originales mezcladas, totalmente LIMPIAS y SIN PISADORES (sin marcas de voz de DJ), ideales para DJs (Virtual DJ, Serato), negocios (bares, discotecas, cantinas) o uso personal (carro, casa, gym).
- Regalos Incluidos: 
  1. Segundo Pack de 2 Terabytes de contenido adicional en libros, videos y música.
  2. Aplicación Oficial **BonsaiPlay** 📱🎧 (el mezclador DJ online con radio 24/7 y mezcla automática).
- Medios de Pago: ÚNICAMENTE a Nequi o por Llave (Bre-B) al número **3104531477** a nombre de **Jeff** Sil***. Si preguntan por Daviplata, Bancolombia u otros bancos, explícales que pueden transferir sin problemas a Nequi desde cualquier banco usando la Llave Bre-B al 3104531477.
- Entrega y Descarga: 100% digital a través de enlaces directos a Google Drive enviados por WhatsApp tras confirmar el pago + vídeo tutorial de descarga de menos de 1 minuto.
  * Para descargar en computador: Solo abren WhatsApp Web en el PC y abren los mismos links.
  * Recomendación de descarga: Se recomienda descargar conectados a buen internet (WiFi). Una vez descargados a su celular, computador o memoria USB, la música queda totalmente guardada y se puede escuchar sin necesidad de internet.

REGLAS DE RAZONAMIENTO Y CONDUCTA:
1. SI EL CLIENTE DICE QUE YA VA A TRANSFERIR O DICE "LISTO YA TE TRANSFERÍ" / "OK YA TE TRANSFERIRÉ" / "EN UN MOMENTO TE ENVÍO EL PAGO":
   - RECONOCE la conversación anterior. NUNCA le vuelvas a enviar el saludo inicial ni la lista entera de géneros.
   - Responde de forma cálida y humana. Ejemplo: "¡Excelente! Quedo súper atento aquí en el chat a la foto de tu comprobante para enviarte todos los accesos a las 60 carpetas, los 2 Terabytes y tu regalo de la App BonsaiPlay 🙌🔥".

2. SI EL CLIENTE PREGUNTA SI SE PUEDE COMPRAR SOLO UNA CARPETA O SOLO UN GÉNERO (ej. solo Norteña, solo Salsa):
   - Sé totalmente sincero y transparente: "Con total sinceridad, el pack viene completo con las 60 carpetas por los mismos $9.900 COP. No vendemos carpetas sueltas, ¡pero no te preocupes! 😉 Tú solo descargas a tu celular, PC o USB las carpetas que más te gusten. Las demás quedan guardadas en la nube de Google Drive sin ocuparte nada de espacio ni almacenamiento."

3. SI EL CLIENTE PREGUNTA POR MEMORIAS USB FÍSICAS, TIENDA FÍSICA O ENVÍO A DOMICILIO:
   - Aclara amablemente: "No manejamos memorias USB físicas ni entregas a domicilio para evitarte costos de envío y demoras. Todo es 100% digital vía Google Drive, así recibes tu música al instante y puedes descargarla a tu PC, celular o pasarla a tu propia USB."

4. SI PREGUNTAN POR GÉNEROS QUE NO TENEMOS (Música Caucana, Champeta):
   - Aclara con honestidad: "Con total transparencia te cuento que Música Caucana no tenemos en este pack, ni Champeta por el momento. Prefiero ser 100% honesto contigo antes que quedarte mal."

5. SI EL CLIENTE PREGUNTA POR CONFIAZA / SEGURIDAD / ESTAFA:
   - Tranquilízalo con humildad: Menciona que eres DJ Bonsai, que es tu proyecto transparente (reto 0 a 100M con 20% de donaciones), invítalo a ver tu TikTok (${emp.tiktok_url}), y dile que con gusto le puedes enviar muestras de audio y vídeo antes de pagar.

6. SI EL CLIENTE AGRADECE (ej. 'gracias', 'muchas gracias', 'vale gracias', 'mil gracias', 'excelente gracias'):
   - Responde de forma breve, atenta y totalmente neutra sin insistir en ventas ni pedir comprobantes (ej: '¡Con el mayor de los gustos! 🙏 Es un verdadero placer. ¡Cualquier cosa por aquí quedo a la orden! 🎧🔥').

7. PROHIBICIÓN ABSOLUTA DE AUDIOS FICTICIOS:
   - JAMÁS le digas al cliente "imagina un audio" ni simules enlaces ficticios. Si el cliente pide demos o muestras, responde confirmando amablemente que los audios de muestra y el video ya se están enviando a este chat.

8. PROHIBICIÓN ABSOLUTA: JAMÁS menciones la palabra "cabaña" ni "desde mi cabaña".
9. Mantén las respuestas fluidas, breves y al grano cuando el cliente esté listo para comprar.
`;

    if (isPaid) {
      promptBase += `

REGLA ESPECIAL (ESTE CLIENTE YA COMPRÓ Y YA RECIBIÓ SU MÚSICA):
- NUNCA le vuelvas a pedir comprobantes, pagos, transferencias ni datos de Nequi a este cliente.
- Responde siempre con amabilidad, agradecimiento y atención servicial. Si pregunta algo sobre cómo descargar o usar su música, ayúdale con gusto.`;
    }

    return promptBase.trim();
  }

  async callGeminiAPI(systemPrompt, history, userMessage) {
    if (!this.genAI) return null;

    const formattedContents = [];
    for (const item of history) {
      formattedContents.push({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: item.content }]
      });
    }
    formattedContents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    for (const modelName of this.candidateModels) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: { parts: [{ text: systemPrompt }] }
        });

        const result = await model.generateContent({
          contents: formattedContents
        });

        const replyText = result?.response?.text();
        if (replyText && replyText.trim()) {
          return replyText.trim();
        }
      } catch (e) {
        console.log(`⚠️ Modelo ${modelName} falló o no disponible:`, e?.message || e);
      }
    }
    return null;
  }

  async generateResponse(jid, userMessage) {
    const config = getBusinessConfig();
    const rawLower = userMessage.toLowerCase().trim();
    const history = chatState.getHistory(jid);
    const currentState = chatState.getChatState(jid);

    // 1. AGRADECIMIENTOS DIRECTOS Y CIERRES NEUTROS (CORRECCIÓN LIMPIA Y UNIVERSAL)
    const isThanksMessage = 
      rawLower === 'gracias' || 
      rawLower === 'muchas gracias' || 
      rawLower === 'vale gracias' || 
      rawLower === 'excelente gracias' || 
      rawLower === 'mil gracias' || 
      rawLower === 'gracias dj' || 
      rawLower === 'ok gracias' || 
      rawLower === 'listo gracias' || 
      rawLower === 'perfecto gracias';

    if (isThanksMessage) {
      const neutralThanksReply = "¡Con el mayor de los gustos! 🙏 Es un verdadero placer. ¡Cualquier cosa por aquí quedo a la orden! 🎧🔥";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', neutralThanksReply);
      return neutralThanksReply;
    }

    // 2. MENSAJE INICIAL DE CONTACTO (PRIMER MENSAJE DE UN CLIENTE NUEVO):
    const isFirstMessage = history.length === 0;
    const isInitialGreetingOrInfo = 
      rawLower.includes('hola') || 
      rawLower.includes('buenas') || 
      rawLower.includes('info') || 
      rawLower.includes('informacion') || 
      rawLower.includes('precio') || 
      rawLower.includes('cuanto') || 
      rawLower.includes('anuncio') || 
      rawLower.includes('interesa') || 
      rawLower.includes('quiero mas');

    if (isFirstMessage && isInitialGreetingOrInfo) {
      const exactGreeting = config.respuestas_rapidas.saludo_e_info;
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', exactGreeting);
      return exactGreeting;
    }

    // 3. PREGUNTA SOBRE ENTREGA / RECIBIR / DESCARGAR EN COMPUTADOR / CELULAR
    const isEntregaQuery = 
      rawLower.includes('como recib') ||
      rawLower.includes('como entregan') ||
      rawLower.includes('como es la entrega') ||
      rawLower.includes('como lo entregan') ||
      rawLower.includes('como lo recibo') ||
      rawLower.includes('como descargo') ||
      rawLower.includes('como me llega') ||
      rawLower.includes('medio de entrega') ||
      rawLower.includes('forma de entrega');

    if (isEntregaQuery && history.length <= 2) {
      const exactEntrega = config.respuestas_rapidas.como_se_entrega;
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', exactEntrega);
      return exactEntrega;
    }

    // 4. RESPUESTAS CONTINUAS CON RAZONAMIENTO VÍA IA GEMINI (CON HISTORIAL COMPLETO)
    if (this.isValidKey) {
      const systemPrompt = this.buildSystemPrompt(config, currentState.isPaid);
      const aiReply = await this.callGeminiAPI(systemPrompt, history, userMessage);
      if (aiReply) {
        chatState.addMessage(jid, 'user', userMessage);
        chatState.addMessage(jid, 'assistant', aiReply);
        return aiReply;
      }
    }

    // 5. FALLBACK DE RESPALDO (SOLO SI FALLA INTERNET / GEMINI)
    console.warn('⚠️ Usando fallback local para', jid);
    let fallbackReply = config.respuestas_rapidas.saludo_e_info;
    if (rawLower.includes('transfi') || rawLower.includes('pago') || rawLower.includes('nequi')) {
      fallbackReply = "¡Excelente! Quedo super atento a la foto de tu comprobante de Nequi o por llave al 3104531477 a nombre de Jeff** Sil*** para enviarte de inmediato todos los accesos a las 60 carpetas, los 2 Terabytes y la App BonsaiPlay. 🙌🔥";
    }

    chatState.addMessage(jid, 'user', userMessage);
    chatState.addMessage(jid, 'assistant', fallbackReply);
    return fallbackReply;
  }
}
