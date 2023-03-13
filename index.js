var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
var puppeteer = require('puppeteer');
var fs = require('fs');
var request = require('request');
(function () { return __awaiter(_this, void 0, void 0, function () {
    var browser, page, urls, entries, panelists, i, results, i_1, path, i_2, panelist;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, puppeteer.launch()];
            case 1:
                browser = _a.sent();
                return [4 /*yield*/, browser.newPage()];
            case 2:
                page = _a.sent();
                return [4 /*yield*/, page.goto('http://www.abc.net.au/tv/qanda/past-programs-by-date.htm', { timeout: 0 })];
            case 3:
                _a.sent();
                return [4 /*yield*/, page.waitForSelector('#filterYear')];
            case 4:
                _a.sent();
                return [4 /*yield*/, page.evaluate(fs.readFileSync('jquery-3.3.1.min.js', 'utf8'))];
            case 5:
                _a.sent();
                // get all episode page url's
                console.log("Getting episode URL's.");
                return [4 /*yield*/, page.evaluate(function () { var _urls = []; $('#filter-items > li > ol > li > div.hentry > a').each(function () { _urls.push($(this).attr('href')); }); return _urls; })];
            case 6:
                urls = _a.sent();
                entries = {};
                panelists = {};
                // process each episode
                console.log("Processing entries...");
                i = 0;
                _a.label = 7;
            case 7:
                if (!(i < urls.length)) return [3 /*break*/, 12];
                // visit episode page
                return [4 /*yield*/, page.goto(urls[i], { timeout: 0 })];
            case 8:
                // visit episode page
                _a.sent();
                return [4 /*yield*/, page.evaluate(fs.readFileSync('node_modules/fuzzyset.js/lib/fuzzyset.js', 'utf8'))];
            case 9:
                _a.sent();
                return [4 /*yield*/, page.evaluate(function () {
                        if (!$('#transcript').length)
                            return "No transcript available";
                        var formatName = function (txt) {
                            //  exceptions to capitalization requirement
                            txt = txt.replace('Mc', 'MC').replace('Mac', 'MAC').replace("’", "'");
                            // ensure text meets name requirements, otherwise return null
                            return (txt == txt.toUpperCase() // name must all be uppercase
                                && !txt.includes('%') // must not include %, indicative of stat embedded in text
                                && !txt.startsWith("OK")) ? txt : // must also not be simply 'OK'
                                null;
                        };
                        // collections to return
                        //  transcript entry
                        var entry = {
                            'date': null,
                            'title': null,
                            'voting': null,
                            'speakers': {},
                            'messages': {},
                            'audience': [],
                            'panelists': [],
                            'host': null
                        };
                        //  panelist descriptions
                        var descriptions = [];
                        //  panelist images
                        var data_dl = [];
                        /**Process date**/
                        // convert from format 'Monday 15 October, 2018' to '15/10/18'
                        var date = $('#epDate').text()
                            .split(' ').map(function (p) { return p.trim(); }).filter(function (p) { return p.length; }) // split into whitespace separated parts
                            .slice(1) // ignore the worded day part
                            .map(function (p, i) {
                            switch (i) {
                                case 0:
                                    return p; // use numbered day of month unmodified e.g. "15"
                                case 1:
                                    return (["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(p.replace(',', '')) + 1).toString(); // convert text-based month to numbered format
                                case 2:
                                    return p.substring(2); // use two-digit decade formatting for year (ignore '20'...)
                            }
                        }).join('/'); // join date parts with '/'
                        if (date)
                            entry.date = date;
                        else
                            return "Non standard date definition";
                        /**Process title**/
                        var title = $('#middleCol > h2');
                        entry.title = title.length ? title.text() : '';
                        /**Process voting preferences. Not required, not present in all transcripts. **/
                        try {
                            var questions = $('#questions').html();
                            var audTag = '<b>Audience:</b>';
                            // determine index's for substring of interest containing polling information
                            var audStart = questions.indexOf(audTag) + audTag.length;
                            var audEnd = questions.indexOf("<br>", audStart);
                            if (questions.includes(audTag) && audStart < audEnd) {
                                entry.voting = // convert from "ALP 37%, Coalition..." to dict of PARTY NAME -> %
                                    questions.substring(audStart, audEnd)
                                        .split(',')
                                        .map(function (p) { return p.trim(); })
                                        .map(function (p) { return p.split(' '); })
                                        .map(function (p) { return ({ 'name': p[0].toUpperCase(), 'percent': parseInt(p[1].slice(0, -1)) }); })
                                        .filter(function (p) { return p.percent; })
                                        .reduce(function (dict, entry) { dict[entry.name] = entry.percent; return dict; }, {});
                            }
                            // sanity check. Polling isn't always for political parties
                            if (['ALP', 'COALITION'].some(function (partyName) { return !(partyName in entry.voting) || !entry.voting[partyName]; }))
                                entry.voting = null;
                        }
                        catch (error) {
                            entry.voting = null;
                        }
                        /**Process panelist details **/
                        var fuzzySpeekers = FuzzySet([]);
                        $('.presenter').each(function (i) {
                            // get name
                            var name = formatName($(this).find('a > h4').text().trim().toUpperCase());
                            // EDGE CASE: Some transcripts have the same panelist listed twice
                            if (entry.panelists.includes(name))
                                return;
                            entry.panelists.push(name);
                            // get description
                            var desc = $(this).find('p').html().split('<br>').map(function (p) { return $('<div>' + p + '</div>').text().trim(); }).filter(function (p) { return p.length; }).join('\n\n');
                            descriptions.push(desc);
                            // get image
                            var img = $(this).find('img');
                            data_dl.push(img.length ? ('http://www.abc.net.au' + img.attr('src')) : null);
                            // we know they'll be speaking, add entry for speakers
                            // ensures there isn't a mismatch later between speaker name and panelist name
                            entry.speakers[name] = { 'name': name, 'responses': [] };
                            fuzzySpeekers.add(name);
                        });
                        /**Process transcript **/
                        // divide transcript into speaking blocks
                        var segments = $('#transcript').html()
                            .split("<br>").map(function (s) { return s.trim(); }) // split into blocks by breaks
                            .filter(function (s) { return !s.startsWith('<span'); }).map(function (s) { return s.split('</span>').pop(); }) // ignore span
                            .map(function (s) { return $('<p>' + s + '</p>').text().trim(); }) // eliminate formatting
                            .filter(function (s) { return s.length > 1 && !['(', '*', '#'].some(function (c) { return s.startsWith(c); }); }); // ignore non-verbal components of transcript, e.g. (audience laughs)
                        var personName = null; // name of current person speaking
                        var paragraphs = ''; // paragraphs that current person has said
                        var messageID = 0; // ID for next message
                        // get speaker entry associated with name
                        var findSpeaker = function (name) {
                            var speakerMatch;
                            var simplify = function (n) { return n.split(' ').filter(function (p) { return p.length > 2; }).join(' '); };
                            var matchBySub = Object.keys(entry.speakers).find(function (sName) {
                                var sA = simplify(name), sB = simplify(sName);
                                return sA.includes(sB) || sB.includes(sA);
                            });
                            var matchByFuzzy = fuzzySpeekers.get(name, null, 0);
                            // attempt to find match by substring (ignoring initials)
                            if (matchBySub)
                                speakerMatch = entry.speakers[matchBySub];
                            // failing, attempt to fuzzy match with similarity % of 75 (e.g. AC Grayling vs A.C. Grayling)
                            else if (matchByFuzzy && matchByFuzzy[0][0] >= 0.75)
                                speakerMatch = entry.speakers[matchByFuzzy[0][1]];
                            // lastly, no match, create a new speaker obj for name
                            else {
                                speakerMatch = (entry.speakers[name] = {
                                    'name': name,
                                    'responses': []
                                });
                                fuzzySpeekers.add(name);
                            }
                            return speakerMatch;
                        };
                        // finalize the response of speaker
                        var finalizeResponse = function () {
                            if (personName && paragraphs.length && !['Q&A'].some(function (invalid) { return personName.includes(invalid); })) {
                                findSpeaker(personName).responses.push(messageID);
                                entry.messages[messageID] = {
                                    'ID': messageID,
                                    'content': paragraphs,
                                    'speaker': findSpeaker(personName).name
                                };
                                messageID++;
                            }
                        };
                        // process transcript segments
                        segments.forEach(function (segment, idx) {
                            var sepIndex = segment.indexOf(':') > -1 ? segment.indexOf(':') : segment.length;
                            var name = formatName(segment.substring(0, sepIndex));
                            if (name) {
                                // name present in segment, e.g. 'TONY JONES', 'TONY JONES: Good Evening', 'TONY JONES:'
                                finalizeResponse();
                                personName = name; // set current speakers name
                                paragraphs = segment.substring(sepIndex + 1).trim();
                            }
                            else {
                                // EDGE CASE: sometimes, there's an intro without accreditation to speaker. Default to Tony.
                                if (!personName && segment.toUpperCase().includes("GOOD EVENING"))
                                    personName = "TONY JONES";
                                // EDGE CASE: last paragraph not always attributed to host
                                else if (idx == segments.length - 1 && personName != entry.messages[0].speaker && segment.toUpperCase().includes("THANK OUR PANEL")) {
                                    finalizeResponse();
                                    personName = entry.messages[0].speaker;
                                    paragraphs = "";
                                }
                                // add to current speakers paragraphs
                                if (personName)
                                    paragraphs += (paragraphs.length ? '\n\n' : '') + segment;
                            }
                        });
                        finalizeResponse();
                        /**Process host**/
                        entry.host = entry.messages[0].speaker;
                        /**Process audience**/
                        entry.audience = Object.keys(entry.speakers).filter(function (n) { return !entry.panelists.includes(n) && n != entry.host; });
                        /**Perform sanity checks**/
                        if (!entry.speakers || Object.keys(entry.speakers).length < 2)
                            return "Invalid transcript format.";
                        return {
                            entry: entry,
                            data_dl: data_dl,
                            descriptions: descriptions
                        };
                    })];
            case 10:
                results = _a.sent();
                if (typeof (results) === 'string') {
                    // error returned, print it
                    console.log("\tERROR processing " + urls[i]);
                    console.log("\tErrorMSG: " + results);
                }
                else {
                    // results returned
                    console.log("\t" + results.entry.date + " processed");
                    // add to images
                    for (i_1 = 0; i_1 < results.data_dl.length; i_1++) {
                        path = './pages/imgs/' + results.entry.panelists[i_1] + '.jpg';
                        if (!fs.existsSync(path) && results.data_dl[i_1])
                            request(results.data_dl[i_1]).pipe(fs.createWriteStream(path));
                    }
                    // add to entries
                    entries[results.entry.date] = results.entry;
                    // add to panelists (update if already present)
                    for (i_2 = 0; i_2 < results.entry.panelists.length; i_2++) {
                        panelist = results.entry.panelists[i_2];
                        if (panelist in panelists)
                            // panelist present, update
                            panelists[panelist].dates.push(results.entry.date);
                        else
                            // panelist not already present, create
                            panelists[panelist] = {
                                name: panelist,
                                dates: [results.entry.date],
                                desc: results.descriptions[i_2]
                            };
                    }
                }
                _a.label = 11;
            case 11:
                i++;
                return [3 /*break*/, 7];
            case 12:
                // page.goto('https://en.wikipedia.org/wiki/Members_of_the_Australian_Senate', {timeout : 0});
                // await page.waitForSelector('.mw-parser-output');
                // await page.evaluate(fs.readFileSync('jquery-3.3.1.min.js', 'utf8'));
                //
                // const senateUrls = await page.evaluate(() => { const _urls = []; $('.mw-parser-output > ul:nth-child(2) a').each(function(){ _urls.push($(this).attr('href'));}); return _urls; });
                // const parliamentNames = [];
                // for(let i = 0; i < senateUrls.length; i++) {
                //     console.log(senateUrls[i]);
                //     await page.goto('http://en.wikipedia.org' + senateUrls[i], {timeout: 0});
                //     await page.evaluate(fs.readFileSync('jquery-3.3.1.min.js', 'utf8'));
                //     const people = await page.evaluate(() => {
                //         const people = [];
                //         $('.wikitable').find('tr').each(function(){
                //             const person = {};
                //             $(this).find('td').each(function(idx){
                //                 let txt = $(this).text().trim().split('[')[0];
                //                 if('name' in person && 'party' in person)
                //                     return;
                //                 if(idx == 0) {
                //                     person['name'] = txt;
                //                 }
                //                 else if($(this).text().trim().length) {
                //                     txt = txt.split('/').pop();
                //                     txt = txt.substring(0, txt.indexOf('[')).trim();
                //                     person['party'] = txt;
                //                 }
                //             });
                //             people.push(person);
                //         });
                //         return people;
                //     });
                //     console.log(JSON.stringify(people));
                // }
                // return;
                // save all the entries
                fs.writeFileSync('JSON/qanda.json', JSON.stringify({
                    'entries': entries,
                    'panelists': panelists
                }));
                console.log("Scraped data saved in 'qanda.json'.");
                return [2 /*return*/];
        }
    });
}); })();
