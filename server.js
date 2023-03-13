const fs = require('fs');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const escapeStringRegexp = require('escape-string-regexp');
const sw = require('stopword')
const port = 8081;

const flatten = (arr) => [].concat(...arr);
const resilient = (f) => (() => {try{ f();} catch(error) {console.log(error)}});

app.use(express.static('pages'));

http.listen(port, () => console.log('listening on ' + port));

const dataset = JSON.parse(fs.readFileSync('JSON/qanda.json', 'utf8'));
const search_eps = Object.values(dataset.entries).map(entry => ({date: entry.date, txt: Object.values(entry.messages).reduce((t, msg) => t + ' ' + msg.content.toUpperCase(), '')}));

//TOFIX: A more reliable method of detecting meaningful words is needed
const IGNORE_WORDS = ['PEOPLE', 'KNOW', 'JUST', 'DONT', 'THINK', 'THATS', 'WELL', 'YEAH', 'MEAN'];
const wordclouds = Object.values(dataset.entries).reduce((entries, entry) => {
    // get list of stop words used in ep
    const stopWords = sw.removeStopwords(Object.values(entry.messages).reduce((t, m) => t.concat(m.content.split(' ').map(w=>w.toUpperCase())), []))
    // get counts of each word
    const wordCounts = stopWords.reduce((words, word) => {words[word] = (word in words) ? words[word] + 1 : 1; return words;}, {})
    // convert to {weight, text}
    const pairs = 
        Object.keys(wordCounts).map(word => ({
            text: word,
            weight: wordCounts[word]
        })).filter(pair => !(/[.,\/#!$%\^&\*;:{}=\-_`~()’']/g).test(pair.text) && !IGNORE_WORDS.includes(pair.text) && pair.weight >= 5 && pair.text.length > 3);
   
    entries[entry.date] = pairs;
    return entries;
}, {});


io.on('connection', (socket) => {
    socket.on('getEpisodes', (date) => resilient( () =>
        socket.emit('getEpisodes',
            {'eps' : Object.values(dataset.entries).filter(ep => ep.date.endsWith(date)).map(ep => ({
                    'title' : ep.title,
                    'date' : ep.date
                }))}))());

    socket.on('getEpisode', (date) => resilient( () =>
        socket.emit('getEpisode', dataset.entries[date])
    )());

    socket.on('getPanelist', (name) => resilient( () =>  {
        name = decodeURIComponent(name);
        socket.emit('getPanelist', {
            details: dataset.panelists[name],
            quotes: flatten(
                dataset.panelists[name].dates.map(date => dataset.entries[date].speakers[name].responses
                    .map(messageID => dataset.entries[date].messages[messageID])
                    .map(message => ({
                        'content': message.content,
                        'date': date,
                        'ID': message.ID
                    }))))
        })
        }
    )());

    socket.on('getPanelists', () => resilient( () =>
        socket.emit('getPanelists', Object.keys(dataset.panelists))
    )());

    socket.on('getTrend', (pat) => resilient(() => {
        socket.emit('getTrend', search_eps
            .map(ep => ({date: ep.date, count : (ep.txt.match(new RegExp(escapeStringRegexp(pat.toUpperCase()), 'g')) || []).length})))
    })());

    socket.on('getWordCloud', (date) => resilient(() => {
        socket.emit('getWordCloud', wordclouds[date]);
    })());
});
