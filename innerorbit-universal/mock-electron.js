module.exports = {
    // If libraries try to access electron properties, we return mocks
    app: {
        getPath: () => '',
        getAppPath: () => '',
    },
    ipcRenderer: {
        on: () => { },
        send: () => { },
        invoke: () => Promise.resolve(),
        removeListener: () => { },
    },
    shell: {
        openExternal: (url) => window.open(url),
    },
    // If they check for native properties
    nativeImage: {
        createFromPath: () => ({}),
    },
};
