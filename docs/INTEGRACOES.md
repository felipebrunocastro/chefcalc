# Integrações e importações (Financeiro)

## O que existe

| Fonte | Como conecta | Situação |
|---|---|---|
| Square | OAuth oficial, **somente leitura** (`MERCHANT_PROFILE_READ`, `ORDERS_READ`, `PAYMENTS_READ`, `PAYOUTS_READ`) | Pronto no código; precisa ser ativado (passos abaixo) |
| DoorDash, Uber Eats, Grubhub | Importação do extrato em CSV, com prévia e mapeamento de colunas | Disponível |
| Outras plataformas | CSV genérico com mapeamento de colunas | Disponível |
| Sincronização automática DoorDash / Uber Eats / Grubhub | API de relatórios financeiros | Em desenvolvimento: as plataformas liberam esses relatórios por API só a parceiros aprovados. O app mostra "Aguardando acesso oficial". |

Os dados importados ficam em `sales_records` e `import_batches`, separados do orçamento (`restaurants.budget`) e dos custos manuais (`finance_months.entries`).

## Banco de dados
Rode `supabase/migrations/005_integrations.sql` no SQL Editor (depois da 002, 003 e 004).

## Ativar o Square

1. Em https://developer.squareup.com, crie um aplicativo e abra **OAuth**.
2. Em **Redirect URL**, cadastre:
   `https://<SEU-PROJETO>.supabase.co/functions/v1/square-oauth`
3. No Supabase, em **Edge Functions → Secrets**, crie:
   - `SQUARE_APPLICATION_ID`: o Application ID
   - `SQUARE_APPLICATION_SECRET`: o Application Secret (nunca vai para o app)
   - `SQUARE_ENV`: `production` (ou `sandbox` para testar)
   - `OAUTH_STATE_SECRET`: um texto aleatório longo
   - `APP_URL`: `https://chefcalc.vercel.app`
4. Publique as funções (CLI do Supabase):
   ```bash
   supabase functions deploy square-oauth --no-verify-jwt
   supabase functions deploy square-sync
   ```
   A `square-oauth` precisa de `--no-verify-jwt` porque o retorno do Square chega sem login. As ações dela validam o usuário por dentro.
5. No app: **Financeiro → Integrações e importações → Conectar Square**.

Os tokens ficam na tabela `integration_secrets`, que não tem política de acesso. Só as Edge Functions (service role) conseguem lê-la.

## Regras de importação
- **Prévia antes de confirmar:** unidade, período, totais normalizados, novos / atualizados / já existentes e os pontos de atenção.
- **Normalização:** vendas após descontos e devoluções, comissões, promoções custeadas pelo restaurante, outras taxas, impostos, gorjetas, ajustes e repasses.
- **Datas separadas:** data da venda e data do repasse. Uma venda de 31/10 paga em 03/11 conta nas vendas de outubro e no repasse de novembro.
- **Sem duplicar:** cada registro tem uma chave estável (fonte + tipo + nº do pedido). Reimportar o mesmo arquivo ou sincronizar períodos sobrepostos atualiza ou reconhece os registros existentes.
- **Conciliação Square × plataforma:** feita pelo nº do pedido.
  - Mesmo nº, valor e data próximos: correspondência confiável. A venda conta uma vez só, pelo extrato da plataforma.
  - Casos incertos vão para **Revisão** e ficam fora dos totais até a decisão.
- **Nomes de colunas:** os aliases de DoorDash, Uber Eats e Grubhub (`src/lib/imports/presets.ts`) cobrem nomes usuais dos relatórios. Confira com um extrato real; se algo vier diferente, corrija o mapeamento na prévia. O ChefCalc lembra o último mapeamento de cada fonte.
