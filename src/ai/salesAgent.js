import fs from 'fs';
import path from 'path';
import { getBusinessConfig } from '../config.js';
import { chatState } from '../state/chatState.js';
import { isInternationalCustomer } from '../packDetector.js';

export class SalesAgent {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.isValidKey = Boolean(this.apiKey && this.apiKey.trim().length > 10);
    this.candidateModels = [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite'
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

  buildSystemPrompt(config, isIntl = false) {
    const emp = config.empleado_digital;
    const neg = config.negocio;
    const rap = config.respuestas_rapidas;
    const faqs = config.objeciones_y_faqs || {};

    if (isIntl) {
      return `
Tu nombre es: ${emp.nombre} (DJ Bonsai).
Ocupación: DJ profesional, creador de la plataforma oficial Bonsai Music Pool.
Tono de voz: Amigable, respetuoso, con energía de DJ colombiano, educado, seguro y 100% transparente.

CLIENTE INTERNACIONAL:
- Este cliente se comunica desde fuera de Colombia (o requiere pagar en dólares / pasarela internacional).
- Todos los precios son en DÓLARES (USD).
- La forma de pago es ÚNICAMENTE con tarjeta débito, crédito o PayPal en la pasarela internacional oficial de Gumroad: https://bonsaijefferson.gumroad.com/l/hiluhk
- JAMÁS ofrezcas Nequi ni Bre-B a este cliente.

PÚBLICO Y USOS DE NUESTRA MÚSICA:
- Sirve tanto para DJs profesionales y discotecas (versiones Extended con intro y outro, BPM y sin sellos ni pisadores), como para cualquier persona, negocio, gimnasio, carro o fiestas en casa que quiera disfrutar de la mejor música limpia en 320 Kbps sin marcas ni anuncios molestos.

INFORMACIÓN DE LA PLATAFORMA (BONSAI MUSIC POOL):
- Web oficial internacional con reproductor en vivo: https://bonsai-music-pool.vercel.app?pais=int
- En la web, el cliente puede escuchar todas las canciones completas en vivo sin sellos en 320 Kbps, ver la cantidad de carpetas y el peso exacto en Gigas de cada pack antes de comprar.
- La compra internacional se hace mediante Gumroad: https://bonsaijefferson.gumroad.com/l/hiluhk

CATÁLOGO OFICIAL Y PRECIOS EN DÓLARES:
Packs individuales:
1️⃣ Pack Samples & Efectos DJ: $3.00 USD
2️⃣ Pack Decembrino 2026: $4.99 USD
3️⃣ Pack 1000 Videos Remix: $4.99 USD
4️⃣ Pack Crossover Originales & Remix: $4.99 USD
5️⃣ Pack Halloween 2026: $4.99 USD

Combos especiales:
6️⃣ Combo Dúo (Elige 2 packs a tu gusto): $7.99 USD
7️⃣ Combo Trío (Elige 3 packs a tu gusto): $9.99 USD
8️⃣ Mega Combo VIP (Todos los packs incluidos): $14.99 USD

REGLAS DE COMUNICACIÓN COMERCIAL (CRÍTICO):
- Sé puntual, breve, enérgico y sin textos largos ni aburridos.
- Si el cliente ya eligió el Combo Dúo o Trío, pregúntale ÚNICAMENTE cuáles desea entre los 5 packs individuales (1 al 5). NUNCA repitas las opciones 6, 7 u 8 dentro de un combo.
- Da la lista completa de precios SOLO si el cliente pregunta en general por todos los precios o el catálogo completo. Si ya tiene un pack en mente, ve directo al grano con ese pack.

CONDICIONES DE SEGURIDAD Y ACCESO:
- Pago: Pasarela oficial y segura de Gumroad (Tarjeta / PayPal).
- Entrega: Al enviar la foto del recibo o número de orden de Gumroad, el bot entrega su Código Único de activación.
- Dispositivos: Máximo 2 dispositivos por código (por ejemplo, celular y computador).
- Duración: Acceso vitalicio de por vida, sin límite de tiempo ni mensualidades.

DISTINCIÓN VITAL:
1. Si preguntan para quién sirve: Explicar que sirve tanto para DJs y discotecas como para escuchar en la casa, gimnasio, negocio, carro o fiestas familiares con amigos.
2. Si preguntan por CONTRATAR a DJ Bonsai para un evento presencial (fiesta, 15 años, boda, discoteca, cuánto cobras por tocar): Responder que sí realiza presentaciones presenciales, preguntar fecha y ciudad, y avisarle que DJ Bonsai en persona le responderá por este chat.
`.trim();
    }

    return `
Tu nombre es: ${emp.nombre} (DJ Bonsai).
Ocupación: DJ profesional, creador de la plataforma oficial Bonsai Music Pool.
Tono de voz: Amigable, respetuoso, con energía de DJ colombiano, educado, seguro y 100% transparente.

PÚBLICO Y USOS DE NUESTRA MÚSICA:
- Sirve tanto para DJs profesionales y discotecas (versiones Extended con intro y outro, BPM y sin sellos ni pisadores), como para cualquier persona, negocio, gimnasio, carro o fiestas en casa que quiera disfrutar de la mejor música limpia en 320 Kbps sin marcas ni anuncios molestos.

INFORMACIÓN DE LA PLATAFORMA (BONSAI MUSIC POOL):
- Web oficial con reproductor en vivo: ${neg.web_oficial}
- En la web, el cliente puede escuchar todas las canciones completas en vivo sin sellos en 320 Kbps, ver la cantidad de carpetas y el peso exacto en Gigas de cada pack antes de comprar.
- La compra se hace directamente seleccionando el pack en la web y dando al botón "Notificar Pago por WhatsApp".

CATÁLOGO OFICIAL Y PRECIOS EN PESOS (COP):
Packs individuales:
1️⃣ Pack Samples & Efectos DJ: $5.000 COP
2️⃣ Pack Decembrino 2026: $10.000 COP
3️⃣ Pack 1000 Videos Remix: $10.000 COP
4️⃣ Pack Crossover Originales & Remix: $10.000 COP
5️⃣ Pack Halloween 2026: $10.000 COP

Combos especiales:
6️⃣ Combo Dúo (Elige 2 packs a tu gusto): $15.000 COP
7️⃣ Combo Trío (Elige 3 packs a tu gusto): $20.000 COP
8️⃣ Mega Combo VIP (Todos los packs incluidos): $35.000 COP

REGLAS DE COMUNICACIÓN COMERCIAL (CRÍTICO):
- Sé puntual, breve, con buena vibra y sin textos largos ni aburridos.
- Si el cliente ya eligió el Combo Dúo o Trío, pregúntale ÚNICAMENTE cuáles desea entre los 5 packs individuales (1 al 5). NUNCA repitas las opciones 6, 7 u 8 dentro de un combo.
- Da la lista completa de precios SOLO si el cliente pregunta en general por todos los precios o el catálogo completo. Si ya tiene un pack en mente, ve directo al grano con ese pack.

CONDICIONES DE SEGURIDAD Y ACCESO:
- Pago: Únicamente a Nequi o por llave Bre-B al 3104531477 a nombre de Jefferson Josué Silva Santafé.
- Entrega: Al enviar el comprobante, el bot entrega un Código Criptográfico Único y las instrucciones de auto-desbloqueo.
- Dispositivos: Máximo 2 dispositivos por código (por ejemplo, celular y computador).
- Duración: Acceso vitalicio de por vida, sin límite de tiempo ni mensualidades.

DISTINCIÓN VITAL:
1. Si preguntan para quién sirve: Explicar que sirve tanto para DJs y discotecas como para escuchar en la casa, gimnasio, negocio, carro o fiestas familiares con amigos.
2. Si preguntan por CONTRATAR a DJ Bonsai para un evento presencial (fiesta, 15 años, boda, discoteca, cuánto cobras por tocar): Responder que sí realiza presentaciones presenciales, preguntar fecha y ciudad, y avisarle que DJ Bonsai en persona le responderá por este chat.
`.trim();
  }

  async callGeminiAPI(systemPrompt, history, userMessage) {
    if (!this.apiKey) return null;

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

    for (const modelName of this.candidateModels) {
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
      } catch (e) {
        // Continuar al siguiente modelo si uno falla
      }
    }
    return null;
  }

