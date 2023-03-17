$.ajaxSetup({
    cache: false
});
$('#divContentContainer').hide();
$('#btnBack').hide();

class LoadingOverlay {
    constructor() {
        this.loadingDiv = $(`
            <div style="display: none; color: white; position: fixed; left: 50vw; top: 50vh; transform: translate(-50%, -50%); z-index: 9999;">
                <h1>Loading Dataset...</h1>
            </div>
        `).prependTo('body');
    }
    static getInstance() { return this.instance; }
    startLoading() {
        this.pendingCount++;
        setTimeout(() => { if (this.pendingCount > 0)
            this.loadingDiv.fadeIn('fast'); }, 0);
    }
    endLoading() {
        console.assert(this.pendingCount >= 0);
        this.pendingCount--;
        setTimeout(() => { if (this.pendingCount == 0)
            this.loadingDiv.fadeOut('fast'); }, 0);
    }
    static instance = new LoadingOverlay();
    loadingDiv;
    pendingCount = 0;
}

const FADE_SPEED = 500;

// global vars
let JSONDATA = null;
let EPISODE_TEXT = null;

function exit(){
}

function getQuery(q) {
    return (window.location.search.match(new RegExp('[?&]' + q + '=([^&]+)')) || [, null])[1];
}
function pageReady(onDone) {
    $('#divContentContainer').fadeIn(FADE_SPEED, onDone);
}
function allowBack() {
    $('#btnBack').show();
}

let lastSection = '';
function navigate() {
    const section = getQuery('section') || 'home';
    if(lastSection != section) {
        // exit last section
        exit();
        // set button highlight
        $("button[data-section='" + lastSection + "']").removeClass('btn-dark').addClass('btn-light');
        $("button[data-section='" + section + "']").removeClass('btn-light').addClass('btn-dark');
        // request page for section
        let html = null;
        $.get(section + '.html', (data, status) => { html = data; });
        // fade out page
        $('#divContentContainer').fadeOut(FADE_SPEED, () => {
            $('#btnBack').hide();
            // page faded out, when page for new section received fade in
            const poller = setInterval(() => {
                if(html) {
                    clearInterval(poller);
                    $('#divContent').html(html);
                    // enter next section
                    enter();
                }
            }, 100);
        });
        lastSection = section;
    } else {
        // section hasn't changed, refresh current section
        refresh();
    }
}

window.onpopstate = (event) =>  navigate();
function pushState (data, title, state) {
    history.pushState(data, title, state.replace(/ /g, '_'));
    navigate();
}

(async () => {
    $(document).on('click', 'a', function() {
        pushState(null, null, $(this).attr('href'));
        return false;
    });

    $('.btn-menu').each(function(index) {
        $(this).on('click', () => {
            pushState(null,  null, '?section=' + $(this).attr('data-section'));
        });
    });

    LoadingOverlay.getInstance().startLoading();

    await new Promise((resolve) => {
        $.getJSON("JSON/qanda.json", (data) => {
            JSONDATA = data;
            EPISODE_TEXT = Object.values(JSONDATA.entries).map(entry => ({date: entry.date, txt: Object.values(entry.messages).reduce((t, msg) => t + ' ' + msg.content.toUpperCase(), '')}));
            resolve();
        });
    });

    LoadingOverlay.getInstance().endLoading();

    navigate();
})();