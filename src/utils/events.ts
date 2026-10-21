// Pequenos avisos entre partes da tela que não se conhecem.
export const NEW_ENTRY_EVENT = 'zenn:new-entry'

/** Pede ao espaço aberto para abrir o "Novo lançamento". */
export const openNewEntry = () => window.dispatchEvent(new Event(NEW_ENTRY_EVENT))
