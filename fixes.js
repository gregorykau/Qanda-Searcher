const fs = require('fs');

const qanda = JSON.parse(fs.readFileSync('JSON/qanda.json'));
const edits = fs.readFileSync('edits.txt', 'utf8');

const processArgs = (str) => {
    return str
        // separate by quotations
        .split('"')
        // divide non-quotation parts into additional args, leave quotation args undivided
        .reduce((args, part, index) => args.concat(index % 2 == 0 ? part.split(/\s/g).map(x=>x.trim()) : [part]), [])
        // remove empties in arg list
        .filter(arg=>arg.length)
};

edits.split('\n')
    .map(edit => edit.trim())
    .filter(edit => edit.length && !edit.startsWith('//')) // ignore empty line and comment lines
    .forEach(edit => {
        const args = processArgs(edit); // get arguments following command
        const command = args.shift(); // get and extract command
        switch(command) {
            case 'COMBINE':
                combine(...args);
                break;
            default:
                throw new Error("Undefined command " + command)
    }
});

fs.writeFileSync('JSON/qanda.json', JSON.stringify(qanda));

function combine(date, fromName, toName) {
    const entry = qanda.entries[date];
    if (!(entry.audience.includes(fromName) && entry.panelists.includes(toName))) {
        console.log("Can't perform combination of " + fromName + " and " + toName + ", possibly already performed.");
        return;
    }
    entry.speakers[fromName].responses.forEach(id => {
        entry.speakers[toName].responses.push(id);
        entry.messages[id].speaker = toName;
    });
    delete entry.speakers[fromName];
    entry.audience.splice(entry.audience.indexOf(fromName), 1);
}


