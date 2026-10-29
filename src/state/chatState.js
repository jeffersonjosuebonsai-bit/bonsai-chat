/**
 * Estado en memoria para cada conversación en WhatsApp.
 * Maneja el historial de mensajes y la pausa por intervención humana.
 */
class ChatStateManager {
  constructor() {
    this.chats = new Map();
    // Tiempo en milisegundos que el bot permanecerá pausado si un humano interviene (60 minutos por defecto)
    this.pauseDurationMs = 60 * 60 * 1000;
  }

  getChatState(jid) {
    if (!this.chats.has(jid)) {
      this.chats.set(jid, {
        jid,
        isHumanActive: false,
        lastHumanIntervention: 0,
        history: [],
        isIntl: false,
        // ── Remarketing tracking ───────────────────────────────────────────
        lastIncomingMessageAt: 0,  // timestamp del último mensaje del cliente
        hasPurchased: false,        // true si el bot ya entregó el pack
        remarketingSent: false,     // garantiza máximo 1 mensaje de remarketing
        // ── Estado de compra pendiente ────────────────────────────────────
        pendingPack: null           // { key: 'DEC'|'VIP'|..., name: '...', setAt: timestamp }
        // ──────────────────────────────────────────────────────────────────
      });
    }
    const state = this.chats.get(jid);

    // Verificar si el tiempo de pausa por intervención humana ya expiró
    if (state.isHumanActive && Date.now() - state.lastHumanIntervention > this.pauseDurationMs) {
      state.isHumanActive = false;
      console.log(`🤖 Bot reactivado automáticamente para ${jid} tras expirar el periodo de pausa.`);
    }

    return state;
  }

  setHumanActive(jid, active = true) {
    const state = this.getChatState(jid);
    state.isHumanActive = active;
    state.lastHumanIntervention = active ? Date.now() : 0;
    console.log(`📌 Estado para ${jid}: Bot ${active ? 'PAUSADO (Atendido por humano)' : 'ACTIVADO'}`);
  }

  addMessage(jid, role, content) {
    const state = this.getChatState(jid);
    state.history.push({
      role, // 'user' | 'assistant'
      content,
      timestamp: Date.now()
    });

    // Mantener máximo los últimos 15 mensajes para ahorrar tokens y mantener relevancia
    if (state.history.length > 15) {
      state.history.shift();
    }
  }

  getHistory(jid) {
    return this.getChatState(jid).history;
  }

  clearHistory(jid) {
    const state = this.getChatState(jid);
    state.history = [];
  }

  // ── Gestión de Pack Pendiente ─────────────────────────────────────────────
  setPendingPack(jid, key, name = '', subPacks = []) {
    const state = this.getChatState(jid);
    state.pendingPack = { key, name, subPacks, setAt: Date.now() };
    console.log(`📦 [chatState] Pack pendiente para ${jid}: ${key} (${name})`);
  }

  getPendingPack(jid) {
    const state = this.getChatState(jid);
    return state.pendingPack;
  }

  clearPendingPack(jid) {
    const state = this.getChatState(jid);
    state.pendingPack = null;
  }
  // ──────────────────────────────────────────────────────────────────────────

  // ── Gestión de Cliente Internacional ──────────────────────────────────────
  setIsIntl(jid, isIntl = true) {
    const state = this.getChatState(jid);
    state.isIntl = Boolean(isIntl);
    if (isIntl) {
      console.log(`🌎 [chatState] Chat marcado como INTERNACIONAL (USD / Gumroad): ${jid}`);
    }
  }

  getIsIntl(jid) {
    return Boolean(this.getChatState(jid).isIntl);
  }
  // ──────────────────────────────────────────────────────────────────────────

  // ── Métodos de remarketing ────────────────────────────────────────────────
  updateLastIncoming(jid) {
    const state = this.getChatState(jid);
    state.lastIncomingMessageAt = Date.now();
  }

  markPurchased(jid) {
    const state = this.getChatState(jid);
    state.hasPurchased = true;
    state.remarketingSent = true; // si ya compró, nunca enviar remarketing
    console.log(`💳 Compra registrada para ${jid}. Remarketing deshabilitado.`);
  }

  getAllChats() {
    return Array.from(this.chats.values());
  }
  // ─────────────────────────────────────────────────────────────────────────
}

export const chatState = new ChatStateManager();
