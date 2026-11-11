// Painel administrativo e grupos de insumos.
const pt = {
  restaurants: {
    deleteTitle: 'Excluir restaurante', deleting: 'Excluindo…', deleteConfirmBtn: 'Excluir restaurante',
    deleteWarn: '“{{name}}” vai sair da sua lista de restaurantes.',
    deleteKeep: 'Fichas técnicas, insumos, finanças, caixa e vendas ficam guardados por {{days}} dias. Nesse prazo você pode reativar tudo em “Excluídos recentemente”. Depois disso, os dados são apagados definitivamente.',
    deleteShared: 'Quem tem acesso compartilhado perde o acesso imediatamente.',
    typeToConfirm: 'Para confirmar, digite o nome do restaurante:', nameMismatch: 'O nome precisa ser igual, inclusive acentos.',
    trashTitle: 'Excluídos recentemente', trashHint: 'Ficam guardados por {{days}} dias e podem ser reativados com todos os dados.',
    deletedOn: 'Excluído em {{date}}', daysLeft_one: 'Apagado definitivamente em {{count}} dia', daysLeft_other: 'Apagado definitivamente em {{count}} dias',
    restore: 'Reativar', restored: '“{{name}}” foi reativado com todos os dados.', restoreExpired: 'O prazo de 90 dias terminou e o restaurante já foi apagado definitivamente.',
  },
  admin: {
    open: 'Painel administrativo', title: 'Painel administrativo', subtitle: 'Visão geral de quem usa o ChefCalc.',
    back: 'Voltar ao app', refresh: 'Atualizar', export: 'Exportar CSV', loading: 'Carregando…',
    denied: 'Acesso restrito ao administrador do app.', deniedHint: 'Se você é o dono do app, aplique a migração 007_admin.sql e cadastre sua conta em app_admins (SQL Editor do Supabase).',
    error: 'Não foi possível carregar o painel: {{msg}}', updatedAt: 'Atualizado às {{time}}',
    kpi: {
      users: 'Pessoas registradas', confirmed: '{{n}} com e-mail confirmado', new7: 'Novas em 7 dias', new30: '{{n}} em 30 dias',
      active7: 'Ativas em 7 dias', activeHint: 'Entraram no app na última semana', restaurants: 'Negócios', withRestaurant: '{{n}} pessoas com negócio',
      dishes: 'Fichas técnicas', ingredients: 'Insumos', perRestaurant: '{{n}} por negócio, em média', inTrash: '{{n}} na lixeira',
    },
    search: 'Buscar por e-mail ou negócio', sort: 'Ordenar',
    sorts: { newest: 'Cadastro mais recente', oldest: 'Cadastro mais antigo', restaurants: 'Mais negócios', dishes: 'Mais fichas técnicas', active: 'Acesso mais recente' },
    col: { email: 'E-mail', signup: 'Cadastro', lastSeen: 'Último acesso', restaurants: 'Negócios', dishes: 'Fichas', ingredients: 'Insumos', shared: 'Acessos compartilhados' },
    never: 'Nunca', unconfirmed: 'E-mail não confirmado', adminBadge: 'Admin', inTrashBadge: 'Excluído',
    showBusinesses: 'Ver negócios de {{email}}', hideBusinesses: 'Ocultar negócios', noBusinesses: 'Nenhum negócio cadastrado.',
    bizLine: '{{dishes}} fichas · {{ingredients}} insumos · {{members}} pessoas com acesso', createdOn: 'criado em {{date}}',
    count: '{{n}} de {{total}} pessoas', empty: 'Nenhuma pessoa encontrada.',
  },
  ingredients: {
    group: 'Grupo', groupPlaceholder: 'ex.: Carnes y Proteínas', allGroups: 'Todos os grupos', noGroup: 'Sem grupo', itemsCount: '{{n}} itens', noPrice: 'Sem preço',
  },
};

type Dict = typeof pt;

