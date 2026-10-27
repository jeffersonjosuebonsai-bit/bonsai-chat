export function isInternationalCustomer(jid, text = '') {
  if (!jid) return false;
  // Extraer sólo los números del teléfono (quitando @s.whatsapp.net, +, espacios, etc.)
  const rawNumber = jid.split('@')[0].replace(/[^0-9]/g, '');

  // Si el usuario explícitamente pide dólares, gumroad, paypal o menciona otro país:
  const t = (text || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const mentionsInternational = 
    t.includes('gumroad') || 
    t.includes('paypal') || 
    t.includes('dolar') || 
    t.includes('usd') || 
    t.includes('tarjeta internacional') || 
    t.includes('otro pais') ||
    t.includes('extranjero');

  // En Colombia todos los números de celular empiezan por 573... (código país 57)
  if (rawNumber.startsWith('57')) {
    return mentionsInternational ? true : false;
  }

  // Cualquier número cuyo prefijo no sea 57 (+52 México, +51 Perú, +593 Ecuador, +56 Chile, +1 USA, etc.)
  return true;
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
