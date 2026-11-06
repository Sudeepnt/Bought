/* Bought. Daily: what an issue holds. The funnel publishes each issue as issues/<date>/issue.json; js/issue.js loads it into these. */
const CATS=[
 {name:"AI",v:"--c-ai",g:"A",pg:"A",feed:"feed-a"},
 {name:"Technology",v:"--c-tech",g:"T",pg:"B",after:"cls-0"},
 {name:"Business",v:"--c-biz",g:"$",pg:"C",after:"half"},
 {name:"Founders",v:"--c-found",g:"F",pg:"D"},
 {name:"Launches",v:"--c-launch",g:"L",pg:"E",feed:"feed-e"},
 {name:"Geopolitics",v:"--c-geo",g:"G",pg:"F"}
];
const CAT=Object.fromEntries(CATS.map(c=>[c.name,c]));
const JOUR={Ira:{c:"#6553c4",d:"AI & tech"},Kabir:{c:"#b4432b",d:"business"},Rio:{c:"#38805a",d:"launches"},Noor:{c:"#89496f",d:"geopolitics"}};
/* one entry per story: id, uid, cat, sz (lead/top/xl/m/s/b=brief), media (auto/thumb/pic/none), len, min, j, kick, t, dek, gist[], body[], why, src[name,link], video, poster, picture, credit */
const S=[];
const LAYOUT=Object.fromEntries(CATS.map(c=>[c.name,{main:[],briefs:[]}]));
const NUMS=[];
const BRIEF=[];
const ORDER=[];
const CLIPIDS=[];
const POLLS={};
const RXSET=["Useful","Surprising","Worrying","Skeptical"];
const RX={};
const LANG_NAMES={"zh-CN":"Mandarin Chinese","es-ES":"Spanish","fr-FR":"French","pt-BR":"Portuguese","ru-RU":"Russian","ja-JP":"Japanese","hi-IN":"हिन्दी","ar":"Arabic","af":"Afrikaans","sq":"Albanian","am":"Amharic","hy":"Armenian","az":"Azerbaijani","my":"Burmese","ca":"Catalan","cs":"Czech","da":"Danish","nl":"Dutch","fil":"Filipino","fi":"Finnish","ka":"Georgian","de":"German","el":"Greek","gu":"Gujarati","he":"Hebrew","hu":"Hungarian","is":"Icelandic","id":"Indonesian","it":"Italian","kn":"ಕನ್ನಡ","ko":"Korean","ms":"Malay","ml":"Malayalam","mr":"Marathi","ne":"Nepali","nb":"Norwegian","or":"Odia","fa":"Persian","pl":"Polish","pa":"Punjabi","ro":"Romanian","sr":"Serbian","si":"Sinhala","sk":"Slovak","sw":"Swahili","sv":"Swedish","ta":"Tamil","th":"Thai","tr":"Turkish","uk":"Ukrainian","ur":"Urdu","uz":"Uzbek","vi":"Vietnamese","cy":"Welsh","ast":"Asturian","be":"Belarusian","bs":"Bosnian","br":"Breton","bg":"Bulgarian","hr":"Croatian","et":"Estonian","fy":"Frisian","gl":"Galician","ga":"Irish","lv":"Latvian","lt":"Lithuanian","lb":"Luxembourgish","mk":"Macedonian","oc":"Occitan","gd":"Scottish Gaelic","sl":"Slovenian"};
