//
//
//




function clone(src) {
  return JSON.parse(JSON.stringify(src));
}

var WIKI_TIMEOUT = 6 * 1000;
function QueryWiki(lang, initArgs, callback, opt_retries) {
  if (opt_retries === undefined) opt_retries = 3;

  var args = clone(initArgs);
  args['continue'] = args['continue'] || '';
  MediaWikiJS('http://' + lang + '.wikipedia.org', args, function(data) {
    console.log('Received', data, 'from', lang, args);
    if (callback) {
      var mycall = callback;
      callback = null;
      queryData = data && data.query;
      
      mycall(queryData, (data && data['continue']));

      if (data && data['continue']) {
        var contArgs = clone(initArgs);
        for (var attr in data['continue']) contArgs[attr] = data['continue'][attr];
        QueryWiki(lang, contArgs, mycall);
      }
    }
  });

  setTimeout(function() {
    if (callback) {
      var mycall = callback;
      callback = null;
      if (opt_retries) {
        console.error('Retry', lang, '-', opt_retries, 'attempts left');
        QueryWiki(lang, args, mycall, opt_retries - 1);
      } else {
        console.error('Failed to get', lang);
        mycall(null);
      }
    }
  }, WIKI_TIMEOUT);
}

/**
 * Returns
 *  {
 *    links: [ <string: title>... ],
 *    languages:
 *      {
 *        <string: language code> : <string: title>,
 *        ...
 *      }
 *  }
 */
function getNativeLinks(langCode, title, callback) {
  var args = {
    action: 'query',
    titles: title,
    prop: 'links|langlinks',
    redirects: true,
    pllimit: 500,
    lllimit: 500
  };
  var links = [];
  var langs = {};
  QueryWiki(langCode, args, function(data, hasMore) {
    if (!data) return callback(null);

    var page = data.pages[Object.keys(data.pages)[0]];
    if (page.missing === '') return callback(null);

    links = links.concat(page.links.map(function(lo) {
      return lo.title;
    }));

    page.langlinks = page.langlinks || [];
    page.langlinks.forEach(function(lpage) {
      langs[lpage.lang] = lpage['*'];
    });

    if (!hasMore) callback({ links: links, languages: langs });
  });
}

/**
 * Returns
 *  {
 *    links: [ <string: title>... ],
 *    noTranslation: [ <string: title>...]
 *  }
 */
function getForeignLinks(foreignCode, nativeCode, title, callback) {
  var args = {
    action: 'query',
    generator: 'links',
    titles: title,
    prop: 'langlinks',
    redirects: true,
    lllang: nativeCode,
    lllimit: 500,
    gpllimit: 500
  };
  var links = [];
  var notrans = [];
  QueryWiki(foreignCode, args, function(data, hasMore) {
    if (!data) return callback(null);

    for (var pageId in data.pages) {
      var llink = data.pages[pageId].langlinks;
      if (llink) {
        links.push(llink[0]['*']);
      } else {
        notrans.push(data.pages[pageId].title);
      }
    }

    if (!hasMore) callback({ links: links, noTranslation: notrans });
  });
}

//====

