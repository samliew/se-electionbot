/**
 * @summary converts a given Date to relative datetime string
 * @param {Date|string|number} date date to format
 * @param {string} [soonText] text to display when the election starts soon
 * @param {string} [justNowText] text to display when the election just started
 * @returns {string}
 */
const dateToRelativetime = (date, soonText = 'soon', justNowText = 'just now') => {

    const validateDate = (input) => {
        let output = input;

        if (typeof input === 'string' || typeof input === 'number') {
            output = new Date(input);
        };

        // use instanceof, as normal objects will pass `typeof !== "object"` validation
        return output instanceof Date ? output : new Date();
    };

    date = validateDate(date);

    if (date === null) return soonText;

    // Try future date
    let diff = (date.getTime() - Date.now()) / 1000;
    let dayDiff = Math.floor(diff / 86400);

    // In the future
    if (diff > 0) {
        return dayDiff > 31 ? "" : (
            diff < 5 && soonText ||
            diff < 60 && (function (x) { return `in ${x} ${x === 1 ? "sec" : "secs"}`; })(Math.floor(diff)) ||
            diff < 3600 && (function (x) { return `in ${x} ${x === 1 ? "min" : "mins"}`; })(Math.floor(diff / 60)) ||
            diff < 86400 && (function (x) { return `in ${x} ${x === 1 ? "hour" : "hours"}`; })(Math.floor(diff / 3600)) ||
            (function (x) { return `in ${x} ${x === 1 ? "day" : "days"}`; })(Math.floor(diff / 86400))
        );
    }

    // In the past
    diff = (Date.now() - date.getTime()) / 1000;
    dayDiff = Math.floor(diff / 86400);

    return dayDiff > 31 ? "" : (
        diff < 5 && justNowText ||
        diff < 60 && (function (x) { return `${x} ${x === 1 ? "sec" : "secs"} ago`; })(Math.floor(diff)) ||
        diff < 3600 && (function (x) { return `${x} ${x === 1 ? "min" : "mins"} ago`; })(Math.floor(diff / 60)) ||
        diff < 86400 && (function (x) { return `${x} ${x === 1 ? "hour" : "hours"} ago`; })(Math.floor(diff / 3600)) ||
        (function (x) { return `${x} ${x === 1 ? "day" : "days"} ago`; })(Math.floor(diff / 86400))
    );
};

const updateRelativeDates = () => {
    var spans = /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll('span.relativetime'));
    spans.forEach(el => {
        if (el.title) {
            var prefix = el.dataset.prefix || "";
            var suffix = el.dataset.suffix || "";
            var date = dateToRelativetime(el.title);
            if (date)
                el.innerHTML = prefix + date + suffix;
        }
    });
};

(function () {
    updateRelativeDates();
    setInterval(updateRelativeDates, 15000);

    // Meta refresh fallback
    const metaRefresh = /** @type { HTMLMetaElement|null } */(document.querySelector('meta[http-equiv="refresh"]'));
    if (metaRefresh && +metaRefresh.content > 0) setTimeout(() => location.reload(), +metaRefresh.content * 1000);
})();