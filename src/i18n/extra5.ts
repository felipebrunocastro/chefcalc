// Painel administrativo e grupos de insumos.
const pt = {
  admin: {
    open: 'Painel administrativo', title: 'Painel administrativo', subtitle: 'Visão geral de quem usa o ChefCalc.',
    back: 'Voltar ao app', refresh: 'Atualizar', export: 'Exportar CSV', loading: 'Carregando…',
    denied: 'Acesso restrito ao administrador do app.', deniedHint: 'Se você é o dono do app, aplique a migração 007_admin.sql e cadastre sua conta em app_admins (SQL Editor do Supabase).',
    error: 'Não foi possível carregar o painel: {{msg}}', updatedAt: 'Atualizado às {{time}}',
    kpi: {
      users: 'Pessoas registradas', confirmed: '{{n}} com e-mail confirmado', new7: 'Novas em 7 dias', new30: '{{n}} em 30 dias',
      active7: 'Ativas em 7 dias', activeHint: 'Entraram no app na última semana', restaurants: 'Negócios', withRestaurant: '{{n}} pessoas com negócio',
      dishes: 'Fichas técnicas', ingredients: 'Insumos', perRestaurant: '{{n}} por negócio, em média',
    },
    search: 'Buscar por e-mail ou negócio', sort: 'Ordenar',
    sorts: { newest: 'Cadastro mais recente', oldest: 'Cadastro mais antigo', restaurants: 'Mais negócios', dishes: 'Mais fichas técnicas', active: 'Acesso mais recente' },
    col: { email: 'E-mail', signup: 'Cadastro', lastSeen: 'Último acesso', restaurants: 'Negócios', dishes: 'Fichas', ingredients: 'Insumos', shared: 'Acessos compartilhados' },
    never: 'Nunca', unconfirmed: 'E-mail não confirmado', adminBadge: 'Admin',
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
  admin: {
    open: 'Admin dashboard', title: 'Admin dashboard', subtitle: 'Overview of who uses ChefCalc.',
    back: 'Back to the app', refresh: 'Refresh', export: 'Export CSV', loading: 'Loading…',
    denied: 'Restricted to the app administrator.', deniedHint: 'If you own the app, run migration 007_admin.sql and add your account to app_admins (Supabase SQL Editor).',
    error: 'Could not load the dashboard: {{msg}}', updatedAt: 'Updated at {{time}}',
    kpi: {
      users: 'Registered people', confirmed: '{{n}} with confirmed email', new7: 'New in 7 days', new30: '{{n}} in 30 days',
      active7: 'Active in 7 days', activeHint: 'Signed in during the last week', restaurants: 'Businesses', withRestaurant: '{{n}} people with a business',
      dishes: 'Recipe cards', ingredients: 'Ingredients', perRestaurant: '{{n}} per business on average',
    },
    search: 'Search by email or business', sort: 'Sort',
    sorts: { newest: 'Newest sign-up', oldest: 'Oldest sign-up', restaurants: 'Most businesses', dishes: 'Most recipe cards', active: 'Most recent access' },
    col: { email: 'Email', signup: 'Signed up', lastSeen: 'Last access', restaurants: 'Businesses', dishes: 'Cards', ingredients: 'Ingredients', shared: 'Shared access' },
    never: 'Never', unconfirmed: 'Email not confirmed', adminBadge: 'Admin',
    showBusinesses: 'Show businesses of {{email}}', hideBusinesses: 'Hide businesses', noBusinesses: 'No businesses yet.',
    bizLine: '{{dishes}} cards · {{ingredients}} ingredients · {{members}} people with access', createdOn: 'created on {{date}}',
    count: '{{n}} of {{total}} people', empty: 'No people found.',
  },
  ingredients: {
    group: 'Group', groupPlaceholder: 'e.g. Meat & Protein', allGroups: 'All groups', noGroup: 'No group', itemsCount: '{{n}} items', noPrice: 'No price',
  },
};

const es: Dict = {
  admin: {
    open: 'Panel administrativo', title: 'Panel administrativo', subtitle: 'Resumen de quién usa ChefCalc.',
    back: 'Volver a la app', refresh: 'Actualizar', export: 'Exportar CSV', loading: 'Cargando…',
    denied: 'Acceso restringido al administrador de la app.', deniedHint: 'Si eres el dueño de la app, aplica la migración 007_admin.sql y registra tu cuenta en app_admins (SQL Editor de Supabase).',
    error: 'No se pudo cargar el panel: {{msg}}', updatedAt: 'Actualizado a las {{time}}',
    kpi: {
      users: 'Personas registradas', confirmed: '{{n}} con correo confirmado', new7: 'Nuevas en 7 días', new30: '{{n}} en 30 días',
      active7: 'Activas en 7 días', activeHint: 'Entraron a la app en la última semana', restaurants: 'Negocios', withRestaurant: '{{n}} personas con negocio',
      dishes: 'Fichas técnicas', ingredients: 'Insumos', perRestaurant: '{{n}} por negocio, en promedio',
    },
    search: 'Buscar por correo o negocio', sort: 'Ordenar',
    sorts: { newest: 'Registro más reciente', oldest: 'Registro más antiguo', restaurants: 'Más negocios', dishes: 'Más fichas técnicas', active: 'Acceso más reciente' },
    col: { email: 'Correo', signup: 'Registro', lastSeen: 'Último acceso', restaurants: 'Negocios', dishes: 'Fichas', ingredients: 'Insumos', shared: 'Accesos compartidos' },
    never: 'Nunca', unconfirmed: 'Correo no confirmado', adminBadge: 'Admin',
    showBusinesses: 'Ver negocios de {{email}}', hideBusinesses: 'Ocultar negocios', noBusinesses: 'Ningún negocio registrado.',
    bizLine: '{{dishes}} fichas · {{ingredients}} insumos · {{members}} personas con acceso', createdOn: 'creado el {{date}}',
    count: '{{n}} de {{total}} personas', empty: 'No se encontraron personas.',
  },
  ingredients: {
    group: 'Grupo', groupPlaceholder: 'ej.: Carnes y Proteínas', allGroups: 'Todos los grupos', noGroup: 'Sin grupo', itemsCount: '{{n}} artículos', noPrice: 'Sin precio',
  },
};

export const extra5 = { pt, en, es };
