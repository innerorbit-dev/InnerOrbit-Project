module.exports = {
    existsSync: () => false,
    readFileSync: () => '',
    promises: {
        readFile: () => Promise.resolve(''),
    },
};
