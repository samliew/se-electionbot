/**
 * @typedef {{
 *  pageSize?: number,
 *  page?: number
 * }} PagingOptions
 */

/**
 * @template {PagingOptions} T
 * 
 * @summary decrements `page` parameter for paginated requests
 * @param {T} options request options
 * @returns {T}
 */
export const getPreviousPageConfig = (options) => {
    const { page = 1 } = options;
    
    return {
        ...options,
        page: page - 1,
    };
}

/**
 * @template {PagingOptions} T
 * 
 * @summary increments `page` parameter for paginated requests
 * @param {T} options request options
 * @returns {T}
 */
export const getNextPageConfig = (options) => {
    const { page = 1 } = options;
    
    return {
        ...options,
        page: page + 1,
    };
};