  async generateResponse(jid, userMessage) {
    const config = getBusinessConfig();
    const faqs = config.objeciones_y_faqs || {};
    const rawLower = userMessage.toLowerCase().trim();
    const lower = rawLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ");
    const history = chatState.getHistory(jid);

    // -------------------------------------------------------------
    // DETECCIÓN INTELIGENTE DE PREGUNTAS Y CONTROL DE FLUJO
    // -------------------------------------------------------------

    // 1. CONTRATACIÓN PRESENCIAL DE DJ BONSAI (Eventos, discotecas, fiestas privadas, bodas, 15 años)
    const isDjBooking = 
      lower.includes('contratar') ||
      lower.includes('para una fiesta') ||
      lower.includes('para un evento') ||
      lower.includes('para una boda') ||
      lower.includes('para unos 15') ||
      lower.includes('cuanto cobras por tocar') ||
      lower.includes('cuanto cobra por tocar') ||
      lower.includes('servicio de dj') ||
      lower.includes('tocas en vivo') ||
      lower.includes('evento presencial') ||
      lower.includes('tocar en discoteca') ||
      lower.includes('tocar en bar');

    if (isDjBooking) {
      const reply = "¡Claro que sí! Con mucho gusto. DJ Bonsai realiza presentaciones y eventos presenciales (bodas, 15 años, discotecas y eventos privados). Cuéntame: ¿para qué fecha y en qué ciudad sería tu evento? Ya mismo le dejo una notificación prioritaria a DJ Bonsai para que te responda personalmente por este chat. 🎧🔥";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // 2. MÚSICA PARA DJ / CALIDAD DE AUDIO / FORMATO LIMPIO
    const isMusicForDj = 
      lower.includes('sirve para dj') ||
      lower.includes('musica para dj') ||
      lower.includes('para mezclar') ||
      lower.includes('extended') ||
      lower.includes('originales') ||
      lower.includes('pisadores') ||
      lower.includes('sellos') ||
      lower.includes('marcas de voz') ||
      lower.includes('calidad') ||
      lower.includes('kbps') ||
      lower.includes('virtual dj') ||
      lower.includes('serato') ||
      lower.includes('rekordbox');

    if (isMusicForDj) {
      const reply = "¡Sirve para todos! Está pensado tanto para DJs profesionales y discotecas (con versiones Extended con intro y outro para mezclar en Virtual DJ, Serato o Rekordbox sin sellos ni pisadores), como para cualquier persona o negocio que quiera disfrutar la mejor música en casa, en el carro, en el gimnasio o en sus fiestas con versiones Originales limpias y en máxima calidad 320 Kbps sin marcas ni comerciales. Puedes escuchar las canciones completas en vivo antes de comprar aquí: https://bonsai-music-pool.vercel.app 🎧🔥";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // 3. MUESTRAS / DEMOS / ESCUCHAR MÚSICA
    const isDemoQuery = 
      lower.includes('demo') ||
      lower.includes('muestra') ||
      lower.includes('escuchar') ||
      lower.includes('probador') ||
      lower.includes('probar') ||
      lower.includes('como viene') ||
      lower.includes('cuantas canciones') ||
      lower.includes('cuantas gigas') ||
      lower.includes('cuanto pesa');

    if (isDemoQuery) {
      const reply = "¡Montamos un reproductor en vivo en nuestra web oficial para que escuches todo sin gastar la memoria de tu WhatsApp! 🚀\n\nEntra aquí:\n🌐 https://bonsai-music-pool.vercel.app\n\nPuedes darle play a cualquier canción completa en 320 Kbps sin marcas, ver cuántas carpetas tiene cada pack y cuántos Gigas pesa. ¡Escuchas exactamente lo que te vas a llevar!";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // 4. CÓMO ABRIRLO EN EL COMPUTADOR / PC / LAPTOP
    const isPcQuery = 
      lower.includes('computador') ||
      lower.includes('computadora') ||
      lower.includes('en mi pc') ||
      lower.includes('al pc') ||
      lower.includes('laptop') ||
      lower.includes('portatil') ||
      lower.includes('como lo abro') ||
      lower.includes('abrirlo en el pc') ||
      lower.includes('abrirlo en mi computador');

    if (isPcQuery) {
      const reply = config.objeciones_y_faqs.como_abro_en_computador || "¡Es muy fácil y sencillo! 💻🎧\n1️⃣ Abres WhatsApp Web en tu computador.\n2️⃣ Desde ahí tocas el enlace directo que te entregaré tras tu compra (el cual ya incluye tu código y se auto-desbloquea de una vez), o entras a https://bonsai-music-pool.vercel.app e ingresas tu código de activación en la casilla del pack.\n3️⃣ ¡Listo! Tu plataforma quedará 100% desbloqueada en tu computador para descargar por carpetas o el pack completo en archivos ZIP limpios.";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // 5. SALUDO E INFORMACIÓN INICIAL MAESTRA
    const isInfoOrGreeting = 
      lower.includes('hola') || 
      lower.includes('buenas') ||
      lower.includes('info') || 
      lower.includes('informacion') ||
      lower.includes('quiero informacion') ||
      lower.includes('mas informacion') ||
      lower.includes('dame informacion') ||
      lower.includes('mas info') ||
      lower.includes('de que trata') ||
      lower.includes('puedo obtener') ||
      lower.includes('obtener informacion') ||
      lower.includes('me das informacion');

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

    let isIntl = chatState.getIsIntl ? chatState.getIsIntl(jid) : false;
    if (!isIntl && isInternationalCustomer(jid, userMessage)) {
      if (chatState.setIsIntl) chatState.setIsIntl(jid, true);
      isIntl = true;
    }

    if ((history.length === 0 || isInfoOrGreeting) && !isExplicitPaymentKeyword) {
      const saludoMsg = isIntl && config.internacional?.respuestas_rapidas?.saludo_e_info
        ? config.internacional.respuestas_rapidas.saludo_e_info
        : config.respuestas_rapidas.saludo_e_info;
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', saludoMsg);
      return saludoMsg;
    }

    // 5. INTENCIÓN DIRECTA DE COMPRA ("Lo quiero", "Cómo lo compro", "Dame el Nequi")
    const isExplicitPaymentRequest = isExplicitPaymentKeyword ||
      lower.includes('quiero la promo') ||
      lower.includes('quiero la promocion') ||
      lower.includes('quiero adquirir') ||
      lower.includes('nequi') ||
      lower.includes('daviplata') ||
      lower.includes('donde transfiero') ||
      lower.includes('donde consigno') ||
      lower.includes('dame el numero') ||
      lower.includes('a que numero') ||
      lower.includes('como es el pago') ||
      lower.includes('mandame los datos') ||
      lower.includes('gumroad') ||
      lower.includes('paypal') ||
      lower.includes('tarjeta') ||
      lower.includes('dame los datos');

    if (isExplicitPaymentRequest) {
      if (isIntl) {
        const intlPayReply = config.internacional?.respuestas_rapidas?.pago_y_tarjetas || `¡Excelente decisión! 💳 Puedes pagar de forma 100% segura con tu tarjeta débito, crédito o PayPal a través de nuestra pasarela internacional oficial de Gumroad:

👉 https://bonsaijefferson.gumroad.com/l/hiluhk

🔥 MENÚ DE PACKS Y PRECIOS EN DÓLARES (USD):
1️⃣ Pack Samples & Efectos DJ ($3.00 USD)
2️⃣ Pack Decembrino 2026 ($4.99 USD)
3️⃣ Pack 1000 Videos Remix ($4.99 USD)
4️⃣ Pack Crossover Originales & Extended ($4.99 USD)
5️⃣ Pack Halloween 2026 ($4.99 USD)
6️⃣ Combo Dúo (2 Packs a elección) ($7.99 USD)
7️⃣ Combo Trío (3 Packs a elección) ($9.99 USD)
8️⃣ Mega Combo VIP (Todos los packs completos) ($14.99 USD)

También puedes pre-escuchar y elegir en nuestra web:
🌐 https://bonsai-music-pool.vercel.app?pais=int

Una vez completada tu compra, me envías la foto del comprobante o tu número de orden de Gumroad, y de inmediato te entrego tu código de activación vitalicio para tus 2 dispositivos 🙌🎧`;
        chatState.addMessage(jid, 'user', userMessage);
        chatState.addMessage(jid, 'assistant', intlPayReply);
        return intlPayReply;
      }

      const pagoReply = `¡Excelente decisión! 💳 Puedes transferir por Nequi o por llave Bre-B:

📲 Nequi: ${config.metodos_pago.nequi}
🔑 Llave Bre-B: ${config.metodos_pago.llave_breb}
Titular: ${config.metodos_pago.titular}

🔥 MENÚ DE PACKS Y PRECIOS:
1️⃣ Pack Samples & Efectos DJ ($5.000 COP)
2️⃣ Pack Decembrino 2026 ($10.000 COP)
3️⃣ Pack 1000 Videos Remix ($10.000 COP)
4️⃣ Pack Crossover Originales & Extended ($10.000 COP)
5️⃣ Pack Halloween 2026 ($10.000 COP)
6️⃣ Combo Dúo (2 Packs a elección) ($15.000 COP)
7️⃣ Combo Trío (3 Packs a elección) ($20.000 COP)
8️⃣ Mega Combo VIP (Todos los packs completos) ($35.000 COP)

También puedes hacer tu compra directamente en nuestra web oficial:
🌐 https://bonsai-music-pool.vercel.app

Envíame el comprobante y el número o nombre de tu pack, y de inmediato te entrego tu código de activación vitalicio para tus 2 dispositivos 🙌🎧`;
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', pagoReply);
      return pagoReply;
    }

    // D. CÓMO SE ENTREGA / CÓMO LO RECIBO / CÓMO DESCARGO / COMPUTADOR
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

    // F. CUÑAS / PISADORES PERSONALIZADOS / SAMPLERS A MI NOMBRE
    if (lower.includes('cuña') || lower.includes('sampler') || lower.includes('a mi nombre')) {
      const reply = "Con total sinceridad, la verdad lo que te diga es mentira: en el momento no trabajo haciendo cuñas ni samplers personalizados a nombres individuales. El pack viene con versiones completamente limpias y sin pisadores.";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // G. GÉNEROS QUE NO TENEMOS (Caucana, Champeta, Metal, Ópera) -> HONESTIDAD TOTAL
    if (lower.includes('caucana') || lower.includes('cauca') || lower.includes('champeta') || lower.includes('metal') || lower.includes('clasica sinfonica') || lower.includes('opera')) {
      const reply = "Con total sinceridad para no quedarte mal ni engañarte: Música Caucana NO tenemos en este pack. Tampoco Champeta por el momento (estamos trabajando para actualizar y subir unas carpetas de champeta más adelante). Prefiero ser 100% transparente contigo para garantizar tu satisfacción.";
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

    // I. VERSIONES EXTENDED VS ORIGINALES / LIMPIAS Y SIN PISADORES / PARA DJ O NEGOCIO
    if (lower.includes('extended') || lower.includes('originales') || lower.includes('pisador') || lower.includes('limpia') || lower.includes('dj virtual') || lower.includes('serato') || lower.includes('sirve para dj') || lower.includes('negocio') || lower.includes('bar')) {
      const reply = "Esta música viene en dos versiones: **Versión Extended** y **Versión Original**. Son versiones completamente limpias y sin pisadores (sin marcas de voz de DJ), perfectas tanto para mezclar en DJ Virtual / Serato como para sonar en tu negocio (bar, cantina, discoteca) o escuchar en el carro, casa o gimnasio. 🎧🔥";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // J. SEGURIDAD / CONFIANZA / ESTAFA / ROBAR
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

    // K. CARRANGA / PARRANDERA / COLOMBIANA
    if (lower.includes('carranga') || lower.includes('parranda') || lower.includes('diciembre') || lower.includes('bailable')) {
      const reply = faqs.carranga_o_parrandera || "¡Claro que sí! 🔥 Trae bastante música de fiesta colombiana, parranderos, bailables de diciembre, vallenatos y géneros tradicionales en las 60 carpetas para prender la rumba en cualquier parte.";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // L. SOLICITUD DE DEMOS O VER CARPETAS O VIDEO DEMO
    if (lower.includes('demo') || lower.includes('muestra') || lower.includes('escuchar') || lower.includes('probador') || lower.includes('audio') || lower.includes('video') || lower.includes('carpetas') || lower.includes('como viene') || lower.includes('demostración') || lower.includes('demostracion') || lower.includes('prueba') || lower.includes('pruebas') || lower.includes('probar') || lower.includes('ejemplo') || lower.includes('ejemplos')) {
      const reply = "¡Claro que sí! Con mucho gusto. 😊 Aquí te comparto el video demostrativo y las muestras de audio para que escuches la calidad de sonido y veas cómo vienen organizadas las 60 carpetas en este pack de música.";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // M. FECHA LÍMITE DE DESCARGA / HASTA CUÁNDO PUEDO DESCARGAR
    if (lower.includes('limite') || lower.includes('caduca') || lower.includes('expira') || lower.includes('vence') || lower.includes('tiempo limite') || lower.includes('hasta cuando') || lower.includes('cuanto tiempo')) {
      const reply = faqs.fecha_limite || "Tranquilo/a, los enlaces **no tienen fecha límite de descarga** ⏳❌ Puedes acceder y descargar hoy, mañana, en un mes o cuando tú quieras. Además, si actualizamos o subimos más contenido, se te actualiza automáticamente. Lo único que debes conservar son los links de acceso. 💻🎧";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // N. CONFIRMACIÓN DE PAGO / COMPROBANTE -> ENTREGA AUTOMÁTICA
    if (lower.includes('comprobante') || lower.includes('ya pague') || lower.includes('ya transferi') || lower.includes('captura') || lower.includes('pago listo') || lower.includes('aqui esta el pago')) {
      const reply = config.respuestas_rapidas.entrega;
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', reply);
      return reply;
    }

    // O. AGRADECIMIENTO Y CIERRE NATURAL POST-VENTA
    if (lower === 'gracias' || lower === 'muchas gracias' || lower.includes('vale gracias') || lower.includes('excelente gracias') || lower.includes('mil gracias') || lower.includes('gracias dj')) {
      const thanksReply = "¡Con el mayor de los gustos! 🙏 Es un verdadero placer ayudarte. Que disfrutes muchísimo tu música 🎧🔥 ¡Cualquier cosa quedo a la orden!";
      chatState.addMessage(jid, 'user', userMessage);
      chatState.addMessage(jid, 'assistant', thanksReply);
      return thanksReply;
    }

    // P. RESPUESTA DINÁMICA MEDIANTE IA GEMINI CON HISTORIAL COMPLETO
    if (this.isValidKey) {
      const systemPrompt = this.buildSystemPrompt(config, isIntl);
      const aiReply = await this.callGeminiAPI(systemPrompt, history, userMessage);
      if (aiReply) {
        chatState.addMessage(jid, 'user', userMessage);
        chatState.addMessage(jid, 'assistant', aiReply);
        return aiReply;
      }
    }

    // Q. RESPUESTA DINÁMICA DE RESPALDO SI NO HAY RED O IA
    const defaultReply = isIntl
      ? "¡Con el mayor gusto! 🎧 Respecto a lo que me preguntas: nuestro pack viene súper completo con más de 60 carpetas y 10.000 canciones desde solo $3.00 USD. Si quieres escuchar las muestras en vivo en la web (https://bonsai-music-pool.vercel.app?pais=int) o tienes alguna inquietud sobre el contenido o el pago por Gumroad, dime con total confianza y te ayudo de una 🙌🔥"
      : "¡Con el mayor gusto! 🎧 Respecto a lo que me preguntas: nuestro pack viene super completo con más de 60 carpetas y 10.000 canciones por $9.900 COP. Si quieres escuchar las muestras de audio o tienes alguna inquietud sobre el contenido, dime con total confianza y te ayudo de una 🙌🔥";

    chatState.addMessage(jid, 'user', userMessage);
    chatState.addMessage(jid, 'assistant', defaultReply);
    return defaultReply;
  }
}
