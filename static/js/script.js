// @ts-nocheck

function prettyDate(rawTitle) {
    if (!rawTitle) return;

    // Extract the date and time from the front of the string.
    var match = rawTitle.match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\dZ)/);
    if (!match) return;

    // firefox requires ISO 8601 formatted dates
    var time = match[1] + "T" + match[2];

    var date = new Date(time),
        diff = (((new Date()).getTime() - date.getTime()) / 1000),
        day_diff = Math.floor(diff / 86400);

    if (isNaN(day_diff) || day_diff < 0 || day_diff >= 31)
        return;

    return day_diff === 0 && (
        diff < 5 && "just now" ||
        diff < 60 && (function (n) { return n.seconds === 1 ? n.seconds + " sec ago" : n.seconds + " secs ago" })({ seconds: Math.floor(diff) }) ||
        diff < 120 && "1 min ago" ||
        diff < 3600 && (function (n) { return n.minutes === 1 ? n.minutes + " min ago" : n.minutes + " mins ago" })({ minutes: Math.floor(diff / 60) }) ||
        diff < 7200 && "1 hour ago" ||
        diff < 86400 && (function (n) { return n.hours === 1 ? n.hours + " hour ago" : n.hours + " hours ago" })({ hours: Math.floor(diff / 3600) }) ||
        diff < 172800 && "1 day ago" ||
        (function (n) { return n.days === 1 ? n.days + " day ago" : n.days + " days ago" })({ days: Math.floor(diff / 86400) })
    );
}

function updateRelativeDates() {
    var spans = document.querySelectorAll('span.relativetime');
    spans.forEach(el => {
        if (el.title) {
            var date = prettyDate(el.title);
            if (date)
                el.innerHTML = date;
        }
    });
}

(function () {
    updateRelativeDates();
    setInterval(updateRelativeDates, 15000);
})();