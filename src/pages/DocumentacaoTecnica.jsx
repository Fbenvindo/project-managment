import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Loader2, FileText } from "lucide-react";
import jsPDF from "jspdf";

const DOC_CONTENT = [
  { type: "title", text: "Documentação Técnica Completa" },
  { type: "subtitle", text: "Project Management — Análise de Arquitetura e Plano de Migração" },
  { type: "meta", text: "Data: 2026-06-30 | Plataforma: Base44 (BaaS Serverless)" },
  { type: "h1", text: "1. Visão Geral da Arquitetura" },
  { type: "p", text: "A aplicação utiliza uma arquitetura Modular Serverless com BaaS (Backend-as-a-Service). O frontend é uma SPA React monolítica; o backend consiste em funções Deno Deploy serverless gerenciadas pela plataforma Base44; o banco de dados é NoSQL gerenciado; e a autenticação é JWT/OAuth2 gerenciada integralmente pela plataforma. Não é microsserviços nem event-driven." },
  { type: "p", text: "Fluxo: Browser → main.jsx → App.jsx (AuthProvider + Router) → 21 páginas JSX + 159 componentes → base44Client.js (SDK) → API Gateway Base44 → Auth Service / Entity CRUD Engine / Realtime WebSocket / File Storage / Integrations Hub / Functions Runtime (Deno Deploy) → Base44 DB (NoSQL/MongoDB-like)." },
  { type: "h2", text: "1.1 Separação de Camadas" },
  { type: "p", text: "Apresentação: Sim — src/pages/ e src/components/ (React + Tailwind + shadcn/ui)." },
  { type: "p", text: "Domínio: Parcial — lógica de negócio embarcada em componentes e ActivityTimerContext (~895 linhas). Não há camada de domínio isolada." },
  { type: "p", text: "Aplicação: Parcial — ActivityTimerContext age como camada de aplicação (orquestração de sessões, timers, sync)." },
  { type: "p", text: "Persistência: Sim (delegada) — todo acesso a dados via SDK Base44 → API da plataforma. Sem ORM nem queries diretas." },
  { type: "h2", text: "1.2 Padrão Arquitetural" },
  { type: "p", text: "Híbrido: Component-Driven + Context State + BaaS Proxy. Mais próximo de MVVM (Views = JSX, ViewModels = Contexts + hooks). A camada de dados segue Active Record via SDK (base44.entities.Nome.list(), .create(), .update())." },
  { type: "h1", text: "2. Stack Tecnológica Completa" },
  { type: "h2", text: "2.1 Frontend" },
  { type: "p", text: "Linguagem: JavaScript (JSX). Framework: React 18.2.0. UI Library: shadcn/ui (Radix UI) + Tailwind CSS 3.4.17. Roteamento: react-router-dom 6.26.0. State: React Context + TanStack Query 5.84.1. Formulários: react-hook-form 7.54.2 + zod 3.24.2." },
  { type: "p", text: "Build Tool: Vite 6.1.0 com @base44/vite-plugin 1.0.24. Gerenciador: npm. Animações: framer-motion 11.16.4. Gráficos: recharts 2.15.4. Drag&Drop: @hello-pangea/dnd 17. Mapas: react-leaflet 4.2.1. 3D: three.js 0.171. Datas: date-fns + moment. Markdown: react-markdown. Rich Text: react-quill. PDF: jspdf. Screenshot: html2canvas. Ícones: lucide-react." },
  { type: "h2", text: "2.2 Backend" },
  { type: "p", text: "Linguagem: JavaScript/TypeScript. Runtime: Deno (Deno Deploy — serverless). Framework: Nenhum — Deno.serve() nativo. Estrutura: cada função é um arquivo isolado em base44/functions/{nome}/entry.ts. SDK: npm:@base44/sdk@0.8.25." },
  { type: "h2", text: "2.3 APIs" },
  { type: "p", text: "API Interna (SDK Base44 → REST): O SDK faz chamadas REST para {serverUrl}/api/ com header X-App-Id. Endpoints de Entidades (CRUD REST padrão): GET /api/entities/{entity} (listar), GET /api/entities/{entity}/{id}, POST /api/entities/{entity} (criar), PUT/PATCH (atualizar), DELETE, POST /bulk (bulk create), POST /bulk-update, POST /update-many, POST /delete-many, GET /schema, WS /subscribe (realtime)." },
  { type: "p", text: "Autenticação: JWT Bearer token (header Authorization) + X-App-Id. 29 entidades registradas." },
  { type: "p", text: "Backend Functions: getMediasPlanejamentos (GET/POST, user autenticado, payload: {tipo: documentos|atividades}); testEmailNotificacao (POST, admin only, payload: {to, nome, atividades})." },
  { type: "p", text: "Integrações Core: InvokeLLM (GPT-4o-mini default, Claude, Gemini), TranscribeAudio (Whisper), SendEmail, UploadFile (público), UploadPrivateFile (privado), CreateFileSignedUrl, GenerateImage, GenerateSpeech (TTS), GenerateVideo (Veo), ExtractDataFromUploadedFile." },
  { type: "h1", text: "3. Banco de Dados" },
  { type: "h2", text: "3.1 Tipo e Modelo" },
  { type: "p", text: "Tipo: Banco proprietário Base44 (NoSQL, MongoDB-like). Modelo: NoSQL orientado a documentos. Infraestrutura: Gerenciado pela plataforma (serverless, compartilhado, multi-tenant). Acesso direto: Não disponível — todo acesso via SDK/API." },
  { type: "h2", text: "3.2 Lista de Entidades (29)" },
  { type: "p", text: "1. User (built-in) — perfil, playlist_atividades. 2. Usuario — nome, email, cargo, departamento, perfil, equipe_id. 3. Equipe — nome, cor, descricao. 4. Empreendimento — nome, cliente, endereco, os, status, etapas, disciplinas_checklist. 5. Disciplina — nome, cor, icone, codisciplinas. 6. Pavimento — nome, area, escala, empreendimento_id. 7. Documento — numero, arquivo, empreendimento_id, disciplina, tempos por etapa. 8. Atividade — etapa, disciplina, subdisciplina, atividade, tempo, funcao." },
  { type: "p", text: "9. AtividadeGenerica — nome, perfis. 10. AtividadeFuncao — funcao, atividade, frequencia, tempo_estimado. 11. PlanejamentoAtividade — descritivo, executores, tempo_planejado, status, datas, horas_por_dia. 12. PlanejamentoDocumento — documento_id, executores, tempo_planejado, status. 13. Execucao — planejamento_id, usuario, inicio, termino, tempo_total, status. 14. SobraUsuario — usuario, empreendimento_id, horas_sobra. 15. Comercial — numero, cliente, empreendimento, tipo_empreendimento, disciplinas, pavimentos." },
  { type: "p", text: "16. ControleOS. 17. OSManual. 18. ItemPRE — empreendimento_id, item, data, descritiva, disciplina, status, imagens. 19. AtaReuniao — assunto, data, participantes, providencias[]. 20. ChecklistPlanejamento — tipo, empreendimento_id, tecnico_responsavel, periodos, status. 21. ChecklistItem — checklist_id, secao, numero_item, descricao, status_por_periodo. 22. DataCadastro — empreendimento_id, ordem, documento_id, datas{}. 23. NotificacaoAtividade — usuario_email, atividade_funcao_id, status." },
  { type: "p", text: "24. AlteracaoEtapa. 25. AtividadesDoProjeto. 26. AtividadesEmpreendimento. 27. HistoricoAtividade. 28. TipoObra. 29. Escopo." },
  { type: "h2", text: "3.3 Diagrama ER (Relacionamentos Lógicos)" },
  { type: "p", text: "User → Usuario (1:1 por email) → Equipe (N:1 via equipe_id)." },
  { type: "p", text: "Empreendimento → Pavimento (1:N), Documento (1:N), Atividade (1:N), ItemPRE (1:N), ChecklistPlanejamento (1:N), DataCadastro (1:N), SobraUsuario (1:N), PlanejamentoAtividade (1:N), PlanejamentoDocumento (1:N) — todos via empreendimento_id." },
  { type: "p", text: "Documento → Atividade (1:N via documento_ids[]), PlanejamentoDocumento (1:N via documento_id), DataCadastro (1:N via documento_id), ItemPRE (N:N via documentos_vinculados[])." },
  { type: "p", text: "ChecklistPlanejamento → ChecklistItem (1:N via checklist_id). Atividade → PlanejamentoAtividade (1:N via atividade_id). AtividadeFuncao → NotificacaoAtividade (1:N via atividade_funcao_id). PlanejamentoAtividade → Execucao (1:N via planejamento_id). ItemPRE → ChecklistItem (1:1 via pre_item_id)." },
  { type: "h2", text: "3.4 Campos Built-in (todas as entidades)" },
  { type: "p", text: "id (string/ObjectId, PK), created_date (date-time), updated_date (date-time), created_by (string/email)." },
  { type: "h2", text: "3.5 Row-Level Security (RLS)" },
  { type: "p", text: "Empreendimento: read pública, write criador+admin+lider+coordenador+gestao+direcao. PlanejamentoAtividade: read/write executor ou executores[] contém user + perfis elevados. PlanejamentoDocumento: read pública, write executor+perfis. Usuario: read pública, write admin+lider+direcao. SobraUsuario: admin apenas. Disciplina: read pública, write admin+lider. Pavimento: read admin+lider+user, write criador+admin+lider. Comercial: read pública, write admin+lider+direcao+gestao." },
  { type: "h1", text: "4. Infraestrutura e Hospedagem" },
  { type: "p", text: "Frontend (SPA): Base44 managed hosting — build Vite servido como estáticos via CDN. Backend Functions: Deno Deploy (serverless, edge runtime, cold-start ~ms). Banco de Dados: Base44 managed DB (MongoDB-like, multi-tenant, sem acesso direto). File Storage: Base44 managed storage (S3-compatible, público e privado com signed URLs). Auth: Base44 Auth Service (JWT, OAuth2)." },
  { type: "p", text: "Escalabilidade: Automática (serverless). Funções escalam para zero. DB compartilhado. Balanceamento: Gerenciado pela Base44 (API Gateway). CDN: Sim. Cache: Implícito na plataforma + retry com backoff manual. Logs: Dashboard Base44. Monitoramento: Dashboard Base44 (sem Sentry/Datadog)." },
  { type: "p", text: "Ambientes: Desenvolvimento = sandbox do builder. Homologação não separada. Produção = deploy ao publicar via dashboard." },
  { type: "h1", text: "5. Dependências com Base44" },
  { type: "p", text: "O sistema depende da Base44 para funcionar: SIM, integralmente. Módulos proprietários: SDK (@base44/sdk), vite-plugin, API Gateway, Entity Engine, Auth Service, Storage, Functions Runtime, Realtime. Existe lock-in: SIM, alto vendor lock-in." },
  { type: "p", text: "Código exportável: Parcialmente — frontend (React/JSX) é exportável; backend e banco dependem da plataforma. Banco exportável: Não diretamente — sem ferramenta nativa, dados acessíveis apenas via API CRUD. APIs dependem da plataforma: SIM — SDK faz chamadas a {serverUrl}/api/ que só existe na Base44." },
  { type: "h2", text: "Matriz de Dependência" },
  { type: "p", text: "Frontend React (21 páginas, 159 componentes): Dependência Média, Pode Migrar Sim, Complexidade Alta." },
  { type: "p", text: "Backend Functions (2 funções Deno): Dependência Alta, Pode Migrar Sim, Complexidade Média." },
  { type: "p", text: "Banco de Dados (29 entidades): Dependência Alta, Pode Migrar Sim, Complexidade Alta." },
  { type: "p", text: "Autenticação: Dependência Total, Não diretamente, Complexidade Alta." },
  { type: "p", text: "File Storage: Dependência Total, Pode Migrar Sim, Complexidade Média." },
  { type: "p", text: "Realtime (WebSocket): Dependência Total, Pode Migrar Sim, Complexidade Média." },
  { type: "p", text: "Integrações (LLM, Email, TTS): Dependência Alta, Pode Migrar Sim, Complexidade Baixa." },
  { type: "p", text: "RLS (declarativa): Dependência Alta, Pode Migrar Sim, Complexidade Alta." },
  { type: "h1", text: "6. Extração Completa da Aplicação" },
  { type: "h2", text: "6.1 Código" },
  { type: "p", text: "Como exportar: código-fonte completo no repositório/sandbox. Estrutura: src/pages (21 JSX), src/components (159 JSX), src/api (base44Client, entities, integrations), src/lib (AuthContext, app-params), src/hooks, base44/entities (29 .jsonc), base44/functions (2 entry.ts), package.json, vite.config.js, tailwind.config.js, index.html." },
  { type: "p", text: "Não exportável como código: runtime do SDK (@base44/sdk — pacote npm mas depende do servidor), API Gateway/Entity Engine (infraestrutura), configurações internas (apenas via dashboard)." },
  { type: "h2", text: "6.2 Banco de Dados" },
  { type: "p", text: "Como extrair: Base44 não oferece ferramenta nativa. Extração via API CRUD programaticamente — para cada entidade, paginar (list com skip/limit de 500), acumular registros, salvar como JSON. Limitações: rate limiting agressivo (já implementado retryWithBackoff com 3 retries e backoff exponencial), sem acesso direto ao MongoDB (não é possível mongodump), volume indisponível." },
  { type: "h2", text: "6.3 Arquivos" },
  { type: "p", text: "Uploads públicos: URLs em campos de entidade (foto_url, imagens[]) — scraping + download HTTP. Uploads privados: file_uri requer signed URL via CreateFileSignedUrl. Imagens AI: URLs estáticas, baixar diretamente." },
  { type: "h2", text: "6.4 Configurações" },
  { type: "p", text: "VITE_BASE44_APP_ID: import.meta.env / localStorage — dashboard Base44. VITE_BASE44_BACKEND_URL: import.meta.env — dashboard. RESEND_API_KEY: secrets da Base44 — re-obter em resend.com. Auth settings: dashboard — reconfigurar. Public settings: dashboard — reconfigurar manualmente." },
  { type: "h2", text: "6.5 Checklist de Extração" },
  { type: "p", text: "[x] Código frontend exportado. [x] Esquemas de entidades exportados. [x] Funções backend exportadas. [ ] Dados exportados via API CRUD (requer script). [ ] Arquivos extraídos (requer scraping). [ ] Secrets re-obtidos. [ ] Nova infraestrutura criada. [ ] Deploy validado." },
  { type: "h1", text: "7. Plano de Migração" },
  { type: "h2", text: "Opção 1: Frontend + Backend Node.js + PostgreSQL" },
  { type: "p", text: "Arquitetura: React SPA (Vercel/Netlify) + Node.js/Express API (Render/Railway) + PostgreSQL (Neon/Supabase). Mudanças: reescrever base44Client → Axios; 29 schemas JSON → Prisma/SQL; reimplementar RLS em middleware; portar 2 funções Deno → Express; reimplementar auth com JWT ou Supabase Auth; reimplementar realtime; substituir integrações Core por chamadas diretas. Custos: $0-50/mês (free tier) a $100-200/mês. Complexidade: Alta. Tempo: 6-10 semanas." },
  { type: "h2", text: "Opção 2: AWS" },
  { type: "p", text: "Arquitetura: S3+CloudFront (frontend) + Lambda+API Gateway (backend) + RDS PostgreSQL (DB) + Cognito (auth) + S3 (storage). Custos: $50-150/mês. Complexidade: Muito Alta. Tempo: 8-12 semanas." },
  { type: "h2", text: "Opção 3: Azure" },
  { type: "p", text: "Arquitetura: Azure Static Web Apps + Azure Functions + Azure Database for PostgreSQL + Azure AD B2C + Blob Storage. Custos: $50-150/mês. Complexidade: Muito Alta. Tempo: 8-12 semanas." },
  { type: "h2", text: "Opção 4: Google Cloud" },
  { type: "p", text: "Arquitetura: Firebase Hosting + Cloud Run/Functions + Cloud SQL PostgreSQL + Firebase Auth + Cloud Storage. Custos: $50-150/mês. Complexidade: Alta. Tempo: 7-10 semanas." },
  { type: "h2", text: "Opção 5: VPS Própria (Recomendada)" },
  { type: "p", text: "Arquitetura: Docker Compose na VPS — Nginx (frontend) + Node.js container (Express) + PostgreSQL container + MinIO (storage) + Supabase self-hosted ou Keycloak (auth). Custos: $20-60/mês (Hetzner/DigitalOcean 4-8GB). Complexidade: Alta mas controlável. Tempo: 6-8 semanas." },
  { type: "h1", text: "8. DevOps e Deploy" },
  { type: "p", text: "Processo atual: Build via Vite (vite build com @base44/vite-plugin). Deploy frontend automático ao publicar via dashboard Base44. Deploy backend functions automático ao salvar entry.ts. CI/CD não configurado. Pipelines: nenhum. Variáveis: import.meta.env.VITE_* (frontend) + Deno.env.get() (backend). Secrets: dashboard Base44 → Settings → Environment Variables." },
  { type: "h2", text: "Dockerfile (para migração)" },
  { type: "p", text: "Build stage: FROM node:20-alpine, npm ci, npm run build. Production stage: FROM nginx:alpine, COPY dist para nginx/html, EXPOSE 80." },
  { type: "h2", text: "Docker Compose (para VPS)" },
  { type: "p", text: "Services: frontend (nginx:alpine, port 80/443), api (node container, port 3000, env DATABASE_URL/JWT_SECRET/RESEND_API_KEY/OPENAI_API_KEY/S3_*), db (postgres:16-alpine, volume pgdata), minio (minio/minio, ports 9000-9001, volume miniodata)." },
  { type: "h1", text: "9. Segurança" },
  { type: "h2", text: "9.1 Autenticação" },
  { type: "p", text: "Mecanismo: JWT gerenciado pela Base44. Provedor: Base44 Auth Service (OAuth2 compatível). Token storage: localStorage (access_token). Expiração: gerenciada pela plataforma. Login flow: redirect para página Base44 → callback com access_token na URL → localStorage → removido da URL. MFA: indisponível." },
  { type: "h2", text: "9.2 Autorização" },
  { type: "p", text: "Modelo: RBAC + RLS. Perfis: admin, lider, coordenador, user, gestao, apoio, direcao, consultor. Hierarquia: admin > direcao > lider > gestao > coordenador > consultor > apoio > user. Permissões via hasPermission() no frontend (níveis 1-4) + RLS no backend (JSON declarativo). Admin functions verificam user.role === admin." },
  { type: "h2", text: "9.3 Sessão e Criptografia" },
  { type: "p", text: "Sessão: JWT stateless. HTTPS: garantido pela plataforma. TLS em trânsito. Criptografia em repouso: gerenciado pela plataforma (provável). Senhas: gerenciado pela Base44 Auth." },
  { type: "h2", text: "9.4 Backup e Logs" },
  { type: "p", text: "Backup: gerenciado pela Base44 (sem controle do usuário) — risco: sem backup exportável. Logs: dashboard Base44 → Functions → Logs. Audit trail: entidade HistoricoAtividade (parcial). Monitoramento de erros: nenhum (Sentry não configurado)." },
  { type: "h2", text: "9.5 Vulnerabilidades" },
  { type: "p", text: "1. Token em localStorage (vulnerável a XSS). 2. Sem MFA. 3. Rate limiting manual sem throttling no cliente. 4. SendSMS importado mas inexistente (código morto em integrations.js)." },
  { type: "h1", text: "10. Documentação Final" },
  { type: "h2", text: "10.1 Resumo" },
  { type: "p", text: "Project Management é uma aplicação SPA React 18 hospedada integralmente na plataforma Base44 (BaaS serverless). Frontend: 21 páginas, 159 componentes, Vite. Backend: 2 funções Deno Deploy. Database: NoSQL MongoDB-like, 29 entidades, RLS declarativa. Auth: JWT/OAuth2. Stack: React + Tailwind + shadcn/ui + TanStack Query + react-router-dom. Alto vendor lock-in." },
  { type: "h2", text: "10.8 Riscos Técnicos" },
  { type: "p", text: "Lock-in Base44: Severidade Alta. Sem backup exportável: Alto. Rate limiting agressivo: Médio. 29 entidades sem FKs físicas: Médio. RLS declarativa complexa: Médio. Realtime via WebSocket: Médio. Auth migrada: Alto. Funções Deno → Node: Baixo. Sem CI/CD: Médio. Sem monitoramento: Baixo." },
  { type: "h2", text: "10.9 Estimativa de Esforço" },
  { type: "p", text: "Análise: 1 semana. Camada de dados (29 entidades → SQL): 2-3 sem. API client: 2 sem. Backend functions: 0.5 sem. Auth: 1-2 sem. Realtime: 1 sem. Storage: 0.5 sem. Integrações: 1 sem. RLS: 1-2 sem. Migração de dados: 1 sem. Deploy+CI/CD: 1 sem. Testes: 1-2 sem. Total: 12-16 semanas (1 dev sênior)." },
  { type: "h2", text: "Informações Indisponíveis" },
  { type: "p", text: "Volume exato de dados: descobrir via dashboard Analytics ou script de contagem. Configurações do app: dashboard Settings. Detalhes internos da infra Base44: não acessível (proprietário). Limite exato de rate limiting: teste de carga. Estrutura física do MongoDB: não acessível. Número de usuários: dashboard Users ou base44.entities.User.list()." },
];

