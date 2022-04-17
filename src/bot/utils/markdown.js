import entities from 'html-entities';
import MIT from "markdown-it";
import sanitize from "sanitize-html";
import { makeURL, markdownify } from "../utils.js";

/**
 * @summary converts HTML to chat Markdown
 * @param {string} content initial text
 * @returns {string}
 */
export const htmlToChatMarkdown = (content) => {
    content = content.trim();

    if (!content || typeof content !== 'string') return "";

    // Has <pre> fixed-font blocks
    if (/^\s*&lt;pre class="full"&gt;/.test(content)) {
        return unescape(content)
            .replace(/($\s*<pre class="full">|<\/pre>$)/, '').replace(/(?:^|(?:\r\n))/gm, '    ');
    }

    return entities.decode(
        markdownify(
            sanitize(
                content.replace(/<a href="([^"]+)">([^<]+)<\/a>/g, makeURL("$2", "$1")).trim(),
                { allowedTags: ["b", "br", "i", "strike"] }
            ), {
            "b": "**",
            "i": "*",
            "strike": "---",
            "br": "\n"
        })
    );
};

/**
 * @summary replaces Markdown bold with HTML tags \
 * adapted from https://cdn-chat.sstatic.net/chat/Js/master-chat.js
 * @param {string} text text to process
 * @returns {string}
 */
const mdBoldToHTML = (text) => text.replace(/(^|.(?=\*)|[\s,('"[{-])(?:\*{2}|__)(?=\S)(.*?\S)(?:\*{2}|__(?=[\s,?!.;:)\]}-]|$))/g, "$1<b>$2</b>");

/**
 * @summary replaces Markdown code with HTML tags \
 * adapted from https://cdn-chat.sstatic.net/chat/Js/master-chat.js
 * @param {string} text text to process
 * @returns {string}
 */
const mdCodeToHTML = (text) => text.replace(/(^|\W|_)(`+)(?!\s)(.*?[^`])\2(?!`)/g, "$1<code>$3</code>");

/**
 * @summary replaces Markdown italic with HTML tags \
 * adapted from https://cdn-chat.sstatic.net/chat/Js/master-chat.js
 * @param {string} text text to process
 * @returns {string}
 */
const mdItalicToHTML = (text) => text.replace(/(^|.(?=\*)|[\s,('">[{-])(?:\*|_)(?=\S)(.+?\S)(?:\*|_(?=[\s,?!.;:)<\]}-]|$))/g, "$1<i>$2</i>");

/**
 * @summary replaces Markdown links with HTML tags \
 * adapted from https://cdn-chat.sstatic.net/chat/Js/master-chat.js
 * @param {string} text text to process
 * @returns {string}
 */
const mdLinkToHTML = (text) => text.replace(/(^|\s)\[([^\]]+)\]\(((?:https?|ftp):\/\/(?:\([^()\s]*\)|[^)\s])+?)(?:\s(?:"|&quot;)([^"]+?)(?:"|&quot;))?\)/g, '$1<a href="$3" title="$4">$2</a>');

/**
 * @summary replaces Markdown strikethrough with HTML tags \
 * adapted from https://cdn-chat.sstatic.net/chat/Js/master-chat.js
 * @param {string} text text to process
 * @returns {string}
 */
const mdStrikeToHTML = (text) => text.replace(/(^|[\s,('">[{-])---(?=\S)(.+?\S)---(?=[\s,?!.;:)<\]}-]|$)/g, "$1<strike>$2</strike>");

/**
 * @summary replaces newlines with HTML tags
 * @param {string} text text to process
 * @returns {string}
 */
const mdNewlineToHTML = (text) => text.replace(/\r\n?|\n/g, "<br/>");

/**
 * @summary replaces escaped Markdown special chars with HTML entities
 * @param {string} text text to process
 * @returns {string}
 */
const mdToHTMLEntities = (text) => {
    /** @type {[RegExp, string][]} */
    const replacements = [
        [/\\`/g, "&#96;"],
        [/\\\*/g, "&#42;"],
        [/\\_/g, "&#95;"],
        [/\\\[/g, "&#91;"],
        [/\\\]/g, "&#93;"],
        [/\\\(/g, "&#40;"],
        [/\\\)/g, "&#41;"]
    ];

    return replacements.reduce((a, [expr, repl]) => a.replace(expr, repl), text);
};

/**
 * @summary replaces Markdown tables with HTML tags
 * @param {string} text text to process
 * @returns {string}
 */
const mdToTableHTML = (text) => {
    const mit = new MIT();

    return text
        .replace(
            // https://regex101.com/r/C9etyy/1
            /(\s*?\|\s+.+?\s+\|(?:\s+.+?\s+\|)?\n\s*?\|\s+-+?\s+\|(?:\s+-+\s+\|)?(?:\n\s*?\|\s+.+?\s+\|(?:\s+.+?\s+\|))+)/g,
            (_, table) => mit.render(table.replace(/^\s{4}/gm, ""))
        )
        .replace(/\r\n?|\n/g, "");
};

/**
 * @summary converts chat Markdown to HTML
 * @param {string} content initial text
 * @returns {string}
 */
export const chatMarkdownToHtml = (content) => {
    if (!content) return "";

    // Message is a full fixed-font block
    const escaped = escape(content);
    if (/[\n\r]/.test(escaped)) {
        const o = !/^ {0,3}[^ ]/m.test(escaped);
        return o ? "<pre class='full'>" + escaped.replace(/^    /gm, "") + "</pre>" : "<div>" + mdNewlineToHTML(escaped) + "</div>";
    }

    const handlers = [
        mdToHTMLEntities,
        mdToTableHTML,
        mdCodeToHTML,
        mdBoldToHTML,
        mdItalicToHTML,
        mdStrikeToHTML,
        mdLinkToHTML,
        mdNewlineToHTML
    ];

    return handlers.reduce((a, c) => c(a), content);
};