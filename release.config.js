module.exports = {
    "dryRun": false,
    "plugins": [
        [
            "@semantic-release/commit-analyzer",
            {
                "preset": "conventionalcommits"
            }
        ],
        [
            "@google/semantic-release-replace-plugin",
            {
                "replacements": [
                    {
                        "files": [
                            "package.json"
                        ],
                        "from": "\"version\": \".*\"",
                        "to": "\"version\": \"${nextRelease.version}\"",
                        "results": [
                            {
                                "file": "package.json",
                                "hasChanged": true,
                                "numMatches": 1,
                                "numReplacements": 1
                            }
                        ],
                        "countMatches": true
                    }
                ]
            }
        ],
        [
            "@semantic-release/release-notes-generator",
            {
                "preset": "conventionalcommits"
            }
        ],
        "@semantic-release/changelog",
        "@semantic-release/github",
        [
            "@semantic-release/git",
            {
                "assets": [
                    "dist/*",
                    "UPGRADE.md",
                    "LICENSE.md",
                    "README.md",
                    "CHANGELOG.md",
                    "action.yml"
                ]
            }
        ]
    ]
}