export default function DocumentacaoTecnica() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 48;
      const maxWidth = pageWidth - margin * 2;
      let y = margin;

      const addPageIfNeeded = (neededHeight) => {
        if (y + neededHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const addText = (text, fontSize, fontStyle, color, lineHeight = 1.35) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", fontStyle);
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(text, maxWidth);
        const lineHeightPx = fontSize * lineHeight;
        for (const line of lines) {
          addPageIfNeeded(lineHeightPx);
          doc.text(line, margin, y);
          y += lineHeightPx;
        }
      };

      for (const block of DOC_CONTENT) {
        switch (block.type) {
          case "title":
            y += 10;
            addText(block.text, 22, "bold", [15, 23, 42], 1.3);
            y += 6;
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, y, pageWidth - margin, y);
            y += 16;
            break;
          case "subtitle":
            addText(block.text, 13, "normal", [100, 116, 139], 1.3);
            y += 6;
            break;
          case "meta":
            addText(block.text, 10, "italic", [120, 120, 120], 1.3);
            y += 18;
            break;
          case "h1":
            y += 8;
            addPageIfNeeded(40);
            addText(block.text, 16, "bold", [15, 23, 42], 1.3);
            y += 8;
            break;
          case "h2":
            y += 4;
            addText(block.text, 12, "bold", [37, 99, 235], 1.3);
            y += 4;
            break;
          case "p":
            addText(block.text, 10, "normal", [51, 65, 85], 1.4);
            y += 6;
            break;
          default:
            break;
        }
      }

      // Footer com numeração
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Project Management — Documentação Técnica   |   Página ${i} de ${pageCount}`,
          pageWidth / 2,
          pageHeight - 20,
          { align: "center" }
        );
      }

      doc.save("Documentacao_Tecnica_Project_Management.pdf");
      setIsGenerating(false);
    }, 100);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentação Técnica</h1>
          <p className="text-sm text-gray-500">
            Análise completa de arquitetura e plano de migração da aplicação
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Resumo do Documento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p><strong className="text-gray-900">Aplicação:</strong> Project Management (Base44)</p>
          <p><strong className="text-gray-900">Seções:</strong> 10 seções (Arquitetura, Stack, Banco de Dados, Infraestrutura, Dependências, Extração, Migração, DevOps, Segurança, Documentação Final)</p>
          <p><strong className="text-gray-900">Entidades analisadas:</strong> 29</p>
          <p><strong className="text-gray-900">Páginas frontend:</strong> 21</p>
          <p><strong className="text-gray-900">Componentes:</strong> 159</p>
          <p><strong className="text-gray-900">Funções backend:</strong> 2 (Deno Deploy)</p>
          <p><strong className="text-gray-900">Estimativa de migração:</strong> 12–16 semanas (1 dev sênior)</p>
        </CardContent>
      </Card>

      <Button
        onClick={generatePDF}
        disabled={isGenerating}
        className="w-full h-14 text-base bg-zinc-950 hover:bg-zinc-800"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Gerando PDF...
          </>
        ) : (
          <>
            <FileDown className="w-5 h-5 mr-2" />
            Baixar Documentação Técnica (PDF)
          </>
        )}
      </Button>
    </div>
  );
}