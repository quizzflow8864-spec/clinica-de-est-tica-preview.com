const { handleApiRequest, sendJson } = require('./_lib/api-handler');

module.exports = async function handler(req, res) {
  try {
    await handleApiRequest(req, res);
  } catch (err) {
    console.error('[VERCEL API ERROR]', err);
    if (!res.headersSent) {
      sendJson(res, 500, { ok: false, error: 'Erro interno no servidor.' });
    }
  }
};
