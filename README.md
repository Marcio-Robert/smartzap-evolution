# SmartZap - Template de Aula (SaaS CRM)

<div align="center">

![SmartZap](https://img.shields.io/badge/SmartZap-WhatsApp%20Marketing-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)

**Template base para construção de um SaaS de Automação com WhatsApp**

</div>

---

## 📚 Sobre este Template

Este repositório é um **template educacional** simplificado do projeto SmartZap. Ele contém a estrutura essencial para criar um CRM com disparo de mensagens via WhatsApp, ideal para aprendizado e customização.

Componentes complexos ou não essenciais foram movidos para a pasta `tmp/` para facilitar o entendimento inicial, mas o código permanece acessível se você quiser consultar.

## 🚀 Funcionalidades Principais (Core)

- **📱 Dashboard**: Visão geral de métricas.
- **👥 Contatos**: CRUD completo, importação de CSV e Tags.
- **📝 Templates**: Integração com Meta (Cloud API) e Geração com IA (Gemini).
- **📢 Campanhas**: Disparo em massa de mensagens.
- **⚙️ Configurações**: Setup de chaves de API (Meta, Gemini, etc).

## 📁 Estrutura de Pastas

```bash
smartzapv2/
├── app/                    # Next.js App Router (Rotas e Páginas)
├── components/             # Componentes React (UI Shadcn + Features)
├── lib/                    # Lógica de negócio, Serviços e Utilitários
├── supabase/               # Migrations do Banco de dados
├── tmp/                    # ⚠️ ARQUIVOS EXTRAS (Workflows, Testes, Docker, Docs avançados)
└── ...
```

> **Nota:** Este template contém apenas o essencial. Funcionalidades extras e testes foram removidos para simplificação.

## 🛠️ Como Iniciar

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/smartzap-template.git
    cd smartzap-template
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    # ou
    pnpm install
    ```

3.  **Configure o ambiente:**
    - Crie um arquivo `.env.local` na raiz do projeto.
    - Adicione as chaves básicas do Supabase (URL e Key). Você pode copiar o exemplo do arquivo `.env.example`.

4.  **Execute o projeto:**
    ```bash
    npm run dev
    ```
    Acesse: `http://localhost:3000`

5.  **Siga o Wizard de Configuração:**
    Ao acessar o projeto pela primeira vez, vá até a página **Configurações** (`/settings`).
    Um **Wizard Interativo** irá guiá-lo passo a passo para conectar:
    - 🔴 **Redis (Upstash)**: Para filas e cache.
    - 🟢 **WhatsApp Business API**: Para envio de mensagens.
    - 🤖 **IA (Gemini)**: Para funcionalidades inteligentes.

    > 📘 **Precisa de ajuda com as chaves?**
    > Consulte nosso [Guia de Configuração Detalhado](docs/GUIA_CONFIGURACAO.md) para um passo a passo completo.

## 📦 Stack Tecnológico

- **Frontend:** Next.js 15, React 19, Tailwind CSS, Shadcn/ui.
- **Backend:** Next.js API Routes (Serverless).
- **Banco de Dados:** Supabase (PostgreSQL).
- **IA:** Google Gemini (para geração de templates).
- **Integração:** Meta WhatsApp Cloud API.

---

**Bom estudo!** 🚀
