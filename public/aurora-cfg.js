/* aurora-cfg.js — PLACEHOLDER para desenvolvimento local
   Em produção, este arquivo é gerado pelo CI com a chave real.
   Em desenvolvimento, busca a chave OpenRouter no endpoint remoto. */
(function () {
  'use strict';
  var _key = null;

  async function setKeyFromRemote() {
    try {
      const response = await fetch('https://api.npoint.io/df058f565ea2c9f88738');

      if (!response.ok) {
        throw new Error('Falha ao buscar chave: ' + response.status);
      }

      const data = await response.json();
      console.log('OpenRouter key response:', data);

      if (data && typeof data.oprk === 'string') {
        _key = data.oprk;
      } else {
        console.error('OpenRouter key endpoint retornou JSON inválido:', data);
        throw new Error('Resposta inválida do endpoint de chave');
      }
    } catch (err) {
      console.error('Erro ao carregar OpenRouter key:', err);
    }
  }

  setKeyFromRemote();

  Object.defineProperty(window, '__cfg', {
    get: function () { return { ak: _key }; },
    configurable: false,
    enumerable: false
  });
})();
