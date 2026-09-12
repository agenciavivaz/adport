# Incorporação do upstream Adport

> PRD §3. Registro de proveniência, licença e patches do upstream Adport.

## Referência upstream

- **Repositório:** https://github.com/ynnickw/adport [S1]
- **Licença:** Apache License 2.0 [S4]
- **Docs de deployment/gates:** https://github.com/ynnickw/adport/blob/main/docs/deployment-model.md [S2]
- **Semântica de relatórios:** https://github.com/ynnickw/adport/blob/main/docs/reporting-semantics.md [S3]

## Commit fixado

| Campo | Valor |
|---|---|
| SHA | **PENDENTE** — não fixado nesta sessão |
| Data | — |
| Licença verificada | Apache-2.0 (declarada no repositório upstream) |
| Patches aplicados | nenhum ainda |

### Por que está pendente

O escopo de acesso GitHub desta sessão é limitado a `agenciavivaz/adport`. O
upstream `ynnickw/adport` pertence a outro proprietário e não pôde ser clonado /
inspecionado aqui. Fixar o SHA e inventariar `apps/cloud`, `packages/core`,
pacotes Google/Meta e migrations **exige uma das ações do proprietário**:

1. Criar fork/repositório derivado privado do upstream sob o proprietário do projeto
   (PRD §3.2), preservando histórico e proveniência; **ou**
2. Conceder acesso de leitura ao upstream a esta automação para inspeção e pin.

Enquanto isso, o produto foi construído com a **fronteira de integração isolada**
em `packages/adport-adapter`, de modo que UI e domínio comercial não importam
implementações de provedor diretamente (PRD §3.2). A incorporação do código real
entra depois, por PR com testes de contrato e regressão (PRD §3.2), sem alterar
a arquitetura de domínio já construída.

## Estratégia de incorporação (quando o acesso existir)

- [ ] Fixar SHA real após inspeção e preencher a tabela acima.
- [ ] Inventariar dependências e licenças de `apps/cloud`, `packages/core`,
      `packages/google`, `packages/meta`, `supabase/migrations`.
- [ ] Reutilizar OAuth/cofre/tool-registry **somente após** verificar adequação
      ao modelo agência→cliente (PRD §3.2, §4).
- [ ] Adaptar cofre e runtime de credenciais ao escopo de cliente (ADR-0004).
- [ ] Mapear tabelas equivalentes (evitar duplicar conceitos — PRD §13).
- [ ] Identificar arquivos modificados (Apache-2.0 §4b) e manter `NOTICE`.

## Matriz de responsabilidade (PRD §3.3)

| Componente | Estratégia neste projeto |
|---|---|
| Integração Google/Meta | Reutilizar pacotes upstream via `packages/google` / `packages/meta`; completar campos por extensões documentadas do adapter |
| OAuth e cofre cloud | Reaproveitar contratos; adaptar escopo e operação hospedada (ADR-0004) |
| Tool registry / política de alterações | Reutilizar; restringir capacidades por fase e papel |
| Dashboard genérico | Evoluir para experiência de agência, sem duplicar a aplicação |
| Cliente/portal/grants | Construído explicitamente neste repositório (`packages/domain`, migrations) |
| Cobrança/quotas/super admin | Domínio próprio (`packages/domain`, migrations de plataforma) |
| Métricas / histórico analítico | Construído (`packages/metrics`, fase 1.3+) |
| CRM/identidade/atribuição/retenção | Módulos independentes de ads (fases 2.x) |
