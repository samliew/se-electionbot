/**
 * @summary formats a number accorting to the number of didits to group and a separator
 * @param {number} num
 * @param {number} group
 * @param {string} [sep]
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