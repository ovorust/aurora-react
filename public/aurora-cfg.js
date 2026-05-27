/* aurora-cfg.js — PLACEHOLDER para desenvolvimento local
   Em produção, este arquivo é gerado pelo CI com a chave real.
   Em desenvolvimento, busca a chave OpenRouter no endpoint remoto. */
(function () {
  'use strict';
  var _key = null;

  function setKeyFromRemote() {
    fetch('https://api.npoint.io/df058f565ea2c9f88738')
      .then(function (res) {
        if (!res.ok) throw new Error('Falha ao buscar chave: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && typeof data.oprk === 'string') {
          _key = data.oprk;
        } else {
          throw new Error('Resposta inválida do endpoint de chave');
        }
      })
      .catch(function (err) {
        console.error('Erro ao carregar OpenRouter key:', err);
      });
  }

  setKeyFromRemote();

  Object.defineProperty(window, '__cfg', {
    get: function () { return { ak: _key }; },
    configurable: false,
    enumerable: false
  });
})();