const en: Dict = {
  restaurants: {
    deleteTitle: 'Delete restaurant', deleting: 'Deleting…', deleteConfirmBtn: 'Delete restaurant',
    deleteWarn: '“{{name}}” will be removed from your restaurants.',
    deleteKeep: 'Recipe cards, ingredients, finance, cash register and sales are kept for {{days}} days. During that time you can restore everything from “Recently deleted”. After that, the data is permanently erased.',
    deleteShared: 'People with shared access lose access immediately.',
    typeToConfirm: 'To confirm, type the restaurant name:', nameMismatch: 'The name must match exactly, including accents.',
    trashTitle: 'Recently deleted', trashHint: 'Kept for {{days}} days and can be restored with all data.',
    deletedOn: 'Deleted on {{date}}', daysLeft_one: 'Permanently erased in {{count}} day', daysLeft_other: 'Permanently erased in {{count}} days',
    restore: 'Restore', restored: '“{{name}}” was restored with all its data.', restoreExpired: 'The 90-day period ended and the restaurant was permanently erased.',
  },
  admin: {
    open: 'Admin dashboard', title: 'Admin dashboard', subtitle: 'Overview of who uses ChefCalc.',
    back: 'Back to the app', refresh: 'Refresh', export: 'Export CSV', loading: 'Loading…',
    denied: 'Restricted to the app administrator.', deniedHint: 'If you own the app, run migration 007_admin.sql and add your account to app_admins (Supabase SQL Editor).',
    error: 'Could not load the dashboard: {{msg}}', updatedAt: 'Updated at {{time}}',
    kpi: {
      users: 'Registered people', confirmed: '{{n}} with confirmed email', new7: 'New in 7 days', new30: '{{n}} in 30 days',
      active7: 'Active in 7 days', activeHint: 'Signed in during the last week', restaurants: 'Businesses', withRestaurant: '{{n}} people with a business',
      dishes: 'Recipe cards', ingredients: 'Ingredients', perRestaurant: '{{n}} per business on average', inTrash: '{{n}} in trash',
    },
    search: 'Search by email or business', sort: 'Sort',
    sorts: { newest: 'Newest sign-up', oldest: 'Oldest sign-up', restaurants: 'Most businesses', dishes: 'Most recipe cards', active: 'Most recent access' },
    col: { email: 'Email', signup: 'Signed up', lastSeen: 'Last access', restaurants: 'Businesses', dishes: 'Cards', ingredients: 'Ingredients', shared: 'Shared access' },
    never: 'Never', unconfirmed: 'Email not confirmed', adminBadge: 'Admin', inTrashBadge: 'Deleted',
    showBusinesses: 'Show businesses of {{email}}', hideBusinesses: 'Hide businesses', noBusinesses: 'No businesses yet.',
    bizLine: '{{dishes}} cards · {{ingredients}} ingredients · {{members}} people with access', createdOn: 'created on {{date}}',
    count: '{{n}} of {{total}} people', empty: 'No people found.',
  },
  ingredients: {
    group: 'Group', groupPlaceholder: 'e.g. Meat & Protein', allGroups: 'All groups', noGroup: 'No group', itemsCount: '{{n}} items', noPrice: 'No price',
  },
};

const es: Dict = {
  restaurants: {
    deleteTitle: 'Eliminar restaurante', deleting: 'Eliminando…', deleteConfirmBtn: 'Eliminar restaurante',
    deleteWarn: '“{{name}}” saldrá de tu lista de restaurantes.',
    deleteKeep: 'Fichas técnicas, insumos, finanzas, caja y ventas se guardan por {{days}} días. En ese plazo puedes reactivar todo en “Eliminados recientemente”. Después, los datos se borran definitivamente.',
    deleteShared: 'Quienes tienen acceso compartido lo pierden de inmediato.',
    typeToConfirm: 'Para confirmar, escribe el nombre del restaurante:', nameMismatch: 'El nombre debe ser igual, incluidos los acentos.',
    trashTitle: 'Eliminados recientemente', trashHint: 'Se guardan por {{days}} días y se pueden reactivar con todos los datos.',
    deletedOn: 'Eliminado el {{date}}', daysLeft_one: 'Se borra definitivamente en {{count}} día', daysLeft_other: 'Se borra definitivamente en {{count}} días',
    restore: 'Reactivar', restored: '“{{name}}” se reactivó con todos sus datos.', restoreExpired: 'El plazo de 90 días terminó y el restaurante ya se borró definitivamente.',
  },
  admin: {
    open: 'Panel administrativo', title: 'Panel administrativo', subtitle: 'Resumen de quién usa ChefCalc.',
    back: 'Volver a la app', refresh: 'Actualizar', export: 'Exportar CSV', loading: 'Cargando…',
    denied: 'Acceso restringido al administrador de la app.', deniedHint: 'Si eres el dueño de la app, aplica la migración 007_admin.sql y registra tu cuenta en app_admins (SQL Editor de Supabase).',
    error: 'No se pudo cargar el panel: {{msg}}', updatedAt: 'Actualizado a las {{time}}',
    kpi: {
      users: 'Personas registradas', confirmed: '{{n}} con correo confirmado', new7: 'Nuevas en 7 días', new30: '{{n}} en 30 días',
      active7: 'Activas en 7 días', activeHint: 'Entraron a la app en la última semana', restaurants: 'Negocios', withRestaurant: '{{n}} personas con negocio',
      dishes: 'Fichas técnicas', ingredients: 'Insumos', perRestaurant: '{{n}} por negocio, en promedio', inTrash: '{{n}} en la papelera',
    },
    search: 'Buscar por correo o negocio', sort: 'Ordenar',
    sorts: { newest: 'Registro más reciente', oldest: 'Registro más antiguo', restaurants: 'Más negocios', dishes: 'Más fichas técnicas', active: 'Acceso más reciente' },
    col: { email: 'Correo', signup: 'Registro', lastSeen: 'Último acceso', restaurants: 'Negocios', dishes: 'Fichas', ingredients: 'Insumos', shared: 'Accesos compartidos' },
    never: 'Nunca', unconfirmed: 'Correo no confirmado', adminBadge: 'Admin', inTrashBadge: 'Eliminado',
    showBusinesses: 'Ver negocios de {{email}}', hideBusinesses: 'Ocultar negocios', noBusinesses: 'Ningún negocio registrado.',
    bizLine: '{{dishes}} fichas · {{ingredients}} insumos · {{members}} personas con acceso', createdOn: 'creado el {{date}}',
    count: '{{n}} de {{total}} personas', empty: 'No se encontraron personas.',
  },
  ingredients: {
    group: 'Grupo', groupPlaceholder: 'ej.: Carnes y Proteínas', allGroups: 'Todos los grupos', noGroup: 'Sin grupo', itemsCount: '{{n}} artículos', noPrice: 'Sin precio',
  },
};

export const extra5 = { pt, en, es };
