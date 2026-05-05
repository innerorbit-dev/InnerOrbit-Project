module.exports = function (api) {
    api.cache(true);

    // Check if we're in test environment
    const isTest = process.env.NODE_ENV === 'test';

    return {
        presets: [
            isTest ? 'babel-preset-expo' : ['babel-preset-expo', { jsxImportSource: 'react' }]
        ],
        plugins: isTest ? [] : [
            'react-native-reanimated/plugin',
            function () {
                return {
                    visitor: {
                        MetaProperty(path) {
                            if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
                                path.replaceWith({
                                    type: 'ObjectExpression',
                                    properties: [
                                        {
                                            type: 'ObjectProperty',
                                            key: { type: 'Identifier', name: 'env' },
                                            value: { type: 'ObjectExpression', properties: [] },
                                            computed: false,
                                            shorthand: false
                                        }
                                    ]
                                });
                            }
                        }
                    }
                };
            }
        ]
    };
};
