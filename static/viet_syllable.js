/* viet_syllable.js — Vietnamese syllable parser and TTS helper.
   No dependencies. Works in browser alongside shared.js.
   Exports: window.VietSyllable = { parse, stripTone, callPronounce } */
(function () {
  'use strict';

  // Tone diacritic → [toneName, toneNum]
  // toneNum 1=ngang, 2=huyền, 3=hỏi, 4=ngã, 5=sắc, 6=nặng
  var TONE_MAP = {
    'á':'sắc','ắ':'sắc','ấ':'sắc','é':'sắc','ế':'sắc','í':'sắc',
    'ó':'sắc','ố':'sắc','ớ':'sắc','ú':'sắc','ứ':'sắc','ý':'sắc',
    'à':'huyền','ằ':'huyền','ầ':'huyền','è':'huyền','ề':'huyền','ì':'huyền',
    'ò':'huyền','ồ':'huyền','ờ':'huyền','ù':'huyền','ừ':'huyền','ỳ':'huyền',
    'ả':'hỏi','ẳ':'hỏi','ẩ':'hỏi','ẻ':'hỏi','ể':'hỏi','ỉ':'hỏi',
    'ỏ':'hỏi','ổ':'hỏi','ở':'hỏi','ủ':'hỏi','ử':'hỏi','ỷ':'hỏi',
    'ã':'ngã','ẵ':'ngã','ẫ':'ngã','ẽ':'ngã','ễ':'ngã','ĩ':'ngã',
    'õ':'ngã','ỗ':'ngã','ỡ':'ngã','ũ':'ngã','ữ':'ngã','ỹ':'ngã',
    'ạ':'nặng','ặ':'nặng','ậ':'nặng','ẹ':'nặng','ệ':'nặng','ị':'nặng',
    'ọ':'nặng','ộ':'nặng','ợ':'nặng','ụ':'nặng','ự':'nặng','ỵ':'nặng',
  };

  var TONE_NUM = { ngang:1, huyền:2, hỏi:3, ngã:4, sắc:5, nặng:6 };

  // Tone-marked vowel → base vowel (for display in breakdown)
  var STRIP_MAP = {
    'á':'a','ắ':'ă','ấ':'â','é':'e','ế':'ê','í':'i','ó':'o','ố':'ô','ớ':'ơ','ú':'u','ứ':'ư','ý':'y',
    'à':'a','ằ':'ă','ầ':'â','è':'e','ề':'ê','ì':'i','ò':'o','ồ':'ô','ờ':'ơ','ù':'u','ừ':'ư','ỳ':'y',
    'ả':'a','ẳ':'ă','ẩ':'â','ẻ':'e','ể':'ê','ỉ':'i','ỏ':'o','ổ':'ô','ở':'ơ','ủ':'u','ử':'ư','ỷ':'y',
    'ã':'a','ẵ':'ă','ẫ':'â','ẽ':'e','ễ':'ê','ĩ':'i','õ':'o','ỗ':'ô','ỡ':'ơ','ũ':'u','ữ':'ư','ỹ':'y',
    'ạ':'a','ặ':'ă','ậ':'â','ẹ':'e','ệ':'ê','ị':'i','ọ':'o','ộ':'ô','ợ':'ơ','ụ':'u','ự':'ư','ỵ':'y',
  };

  // Ordered longest-first so we match "ngh" before "ng" before "nh" etc.
  var INITIALS = [
    'ngh','ng','nh','ch','gh','gi','kh','ph','th','tr','qu',
    'b','c','d','đ','g','h','k','l','m','n','p','r','s','t','v','x'
  ];

  // Ordered longest-first: ch/ng/nh before single consonants
  var FINALS = ['ch','ng','nh','c','m','n','p','t'];

  function detectTone(syl) {
    for (var i = 0; i < syl.length; i++) {
      var t = TONE_MAP[syl[i]];
      if (t) return { tone: t, toneNum: TONE_NUM[t] };
    }
    return { tone: 'ngang', toneNum: 1 };
  }

  function stripToneStr(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      out += STRIP_MAP[s[i]] || s[i];
    }
    return out;
  }

  function parseSyllable(raw) {
    var syl = raw.trim().toLowerCase();
    if (!syl) return null;

    // Step 1: detect tone (keep diacritics for steps 2-4)
    var toneInfo = detectTone(syl);

    // Step 2: match initial consonant (longest first)
    // Use tone-stripped string for prefix matching so "gi" matches "gì" (ì stripped → i)
    var sylStripped = stripToneStr(syl);
    var initial = '';
    for (var i = 0; i < INITIALS.length; i++) {
      if (sylStripped.slice(0, INITIALS[i].length) === INITIALS[i]) {
        initial = INITIALS[i];
        break;
      }
    }

    // Edge case: gi stripped leaves nothing — e.g. "gì" where tone mark is on i
    // (stripped "gi" matches, but original syl.slice(2) is empty)
    var rest = syl.slice(initial.length);
    if (!rest && initial === 'gi') {
      return { raw: raw, tone: toneInfo.tone, toneNum: toneInfo.toneNum, initial: '', nucleus: stripToneStr(syl), final: '' };
    }

    // Step 3: match final consonant (longest first) — nucleus must be non-empty
    var final_ = '';
    for (var j = 0; j < FINALS.length; j++) {
      var f = FINALS[j];
      if (rest.length > f.length && rest.slice(-f.length) === f) {
        final_ = f;
        rest = rest.slice(0, rest.length - f.length);
        break;
      }
    }

    // Steps 4+5: rest is the nucleus (with tone mark); strip for display
    return {
      raw:     raw,
      tone:    toneInfo.tone,
      toneNum: toneInfo.toneNum,
      initial: initial,
      nucleus: stripToneStr(rest),
      final:   final_,
    };
  }

  function parse(word) {
    if (!word) return [];
    return word.trim().split(/\s+/).map(parseSyllable).filter(Boolean);
  }

  // Passes text DIRECTLY to SpeechSynthesisUtterance — no stripping,
  // tone diacritics must be preserved for correct Vietnamese TTS.
  function callPronounce(text, lang) {
    if (!window.speechSynthesis) return;
    var utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang || 'vi-VN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  }

  window.VietSyllable = {
    parse:         parse,
    stripTone:     function (ch) { return STRIP_MAP[ch] || ch; },
    callPronounce: callPronounce,
  };
})();
