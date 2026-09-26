// ============================================================
// Mensagens de abordagem (prospecção).
//
// A mensagem é a peça que converte — por isso são modelos prontos, curtos
// e específicos, e não um texto genérico. Regras que guiaram a escrita:
//   - citar o nome do negócio (mostra que não é disparo em massa);
//   - apontar UM problema concreto (não ter site / site lento);
//   - dizer o benefício em linguagem de dono de negócio (cliente no WhatsApp);
//   - terminar com uma pergunta fácil de responder "sim".
//
// A assinatura é institucional ("da Zenn Works"), sem nome de pessoa.
// ============================================================

export interface OutreachContext {
  name: string
  category?: string | null
  city?: string | null
  website?: string | null
}

/**
 * Traduz a categoria crua do OpenStreetMap ("restaurant", "hairdresser")
 * para um termo em português. Devolve null quando não reconhece, e nesse
 * caso os modelos simplesmente omitem a frase que citaria a categoria —
 * melhor calar do que escrever "exemplo de hairdresser" para o cliente.
 */
const CATEGORIAS: Record<string, string> = {
  restaurant: 'restaurante',
  fast_food: 'lanchonete',
  pizza: 'pizzaria',
  pizzaria: 'pizzaria',
  bar: 'bar',
  pub: 'bar',
  cafe: 'cafeteria',
  coffee_shop: 'cafeteria',
  bakery: 'padaria',
  hairdresser: 'salão',
  barber: 'barbearia',
  beauty: 'salão de beleza',
  fitness_centre: 'academia',
  gym: 'academia',
  pet: 'pet shop',
  veterinary: 'clínica veterinária',
  dentist: 'consultório odontológico',
  clinic: 'clínica',
  doctors: 'consultório',
  pharmacy: 'farmácia',
  car_repair: 'oficina',
  car_wash: 'lava-rápido',
  supermarket: 'mercado',
  convenience: 'mercadinho',
  greengrocer: 'hortifrúti',
  clothes: 'loja de roupas',
  boutique: 'boutique',
  optician: 'ótica',
  tattoo: 'estúdio de tatuagem',
  school: 'escola',
  college: 'escola',
  language_school: 'escola de idiomas',
  hotel: 'hotel',
  guest_house: 'pousada',
  hostel: 'hostel',
  motel: 'motel',
  estate_agent: 'imobiliária',
  lawyer: 'escritório de advocacia',
  accountant: 'escritório de contabilidade',
  ice_cream: 'sorveteria',
  florist: 'floricultura',
  jewelry: 'joalheria',
  watches: 'relojoaria',
}

export function categoriaEmPortugues(category?: string | null): string | null {
  if (!category) return null
  const raw = category.trim().toLowerCase()
  if (!raw) return null
  if (CATEGORIAS[raw]) return CATEGORIAS[raw]
  // Categorias já em português (vindas do Google ou digitadas na busca)
  // chegam no plural: "Pizzarias" -> "pizzaria".
  if (/^[a-zà-ú\s]+$/i.test(raw) && !raw.includes('_')) {
    const palavras = raw.split(/\s+/)
    const singular = palavras
      .map((p) => (p.length > 4 && /s$/.test(p) ? p.replace(/s$/, '') : p))
      .join(' ')
    return singular || null
  }
  return null
}

export const temSite = (website?: string | null) => !!website && !!website.trim()

export interface Template {
  id: string
  label: string
  /** Em que situação o modelo faz sentido. */
  escopo: 'semSite' | 'comSite' | 'sempre'
  build: (c: OutreachContext) => string
}

