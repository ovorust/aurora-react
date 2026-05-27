/* aurora-cfg.js — PLACEHOLDER para desenvolvimento local
   Em produção, este arquivo é gerado pelo CI com a chave real.
   Para testar localmente, substitua YOUR_KEY_HERE pela sua chave OpenRouter. */
(function () {
  'use strict';
  var _key = 'YOUR_KEY_HERE';
  Object.defineProperty(window, '__cfg', {
    get: function () { return { ak: _key }; },
    configurable: false,
    enumerable: false
  });
})();
