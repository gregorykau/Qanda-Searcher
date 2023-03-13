const gender = require('gender-detection');
const fs = require('fs');

const qanda = JSON.parse(fs.readFileSync('qanda.json'));

const flatten = (arr) => [].concat(...arr);

const americanDate = (date) => {
    const parts = date.split('/');
    return [parts[1], parts[0], parts[2]].join('/');
};


fs.writeFileSync('gender.json', JSON.stringify(Object.values(qanda.entries).map(entry => {
    const headCount = (group, gen) => entry[group].filter(n => gender.detect(n) === gen).length;
    const wordCount = (group, gen) => flatten(
        entry[group]
            .filter(n => gender.detect(n) === gen)
            .map(n => entry.speakers[n].responses.map(id => entry.messages[id].content)))
        .reduce((c, msg) => c + msg.split(' ').length, 0);

    const mPanelHeadCount =  headCount('panelists', 'male'), fPanelHeadCount =  headCount('panelists', 'female');
    const mAudHeadCount =  headCount('audience', 'male'), fAudHeadCount =  headCount('audience', 'female');
    const mPanelWordCount =  wordCount('panelists', 'male'), fPanelWordCount =  wordCount('panelists', 'female');
    const mAudWordCount =  wordCount('audience', 'male'), fAudWordount =  wordCount('audience', 'female');

    if((mPanelHeadCount + fPanelHeadCount) == 0 || (mAudHeadCount + fAudHeadCount) == 0)
        return null; // gender-detection failed, couldn't determine gender of any panelists

    return ({
        date: americanDate(entry.date),
        headCount: {
            audience: {
                femaleCount: fAudHeadCount,
                maleCount: mAudHeadCount
            },
            panel: {
                femaleCount: fPanelHeadCount,
                maleCount: mPanelHeadCount,
            },
        },
        wordCount: {
            audience: {
                femaleCount: fAudWordount / (fAudHeadCount),
                maleCount: mAudWordCount / (mAudHeadCount),
            },
            panel: {
                femaleCount: fPanelWordCount / (fPanelHeadCount),
                maleCount: mPanelWordCount  / (mPanelHeadCount),
            }
        }
    })
})));

fs.writeFileSync('polls.json', JSON.stringify(Object.values(qanda.entries).filter(entry => entry.voting != null).map(entry => {
    const ret = {};
    const majorParties = ['ALP', 'COALITION', 'GREENS'];
    majorParties.forEach(partyName => ret[partyName] = partyName in entry.voting ? entry.voting[partyName] : 0);
    ret['OTHER/UNDECIDED'] = 100 - Object.values(ret).reduce((t, p)=>t+p);
    ret['date'] = americanDate(entry.date);
    return ret;
})));

