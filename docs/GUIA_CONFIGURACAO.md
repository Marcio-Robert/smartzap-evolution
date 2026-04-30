# 🎓 Guia Oficial de Configuração

Este guia explica todos os componentes do sistema, desde o "chão" até o "telhado".

Para que o SmartZap funcione, precisamos montar as peças na ordem certa. O **Wizard de Configuração** (na tela `/settings`) ajuda na metade do caminho, mas existem passos que vêm **antes** (Supabase) e **depois** (Vercel).

---

## 🏗️ Fase 1: A Fundação (Antes do Wizard)

Antes de rodar o projeto, você precisa do Banco de Dados. Sem ele, o sistema nem abre.

### 1. Supabase (O Banco de Dados)
O Supabase é onde guardamos contatos, mensagens e usuários.

1.  Crie conta em [supabase.com](https://supabase.com).
2.  Crie um novo **Project**.
3.  Vá em **Project Settings > API**.
4.  Copie a `URL` e a chave `anon` (public).
5.  Cole no seu arquivo `.env.local` (crie este arquivo na raiz do projeto se não existir):

```bash
NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-chave-anon-publica"
```

> ✅ **Teste:** Agora você pode rodar `npm run dev`. O site deve abrir!

---

## 🚦 Fase 2: O Wizard (Infraestrutura)

Com o site aberto, vá para a página **Configurações** (`/settings`). Você verá o **Wizard Interativo**. Ele vai te cobrar as próximas peças.

### 2. Upstash Redis (A Memória Rápida)
Necessário para o sistema ser rápido e não travar.

1.  Crie conta em [upstash.com](https://upstash.com).
2.  Crie um banco **Redis**.
3.  Copie as chaves da seção **REST API** e adicione ao `.env.local`:
    ```bash
    UPSTASH_REDIS_REST_URL="..."
    UPSTASH_REDIS_REST_TOKEN="..."
    ```
4.  No Wizard, clique em **"Verificar novamente"**. O passo deve ficar Verde.

### 3. Upstash QStash (O Gerente de Filas)
Necessário para agendar mensagens e disparos em massa.

1.  No painel Upstash, vá em **QStash**.
2.  Copie as chaves e adicione ao `.env.local`:
    ```bash
    QSTASH_URL="..."
    QSTASH_TOKEN="..."
    QSTASH_CURRENT_SIGNING_KEY="..."
    QSTASH_NEXT_SIGNING_KEY="..."
    ```
3.  Verifique no Wizard. Deve ficar Verde.

---

## 🟢 Fase 3: Conexão (WhatsApp)

Quando a infraestrutura (Redis + QStash) está verde, o Wizard libera o botão **"Configurar WhatsApp"**.

### 4. Meta for Developers
1.  Neste passo, você não precisa mais mexer no arquivo `.env`.
2.  Use a interface do SmartZap para colar:
    *   **Phone Number ID**
    *   **WABA ID**
    *   **Token**
3.  O sistema salva isso no Redis automaticamente.

---

## 🚀 Fase 4: Onde Hospedar (Vercel)

Se você quiser colocar o site na internet (sair do localhost), usamos a Vercel.

### 5. Deploy na Vercel
1.  Crie conta em [vercel.com](https://vercel.com).
2.  Instale a CLI: `npm i -g vercel`.
3.  No terminal do projeto, rode: `vercel`.
4.  Siga os passos e pronto!

> **Dica Pro:** Lembre-se de adicionar as variáveis de ambiente (as mesmas do `.env.local`) nas configurações do projeto no painel da Vercel (`Settings > Environment Variables`).

---

## 🤖 Fase 5: Inteligência (Opcional)

### 6. Google Gemini (IA)
Para gerar respostas inteligentes.
1.  Pegue a chave no [Google AI Studio](https://aistudio.google.com).
2.  No SmartZap, vá na aba **IA** em Configurações e cole a chave.

---

## 📝 Resumo do Arquivo .env.local

```bash
# === FASE 1 (Obrigatório para iniciar) ===
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."

# === FASE 2 (Exigido pelo Wizard) ===
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."
QSTASH_URL="..."
QSTASH_TOKEN="..."
QSTASH_CURRENT_SIGNING_KEY="..."
QSTASH_NEXT_SIGNING_KEY="..."

# === FASE 4 (Deploy - Apenas Vercel) ===
# VERCEL_URL="..." (Automático na Vercel)
```

---

## 🆘 Precisa de ajuda?

Entre no nosso grupo de suporte no WhatsApp:
[👉 **Clique aqui para entrar na Comunidade**](https://chat.whatsapp.com/K24Xek8pinPBwzOU7H4DCg?mode=hqrt1)
