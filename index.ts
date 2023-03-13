const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');

(async () => {
    // set up puppeteer browser & page, and go to the q&a past programs
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://www.abc.net.au/tv/qanda/past-programs-by-date.htm', {timeout : 0});
    await page.waitForSelector('#filterYear');
    await page.evaluate(fs.readFileSync('jquery-3.3.1.min.js', 'utf8'));

    // get all episode page url's
    console.log("Getting episode URL's.");
    const urls = await page.evaluate(() => { const _urls = []; $('#filter-items > li > ol > li > div.hentry > a').each(function() { _urls.push($(this).attr('href')); }); return _urls; });

    // data collections
    const entries = {}; // episode info + transcript
    const panelists = {}; // panelist info

    // process each episode
    console.log("Processing entries...");
    for (let i = 0; i < urls.length; i++) {
        // visit episode page
        await page.goto(urls[i], {timeout: 0});
        await page.evaluate(fs.readFileSync('node_modules/fuzzyset.js/lib/fuzzyset.js', 'utf8'));

        // get data for episode
        const results = await page.evaluate(() => {
            if (!$('#transcript').length)
                return "No transcript available";

            const formatName = (txt) => {
                //  exceptions to capitalization requirement
                txt = txt.replace('Mc', 'MC').replace('Mac', 'MAC').replace("’", "'");
                // ensure text meets name requirements, otherwise return null
                return (
                    txt == txt.toUpperCase() // name must all be uppercase
                    && !txt.includes('%') // must not include %, indicative of stat embedded in text
                    && !txt.startsWith("OK")) ? txt : // must also not be simply 'OK'
                    null;
            };

            // collections to return
            //  transcript entry
            const entry = {
                'date': null,
                'title': null,
                'voting': null,
                'speakers': {},
                'messages': {},
                'audience': [],
                'panelists': [],
                'host': null,
            };
            //  panelist descriptions
            const descriptions = [];
            //  panelist images
            const data_dl = [];

            /**Process date**/
            // convert from format 'Monday 15 October, 2018' to '15/10/18'
            const date = $('#epDate').text()
                .split(' ').map(p => p.trim()).filter(p => p.length) // split into whitespace separated parts
                .slice(1) // ignore the worded day part
                .map((p, i) => { // convert date parts
                    switch(i) {
                        case 0:
                            return p; // use numbered day of month unmodified e.g. "15"
                        case 1:
                            return (["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(p.replace(',','')) + 1).toString(); // convert text-based month to numbered format
                        case 2:
                            return p.substring(2); // use two-digit decade formatting for year (ignore '20'...)
                    }
                }).join('/'); // join date parts with '/'
            if(date)
                entry.date = date;
            else
                return "Non standard date definition";

            /**Process title**/
            const title = $('#middleCol > h2');
            entry.title = title.length ? title.text() : '';

            /**Process voting preferences. Not required, not present in all transcripts. **/
            try {
                const questions = $('#questions').html();
                const audTag = '<b>Audience:</b>';
                // determine index's for substring of interest containing polling information
                const audStart = questions.indexOf(audTag) + audTag.length;
                const audEnd = questions.indexOf("<br>", audStart);
                if (questions.includes(audTag) && audStart < audEnd) {
                    entry.voting =  // convert from "ALP 37%, Coalition..." to dict of PARTY NAME -> %
                        questions.substring(audStart, audEnd)
                            .split(',')
                            .map(p => p.trim())
                            .map(p => p.split(' '))
                            .map(p => ({'name': p[0].toUpperCase(), 'percent': parseInt(p[1].slice(0, -1))}))
                            .filter(p => p.percent)
                            .reduce((dict, entry) => {dict[entry.name] = entry.percent; return dict;}, {});
                }
                // sanity check. Polling isn't always for political parties
                if(['ALP', 'COALITION'].some(partyName => !(partyName in entry.voting) || !entry.voting[partyName]))
                    entry.voting = null;
            } catch (error) {
                entry.voting = null;
            }

            /**Process panelist details **/
            const fuzzySpeekers = FuzzySet([]);
            $('.presenter').each(function (i) {
                // get name
                const name = formatName($(this).find('a > h4').text().trim().toUpperCase());
                // EDGE CASE: Some transcripts have the same panelist listed twice
                if(entry.panelists.includes(name))
                    return;
                entry.panelists.push(name);
                // get description
                const desc = $(this).find('p').html().split('<br>').map(p => $('<div>'+p+'</div>').text().trim()).filter(p => p.length).join('\n\n');
                descriptions.push(desc);
                // get image
                const img = $(this).find('img');
                data_dl.push(img.length ? ('http://www.abc.net.au' + img.attr('src')) : null);
                // we know they'll be speaking, add entry for speakers
                // ensures there isn't a mismatch later between speaker name and panelist name
                entry.speakers[name] = {'name': name, 'responses': []};
                fuzzySpeekers.add(name);
            });

            /**Process transcript **/
            // divide transcript into speaking blocks
            let segments = $('#transcript').html()
                    .split("<br>").map(s => s.trim()) // split into blocks by breaks
                    .filter(s => !s.startsWith('<span')).map(s => s.split('</span>').pop()) // ignore span
                    .map(s => $('<p>' + s + '</p>').text().trim()) // eliminate formatting
                    .filter(s => s.length > 1 && !['(', '*', '#'].some(c => s.startsWith(c))); // ignore non-verbal components of transcript, e.g. (audience laughs)

            let personName = null; // name of current person speaking
            let paragraphs = ''; // paragraphs that current person has said
            let messageID = 0; // ID for next message

            // get speaker entry associated with name
            const findSpeaker = (name) => {
                let speakerMatch;
                const simplify = (n) => n.split(' ').filter(p => p.length > 2).join(' ');
                const matchBySub = Object.keys(entry.speakers).find(sName => {
                    const sA = simplify(name), sB = simplify(sName);
                    return sA.includes(sB) || sB.includes(sA)
                    }
                );
                const matchByFuzzy = fuzzySpeekers.get(name, null, 0);
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
            const finalizeResponse = () => {
                if (personName && paragraphs.length && !['Q&A'].some(invalid => personName.includes(invalid))) {
                    findSpeaker(personName).responses.push(messageID);
                    entry.messages[messageID] = {
                      'ID' : messageID,
                      'content' : paragraphs,
                      'speaker' : findSpeaker(personName).name
                    };
                    messageID++;
                }
            };

            // process transcript segments
            segments.forEach((segment, idx) => {
                const sepIndex = segment.indexOf(':') > -1 ? segment.indexOf(':') : segment.length;
                const name = formatName(segment.substring(0, sepIndex));
                if (name) {
                    // name present in segment, e.g. 'TONY JONES', 'TONY JONES: Good Evening', 'TONY JONES:'
                    finalizeResponse();
                    personName = name; // set current speakers name
                    paragraphs = segment.substring(sepIndex+1).trim();
                }
                else {
                    // EDGE CASE: sometimes, there's an intro without accreditation to speaker. Default to Tony.
                    if (!personName && segment.toUpperCase().includes("GOOD EVENING"))
                        personName = "TONY JONES";
                    // EDGE CASE: last paragraph not always attributed to host
                    else if(idx == segments.length-1 && personName != entry.messages[0].speaker && segment.toUpperCase().includes("THANK OUR PANEL")) {
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
            entry.audience = Object.keys(entry.speakers).filter(n => !entry.panelists.includes(n) && n != entry.host);

            /**Perform sanity checks**/
            if (!entry.speakers || Object.keys(entry.speakers).length < 2)
                return "Invalid transcript format.";
            return {
                entry: entry,
                data_dl: data_dl,
                descriptions: descriptions,
            };
        });

        if(typeof(results) === 'string') {
            // error returned, print it
            console.log("\tERROR processing " + urls[i]);
            console.log("\tErrorMSG: " + results);
        } else {
            // results returned
            console.log("\t" + results.entry.date + " processed");

            // add to images
            for(let i = 0; i < results.data_dl.length; i++) {
                const path = './pages/imgs/' + results.entry.panelists[i] + '.jpg';
                if(!fs.existsSync(path) && results.data_dl[i])
                    request(results.data_dl[i]).pipe(fs.createWriteStream(path));
            }

            // add to entries
            entries[results.entry.date] = results.entry;

            // add to panelists (update if already present)
            for(let i = 0; i < results.entry.panelists.length; i++) {
                const panelist = results.entry.panelists[i];
                if(panelist in panelists)
                    // panelist present, update
                    panelists[panelist].dates.push(results.entry.date);
                else
                    // panelist not already present, create
                    panelists[panelist] = {
                        name: panelist,
                        dates : [results.entry.date],
                        desc: results.descriptions[i]
                    }
            }
        }
    }

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
})();