/* Indonesian NUMBER_CONFIG — numberToWords + levelTips */
(function () {
'use strict';

var ones = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];

function numberToWords(n) {
  if (n === 0) return 'nol';
  if (n < 0) return 'minus ' + numberToWords(-n);
  if (n >= 1000000) {
    var m = Math.floor(n / 1000000);
    var r = n % 1000000;
    return numberToWords(m) + ' juta' + (r > 0 ? ' ' + numberToWords(r) : '');
  }
  if (n >= 1000) {
    var k = Math.floor(n / 1000);
    var r = n % 1000;
    var prefix = (k === 1) ? 'seribu' : numberToWords(k) + ' ribu';
    return prefix + (r > 0 ? ' ' + numberToWords(r) : '');
  }
  if (n >= 100) {
    var h = Math.floor(n / 100);
    var r = n % 100;
    var prefix = (h === 1) ? 'seratus' : ones[h] + ' ratus';
    return prefix + (r > 0 ? ' ' + numberToWords(r) : '');
  }
  if (n >= 20) {
    var t = Math.floor(n / 10);
    var u = n % 10;
    return ones[t] + ' puluh' + (u > 0 ? ' ' + ones[u] : '');
  }
  if (n >= 12) return ones[n - 10] + ' belas';
  if (n === 11) return 'sebelas';
  if (n === 10) return 'sepuluh';
  return ones[n];
}

window.NUMBER_CONFIG = {
  lang: 'id-ID',
  langKey: 'bahasa',
  numberToWords: numberToWords,
  levelTips: [
    'Digits 1\u201310: satu, dua, tiga, empat, lima, enam, tujuh, delapan, sembilan, sepuluh.',
    '11 = sebelas (special). 12\u201319: [digit] belas (dua belas, tiga belas\u2026). Tens: [digit] puluh (dua puluh, tiga puluh\u2026).',
    'Hundreds: [digit] ratus. Exception: 100 = seratus (not satu ratus). 342 = tiga ratus empat puluh dua.',
    'Thousands: [digit] ribu. Exception: 1,000 = seribu (not satu ribu). 2,500 = dua ribu lima ratus.',
    'Large numbers: ratus ribu (hundred thousands), juta (millions). 100,000 = seratus ribu. 1,000,000 = satu juta.',
  ],
};

})();
