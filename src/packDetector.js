export function isInternationalCustomer(jid, text = '') {
  if (!jid) return false;

  const t = (text || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Si el cliente menciona explícitamente pagar por Gumroad, PayPal, Dólares o que está en el exterior:
  if (
    t.includes('gumroad') || 
    t.includes('paypal') || 
    t.includes('dolar') || 
    t.includes('usd') || 
    t.includes('tarjeta internacional') || 
    t.includes('otro pais') ||
    t.includes('extranjero') ||
    t.includes('fuera de colombia')
  ) {
    return true;
  }

  // 2. Si el JID es un LID (@lid de WhatsApp), NO contiene el número telefónico real.
  // En tu negocio el 99% es Colombia, por lo tanto NUNCA asumir internacional por un @lid.
  if (jid.includes('@lid')) {
    return false;
  }

  // 3. Extraer sólo los números del teléfono
  const rawNumber = jid.split('@')[0].replace(/[^0-9]/g, '');

  // Si empieza por 57 (Colombia) o es un celular colombiano (10 dígitos empezando en 3 ej. 310, 318, 323, 300) -> COLOMBIA
  if (rawNumber.startsWith('57') || (rawNumber.startsWith('3') && rawNumber.length === 10)) {
    return false;
  }

  // 4. Prefijos telefónicos internacionales conocidos y comprobados:
  // México (+52), Perú (+51), Argentina (+54), Chile (+56), Ecuador (+593), Bolivia (+591),
  // Paraguay (+595), Uruguay (+598), Panamá (+507), Costa Rica (+506), Guatemala (+502),
  // El Salvador (+503), Honduras (+504), España (+34), USA / Canadá (+1)
  const FOREIGN_PREFIXES = [
    '52',  // México
    '51',  // Perú
    '54',  // Argentina
    '56',  // Chile
    '593', // Ecuador
    '591', // Bolivia
    '595', // Paraguay
    '598', // Uruguay
    '507', // Panamá
    '506', // Costa Rica
    '504', // Honduras
    '503', // El Salvador
    '502', // Guatemala
    '58',  // Venezuela
    '34',  // España
    '1'    // USA / Canadá
  ];

  const isExplicitForeign = FOREIGN_PREFIXES.some(prefix => rawNumber.startsWith(prefix));
  if (isExplicitForeign) {
    return true;
  }

  // 5. REGLA DE ORO: ANTE CUALQUIER DUDA O NÚMERO DESCONOCIDO, ES 100% COLOMBIA (COP / Nequi)
  return false;
}

export function detectPackFromText(text) {
  if (!text) return null;
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Detectar paquetes específicos en etiquetas como: [Packs: pack-xxx,pack-yyy]
  let detectedSubPacks = [];
  const tagMatch = text.match(/\[Packs:\s*([^\]]+)\]/i);
  if (tagMatch) {
    detectedSubPacks = tagMatch[1].split(',').map(s => s.trim());
  } else {
    if (t.includes('sample') || t.includes('efecto')) detectedSubPacks.push('pack-samples-efectos-dj');
    if (t.includes('decembrin') || t.includes('navidad') || t.includes('diciembre') || t.includes('parranda')) detectedSubPacks.push('pack-decembrino-2026');
    if (t.includes('video') || t.includes('1000')) detectedSubPacks.push('pack-1000-videos-remix');
    if (t.includes('crossover') || t.includes('extended')) detectedSubPacks.push('pack-crossover-originales-extended');
    if (t.includes('halloween') || t.includes('hallowen')) detectedSubPacks.push('pack-halloween-2026');
  }

  // Opciones numéricas simples según la enumeración oficial (1 a 8)
  const trimmed = t.trim().replace('.', '');
  if (trimmed === '1') return { key: 'SMP', name: 'Pack Samples & Efectos DJ', packId: 'pack-samples-efectos-dj' };
  if (trimmed === '2') return { key: 'DEC', name: 'Pack Decembrino 2026', packId: 'pack-decembrino-2026' };
  if (trimmed === '3') return { key: 'VID', name: 'Pack 1000 Videos Remix', packId: 'pack-1000-videos-remix' };
  if (trimmed === '4') return { key: 'CRO', name: 'Pack Crossover Originales & Remix', packId: 'pack-crossover-originales-extended' };
  if (trimmed === '5') return { key: 'HAL', name: 'Pack Halloween 2026', packId: 'pack-halloween-2026' };
  if (trimmed === '6') return { key: 'DUO', name: 'Combo Dúo (2 Packs a elección)', subPacks: detectedSubPacks };
  if (trimmed === '7') return { key: 'TRIO', name: 'Combo Trío (3 Packs a elección)', subPacks: detectedSubPacks };
  if (trimmed === '8') return { key: 'VIP', name: 'Mega Combo VIP (Todos los Packs)' };

  // Mega Combo VIP
  if (t.includes('mega combo vip') || t.includes('combo vip') || (t.includes('vip') && (t.includes('35') || t.includes('14.99') || t.includes('15 usd') || t.includes('todos')))) {
    return { key: 'VIP', name: 'Mega Combo VIP (Todos los Packs)' };
  }

  // Combo Trío
  if (t.includes('combo trio') || (t.includes('trio') && (t.includes('20') || t.includes('9.99') || t.includes('tres')))) {
    return { key: 'TRIO', name: 'Combo Trío (3 Packs a elección)', subPacks: detectedSubPacks };
  }

  // Combo Dúo
  if (t.includes('combo duo') || (t.includes('duo') && (t.includes('15') || t.includes('7.99') || t.includes('dos')))) {
    return { key: 'DUO', name: 'Combo Dúo (2 Packs a elección)', subPacks: detectedSubPacks };
  }

  // Packs individuales
  if (t.includes('sample') || t.includes('efecto') || t.includes('5000') || t.includes('5.000') || t.includes('3 usd') || t.includes('3 dolares')) {
    return { key: 'SMP', name: 'Pack Samples & Efectos DJ', packId: 'pack-samples-efectos-dj' };
  }

  if (t.includes('decembrin') || t.includes('navidad') || t.includes('naviden') || t.includes('diciembre') || t.includes('parranda')) {
    return { key: 'DEC', name: 'Pack Decembrino 2026', packId: 'pack-decembrino-2026' };
  }

  if (t.includes('video') || t.includes('1000 video')) {
    return { key: 'VID', name: 'Pack 1000 Videos Remix', packId: 'pack-1000-videos-remix' };
  }

  if (t.includes('crossover') || t.includes('extended')) {
    return { key: 'CRO', name: 'Pack Crossover Originales & Remix', packId: 'pack-crossover-originales-extended' };
  }

  if (t.includes('halloween') || t.includes('hallowen')) {
    return { key: 'HAL', name: 'Pack Halloween 2026', packId: 'pack-halloween-2026' };
  }

  return null;
}
