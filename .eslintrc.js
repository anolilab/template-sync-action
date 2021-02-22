module.exports = {
    extends: ["@anolilab/eslint-config"],
    "parserOptions": {
        "project": "./tsconfig.json"
    },
    env: {
        "node": true,
        "es6": true,
        "jest/globals": true
    },
    globals: {
        // Your global variables (setting to false means it's not allowed to be reassigned)
        //
        // myGlobal: false
    },
    rules: {
        // Customize your rules
    }
};
