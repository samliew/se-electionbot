/**
 * @summary formats a number accorting to the number of didits to group and a separator
 * @param {number} num number to format
 * @param {number} group number of sequential digits to separate
 * @param {string} [sep] separator
 * @returns {string}
 */
export const formatNumber = (num, group, sep = ",") => {

    const digits = num.toString().split("");
    const { length } = digits;
    const lidx = length - 1;

    let output = "";
    for (let i = 0; i < length; i++) {
        const digit = digits[lidx - i];

        output = (i % group || !i ? digit : `${digit}${sep}`) + output;
    }

    return output;
};

/**
 * @summary formats two numbers as a percentage
 * @param {number} numA quotient
 * @param {number} numB divisor
 * @param {number} precision percentage precision
 * @param {string} [postfix=""] output postfix
 * @returns {string}
 */
export const percentify = (numA, numB, precision, postfix = "%") => {
    const percent = numA / numB * 100;
    const isInt = percent === Math.trunc(percent);
    return `${isInt ? percent : percent.toFixed(precision)}${postfix}`;
};