document.addEventListener('DOMContentLoaded', function() {
  var titleField = document.getElementById('title'),
    lookupButton = document.getElementById('lookup'),
    nativeLang = document.getElementById('lang-native'),
    foreignLang = document.getElementById('lang-foreign'),
    nativeSpinner = document.getElementById('native-spinner'),
    foreignSpinner = document.getElementById('foreign-spinner'),
    notFoundMessage = document.getElementById('msg-notfound'),
    noResultMessage = document.getElementById('msg-noresult'),
    headingNative = document.getElementById('heading-native'),
    headingForeign = document.getElementById('heading-foreign'),
    commonList = document.getElementById('list-common'),
    nativeList= document.getElementById('list-native'),
    foreignList = document.getElementById('list-foreign');

  for (var code in wikicode) {
    var option = document.createElement('option');
    option.text = wikicode[code];
    nativeLang.add(option);
  }

  var nativeCode, foreignCode, nativeResults, nativeTitle,
    foreignResults = {};

  function makeLi(lang, title) {
    var link = document.createElement('li');
    link.innerHTML = '<a target=\"_blank\" href=\"http://' + lang +
      '.wikipedia.org/wiki/' + title.replace(/ /g, '_') + '\">' +
      title + '</a>';
    return link;
  }

  function doLookup() {
    nativeSpinner.style.visibility = 'visible';
    notFoundMessage.style.visibility = 'hidden';
    noResultMessage.style.visibility = 'hidden';
    lookup.disabled = true;

    nativeTitle = titleField.value;
    nativeCode = langwiki[nativeLang.value];
    getNativeLinks(nativeCode, nativeTitle, function(wikiResults) {
      lookup.disabled = false;
      nativeSpinner.style.visibility = 'hidden';
      if (!wikiResults) {
        notFoundMessage.style.visibility = 'visible';
        return;
      }

      nativeResults = wikiResults;
      nativeResults.links.sort();

      for (var i = foreignLang.options.length; i >= 0; i--)
        foreignLang.remove(i);

      var flangs = Object.keys(wikiResults.languages).map(function(code) {
        return wikicode[code];
      });
      flangs.sort();
      flangs.forEach(function(flang) {
        if (langwiki[flang] == nativeCode) return;
        var option = document.createElement('option');
        option.text = flang;
        foreignLang.add(option);
      });
      foreignLang.disabled = false;
      if (!wikiResults.languages[foreignCode] && wikiResults.languages['es']) {
        foreignCode = 'es'; // A good default
      }
      foreignLang.value = wikicode[foreignCode];

      foreignResults = {};
      setForeign();
    });
  };

  function setForeign() {
    noResultMessage.style.visibility = 'hidden';
    foreignCode = langwiki[foreignLang.value];
    if (!foreignResults[foreignCode]) {
      foreignSpinner.style.visibility = 'visible';
      getForeignLinks(foreignCode, nativeCode, nativeResults.languages[foreignCode], function(wikiResults) {
        if (!wikiResults) {
          noResultMessage.style.visibility = 'visible';
          return;
        }
        wikiResults.links.sort();
        wikiResults.noTranslation.sort();
        foreignResults[foreignCode] = wikiResults;
        setForeign();
      });
      return;
    }
    foreignSpinner.style.visibility = 'hidden';

    window.location.hash = nativeCode + '&' + foreignCode + '&' + encodeURIComponent(nativeTitle);

    var nativeLinks = nativeResults.links;
    var foreignLinks = foreignResults[foreignCode].links;
    var noTrans = foreignResults[foreignCode].noTranslation;
    var commonLinks = [];

    headingNative.innerHTML = '<a target=\"_blank\" href=\"http://' + nativeCode +
      '.wikipedia.org/wiki/' + nativeTitle.replace(/ /g, '_') + '\">' +
      wikicode[nativeCode] + ': ' + nativeTitle + ' &#8599</a>';

    headingForeign.innerHTML = '<a target=\"_blank\" href=\"http://' + foreignCode +
      '.wikipedia.org/wiki/' + nativeResults.languages[foreignCode].replace(/ /g, '_') + '\">' +
      wikicode[foreignCode] + ': ' + nativeResults.languages[foreignCode] + ' &#8599</a>';

    nativeList.innerHTML = '';
    foreignList.innerHTML = '';
    commonList.innerHTML = '';

    nativeLinks.forEach(function(title) {
      var link = makeLi(nativeCode, title);
      if (foreignLinks.indexOf(title) < 0) {
        nativeList.appendChild(link);
      } else {
        commonLinks.push(title);
        commonList.appendChild(link);
      }
    });
    foreignLinks.forEach(function(title) {
      if (commonLinks.indexOf(title) < 0) {
        var link = makeLi(nativeCode, title);
        foreignList.appendChild(link);
      }
    });

    if (noTrans.length) {
      var noTransHeader = document.createElement('li');
      noTransHeader.className = 'lihead';
      noTransHeader.innerHTML = 'No ' + wikicode[nativeCode] + ' Versions';
      foreignList.appendChild(noTransHeader);
    }
    noTrans.forEach(function(title) {
      var link = makeLi(foreignCode, title);
      foreignList.appendChild(link);
    });
  };

  titleField.addEventListener('keypress', function(evt) {
    if (evt.keyCode == 13) doLookup();
  });
  lookupButton.addEventListener('click', doLookup);
  foreignLang.addEventListener('change', setForeign);

  if (!window.location.hash) window.location.hash = 'en&nl&Constructed%20Language';
  var params = window.location.hash.substring(1,window.location.hash.length).split('&');
  nativeCode = params[0];
  foreignCode = params[1];
  nativeTitle = decodeURIComponent(params[2]);
  titleField.value = nativeTitle;
  nativeLang.value = wikicode[nativeCode];
  
  doLookup();
});



