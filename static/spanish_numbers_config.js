/* Spanish NUMBER_CONFIG — numberToWords + levelTips (gender-neutral) */
(function () {
'use strict';

var ones = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
var teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'diecis\u00e9is', 'diecisiete', 'dieciocho', 'diecinueve'];
var twenties = ['veinte', 'veintiuno', 'veintid\u00f3s', 'veintitr\u00e9s', 'veinticuatro', 'veinticinco', 'veintis\u00e9is', 'veintisiete', 'veintiocho', 'veintinueve'];
var tens = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
var hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function numberToWords(n) {
  if (n === 0) return 'cero';
  if (n < 0) return 'menos ' + numberToWords(-n);

  if (n >= 1000000) {
    var m = Math.floor(n / 1000000);
    var r = n % 1000000;
    var prefix = (m === 1) ? 'un mill\u00f3n' : numberToWords(m) + ' millones';
    return prefix + (r > 0 ? ' ' + numberToWords(r) : '');
  }

  if (n >= 1000) {
    var k = Math.floor(n / 1000);
    var r = n % 1000;
    var prefix = (k === 1) ? 'mil' : numberToWords(k) + ' mil';
    return prefix + (r > 0 ? ' ' + numberToWords(r) : '');
  }

  if (n >= 100) {
    var h = Math.floor(n / 100);
    var r = n % 100;
    if (h === 1 && r === 0) return 'cien';
    return hundreds[h] + (r > 0 ? ' ' + numberToWords(r) : '');
  }

  if (n >= 30) {
    var t = Math.floor(n / 10);
    var u = n % 10;
    return tens[t] + (u > 0 ? ' y ' + ones[u] : '');
  }

  if (n >= 20) return twenties[n - 20];
  if (n >= 10) return teens[n - 10];
  return ones[n];
}

window.NUMBER_CONFIG = {
  lang: 'es-ES',
  langKey: 'spanish',
  numberToWords: numberToWords,
  levelTips: [
    'Digits 1\u201310: uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez.',
    '11\u201315 are unique: once, doce, trece, catorce, quince. 16\u201319: diecis\u00e9is, diecisiete\u2026 20 = veinte. 21\u201329 are one word: veintiuno, veintid\u00f3s\u2026 30+: treinta y uno, cuarenta y dos\u2026',
    '100 = cien (standalone) or ciento (before more). 200\u2013900 have special forms: doscientos, trescientos, cuatrocientos, quinientos, seiscientos, setecientos, ochocientos, novecientos.',
    '1,000 = mil (not un mil). 2,000 = dos mil. Compound: 2,500 = dos mil quinientos.',
    'Large: cien mil = 100,000. Un mill\u00f3n = 1,000,000. Plural: dos millones. Note: mill\u00f3n takes "de" before nouns (un mill\u00f3n de pesos).',
  ],
};

})();
