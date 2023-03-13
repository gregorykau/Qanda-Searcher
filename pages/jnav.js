$('#divContentContainer').hide();
$('#btnBack').hide();

const FADE_SPEED = 500;
const socket = io.connect();

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

(() => {
    $(document).on('click', 'a', function() {
        pushState(null, null, $(this).attr('href'));
        return false;
    });

    $('.btn-menu').each(function(index) {
        $(this).on('click', () => {
            pushState(null,  null, '?section=' + $(this).attr('data-section'));
        });
    });
    navigate();
})();