var wikicode = {
  'aa': 'Afar', 'ab': 'Abkhazian', 'ace': 'Achinese', 'af': 'Afrikaans',
  'ak': 'Akan', 'als': 'Alemannisch', 'am': 'Amharic', 'an': 'Aragonese',
  'ang': 'Old English', 'ar': 'Arabic', 'arc': 'Aramaic', 'arz': 'Egyptian Spoken Arabic',
  'as': 'Assamese', 'ast': 'Asturian', 'av': 'Avaric', 'ay': 'Aymara',
  'az': 'Azerbaijani', 'ba': 'Bashkir', 'bar': 'Bavarian', 'bat-smg': 'Samogitian',
  'bcl': 'Bikol Central', 'be': 'Belarusian', 'be-x-old': 'тарашкевіца', 'bg': 'Bulgarian',
  'bh': 'भोजपुरी', 'bi': 'Bislama', 'bjn': 'Banjar', 'bm': 'Bambara',
  'bn': 'Bengali', 'bo': 'Tibetan', 'bpy': 'Bishnupuriya Manipuri', 'br': 'Breton',
  'bs': 'Bosnian', 'bug': 'Buginese', 'bxr': 'буряад', 'ca': 'Catalan',
  'cbk-zam': 'Chavacano de Zamboanga', 'cdo': 'Min Dong Chinese', 'ce': 'Chechen', 'ceb': 'Cebuano',
  'ch': 'Chamorro', 'cho': 'Choctaw', 'chr': 'Cherokee', 'chy': 'Cheyenne',
  'ckb': 'Sorani Kurdish', 'co': 'Corsican', 'cr': 'Cree', 'crh': 'Crimean Turkish',
  'cs': 'Czech', 'csb': 'Kashubian', 'cu': 'Church Slavic', 'cv': 'Chuvash',
  'cy': 'Welsh', 'da': 'Danish', 'de': 'German', 'diq': 'Zazaki',
  'dsb': 'Lower Sorbian', 'dv': 'Divehi', 'dz': 'Dzongkha', 'ee': 'Ewe',
  'el': 'Greek', 'eml': 'Emiliano-Romagnolo', 'en': 'English', 'eo': 'Esperanto',
  'es': 'Spanish', 'et': 'Estonian', 'eu': 'Basque', 'ext': 'Extremaduran',
  'fa': 'Persian', 'ff': 'Fulah', 'fi': 'Finnish', 'fiu-vro': 'Võro',
  'fj': 'Fijian', 'fo': 'Faroese', 'fr': 'French', 'frp': 'Franco-Provençal',
  'frr': 'Northern Frisian', 'fur': 'Friulian', 'fy': 'Western Frisian', 'ga': 'Irish',
  'gag': 'Gagauz', 'gan': 'Gan', 'gd': 'Scottish Gaelic', 'gl': 'Galician',
  'glk': 'Gilaki', 'gn': 'Guarani', 'got': 'Gothic', 'gu': 'Gujarati',
  'gv': 'Manx', 'ha': 'Hausa', 'hak': 'Hakka', 'haw': 'Hawaiian',
  'he': 'Hebrew', 'hi': 'Hindi', 'hif': 'Fiji Hindi', 'ho': 'Hiri Motu',
  'hr': 'Croatian', 'hsb': 'Upper Sorbian', 'ht': 'Haitian', 'hu': 'Hungarian',
  'hy': 'Armenian', 'hz': 'Herero', 'ia': 'Interlingua', 'id': 'Indonesian',
  'ie': 'Interlingue', 'ig': 'Igbo', 'ii': 'Sichuan Yi', 'ik': 'Inupiaq',
  'ilo': 'Iloko', 'io': 'Ido', 'is': 'Icelandic', 'it': 'Italian',
  'iu': 'Inuktitut', 'ja': 'Japanese', 'jbo': 'Lojban', 'jv': 'Javanese',
  'ka': 'Georgian', 'kaa': 'Kara-Kalpak', 'kab': 'Kabyle', 'kbd': 'Kabardian',
  'kg': 'Kongo', 'ki': 'Kikuyu', 'kj': 'Kuanyama', 'kk': 'Kazakh',
  'kl': 'Kalaallisut', 'km': 'Khmer', 'kn': 'Kannada', 'ko': 'Korean',
  'koi': 'Komi-Permyak', 'kr': 'Kanuri', 'krc': 'Karachay-Balkar', 'ks': 'Kashmiri',
  'ksh': 'Colognian', 'ku': 'Kurdish', 'kv': 'Komi', 'kw': 'Cornish',
  'ky': 'Kyrgyz', 'la': 'Latin', 'lad': 'Ladino', 'lb': 'Luxembourgish',
  'lbe': 'лакку', 'lez': 'Lezghian', 'lg': 'Ganda', 'li': 'Limburgish',
  'lij': 'Ligurian', 'lmo': 'Lombard', 'ln': 'Lingala', 'lo': 'Lao',
  'lt': 'Lithuanian', 'ltg': 'Latgalian', 'lv': 'Latvian', 'mai': 'Maithili',
  'map-bms': 'Basa Banyumasan', 'mdf': 'Moksha', 'mg': 'Malagasy', 'mh': 'Marshallese',
  'mhr': 'Eastern Mari', 'mi': 'Maori', 'min': 'Minangkabau', 'mk': 'Macedonian',
  'ml': 'Malayalam', 'mn': 'Mongolian', 'mo': 'молдовеняскэ', 'mr': 'Marathi',
  'mrj': 'Hill Mari', 'ms': 'Malay', 'mt': 'Maltese', 'mus': 'Creek',
  'mwl': 'Mirandese', 'my': 'Burmese', 'myv': 'Erzya', 'mzn': 'Mazanderani',
  'na': 'Nauru', 'nah': 'Nāhuatl', 'nap': 'Neapolitan', 'nds': 'Low German',
  'nds-nl': 'Low Saxon (Netherlands)', 'ne': 'Nepali', 'new': 'Newari', 'ng': 'Ndonga',
  'nl': 'Dutch', 'nn': 'Norwegian Nynorsk', 'no': 'Norwegian (bokmål)', 'nov': 'Novial',
  'nrm': 'Nouormand', 'nso': 'Northern Sotho', 'nv': 'Navajo', 'ny': 'Nyanja',
  'oc': 'Occitan', 'om': 'Oromo', 'or': 'Oriya', 'os': 'Ossetic',
  'pa': 'Punjabi', 'pag': 'Pangasinan', 'pam': 'Pampanga', 'pap': 'Papiamento',
  'pcd': 'Picard', 'pdc': 'Pennsylvania German', 'pfl': 'Palatine German', 'pi': 'Pali',
  'pih': 'Norfuk / Pitkern', 'pl': 'Polish', 'pms': 'Piedmontese', 'pnb': 'Western Punjabi',
  'pnt': 'Pontic', 'ps': 'Pashto', 'pt': 'Portuguese', 'qu': 'Quechua',
  'rm': 'Romansh', 'rmy': 'Romani', 'rn': 'Rundi', 'ro': 'Romanian',
  'roa-rup': 'Aromanian', 'roa-tara': 'tarandíne', 'ru': 'Russian', 'rue': 'Rusyn',
  'rw': 'Kinyarwanda', 'sa': 'Sanskrit', 'sah': 'Sakha', 'sc': 'Sardinian',
  'scn': 'Sicilian', 'sco': 'Scots', 'sd': 'Sindhi', 'se': 'Northern Sami',
  'sg': 'Sango', 'sh': 'Serbo-Croatian', 'si': 'Sinhala', 'simple': 'Simple English',
  'sk': 'Slovak', 'sl': 'Slovenian', 'sm': 'Samoan', 'sn': 'Shona',
  'so': 'Somali', 'sq': 'Albanian', 'sr': 'Serbian', 'srn': 'Sranan Tongo',
  'ss': 'Swati', 'st': 'Southern Sotho', 'stq': 'Saterland Frisian', 'su': 'Sundanese',
  'sv': 'Swedish', 'sw': 'Swahili', 'szl': 'Silesian', 'ta': 'Tamil',
  'te': 'Telugu', 'tet': 'Tetum', 'tg': 'Tajik', 'th': 'Thai',
  'ti': 'Tigrinya', 'tk': 'Turkmen', 'tl': 'Tagalog', 'tn': 'Tswana',
  'to': 'Tongan', 'tpi': 'Tok Pisin', 'tr': 'Turkish', 'ts': 'Tsonga',
  'tt': 'Tatar', 'tum': 'Tumbuka', 'tw': 'Twi', 'ty': 'Tahitian',
  'tyv': 'Tuvinian', 'udm': 'Udmurt', 'ug': 'Uyghur', 'uk': 'Ukrainian',
  'ur': 'Urdu', 'uz': 'Uzbek', 've': 'Venda', 'vec': 'Venetian',
  'vep': 'Veps', 'vi': 'Vietnamese', 'vls': 'West Flemish', 'vo': 'Volapük',
  'wa': 'Walloon', 'war': 'Waray', 'wo': 'Wolof', 'wuu': 'Wu',
  'xal': 'Kalmyk', 'xh': 'Xhosa', 'xmf': 'Mingrelian', 'yi': 'Yiddish',
  'yo': 'Yoruba', 'za': 'Zhuang', 'zea': 'Zeeuws', 'zh': 'Chinese',
  'zh-classical': 'Classical Chinese', 'zh-min-nan': 'Chinese (Min Nan)', 'zh-yue': 'Cantonese', 'zu': 'Zulu'
};

var langwiki = {};
for (var code in wikicode) {
  langwiki[wikicode[code]] = code;
}