export const TEMPLATES: Template[] = [
  {
    id: 'direto',
    label: 'Direto',
    escopo: 'semSite',
    build: (c) => {
      const cat = categoriaEmPortugues(c.category)
      const exemplo = cat ? `um exemplo de ${cat}` : 'um exemplo'
      return [
        `Oi, pessoal da ${c.name}! Aqui é da Zenn Works.`,
        '',
        'Vi que vocês aparecem no Google mas ainda não têm site — e é ali que boa parte do cliente decide pra quem ligar.',
        '',
        'A gente faz site enxuto, que abre rápido no celular e joga o contato direto no WhatsApp de vocês.',
        '',
        `Posso mandar ${exemplo}? Sem compromisso.`,
      ].join('\n')
    },
  },
  {
    id: 'curto',
    label: 'Curto',
    escopo: 'semSite',
    build: (c) => {
      const cat = categoriaEmPortugues(c.category)
      const busca = cat && c.city ? `"${cat} em ${c.city}"` : 'o nome de vocês'
      return [
        `Oi, ${c.name}! Aqui é da Zenn Works.`,
        '',
        `Procurei ${busca} no Google e vocês aparecem — mas sem site, o cliente acaba clicando no concorrente.`,
        '',
        'Isso a gente resolve em poucos dias. Quer ver um exemplo?',
      ].join('\n')
    },
  },
  {
    id: 'prova',
    label: 'Prova social',
    escopo: 'semSite',
    build: (c) => {
      const onde = c.city ? `aqui de ${c.city}` : 'aqui da região'
      return [
        `Oi, ${c.name}! Aqui é da Zenn Works.`,
        '',
        `Fizemos o site de outros negócios ${onde} e eles passaram a receber contato direto pelo WhatsApp, sem depender só do Instagram.`,
        '',
        'Notei que vocês ainda não têm site. Te mando um exemplo rápido?',
      ].join('\n')
    },
  },
  {
    id: 'comSite',
    label: 'Já tem site',
    escopo: 'comSite',
    build: (c) =>
      [
        `Oi, pessoal da ${c.name}! Aqui é da Zenn Works.`,
        '',
        'Dei uma olhada no site de vocês. Ele cumpre o papel, mas tem dois pontos que costumam travar contato: a velocidade no celular e um caminho claro até o WhatsApp.',
        '',
        'Posso te mandar um diagnóstico rápido, de graça? São 3 pontos objetivos, leva 1 minuto pra ler.',
      ].join('\n'),
  },
  {
    id: 'instagram',
    label: 'Instagram / DM',
    escopo: 'sempre',
    build: (c) =>
      temSite(c.website)
        ? [
            `Oi, ${c.name}! Aqui é da Zenn Works.`,
            '',
            'Acompanhei o perfil de vocês e dei uma olhada no site. Tenho 3 ajustes rápidos que costumam aumentar o contato pelo WhatsApp.',
            '',
            'Posso mandar aqui?',
          ].join('\n')
        : [
            `Oi, ${c.name}! Aqui é da Zenn Works.`,
            '',
            'Acompanhei o perfil de vocês e senti falta de um site pra fechar o ciclo — hoje quem vê o post e quer contratar precisa ficar procurando o contato.',
            '',
            'Posso te mandar um exemplo do que fazemos? Rapidinho.',
          ].join('\n'),
  },
  {
    id: 'followup',
    label: 'Follow-up',
    escopo: 'sempre',
    build: (c) =>
      [
        `Oi, ${c.name}! Passando rápido pra retomar aqui.`,
        '',
        'Sei que a correria do dia a dia toma conta — só não queria que a ideia do site ficasse parada.',
        '',
        'Se fizer sentido, te mando o exemplo e você olha com calma. Posso mandar?',
      ].join('\n'),
  },
]

/** Modelos que fazem sentido para este lead, na ordem de uso. */
export function templatesPara(c: OutreachContext): Template[] {
  const comSite = temSite(c.website)
  return TEMPLATES.filter((t) => t.escopo === 'sempre' || (comSite ? t.escopo === 'comSite' : t.escopo === 'semSite'))
}

/** Mensagem padrão: o primeiro modelo aplicável ("Direto" / "Já tem site"). */
export function mensagemPadrao(c: OutreachContext): string {
  const [primeiro] = templatesPara(c)
  return primeiro ? primeiro.build(c) : ''
}
