const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const BOOKINGS_DIR = path.join(DATA_DIR, 'bookings');
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const VALID_STATUSES = ['novo', 'em_contato', 'agendado', 'concluido', 'cancelado'];
const VALID_TX_TYPES = ['receita', 'despesa'];
const VALID_TX_STATUSES = ['pago', 'pendente'];
const VALID_PAYMENT_METHODS = ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Transferência'];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BOOKINGS_DIR)) fs.mkdirSync(BOOKINGS_DIR, { recursive: true });
  if (!fs.existsSync(WORKSPACES_DIR)) fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]', 'utf-8');
  if (!fs.existsSync(FEEDBACK_FILE)) fs.writeFileSync(FEEDBACK_FILE, '[]', 'utf-8');
  if (!fs.existsSync(SECRET_FILE)) {
    fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'), 'utf-8');
  }
}

let cachedSecret = null;
function getTokenSecret() {
  if (!cachedSecret) {
    ensureStorage();
    cachedSecret = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
  }
  return cachedSecret;
}

function readUsers() {
  ensureStorage();
  try {
    const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  ensureStorage();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, 64).toString('hex');
  return { salt: s, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Signed per-user token (HMAC-SHA256)
function createAuthToken(email) {
  const payload = Buffer.from(JSON.stringify({ email, iat: Date.now() }), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!data || !data.email) return null;
    const users = readUsers();
    if (!users.some((u) => u.email === data.email)) return null;
    return data.email;
  } catch {
    return null;
  }
}

function getAuthenticatedEmail(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return verifyAuthToken(header.slice(7).trim());
}

// Per-user isolated bookings store: data/bookings/<sha256(email)>.json
function getUserBookingsPath(email) {
  ensureStorage();
  const key = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32);
  return path.join(BOOKINGS_DIR, `${key}.json`);
}

