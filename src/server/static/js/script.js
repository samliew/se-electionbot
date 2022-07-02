/**
 * @summary pluralizes a noun
 * @param {number} num number of {@param signular}
 * @param {string} singular singular form of a noun
 * @param {string} [suffix] plural suffix
 * @returns {string}
 */
const pluralize = (num, singular, suffix = "s") => `${singular}${num === 1 ? "" : suffix}`;

/**
 * @summary validates and normalizes the Date
 * @param {Date|number|string} input
 * @returns {Date}
 */
const validateDate = (input) => {
    let output = input;

    if (typeof input === 'string' || typeof input === 'number') {
        output = new Date(input);
    };

    // use instanceof, as normal objects will pass `typeof !== "object"` validation
    return output instanceof Date ? output : new Date();
};


/**
 * @summary converts a given Date to relative datetime string
 * @param {Date|string|number} date date to format
 * @param {string} [soonText] text to display when the election starts soon
 * @param {string} [justNowText] text to display when the election just started
 * @returns {string}
 */
const dateToRelativetime = (date, prefix = "in ", soonText = 'soon', justNowText = 'just now') => {
    date = validateDate(date);

    if (date === null) return soonText;

    // Try future date
    const diff = (date.getTime() - Date.now()) / 1000;
    const dayDiff = Math.floor(diff / 86400);

    // In the future
    if (diff > 0) {
        return (
            diff < 5 && soonText ||
            diff < 60 && ((x) => `${prefix}${x} ${pluralize(x, "sec")}`)(Math.floor(diff)) ||
            diff < 3600 && ((x) => `${prefix}${x} ${pluralize(x, "min")}`)(Math.floor(diff / 60)) ||
            diff < 86400 && ((x) => `${prefix}${x} ${pluralize(x, "hour")}`)(Math.floor(diff / 3600)) ||
            dayDiff < 31 && ((x) => `${prefix}${x} ${pluralize(x, "day")}`)(dayDiff) ||
            dayDiff < 366 && ((x) => `${prefix}${x} ${pluralize(x, "month")}`)(Math.floor(dayDiff / 31)) ||
            ((x) => `${prefix}${x} ${pluralize(x, "year")}`)(Math.floor(dayDiff / 366))
        );
    }

    const pastDiff = Math.abs(diff);
    const pstDayDiff = Math.abs(dayDiff);

    // In the past
    return (
        pastDiff < 5 && justNowText ||
        pastDiff < 60 && ((x) => `${x} ${pluralize(x, "sec")} ago`)(Math.floor(pastDiff)) ||
        pastDiff < 3600 && ((x) => `${x} ${pluralize(x, "min")} ago`)(Math.floor(pastDiff / 60)) ||
        pastDiff < 86400 && ((x) => `${x} ${pluralize(x, "hour")} ago`)(Math.floor(pastDiff / 3600)) ||
        pstDayDiff < 31 && ((x) => `${x} ${pluralize(x, "day")} ago`)(pstDayDiff) ||
        pstDayDiff < 366 && ((x) => `${x} ${pluralize(x, "month")} ago`)(Math.floor(pstDayDiff / 31)) ||
        ((x) => `${x} ${pluralize(x, "year")} ago`)(Math.floor(pstDayDiff / 366))
    );
};

const updateRelativeDates = () => {
    const spans = /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll('span.relativetime'));
    spans.forEach((element) => {
        const { title, dataset } = element;
        if (!title) return;

        const prefix = dataset.prefix;
        const suffix = dataset.suffix;
        const date = dateToRelativetime(title, prefix);
        if (date) element.innerHTML = `${date}${suffix || ""}`;
    });
};

const initMenu = () => {
    // Move to selected page
    document.getElementById('nav')?.addEventListener('change', evt => {
        // @ts-ignore
        const value = evt.target.value || '';
        if (value) window.location.href = value;
    });
};

(() => {
    initMenu();
    updateRelativeDates();
    setInterval(updateRelativeDates, 15000);
})();