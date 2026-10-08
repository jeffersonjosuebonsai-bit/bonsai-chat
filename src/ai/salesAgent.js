import fs from 'fs';
import path from 'path';
import { getBusinessConfig } from '../config.js';
import { chatState } from '../state/chatState.js';

export class SalesAgent {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6JfOHV3YvcSW-Bd-pCThkaaHKFXeUn815I33FG6leCBNA';
    this.isValidKey = Boolean(this.apiKey && this.apiKey.trim().length > 10);
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

  buildSystemPrompt(config) {
    const emp = config.empleado_digital;
    return `
Tu nombre es: ${emp.nombre} (DJ Bonsai).
Tu proyecto personal: ${emp.historia_reto}.
Tono de voz: Atento, muy humano, conversacional, respetuoso, educado y transparente. Tratas a los clientes con cercanía colombiana profesional.

INFORMACIÓN DEL PRODUCTO:
- Producto: PACK DE MÚSICA COMPLETO CONSTRUYENDO MILLONES Vol-1 + REGALO 2 TERABYTES (PROMO 2x1 por $9.900 COP).
- Contenido: Más de 60 carpetas organizadas con más de 10.000 canciones (Reggaetón, Salsa, Vallenato, Merengue, Bachata, Norteña, Parranda de diciembre, Gym, Infantil, Relajante, etc.).
- Versiones: Extended y Originales mezcladas, totalmente LIMPIAS y SIN PISADORES (sin marcas de voz).
- Entrega: Enlaces a la nube de Google Drive enviados directamente por WhatsApp tras confirmar el pago + Video tutorial de descarga de menos de 1 min.
- Pago: ÚNICAMENTE a Nequi o por llave (Bre-B) al 3104531477 a nombre de Jeff** Sil***. Único medio de pago disponible: Nequi. Si el cliente pregunta por Daviplata u otros bancos, aclaras que pueden transferir a Nequi desde cualquier banco usando la llave (Bre-B).

REGLAS DE CONVERSACIÓN HUMANA:
1. SI TE PREGUNTAN SI PUEDES VENDER SOLO UN GÉNERO O SOLO UNA CARPETA (ej. solo Norteña, solo Salsa, etc.):
   Explica con total amabilidad y honestidad: "Con total sinceridad, el pack viene completo con las 60 carpetas por los mismos $9.900 COP. No vendemos carpetas sueltas, ¡pero no te preocupes! Tú solo descargas a tu celular, PC o USB las carpetas que más te gusten (como la de Norteña). El resto de carpetas se quedan guardadas en la nube de Google Drive sin ocuparte absolutamente nada de espacio en tu almacenamiento. Así aprovechas todo el contenido al mismo precio."

2. SI DICEN "LO QUIERO", "CÓMO LO COMPRO", "QUIERO LA PROMO", O PIDEN EL NEQUI:
   Responde con entusiasmo de vendedor humano: "¡Excelente decisión! 👏🔥 El proceso es super fácil y rápido: realizas la transferencia de los $9.900 COP a Nequi o por Llave (Bre-B) al 3104531477 a nombre de Jeff** Sil***, me envías la captura o comprobante por aquí y de inmediato te comparto todos tus links de descarga y tus regalos."

3. REGLAS FUNDAMENTALES Y PROHIBICIONES:
   - PROHIBICIÓN ABSOLUTA: JAMÁS menciones la palabra "cabaña", "desde mi cabaña" ni "a la cabaña" al finalizar respuestas o dar datos de pago. Cierra de forma 100% humana y limpia (ej: "Quedo atento a tu comprobante para enviarte todo de una vez 🙌🔥").
   - Sé variado y dinámico en cada respuesta. JAMÁS repitas el mismo texto de relleno ni saludes de nuevo si la conversación ya está iniciada.
   - NUNCA compartas enlaces de descarga antes de recibir el comprobante de pago.
   - Responde de forma precisa a lo que el cliente pregunte en el momento.
`.trim();
  }