function readUserBookings(email) {
  const fp = getUserBookingsPath(email);
  if (!fs.existsSync(fp)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUserBookings(email, bookings) {
  const fp = getUserBookingsPath(email);
  fs.writeFileSync(fp, JSON.stringify(bookings, null, 2), 'utf-8');
}

// Per-user isolated clinic workspace store: data/workspaces/<sha256(email)>.json
function getUserWorkspacePath(email) {
  ensureStorage();
  const key = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32);
  return path.join(WORKSPACES_DIR, `${key}.json`);
}

function makeDefaultWorkspace() {
  return {
    settings: {
      clinicName: 'Clínica de Estética',
      whatsapp: '(11) 98489-4031',
      address: 'Espaço Wellness · Salas 401 a 404, Torre 1',
      hours: 'Segunda a Sexta · 09h às 12h e 14h às 18h',
      instagram: '@clinicaestetica',
      waGreeting: 'Olá {nome}, tudo bem? Aqui é da {clinica}.',
    },
    team: [
      {
        id: 'pro_helena',
        nome: 'Dra. Helena Martins',
        especialidade: 'Biomédica Esteta · Injetáveis e Colágeno',
        sala: 'Sala 401',
        dias: 'Seg, Ter, Qua, Sex',
        ativo: true,
      },
      {
        id: 'pro_beatriz',
        nome: 'Dra. Beatriz Souza',
        especialidade: 'Tecnologias, Laser & Rejuvenescimento',
        sala: 'Sala 402',
        dias: 'Seg a Sex',
        ativo: true,
      },
      {
        id: 'pro_lucas',
        nome: 'Lucas Andrade',
        especialidade: 'Terapia Capilar & Estética Corporal',
        sala: 'Sala 403',
        dias: 'Ter, Qui, Sex',
        ativo: true,
      },
    ],
    services: [
      {
        id: 'srv_bioestimulador',
        nome: 'Bioestimulador de Colágeno',
        categoria: 'Banco de Colágeno',
        duracaoMin: 60,
        preco: 1850,
        retornoDias: 45,
        ativo: true,
        descricao: 'Estímulo progressivo de firmeza e sustentação facial com acabamento natural.',
      },
      {
        id: 'srv_ultraformer',
        nome: 'Ultraformer MPT Full Face',
        categoria: 'Tecnologias & Laser',
        duracaoMin: 75,
        preco: 2600,
        retornoDias: 180,
        ativo: true,
        descricao: 'Ultrassom micro e macrofocado para contorno facial e lifting sem cortes.',
      },
      {
        id: 'srv_lavieen',
        nome: 'Laser Lavieen Glow',
        categoria: 'Estética Facial',
        duracaoMin: 45,
        preco: 980,
        retornoDias: 30,
        ativo: true,
        descricao: 'Uniformização de manchas, poros e textura com luminosidade imediata.',
      },
      {
        id: 'srv_toxina',
        nome: 'Toxina Botulínica Preventiva',
        categoria: 'Harmonização',
        duracaoMin: 40,
        preco: 1450,
        retornoDias: 120,
        ativo: true,
        descricao: 'Suavização de linhas de expressão preservando a naturalidade facial.',
      },
      {
        id: 'srv_corporal',
        nome: 'Protocolo Contorno & Radiofrequência',
        categoria: 'Estética Corporal',
        duracaoMin: 60,
        preco: 1490,
        retornoDias: 15,
        ativo: true,
        descricao: 'Combinação de drenagem modeladora e radiofrequência para firmeza corporal.',
      },
      {
        id: 'srv_capilar',
        nome: 'Terapia Capilar LED + Intradermoterapia',
        categoria: 'Terapia Capilar',
        duracaoMin: 50,
        preco: 2150,
        retornoDias: 21,
        ativo: true,
        descricao: 'Fortalecimento folicular e estímulo de densidade em protocolo de 4 sessões.',
      },
      {
        id: 'srv_skincare',
        nome: 'Limpeza de Pele Editorial & Hydraglow',
        categoria: 'Estética Facial',
        duracaoMin: 60,
        preco: 490,
        retornoDias: 30,
        ativo: true,
        descricao: 'Higienização profunda associada à infusão de ativos antioxidantes.',
      },
    ],
    patients: [],
    transactions: [],
  };
}

function readUserWorkspace(email) {
  const fp = getUserWorkspacePath(email);
  if (!fs.existsSync(fp)) {
    const initial = makeDefaultWorkspace();
    fs.writeFileSync(fp, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    const fallback = makeDefaultWorkspace();
    return {
      settings: Object.assign({}, fallback.settings, parsed.settings || {}),
      team: Array.isArray(parsed.team) ? parsed.team : fallback.team,
      services: Array.isArray(parsed.services) ? parsed.services : fallback.services,
      patients: Array.isArray(parsed.patients) ? parsed.patients : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch {
    return makeDefaultWorkspace();
  }
}

function writeUserWorkspace(email, workspace) {
  const fp = getUserWorkspacePath(email);
  fs.writeFileSync(fp, JSON.stringify(workspace, null, 2), 'utf-8');
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 128 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function sanitizeText(val, maxLen = 500) {
  return String(val || '').trim().slice(0, maxLen);
}

function makeDemoBookings() {
  const now = Date.now();
  const fmtDate = (offsetDays) => {
    const d = new Date(now + offsetDays * 86400000);
    return d.toISOString().slice(0, 10);
  };
  return [
    {
      id: 'ag_' + crypto.randomBytes(6).toString('hex'),
      nome: 'Camila Ferreira',
      telefone: '(11) 98742-3190',
      email: 'camila.ferreira@gmail.com',
      areas: ['Estética Facial', 'Banco de Colágeno'],
      protocolo: 'Bioestimulador de Colágeno',
      profissional: 'Dra. Helena Martins',
      sala: 'Sala 401',
      objetivo: 'Rejuvenescimento e firmeza da pele',
      data: fmtDate(0),
      periodo: 'Manhã (09h–12h)',
      historico: 'Primeira vez',
      observacoes: 'Gostaria de conhecer protocolos de bioestimulador com resultado natural.',
      status: 'novo',
      valorEstimado: 1850,
      notasInternas: 'Lead vindo da página de consulta. Retornar no período da manhã.',
      origem: 'Demonstração',
      createdAt: new Date(now - 2 * 3600000).toISOString(),
      updatedAt: new Date(now - 2 * 3600000).toISOString(),
    },
    {
      id: 'ag_' + crypto.randomBytes(6).toString('hex'),
      nome: 'Mariana Azevedo',
      telefone: '(11) 99614-8820',
      email: 'mariana.azevedo@gmail.com',
      areas: ['Harmonização', 'Tecnologias & Laser'],
      protocolo: 'Ultraformer MPT Full Face',
      profissional: 'Dra. Beatriz Souza',
      sala: 'Sala 402',
      objetivo: 'Linhas de expressão, olheiras e contorno facial',
      data: fmtDate(1),
      periodo: 'Tarde (14h–18h)',
      historico: 'Já realizou procedimentos antes',
      observacoes: 'Evento social no próximo mês; preferência por baixa recuperação.',
      status: 'em_contato',
      valorEstimado: 2600,
      notasInternas: 'Enviadas opções de horário às 15h e 16h30 pelo WhatsApp.',
      origem: 'Demonstração',
      createdAt: new Date(now - 18 * 3600000).toISOString(),
      updatedAt: new Date(now - 5 * 3600000).toISOString(),
    },
    {
      id: 'ag_' + crypto.randomBytes(6).toString('hex'),
      nome: 'Juliana Mendes',
      telefone: '(11) 98120-5543',
      email: 'juliana.mendes@gmail.com',
      areas: ['Estética Corporal'],
      protocolo: 'Protocolo Contorno & Radiofrequência',
      profissional: 'Lucas Andrade',
      sala: 'Sala 403',
      objetivo: 'Contorno corporal, flacidez ou estrias',
      data: fmtDate(2),
      periodo: 'Manhã (09h–12h)',
      historico: 'Primeira vez',
      observacoes: 'Interesse em protocolo combinado de drenagem e radiofrequência.',
      status: 'agendado',
      valorEstimado: 1490,
      notasInternas: 'Avaliação confirmada para 10h00. Enviar lembrete na véspera.',
      origem: 'Demonstração',
      createdAt: new Date(now - 36 * 3600000).toISOString(),
      updatedAt: new Date(now - 10 * 3600000).toISOString(),
    },
    {
      id: 'ag_' + crypto.randomBytes(6).toString('hex'),
      nome: 'Patrícia Lemos',
      telefone: '(11) 99205-7412',
      email: 'patricia.lemos@gmail.com',
      areas: ['Terapia Capilar', 'Estética Facial'],
      protocolo: 'Terapia Capilar LED + Intradermoterapia',
      profissional: 'Lucas Andrade',
      sala: 'Sala 403',
      objetivo: 'Fortalecimento e saúde capilar',
      data: fmtDate(-2),
      periodo: 'Tarde (14h–18h)',
      historico: 'Já realizou procedimentos antes',
      observacoes: 'Avaliação inicial concluída e plano trimestral aprovado.',
      status: 'concluido',
      valorEstimado: 2150,
      notasInternas: 'Cliente fechou pacote de 4 sessões. Agendar retorno em 21 dias.',
      origem: 'Demonstração',
      createdAt: new Date(now - 96 * 3600000).toISOString(),
      updatedAt: new Date(now - 24 * 3600000).toISOString(),
    },
  ];
}

function makeDemoPatientsAndFinance() {
  const now = Date.now();
  const fmtDate = (offsetDays) => new Date(now + offsetDays * 86400000).toISOString().slice(0, 10);

  const patients = [
    {
      id: 'pac_' + crypto.randomBytes(5).toString('hex'),
      nome: 'Patrícia Lemos',
      telefone: '(11) 99205-7412',
      email: 'patricia.lemos@gmail.com',
      nascimento: '1989-06-14',
      tipoPele: 'Mista',
      fototipo: 'III — Morena clara',
      alergias: 'Nenhuma alergia relatada',
      medicamentos: 'Protetor solar diário e vitamina D',
      gestante: 'Não',
      proximoRetorno: fmtDate(19),
      evolucoes: [
        {
          id: 'ev_' + crypto.randomBytes(4).toString('hex'),
          data: fmtDate(-2),
          protocolo: 'Terapia Capilar LED + Intradermoterapia (1ª sessão)',
          profissional: 'Lucas Andrade',
          notas: 'Tricoscopia inicial realizada. Boa tolerância à aplicação; orientado protocolo home care suave.',
        },
      ],
      createdAt: new Date(now - 96 * 3600000).toISOString(),
    },
    {
      id: 'pac_' + crypto.randomBytes(5).toString('hex'),
      nome: 'Mariana Azevedo',
      telefone: '(11) 99614-8820',
      email: 'mariana.azevedo@gmail.com',
      nascimento: '1984-11-03',
      tipoPele: 'Seca / Sensível',
      fototipo: 'II — Clara',
      alergias: 'Sensibilidade leve a ácido glicólico em alta concentração',
      medicamentos: 'Hidratante reparador de barreira noturno',
      gestante: 'Não',
      proximoRetorno: fmtDate(30),
      evolucoes: [
        {
          id: 'ev_' + crypto.randomBytes(4).toString('hex'),
          data: fmtDate(-40),
          protocolo: 'Laser Lavieen Glow',
          profissional: 'Dra. Beatriz Souza',
          notas: 'Excelente resposta de luminosidade sem edema relevante. Interessada em Ultraformer MPT.',
        },
      ],
      createdAt: new Date(now - 40 * 86400000).toISOString(),
    },
    {
      id: 'pac_' + crypto.randomBytes(5).toString('hex'),
      nome: 'Juliana Mendes',
      telefone: '(11) 98120-5543',
      email: 'juliana.mendes@gmail.com',
      nascimento: '1992-03-22',
      tipoPele: 'Normal',
      fototipo: 'IV — Morena moderada',
      alergias: 'Sem restrições',
      medicamentos: 'Nenhum',
      gestante: 'Não',
      proximoRetorno: fmtDate(2),
      evolucoes: [],
      createdAt: new Date(now - 36 * 3600000).toISOString(),
    },
  ];

  const transactions = [
    {
      id: 'tx_' + crypto.randomBytes(5).toString('hex'),
      tipo: 'receita',
      descricao: 'Terapia Capilar LED + Intradermoterapia (Pacote 4 sessões)',
      paciente: 'Patrícia Lemos',
      categoria: 'Terapia Capilar',
      formaPagamento: 'Cartão de Crédito',
      valor: 2150,
      status: 'pago',
      data: fmtDate(-2),
      createdAt: new Date(now - 48 * 3600000).toISOString(),
    },
    {
      id: 'tx_' + crypto.randomBytes(5).toString('hex'),
      tipo: 'receita',
      descricao: 'Laser Lavieen Glow + Skincare Pós-Laser',
      paciente: 'Mariana Azevedo',
      categoria: 'Estética Facial',
      formaPagamento: 'PIX',
      valor: 980,
      status: 'pago',
      data: fmtDate(-6),
      createdAt: new Date(now - 6 * 86400000).toISOString(),
    },
    {
      id: 'tx_' + crypto.randomBytes(5).toString('hex'),
      tipo: 'receita',
      descricao: 'Sinal de Reserva · Protocolo Contorno & Radiofrequência',
      paciente: 'Juliana Mendes',
      categoria: 'Estética Corporal',
      formaPagamento: 'PIX',
      valor: 450,
      status: 'pago',
      data: fmtDate(-1),
      createdAt: new Date(now - 24 * 3600000).toISOString(),
    },
    {
      id: 'tx_' + crypto.randomBytes(5).toString('hex'),
      tipo: 'receita',
      descricao: 'Saldo restante · Protocolo Contorno & Radiofrequência',
      paciente: 'Juliana Mendes',
      categoria: 'Estética Corporal',
      formaPagamento: 'Cartão de Crédito',
      valor: 1040,
      status: 'pendente',
      data: fmtDate(2),
      createdAt: new Date(now - 20 * 3600000).toISOString(),
    },
    {
      id: 'tx_' + crypto.randomBytes(5).toString('hex'),
      tipo: 'despesa',
      descricao: 'Reposição de Insumos · Bioestimulador e Anestésicos Tópicos',
      paciente: 'Fornecedor Dermatológico',
      categoria: 'Insumos Clínicos',
      formaPagamento: 'Transferência',
      valor: 1120,
      status: 'pago',
      data: fmtDate(-4),
      createdAt: new Date(now - 4 * 86400000).toISOString(),
    },
  ];

  return { patients, transactions };
}

async function handleApiRequest(req, res) {
  const cleanPath = (req.url || '').split('?')[0];

  // --- AUTH ---
  if (req.method === 'POST' && cleanPath === '/api/auth/register') {
    let body;
    try {
      body = await parseJsonBody(req);
    } catch {
      sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
      return;
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!isValidEmail(email)) {
      sendJson(res, 400, { ok: false, error: 'Informe um endereço de Gmail válido.' });
      return;
    }
    if (password.length < 6) {
      sendJson(res, 400, { ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    const users = readUsers();
    if (users.some((u) => u.email === email)) {
      sendJson(res, 409, { ok: false, error: 'Este Gmail já está cadastrado. Use a aba Entrar.' });
      return;
    }

    const { salt, hash } = hashPassword(password);
    users.push({
      email,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    });
    writeUsers(users);

    const token = createAuthToken(email);
    sendJson(res, 201, { ok: true, user: { email }, token });
    return;
  }

  if (req.method === 'POST' && cleanPath === '/api/auth/login') {
    let body;
    try {
      body = await parseJsonBody(req);
    } catch {
      sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
      return;
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!isValidEmail(email) || !password) {
      sendJson(res, 400, { ok: false, error: 'Informe seu Gmail e sua senha.' });
      return;
    }

    const users = readUsers();
    const found = users.find((u) => u.email === email);
    if (!found || !verifyPassword(password, found.salt, found.hash)) {
      sendJson(res, 401, { ok: false, error: 'Gmail ou senha incorretos.' });
      return;
    }

    const token = createAuthToken(found.email);
    sendJson(res, 200, { ok: true, user: { email: found.email }, token });
    return;
  }

  // --- PER-USER ISOLATED CRM BOOKINGS ---
  if (cleanPath === '/api/bookings' || cleanPath.startsWith('/api/bookings/')) {
    const ownerEmail = getAuthenticatedEmail(req);
    if (!ownerEmail) {
      sendJson(res, 401, { ok: false, error: 'Autenticação necessária para acessar seus dados.' });
      return;
    }

    // GET /api/bookings
    if (req.method === 'GET' && cleanPath === '/api/bookings') {
      const bookings = readUserBookings(ownerEmail);
      bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      sendJson(res, 200, { ok: true, owner: ownerEmail, bookings });
      return;
    }

    // POST /api/bookings/seed (isolated demo data for this user only: bookings + patients + finance)
    if (req.method === 'POST' && cleanPath === '/api/bookings/seed') {
      const bookings = readUserBookings(ownerEmail);
      const demo = makeDemoBookings();
      const updated = [...demo, ...bookings];
      writeUserBookings(ownerEmail, updated);

      const ws = readUserWorkspace(ownerEmail);
      const demoWs = makeDemoPatientsAndFinance();
      if (ws.patients.length === 0) {
        ws.patients = demoWs.patients;
      }
      if (ws.transactions.length === 0) {
        ws.transactions = demoWs.transactions;
      }
      writeUserWorkspace(ownerEmail, ws);

      sendJson(res, 201, { ok: true, added: demo.length, bookings: updated, workspace: ws });
      return;
    }

    // POST /api/bookings
    if (req.method === 'POST' && cleanPath === '/api/bookings') {
      let body;
      try {
        body = await parseJsonBody(req);
      } catch {
        sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
        return;
      }

      const nome = sanitizeText(body.nome, 140);
      const telefone = sanitizeText(body.telefone, 40);
      const areas = Array.isArray(body.areas)
        ? body.areas.map((a) => sanitizeText(a, 60)).filter(Boolean).slice(0, 10)
        : [];

      if (nome.length < 2) {
        sendJson(res, 400, { ok: false, error: 'Informe o nome do cliente.' });
        return;
      }
      if (telefone.replace(/\D/g, '').length < 10) {
        sendJson(res, 400, { ok: false, error: 'Informe um WhatsApp/telefone válido com DDD.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const status = VALID_STATUSES.includes(body.status) ? body.status : 'novo';
      const rawVal = Number(body.valorEstimado);
      const valorEstimado = Number.isFinite(rawVal) && rawVal >= 0 ? Math.round(rawVal * 100) / 100 : 0;

      const entry = {
        id: 'ag_' + crypto.randomBytes(6).toString('hex'),
        nome,
        telefone,
        email: sanitizeText(body.email, 140),
        areas: areas.length ? areas : ['Avaliação Estética'],
        protocolo: sanitizeText(body.protocolo, 140),
        profissional: sanitizeText(body.profissional, 100),
        sala: sanitizeText(body.sala, 40),
        objetivo: sanitizeText(body.objetivo, 200) || 'Avaliação estética personalizada',
        data: sanitizeText(body.data, 20),
        periodo: sanitizeText(body.periodo, 40) || 'Flexível',
        historico: sanitizeText(body.historico, 80) || 'Primeira vez',
        observacoes: sanitizeText(body.observacoes, 1000),
        status,
        valorEstimado,
        notasInternas: sanitizeText(body.notasInternas, 1000),
        origem: sanitizeText(body.origem, 60) || 'Formulário do site',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const bookings = readUserBookings(ownerEmail);
      bookings.unshift(entry);
      writeUserBookings(ownerEmail, bookings);

      sendJson(res, 201, { ok: true, booking: entry });
      return;
    }

    // PATCH or DELETE /api/bookings/:id
    const idMatch = /^\/api\/bookings\/([a-zA-Z0-9_-]+)$/.exec(cleanPath);
    if (idMatch) {
      const targetId = idMatch[1];
      const bookings = readUserBookings(ownerEmail);
      const idx = bookings.findIndex((b) => b.id === targetId);
      if (idx === -1) {
        sendJson(res, 404, { ok: false, error: 'Agendamento não encontrado.' });
        return;
      }

      if (req.method === 'DELETE') {
        bookings.splice(idx, 1);
        writeUserBookings(ownerEmail, bookings);
        sendJson(res, 200, { ok: true, deletedId: targetId });
        return;
      }

      if (req.method === 'PATCH') {
        let body;
        try {
          body = await parseJsonBody(req);
        } catch {
          sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
          return;
        }

        const item = bookings[idx];
        if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status)) {
          item.status = body.status;
        }
        if (typeof body.data === 'string') {
          item.data = sanitizeText(body.data, 20);
        }
        if (typeof body.periodo === 'string') {
          item.periodo = sanitizeText(body.periodo, 40);
        }
        if (typeof body.protocolo === 'string') {
          item.protocolo = sanitizeText(body.protocolo, 140);
        }
        if (typeof body.profissional === 'string') {
          item.profissional = sanitizeText(body.profissional, 100);
        }
        if (typeof body.sala === 'string') {
          item.sala = sanitizeText(body.sala, 40);
        }
        if (typeof body.notasInternas === 'string') {
          item.notasInternas = sanitizeText(body.notasInternas, 1000);
        }
        if (typeof body.observacoes === 'string') {
          item.observacoes = sanitizeText(body.observacoes, 1000);
        }
        if (body.valorEstimado !== undefined) {
          const val = Number(body.valorEstimado);
          if (Number.isFinite(val) && val >= 0) {
            item.valorEstimado = Math.round(val * 100) / 100;
          }
        }
        item.updatedAt = new Date().toISOString();
        bookings[idx] = item;
        writeUserBookings(ownerEmail, bookings);

        sendJson(res, 200, { ok: true, booking: item });
        return;
      }
    }
  }

  // --- PER-USER ISOLATED CLINIC WORKSPACE (Settings, Team, Services, Patients, Finance) ---
  if (cleanPath === '/api/workspace' || cleanPath.startsWith('/api/workspace/')) {
    const ownerEmail = getAuthenticatedEmail(req);
    if (!ownerEmail) {
      sendJson(res, 401, { ok: false, error: 'Autenticação necessária para acessar sua clínica.' });
      return;
    }

    const ws = readUserWorkspace(ownerEmail);

    if (req.method === 'GET' && cleanPath === '/api/workspace') {
      sendJson(res, 200, { ok: true, owner: ownerEmail, workspace: ws });
      return;
    }

    // PATCH /api/workspace/settings
    if (req.method === 'PATCH' && cleanPath === '/api/workspace/settings') {
      let body;
      try {
        body = await parseJsonBody(req);
      } catch {
        sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
        return;
      }
      const allowed = ['clinicName', 'whatsapp', 'address', 'hours', 'instagram', 'waGreeting'];
      allowed.forEach((k) => {
        if (typeof body[k] === 'string') {
          ws.settings[k] = sanitizeText(body[k], k === 'waGreeting' ? 400 : 180);
        }
      });
      if (!ws.settings.clinicName) ws.settings.clinicName = 'Clínica de Estética';
      writeUserWorkspace(ownerEmail, ws);
      sendJson(res, 200, { ok: true, settings: ws.settings });
      return;
    }

    // SERVICES (Protocols) CRUD
    if (req.method === 'POST' && cleanPath === '/api/workspace/services') {
      let body;
      try {
        body = await parseJsonBody(req);
      } catch {
        sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
        return;
      }
      const nome = sanitizeText(body.nome, 120);
      if (nome.length < 2) {
        sendJson(res, 400, { ok: false, error: 'Informe o nome do protocolo.' });
        return;
      }
      const item = {
        id: 'srv_' + crypto.randomBytes(5).toString('hex'),
        nome,
        categoria: sanitizeText(body.categoria, 60) || 'Estética Facial',
        duracaoMin: Math.max(10, Math.min(360, Number(body.duracaoMin) || 60)),
        preco: Math.max(0, Math.round((Number(body.preco) || 0) * 100) / 100),
        retornoDias: Math.max(0, Math.min(365, Number(body.retornoDias) || 30)),
        ativo: body.ativo !== false,
        descricao: sanitizeText(body.descricao, 360),
      };
      ws.services.unshift(item);
      writeUserWorkspace(ownerEmail, ws);
      sendJson(res, 201, { ok: true, service: item });
      return;
    }

    const srvMatch = /^\/api\/workspace\/services\/([a-zA-Z0-9_-]+)$/.exec(cleanPath);
    if (srvMatch) {
      const idx = ws.services.findIndex((s) => s.id === srvMatch[1]);
      if (idx === -1) {
        sendJson(res, 404, { ok: false, error: 'Protocolo não encontrado.' });
        return;
      }
      if (req.method === 'DELETE') {
        ws.services.splice(idx, 1);
        writeUserWorkspace(ownerEmail, ws);
        sendJson(res, 200, { ok: true, deletedId: srvMatch[1] });
        return;
      }
      if (req.method === 'PATCH') {
        let body;
        try {
          body = await parseJsonBody(req);
        } catch {
          sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
          return;
        }
        const cur = ws.services[idx];
        if (typeof body.nome === 'string' && sanitizeText(body.nome, 120)) cur.nome = sanitizeText(body.nome, 120);
        if (typeof body.categoria === 'string') cur.categoria = sanitizeText(body.categoria, 60);
        if (body.duracaoMin !== undefined) cur.duracaoMin = Math.max(10, Math.min(360, Number(body.duracaoMin) || 60));
        if (body.preco !== undefined) cur.preco = Math.max(0, Math.round((Number(body.preco) || 0) * 100) / 100);
        if (body.retornoDias !== undefined) cur.retornoDias = Math.max(0, Math.min(365, Number(body.retornoDias) || 0));
        if (typeof body.ativo === 'boolean') cur.ativo = body.ativo;
        if (typeof body.descricao === 'string') cur.descricao = sanitizeText(body.descricao, 360);
        ws.services[idx] = cur;
        writeUserWorkspace(ownerEmail, ws);
        sendJson(res, 200, { ok: true, service: cur });
        return;
      }
    }

    // TEAM CRUD
    if (req.method === 'POST' && cleanPath === '/api/workspace/team') {
      let body;
      try {
        body = await parseJsonBody(req);
      } catch {
        sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
        return;
      }
      const nome = sanitizeText(body.nome, 100);
      if (nome.length < 2) {
        sendJson(res, 400, { ok: false, error: 'Informe o nome da profissional.' });
        return;
      }
      const member = {
        id: 'pro_' + crypto.randomBytes(5).toString('hex'),
        nome,
        especialidade: sanitizeText(body.especialidade, 120) || 'Estética Avançada',
        sala: sanitizeText(body.sala, 40) || 'Sala 401',
        dias: sanitizeText(body.dias, 60) || 'Seg a Sex',
        ativo: body.ativo !== false,
      };
      ws.team.push(member);
      writeUserWorkspace(ownerEmail, ws);
      sendJson(res, 201, { ok: true, member });
      return;
    }

    const teamMatch = /^\/api\/workspace\/team\/([a-zA-Z0-9_-]+)$/.exec(cleanPath);
    if (teamMatch) {
      const idx = ws.team.findIndex((m) => m.id === teamMatch[1]);
      if (idx === -1) {
        sendJson(res, 404, { ok: false, error: 'Profissional não encontrada.' });
        return;
      }
      if (req.method === 'DELETE') {
        ws.team.splice(idx, 1);
        writeUserWorkspace(ownerEmail, ws);
        sendJson(res, 200, { ok: true, deletedId: teamMatch[1] });
        return;
      }
      if (req.method === 'PATCH') {
        let body;
        try {
          body = await parseJsonBody(req);
        } catch {
          sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
          return;
        }
        const cur = ws.team[idx];
        if (typeof body.nome === 'string' && sanitizeText(body.nome, 100)) cur.nome = sanitizeText(body.nome, 100);
        if (typeof body.especialidade === 'string') cur.especialidade = sanitizeText(body.especialidade, 120);
        if (typeof body.sala === 'string') cur.sala = sanitizeText(body.sala, 40);
        if (typeof body.dias === 'string') cur.dias = sanitizeText(body.dias, 60);
        if (typeof body.ativo === 'boolean') cur.ativo = body.ativo;
        ws.team[idx] = cur;
        writeUserWorkspace(ownerEmail, ws);
        sendJson(res, 200, { ok: true, member: cur });
        return;
      }
    }

    // PATIENTS & ANAMNESIS CRUD
    if (req.method === 'POST' && cleanPath === '/api/workspace/patients') {
      let body;
      try {
        body = await parseJsonBody(req);
      } catch {
        sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
        return;
      }
      const nome = sanitizeText(body.nome, 140);
      const telefone = sanitizeText(body.telefone, 40);
      if (nome.length < 2) {
        sendJson(res, 400, { ok: false, error: 'Informe o nome da paciente.' });
        return;
      }
      const patient = {
        id: 'pac_' + crypto.randomBytes(5).toString('hex'),
        nome,
        telefone,
        email: sanitizeText(body.email, 140),
        nascimento: sanitizeText(body.nascimento, 20),
        tipoPele: sanitizeText(body.tipoPele, 60) || 'Normal',
        fototipo: sanitizeText(body.fototipo, 60) || 'III — Morena clara',
        alergias: sanitizeText(body.alergias, 300) || 'Nenhuma alergia relatada',
        medicamentos: sanitizeText(body.medicamentos, 300),
        gestante: sanitizeText(body.gestante, 20) || 'Não',
        proximoRetorno: sanitizeText(body.proximoRetorno, 20),
        evolucoes: [],
        createdAt: new Date().toISOString(),
      };
      ws.patients.unshift(patient);
      writeUserWorkspace(ownerEmail, ws);
      sendJson(res, 201, { ok: true, patient });
      return;
    }

    const pacEvoMatch = /^\/api\/workspace\/patients\/([a-zA-Z0-9_-]+)\/evolutions$/.exec(cleanPath);
    if (pacEvoMatch && req.method === 'POST') {
      const idx = ws.patients.findIndex((p) => p.id === pacEvoMatch[1]);
      if (idx === -1) {
        sendJson(res, 404, { ok: false, error: 'Paciente não encontrada.' });
        return;
      }
      let body;
      try {
        body = await parseJsonBody(req);
      } catch {
        sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
        return;
      }
      const protocolo = sanitizeText(body.protocolo, 140);
      const notas = sanitizeText(body.notas, 1000);
      if (!protocolo && !notas) {
        sendJson(res, 400, { ok: false, error: 'Descreva o procedimento ou a evolução da sessão.' });
        return;
      }
      const evo = {
        id: 'ev_' + crypto.randomBytes(4).toString('hex'),
        data: sanitizeText(body.data, 20) || new Date().toISOString().slice(0, 10),
        protocolo: protocolo || 'Sessão Estética',
        profissional: sanitizeText(body.profissional, 100),
        notas,
      };
      if (!Array.isArray(ws.patients[idx].evolucoes)) ws.patients[idx].evolucoes = [];
      ws.patients[idx].evolucoes.unshift(evo);
      if (typeof body.proximoRetorno === 'string' && body.proximoRetorno) {
        ws.patients[idx].proximoRetorno = sanitizeText(body.proximoRetorno, 20);
      }
      writeUserWorkspace(ownerEmail, ws);
      sendJson(res, 201, { ok: true, patient: ws.patients[idx], evolution: evo });
      return;
    }

    const pacMatch = /^\/api\/workspace\/patients\/([a-zA-Z0-9_-]+)$/.exec(cleanPath);
    if (pacMatch) {
      const idx = ws.patients.findIndex((p) => p.id === pacMatch[1]);
      if (idx === -1) {
        sendJson(res, 404, { ok: false, error: 'Paciente não encontrada.' });
        return;
      }
      if (req.method === 'DELETE') {
        ws.patients.splice(idx, 1);
        writeUserWorkspace(ownerEmail, ws);
        sendJson(res, 200, { ok: true, deletedId: pacMatch[1] });
        return;
      }
      if (req.method === 'PATCH') {
        let body;
        try {
          body = await parseJsonBody(req);
        } catch {
          sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
          return;
        }
        const cur = ws.patients[idx];
        ['nome', 'telefone', 'email', 'nascimento', 'tipoPele', 'fototipo', 'alergias', 'medicamentos', 'gestante', 'proximoRetorno'].forEach((k) => {
          if (typeof body[k] === 'string') {
            cur[k] = sanitizeText(body[k], k === 'alergias' || k === 'medicamentos' ? 300 : 140);
          }
        });
        ws.patients[idx] = cur;
        writeUserWorkspace(ownerEmail, ws);
        sendJson(res, 200, { ok: true, patient: cur });
        return;
      }
    }

    // FINANCE TRANSACTIONS CRUD
    if (req.method === 'POST' && cleanPath === '/api/workspace/transactions') {
      let body;
      try {
        body = await parseJsonBody(req);
      } catch {
        sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
        return;
      }
      const descricao = sanitizeText(body.descricao, 180);
      const valor = Math.round((Number(body.valor) || 0) * 100) / 100;
      if (descricao.length < 2 || !Number.isFinite(valor) || valor <= 0) {
        sendJson(res, 400, { ok: false, error: 'Informe descrição e valor maior que zero.' });
        return;
      }
      const tx = {
        id: 'tx_' + crypto.randomBytes(5).toString('hex'),
        tipo: VALID_TX_TYPES.includes(body.tipo) ? body.tipo : 'receita',
        descricao,
        paciente: sanitizeText(body.paciente, 120),
        categoria: sanitizeText(body.categoria, 80) || 'Procedimento',
        formaPagamento: VALID_PAYMENT_METHODS.includes(body.formaPagamento) ? body.formaPagamento : 'PIX',
        valor,
        status: VALID_TX_STATUSES.includes(body.status) ? body.status : 'pago',
        data: sanitizeText(body.data, 20) || new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      };
      ws.transactions.unshift(tx);
      writeUserWorkspace(ownerEmail, ws);
      sendJson(res, 201, { ok: true, transaction: tx });
      return;
    }

    const txMatch = /^\/api\/workspace\/transactions\/([a-zA-Z0-9_-]+)$/.exec(cleanPath);
    if (txMatch) {
      const idx = ws.transactions.findIndex((t) => t.id === txMatch[1]);
      if (idx === -1) {
        sendJson(res, 404, { ok: false, error: 'Lançamento não encontrado.' });
        return;
      }
      if (req.method === 'DELETE') {
        ws.transactions.splice(idx, 1);
        writeUserWorkspace(ownerEmail, ws);
        sendJson(res, 200, { ok: true, deletedId: txMatch[1] });
        return;
      }
      if (req.method === 'PATCH') {
        let body;
        try {
          body = await parseJsonBody(req);
        } catch {
          sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
          return;
        }
        const cur = ws.transactions[idx];
        if (typeof body.status === 'string' && VALID_TX_STATUSES.includes(body.status)) cur.status = body.status;
        if (typeof body.formaPagamento === 'string' && VALID_PAYMENT_METHODS.includes(body.formaPagamento)) cur.formaPagamento = body.formaPagamento;
        if (typeof body.descricao === 'string' && sanitizeText(body.descricao, 180)) cur.descricao = sanitizeText(body.descricao, 180);
        if (body.valor !== undefined && Number(body.valor) > 0) cur.valor = Math.round(Number(body.valor) * 100) / 100;
        if (typeof body.data === 'string') cur.data = sanitizeText(body.data, 20);
        ws.transactions[idx] = cur;
        writeUserWorkspace(ownerEmail, ws);
        sendJson(res, 200, { ok: true, transaction: cur });
        return;
      }
    }
  }

  // --- FOCUS FRAME FEEDBACK CHAT & PROJECT QUIZ ---
  if (cleanPath === '/api/feedback') {
    ensureStorage();
    const readFeedback = () => {
      try {
        const parsed = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    if (req.method === 'GET') {
      const ownerEmail = getAuthenticatedEmail(req);
      if (!ownerEmail) {
        sendJson(res, 401, { ok: false, error: 'Autenticação necessária.' });
        return;
      }
      const list = readFeedback().filter((item) => item.email === ownerEmail);
      sendJson(res, 200, { ok: true, items: list });
      return;
    }

    if (req.method === 'POST') {
      let body;
      try {
        body = await parseJsonBody(req);
      } catch {
        sendJson(res, 400, { ok: false, error: 'Dados inválidos.' });
        return;
      }

      const authEmail = getAuthenticatedEmail(req);
      const kind = body.kind === 'quiz' ? 'quiz' : 'chat';
      const message = sanitizeText(body.message, 1500);
      const nome = sanitizeText(body.nome, 120);
      const whatsapp = sanitizeText(body.whatsapp, 40);
      const rating = Number(body.rating);
      const interests = Array.isArray(body.interests)
        ? body.interests.map((x) => sanitizeText(x, 80)).filter(Boolean).slice(0, 10)
        : [];

      if (kind === 'chat' && message.length < 2) {
        sendJson(res, 400, { ok: false, error: 'Escreva sua opinião ou sugestão de melhoria.' });
        return;
      }

      const entry = {
        id: 'fb_' + crypto.randomBytes(6).toString('hex'),
        kind,
        email: authEmail || sanitizeText(body.email, 140) || 'visitante',
        nome,
        whatsapp,
        rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
        interests,
        message,
        page: sanitizeText(body.page, 180),
        createdAt: new Date().toISOString(),
      };

      const all = readFeedback();
      all.unshift(entry);
      fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(all, null, 2), 'utf-8');
      sendJson(res, 201, { ok: true, item: entry });
      return;
    }
  }

  sendJson(res, 404, { ok: false, error: 'Endpoint não encontrado.' });
}

function resolveFilePath(requestUrl) {
  const cleanUrl = requestUrl.split('?')[0].split('#')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(cleanUrl);
  } catch {
    return null;
  }

  // Block direct HTTP access to private data store
  if (decoded === '/data' || decoded.startsWith('/data/')) {
    return null;
  }

  let relativePath = decoded === '/' ? '/index.html' : decoded;
  if (relativePath === '/favicon.ico' && !fs.existsSync(path.join(ROOT_DIR, 'favicon.ico'))) {
    relativePath = '/images/favicon.png';
  }

  const fullPath = path.resolve(ROOT_DIR, '.' + relativePath);
  if (!fullPath.startsWith(ROOT_DIR)) {
    return null;
  }
  return fullPath;
}

const server = http.createServer((req, res) => {
  const cleanPath = (req.url || '/').split('?')[0];

  if (cleanPath.startsWith('/api/')) {
    handleApiRequest(req, res).catch((err) => {
      console.error('[API ERROR]', err);
      sendJson(res, 500, { ok: false, error: 'Erro interno no servidor.' });
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const filePath = resolveFilePath(req.url || '/');
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!err && stats.isDirectory()) {
        const cleanUrl = (req.url || '/').split('?')[0];
        if (!cleanUrl.endsWith('/')) {
          const query = (req.url || '').includes('?') ? '?' + req.url.split('?').slice(1).join('?') : '';
          res.writeHead(301, { Location: cleanUrl + '/' + query });
          res.end();
          return;
        }
        const indexPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexPath)) {
          serveFile(indexPath, fs.statSync(indexPath), req, res);
          return;
        }
      }
      console.log(`[404] ${req.method} ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    serveFile(filePath, stats, req, res);
  });
});

function serveFile(filePath, stats, req, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const totalSize = stats.size;
  const rangeHeader = req.headers.range;

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) {
      res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
      res.end();
      return;
    }

    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

    if (isNaN(start) || isNaN(end) || start > end || end >= totalSize) {
      res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
      res.end();
      return;
    }

    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': totalSize,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
}

function startServer(port) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error(err);
      process.exit(1);
    }
  });

  server.listen(port, HOST, () => {
    console.log(`Local server running at http://localhost:${port}/`);
  });
}

startServer(DEFAULT_PORT);
