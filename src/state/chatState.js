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
        // ── Remarketing tracking ───────────────────────────────────────────
        lastIncomingMessageAt: 0,  // timestamp del último mensaje del cliente
        hasPurchased: false,        // true si el bot ya entregó el pack
        remarketingSent: false      // garantiza máximo 1 mensaje de remarketing
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
