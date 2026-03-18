/* Vietnamese NUMBER_CONFIG — numberToWords + levelTips
   Southern convention: lẻ for gaps, mốt/tư/lăm in compound positions */
(function () {
'use strict';

var ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readTwoDigits(n) {
  if (n === 0) return '';
  if (n < 10) return ones[n];
  if (n === 10) return 'mười';
  if (n < 20) {
    var u = n % 10;
    if (u === 5) return 'mười lăm';
    return 'mười ' + ones[u];
  }
  var tens = Math.floor(n / 10);
  var unit = n % 10;
  var result = ones[tens] + ' mươi';
  if (unit === 0) return result;
  if (unit === 1) return result + ' mốt';
  if (unit === 4) return result + ' tư';
  if (unit === 5) return result + ' lăm';
  return result + ' ' + ones[unit];
}

function readThreeDigits(n) {
  if (n === 0) return '';
  if (n < 10) return ones[n];
  if (n < 100) return readTwoDigits(n);
  var h = Math.floor(n / 100);
  var remainder = n % 100;
  var result = ones[h] + ' trăm';
  if (remainder === 0) return result;
  if (remainder < 10) return result + ' lẻ ' + ones[remainder];
  return result + ' ' + readTwoDigits(remainder);
}

function numberToWords(n) {
  if (n === 0) return 'không';
  if (n < 0) return 'âm ' + numberToWords(-n);

  var parts = [];

  // Millions
  var millions = Math.floor(n / 1000000);
  if (millions > 0) {
    parts.push(readThreeDigits(millions) + ' triệu');
    n = n % 1000000;
  }

  // Thousands
  var thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    parts.push(readThreeDigits(thousands) + ' nghìn');
    n = n % 1000;
    // If remainder has no hundreds digit (1-99), insert "không trăm"
    if (n > 0 && n < 100) {
      parts.push('không trăm');
    }
  }

  // Hundreds / tens / ones
  if (n > 0) {
    if (n < 100 && parts.length > 0 && parts[parts.length - 1] === 'không trăm') {
      if (n < 10) {
        parts.push('lẻ ' + ones[n]);
      } else {
        parts.push(readTwoDigits(n));
      }
    } else {
      parts.push(readThreeDigits(n));
    }
  }

  return parts.join(' ');
}

window.NUMBER_CONFIG = {
  lang: 'vi-VN',
  langKey: 'viet',
  numberToWords: numberToWords,
  levelTips: [
    'Digits 1\u201310: một, hai, ba, bốn, năm, sáu, bảy, tám, chín, mười.',
    '10 = mười. Teens: mười một, mười hai\u2026 From 20 onward, tens use mươi: hai mươi, ba mươi. Special units after mươi: 1\u2192mốt (hai mươi mốt), 4\u2192tư (hai mươi tư), 5\u2192lăm (hai mươi lăm).',
    'Hundreds: [digit] trăm. 300 = ba trăm. Compound: 342 = ba trăm bốn mươi hai. Zero gap: 101 = một trăm lẻ một (Southern convention).',
    'Thousands: [digit] nghìn. 1,000 = một nghìn. 2,500 = hai nghìn năm trăm. When hundreds digit is 0: một nghìn không trăm mười = 1,010.',
    'Large numbers: trăm nghìn (hundred thousands), triệu (millions). 100,000 = một trăm nghìn. 1,000,000 = một triệu.',
  ],
};

})();
