# Como instalar e rodar o Zenn OS

Guia rápido para rodar o sistema no seu computador (Windows ou Mac).

---

## 1. Instalar o Node.js (só na primeira vez)

O projeto precisa do Node.js (versão 20 ou mais nova).

1. Acesse **https://nodejs.org**
2. Baixe a versão **LTS** (botão da esquerda).
3. Instale clicando em "Avançar/Next" até o fim.
4. Para conferir se instalou, abra o terminal e digite:
   ```
   node -v
   ```
   Deve aparecer algo como `v20.x.x` ou maior.

> **Onde fica o terminal?**
> - **Windows:** menu Iniciar → digite "PowerShell" → abrir.
> - **Mac:** ⌘ + espaço → digite "Terminal" → abrir.

---

## 2. Baixar o código

Se você **tem o Git instalado**, no terminal:
```
git clone https://github.com/gh9034517-hash/Zenn-OS.git
cd Zenn-OS
git checkout claude/zenn-os-build-g2subh
```

Se **não tem o Git**, baixe pelo site:
1. Abra **https://github.com/gh9034517-hash/Zenn-OS**
2. Troque a branch para `claude/zenn-os-build-g2subh` (menu de branches).
3. Botão verde **Code → Download ZIP**.
4. Extraia o ZIP e abra a pasta no terminal (`cd caminho/da/pasta`).

---

## 3. Configurar (o arquivo já vem pronto)

O arquivo **`.env.local`** já está na pasta, com as chaves públicas do seu
Supabase preenchidas. Não precisa mexer em nada.

> Se você baixou pelo ZIP e o `.env.local` não veio junto, crie um arquivo
> chamado `.env.local` na raiz da pasta com este conteúdo:
> ```
> VITE_DATA_PROVIDER=supabase
> SUPABASE_URL=https://ctylvrexmzpbejytkbmo.supabase.co
> SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0eWx2cmV4bXpwYmVqeXRrYm1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMTYzMzIsImV4cCI6MjEwNTU5MjMzMn0.ii4MSgK_pK-JFR4uu7dY_IjKfioi_kiEnONn-cBuNxk
> ```

---

## 4. Instalar as dependências (só na primeira vez)

Dentro da pasta do projeto, no terminal:
```
npm install
```
Espere terminar (baixa as bibliotecas, pode levar 1–2 minutos).

---

## 5. Rodar o sistema

```
npm run dev
```

Vai aparecer um endereço, geralmente **http://localhost:5173** —
abra ele no navegador (Chrome, Edge, etc.).

**Login:**
- E-mail: `contato.zennworks@gmail.com`
- Senha: `ZennOS2026!`  *(troque essa senha depois, em Configurações)*

Para **parar** o sistema, volte no terminal e aperte `Ctrl + C`.
Para **rodar de novo** depois, é só abrir a pasta no terminal e digitar
`npm run dev` (não precisa repetir os passos 1 a 4).

---

## 6. Testar a busca de leads (grátis)

1. Menu **Prospecção → Buscar leads**.
2. Nicho: `Pizzarias` · Cidade: `Campinas` · Raio: `12 km`.
3. Clique em **Buscar**.

Aparecem empresas reais do OpenStreetMap, com as **sem site** no topo
(que são os melhores alvos de prospecção). É 100% grátis, não usa API paga.

---

## Erros comuns

- **`npm: command not found` / `node não é reconhecido`** → o Node.js não foi
  instalado. Volte ao passo 1 e reinicie o terminal depois de instalar.
- **A busca de leads não retorna nada** → pode ser instabilidade momentânea
  do servidor de mapas gratuito. Espere alguns segundos e tente de novo.
- **Porta 5173 ocupada** → o Vite abre outra porta automaticamente; use o
  endereço que aparecer no terminal.
