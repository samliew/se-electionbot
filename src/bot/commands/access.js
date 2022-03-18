/**
 * @summary represents possible user access levels
 */
export const AccessLevel = {
    user: 1,
    admin: 2,
    mod: 4,
    dev: 8,
    get privileged() {
        const { admin, dev, mod } = this;
        return admin | dev | mod;
    },
    get all() {
        const { user, privileged } = this;
        return user | privileged;
    }
};