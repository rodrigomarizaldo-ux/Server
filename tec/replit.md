# Workspace

## Overview

Aplicativo fullstack de gerenciamento de máquinas pesadas. Monorepo pnpm com TypeScript. Cada pacote gerencia suas próprias dependências.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (servidor auxiliar — dados de máquinas não usados pelo app)
- **Database mobile**: AsyncStorage — todos os dados (máquinas, relatórios, manutenção, pneus/combustível) são armazenados localmente no dispositivo
- **Validation**: Zod (validação de entrada/saída nas rotas)
- **API codegen**: Orval (a partir do spec OpenAPI)
- **Mobile**: Expo (React Native) com Expo Router
- **State management**: React Query (@tanstack/react-query)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # API Express (servidor auxiliar, não usado pelos dados de máquinas)
│   └── mobile/             # App Expo React Native
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # React Query hooks gerados automaticamente (não usados para máquinas)
│   ├── api-zod/            # Schemas Zod gerados do OpenAPI
│   └── db/                 # (não utilizado)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Armazenamento de Dados (AsyncStorage)

Todos os dados do app são armazenados localmente no dispositivo via `@react-native-async-storage/async-storage`.

| Chave AsyncStorage     | Conteúdo                          |
|------------------------|-----------------------------------|
| `machines_store_v1`    | Lista de máquinas cadastradas     |
| `reports_<machineId>`  | Relatórios diários da máquina     |
| `maintenance_<id>`     | Registros de manutenção           |
| `parts_<id>`           | Peças trocadas                    |
| `tires_<id>`           | Histórico de pneus/esteiras       |
| `fuel_<id>`            | Registros de abastecimento        |
| `operators_store_v1`   | Lista de operadores cadastrados   |

## Mobile App

### Telas

- **Lista de Máquinas** (`app/(tabs)/index.tsx`) — lista com busca, edição, exclusão
- **Lista de Operadores** (`app/(tabs)/operators.tsx`) — lista com busca, edição, exclusão
- **Novo Operador** (`app/operator/new.tsx`) — formulário modal para cadastro
- **Editar Operador** (`app/operator/edit/[id].tsx`) — formulário modal pré-preenchido
- **Nova Máquina** (`app/machine/new.tsx`) — formulário modal para cadastro
- **Editar Máquina** (`app/machine/edit/[id].tsx`) — formulário modal pré-preenchido
- **Relatórios Diários** (`app/machine/[id].tsx`) — relatórios por turno com status
- **Controle de Manutenção** (`app/machine/maintenance/[id].tsx`) — manutenções preventiva/corretiva e peças trocadas
- **Pneus & Combustível** (`app/machine/tires-fuel/[id].tsx`) — histórico de pneus/esteiras e abastecimentos

### Navegação

Toque no card → `ActionChoiceModal` (3 opções: Relatórios, Manutenção, Pneus & Combustível)
Ícone lápis → editar máquina (modal)
Ícone lixeira → excluir máquina (ConfirmModal)
Botão "+" → nova máquina (modal)

### Componentes principais

- `MachineCard` — card com ações absolutamente posicionadas fora do Pressable principal (evita bubbling de eventos no web)
- `MachineForm` — formulário reutilizado para criação e edição
- `ActionChoiceModal` — modal de escolha de ação ao tocar no card
- `ConfirmModal` — modal de confirmação genérico (nunca usar Alert.alert)

### Hooks de dados locais

- `hooks/useMachineStore.ts` — CRUD de máquinas via AsyncStorage, exporta: `useListMachines`, `useGetMachine`, `useCreateMachine`, `useUpdateMachine`, `useDeleteMachine`, `getListMachinesQueryKey`, `getGetMachineQueryKey`

## Pacotes

### `artifacts/api-server` (`@workspace/api-server`)

API Express 5. Rotas em `src/routes/`. Banco de dados em memória (não usado pelo app mobile).

### `artifacts/mobile` (`@workspace/mobile`)

App Expo com Expo Router (file-based routing).

- Tabs: `app/(tabs)/_layout.tsx`
- Hooks locais: `hooks/useMachineStore.ts`
- Componentes: `components/`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec em `openapi.yaml`. Rodar codegen:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Scripts úteis

- `pnpm --filter @workspace/api-server run dev` — Iniciar API
- `pnpm --filter @workspace/mobile run dev` — Iniciar app mobile
- `pnpm --filter @workspace/api-spec run codegen` — Regenerar hooks/schemas da API