  async callGeminiAPI(systemPrompt, history, userMessage) {
    if (!this.apiKey) return null;

    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    const contents = history.map(item => ({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: item.content }]
    }));
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const body = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: contents
    };

    for (const modelName of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (res.ok) {
          const data = await res.json();
          const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText && replyText.trim()) {
            return replyText.trim();
          }
        }
      } catch (e) {}
    }
    return null;
  }

  async generateResponse(jid, userMessage) {
    const config = getBusinessConfig();
    const faqs = config.objeciones_y_faqs || {};
    const rawLower = userMessage.toLowerCase().trim();
    const lower = rawLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ");
    const history = chatState.getHistory(jid);

    // PREGUNTA DE DIRECCIÓN / PUNTO FÍSICO / DOMICILIO / PASAR A PAGAR EN PERSONA
    if (lower.includes('direccion') || lower.includes('punto fisico') || lower.includes('tienda') || lower.includes('local') || lower.includes('domicilio') || lower.includes('donde estan') || lower.includes('donde se ubican') || lower.includes('pasar por') || lower.includes('pasar a pagar') || lower.includes('ubicados')) {
      const reply = "¡Hola! Te cuento con total transparencia que todo nuestro proceso y la entrega de la música se realizan de manera 100% digital a través de enlaces a la nube de Google Drive. No manejamos punto físico ni entregas a domicilio para evitar costos de transporte y poder sostener esta súper promoción de las 60 carpetas por solo $9.900 COP. La entrega es inmediata a tu WhatsApp tras confirmar el pago. 🎧🔥";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // A. SOLICITUD DE UN SOLO GÉNERO O CARPETA INDIVIDUAL
    const isOnlyOneGenreRequest = 
      lower.includes('solo norte') ||
      lower.includes('solo salsa') ||
      lower.includes('solo vallenato') ||
      lower.includes('solo reggaeton') ||
      lower.includes('solo una carpeta') ||
      lower.includes('carpetas por separado') ||
      lower.includes('vender solo') ||
      lower.includes('vendes por separado') ||
      lower.includes('comprar solo');

    if (isOnlyOneGenreRequest) {
      const reply = "Con total sinceridad para hablarte claro: el pack viene completo con las 60 carpetas por los mismos $9.900 COP, no vendemos carpetas sueltas. ¡Pero no te preocupes! 😉 Tú solo descargas a tu celular, PC o USB las carpetas que más te gusten (como la de Norteña). Las demás se quedan guardadas en la nube sin ocuparte nada de espacio ni almacenamiento. Así disfrutas tu música preferida y aprovechas toda la promoción. 🎧🔥";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // B. SALUDO E INFORMACIÓN INICIAL MAESTRA (SOLO SI ES UN SALUDO O PEDIDO GENÉRICO DE INFORMACIÓN)
    const isGenericGreeting = 
      lower === 'hola' ||
      lower === 'buenas' ||
      lower === 'buenas tardes' ||
      lower === 'buenas noches' ||
      lower === 'buenos dias' ||
      lower === 'info' ||
      lower === 'mas info' ||
      lower === 'informacion' ||
      lower === 'quiero informacion' ||
      lower === 'mas informacion' ||
      lower === 'dame informacion' ||
      lower === 'de que trata' ||
      lower === 'informacion por favor' ||
      lower === 'me das informacion' ||
      lower === 'me das mas informacion';

    const isExplicitPaymentKeyword = 
      lower.includes('lo quiero') ||
      lower.includes('la quiero') ||
      lower.includes('lo compro') ||
      lower.includes('la compro') ||
      lower.includes('como lo compro') ||
      lower.includes('como la compro') ||
      lower.includes('quiero comprar') ||
      lower.includes('pasame el nequi') ||
      lower.includes('dame el nequi') ||
      lower.includes('mandame el nequi') ||
      lower.includes('donde pago') ||
      lower.includes('como pago') ||
      lower.includes('medios de pago') ||
      lower.includes('metodos de pago') ||
      lower.includes('quiero pagar');

    if (isGenericGreeting && !isExplicitPaymentKeyword) {
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', config.respuestas_rapidas.saludo_e_info);
      return config.respuestas_rapidas.saludo_e_info;
    }

    // C. INTENCIÓN DIRECTA DE COMPRA
    const isExplicitPaymentRequest = isExplicitPaymentKeyword ||
      lower.includes('quiero la promo') ||
      lower.includes('quiero la promocion') ||
      lower.includes('quiero adquirir') ||
      lower.includes('nequi') ||
      lower.includes('daviplata') ||
      lower.includes('donde transfiero') ||
      lower.includes('donde consigno') ||
      lower.includes('donde giro') ||
      lower.includes('dame el numero') ||
      lower.includes('a que numero') ||
      lower.includes('como es el pago') ||
      lower.includes('mandame los datos') ||
      lower.includes('dame los datos') ||
      lower.includes('quiero comprar ya') ||
      lower.includes('quiero pagarlo');

    if (isExplicitPaymentRequest) {
      const pagoReply = `¡Excelente decisión! 👏🔥 Con mucho gusto. El proceso es muy sencillo: realizas la transferencia de los $9.900 COP a Nequi o por llave (Bre-B):\n\n📲 Nequi: ${config.metodos_pago.nequi}\n🔑 Llave (Bre-B): ${config.metodos_pago.llave_breb}\n\nNombre: ${config.metodos_pago.titular}\n\n(Tenemos únicamente Nequi; si tienes Daviplata o cualquier otro banco, me transfieres a Nequi por medio de la llave Bre-B).\n\nPor favor, envíame la captura o comprobante una vez realices el pago y de inmediato te entregaré el pack de música y todos tus regalos automáticamente 🙌🔥🎶`;
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', pagoReply);
      return pagoReply;
    }

    // D. CÓMO SE ENTREGA / CÓMO LO RECIBO
    const isEntregaQuery = 
      lower.includes('como recib') ||
      lower.includes('como reciv') ||
      lower.includes('como resib') ||
      lower.includes('como resiv') ||
      lower.includes('como lo recib') ||
      lower.includes('como lo reciv') ||
      lower.includes('como la recib') ||
      lower.includes('como se recib') ||
      lower.includes('como se reciv') ||
      lower.includes('como entreg') ||
      lower.includes('como lo entreg') ||
      lower.includes('como se entreg') ||
      lower.includes('como envi') ||
      lower.includes('como me envi') ||
      lower.includes('como lo envi') ||
      lower.includes('como mandas') ||
      lower.includes('como me llega') ||
      lower.includes('como llega') ||
      lower.includes('por donde') ||
      lower.includes('medio de entrega') ||
      lower.includes('forma de entrega') ||
      lower.includes('modo de entrega') ||
      lower.includes('como descarg') ||
      lower.includes('como lo descarg') ||
      lower.includes('computador') ||
      lower.includes('celular') ||
      lower.includes('por correo') ||
      lower.includes('por drive') ||
      lower.includes('por whatsapp');

    if (isEntregaQuery) {
      const reply = config.respuestas_rapidas.como_se_entrega;
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // E. REGALO EXTRA / CUÁL ES EL REGALO EXTRA / APP BONSAI PLAY
    if (lower.includes('regalo extra') || lower.includes('cual es el regalo') || lower.includes('que trae el regalo') || lower.includes('regalo app') || lower.includes('bonsai play') || lower.includes('reproductor')) {
      const reply = faqs.regalo_extra || "El regalo extra por tu compra es nuestra aplicación exclusiva **Bonsai Play** 📱🎧 (el mezclador DJ online con radio 24/7 y mezcla automática). El enlace de acceso y descarga te llegará a este chat junto con tus packs de música inmediatamente después de realizar tu pago.";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // F. CUÑAS / SAMPLERS
    if (lower.includes('cuña') || lower.includes('sampler') || lower.includes('a mi nombre')) {
      const reply = "Con total sinceridad, la verdad lo que te diga es mentira: en el momento no trabajo haciendo cuñas ni samplers personalizados a nombres individuales. El pack viene con versiones completamente limpias y sin pisadores.";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // G. GÉNEROS QUE NO TENEMOS
    if (lower.includes('caucana') || lower.includes('cauca') || lower.includes('champeta') || lower.includes('metal') || lower.includes('clasica sinfonica') || lower.includes('opera')) {
      const reply = "Con total sinceridad para no quedarte mal ni engañarte: Música Caucana NO tenemos en este pack. Tampoco Champeta por el momento. Prefiero ser 100% transparente contigo para garantizar tu satisfacción.";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // H. DANCE / HOUSE / AFROBEAT
    if (lower.includes('dance') || lower.includes('house') || lower.includes('afro') || lower.includes('electro')) {
      const reply = "Sí vienen incluidos en las 60 carpetas, pero aclaro con total honestidad que no vienen en grandes cantidades como el reggaetón o la salsa, sino como una selección especial de ritmos para variar la fiesta.";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // I. VERSIONES EXTENDED VS ORIGINALES / LIMPIAS Y SIN PISADORES
    if (lower.includes('extended') || lower.includes('originales') || lower.includes('pisador') || lower.includes('limpia') || lower.includes('dj virtual') || lower.includes('serato') || lower.includes('sirve para dj') || lower.includes('negocio') || lower.includes('bar')) {
      const reply = "Esta música viene en dos versiones: **Versión Extended** y **Versión Original**. Son versiones completamente limpias y sin pisadores (sin marcas de voz de DJ), perfectas tanto para mezclar en DJ Virtual / Serato como para sonar en tu negocio (bar, cantina, discoteca) o escuchar en el carro, casa o gimnasio. 🎧🔥";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // J. SEGURIDAD / CONFIANZA / ESTAFA
    const isTrustQuery = 
      lower.includes('robar') || 
      lower.includes('robo') || 
      lower.includes('estafa') || 
      lower.includes('estafador') || 
      lower.includes('confiar') || 
      lower.includes('confio') || 
      lower.includes('confia') || 
      lower.includes('confianza') || 
      lower.includes('como confio') || 
      lower.includes('como se que') || 
      lower.includes('como se si') || 
      lower.includes('seguro') || 
      lower.includes('garantia') || 
      lower.includes('engan') || 
      lower.includes('falso') ||
      lower.includes('trampa') ||
      lower.includes('realidad');

    if (isTrustQuery) {
      const reply = faqs.confianza_o_estafa || `¡Te entiendo perfectamente! Es normal dudar en internet. 🤝 Te doy 100% de tranquilidad:\n1️⃣ Este es mi proyecto real y transparente. Puedes verificar mi trabajo en todas mis redes oficiales buscando como **DJ Bonsai** en YouTube, Facebook e Instagram, y ver mis videos diarios en mi canal oficial de TikTok: https://www.tiktok.com/@jeffer.1997?_r=1&_t=ZS-9AKsEsdr3uG\n2️⃣ Este proyecto hace parte de mi reto personal (pasar de 0 a 100M en 365 días desde mi cabaña y donamos el 20% a personas de bajos recursos).\n3️⃣ Si lo prefieres, te envío primero muestras de audio y el video demostrativo de las 60 carpetas antes de que realices el pago. ¡La idea es construir confianza total! 🙌🔥`;
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // K. CARRANGA / PARRANDERA
    if (lower.includes('carranga') || lower.includes('parranda') || lower.includes('diciembre') || lower.includes('bailable')) {
      const reply = faqs.carranga_o_parrandera || "¡Claro que sí! 🔥 Trae bastante música de fiesta colombiana, parranderos, bailables de diciembre, vallenatos y géneros tradicionales en las 60 carpetas para prender la rumba en cualquier parte.";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // L. DEMOS / MUESTRAS
    if (lower.includes('demo') || lower.includes('muestra') || lower.includes('escuchar') || lower.includes('probador') || lower.includes('audio') || lower.includes('video') || lower.includes('carpetas') || lower.includes('como viene')) {
      const reply = "¡Claro que sí! Con mucho gusto. 😊 Aquí te comparto el video demostrativo y las muestras de audio para que escuches la calidad de sonido y veas cómo vienen organizadas las 60 carpetas en este pack de música.";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // M. FECHA LÍMITE
    if (lower.includes('limite') || lower.includes('caduca') || lower.includes('expira') || lower.includes('vence') || lower.includes('tiempo limite') || lower.includes('hasta cuando') || lower.includes('cuanto tiempo')) {
      const reply = faqs.fecha_limite || "Tranquilo/a, los enlaces **no tienen fecha límite de descarga** ⏳❌ Puedes acceder y descargar hoy, mañana, en un mes o cuando tú quieras. Además, si actualizamos o subimos más contenido, se te actualiza automáticamente. Lo único que debes conservar son los links de acceso. 💻🎧";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // N. COMPROBANTE DE PAGO
    if (lower.includes('comprobante') || lower.includes('ya pague') || lower.includes('ya transferi') || lower.includes('captura') || lower.includes('pago listo') || lower.includes('aqui esta el pago')) {
      const reply = config.respuestas_rapidas.entrega;
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // O. AGRADECIMIENTO
    if (lower === 'gracias' || lower === 'muchas gracias' || lower.includes('vale gracias') || lower.includes('excelente gracias') || lower.includes('mil gracias') || lower.includes('gracias dj')) {
      const thanksReply = "¡Con el mayor de los gustos! 🙏 Es un verdadero placer ayudarte. Que disfrutes muchísimo tu música 🎧🔥 ¡Cualquier cosa quedo a la orden!";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', thanksReply);
      chatState.setHumanActive(jid, true);
      return thanksReply;
    }

    // P. IA GEMINI 3.8 FLASH CON RAZONAMIENTO Y CONTEXTO COMPLETO
    if (this.isValidKey) {
      const systemPrompt = this.buildSystemPrompt(config);
      const aiReply = await this.callGeminiAPI(systemPrompt, history, userMessage);
      if (aiReply) {
        chatState.addMessage(jid, 'user', userMessage);
        chatState.addMessage(jid, 'assistant', aiReply);
        return aiReply;
      }
    }

    // Q. RESPUESTA DE RESPALDO
    const defaultReply = "¡Con el mayor gusto! 🎧 Respecto a lo que me preguntas: nuestro pack viene super completo con más de 60 carpetas y 10.000 canciones por $9.900 COP. Si quieres escuchar las muestras de audio o tienes alguna inquietud sobre el contenido, dime con total confianza y te ayudo de una 🙌🔥";
    chatState.addMessage(jid, 'user', userMessage);
    chatState.addMessage(jid, 'assistant', defaultReply);
    return defaultReply;
  }
}
