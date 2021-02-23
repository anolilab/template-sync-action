import path from "path";
import * as core from "@actions/core";
import fs from "fs-extra";
import { PathLike } from "fs";
import { sync } from "../lib/sync";
import { GithubActionContext } from "../lib/github-action-context";
import { Settings } from "../lib/settings";
import { ISettings } from "../lib/interfaces";

const originalGitHubWorkspace = process.env["GITHUB_WORKSPACE"];
const context = new GithubActionContext();
const gitHubWorkspace = path.join(__dirname, "fixture/workspace");
const templateRepositoryPath = path.join(gitHubWorkspace, "template");

let settings: ISettings;

// Inputs for mock @actions/core
let inputs = {} as any;

// Shallow clone original @actions/github context
let originalContext = { ...context };

const createFile = (name: string, content: string): string => {
    fs.writeFileSync(name, content);

    return name;
};

describe("sync tests", () => {
    beforeAll(() => {
        // Mock getInput
        jest.spyOn(core, "getInput").mockImplementation((name: string) => {
            return inputs[name];
        });

        // Mock error/warning/info/debug
        jest.spyOn(core, "error").mockImplementation(jest.fn());
        jest.spyOn(core, "warning").mockImplementation(jest.fn());
        jest.spyOn(core, "info").mockImplementation(jest.fn());
        jest.spyOn(core, "debug").mockImplementation(jest.fn());

        // Mock github context
        jest.spyOn(context, "repo", "get").mockImplementation(() => {
            return {
                owner: "some-owner",
                repo: "some-repo",
            };
        });

        context.ref = "refs/heads/some-ref";

        jest.spyOn(fs, "existsSync").mockImplementation((path: PathLike) => path == gitHubWorkspace);

        // GitHub workspace
        process.env["GITHUB_WORKSPACE"] = gitHubWorkspace;
    });

    beforeEach(() => {
        // Reset inputs
        inputs = {};

        fs.rmdirSync(gitHubWorkspace, { recursive: true });

        fs.mkdirpSync(gitHubWorkspace);
        fs.mkdirpSync(templateRepositoryPath);
    });

    afterAll(() => {
        // Restore GitHub workspace
        delete process.env["GITHUB_WORKSPACE"];

        if (originalGitHubWorkspace) {
            process.env["GITHUB_WORKSPACE"] = originalGitHubWorkspace;
        }

        // Restore @actions/github context
        context.ref = originalContext.ref;

        // Restore
        jest.restoreAllMocks();

        // fs.rmdirSync(gitHubWorkspace, { recursive: true })
    });

    // it('sync with patch', async () => {
    //   const patchContent = 'abc\n' + 'def\n' + 'abc\n'
    //
    //   fs.writeFileSync(
    //     path.join(templateRepositoryPath, 'test.txt'),
    //     patchContent
    //   )
    //   const testFilePathB = createFile(
    //     path.join(gitHubWorkspace, 'test.txt'),
    //     'abd\n' + 'deg\n' + 'ab4\n'
    //   )
    //
    //   settings = new Settings(context)
    //   settings.templateRepositoryPath = templateRepositoryPath
    //
    //   await sync(settings)
    //
    //   expect(
    //     fs.readFileSync(testFilePathB, 'utf8')
    //   ).toBe(patchContent)
    // })
    //
    // it('sync with patch and copy', async () => {
    //   const patchContent = 'abc\n' + 'def\n' + 'abc\n'
    //
    //   fs.writeFileSync(
    //     path.join(templateRepositoryPath, 'test.txt'),
    //     patchContent
    //   )
    //   const testFilePathB1 = createFile(path.join(templateRepositoryPath, 'missing.txt'), '')
    //   const testFilePathB2 = createFile(
    //     path.join(gitHubWorkspace, 'test.txt'),
    //     'abd\n' + 'deg\n' + 'ab4\n'
    //   )
    //
    //   settings = new Settings(context)
    //   settings.templateRepositoryPath = templateRepositoryPath
    //
    //   await sync(settings)
    //
    //   expect(
    //     await fs.readFile(testFilePathB2, 'utf8')
    //   ).toBe(patchContent)
    //
    //   expect(fs.pathExistsSync(testFilePathB1)).toBe(true)
    // })
    //
    // it('sync with patch and filter', async () => {
    //   const dotGithubPath = path.join(gitHubWorkspace, '.github')
    //
    //   fs.mkdirpSync(dotGithubPath)
    //   fs.writeFileSync(
    //     path.join(dotGithubPath, 'template-sync-settings.yml'),
    //     'filters:\n' +
    //       '  -\n' +
    //       '    filepath: test.txt\n' +
    //       '    filter: f\n'
    //   )
    //   fs.writeFileSync(
    //     path.join(templateRepositoryPath, 'test.txt'),
    //     'abc\n' + 'def\n' + 'abc\n'
    //   )
    //   const testFilePathB = createFile(
    //     path.join(gitHubWorkspace, 'test.txt'),
    //     'abd\n' + 'deg\n' + 'ab4\n'
    //   )
    //
    //   settings = new Settings(context)
    //   settings.templateRepositoryPath = templateRepositoryPath
    //
    //   await sync(settings)
    //
    //   expect(await fs.readFile(testFilePathB, 'utf8')).toBe('abc\n' + 'deg\n' + 'abc\n')
    // })
    //
    // it('sync with long patch and filter', async () => {
    //   const dotGithubPath = path.join(gitHubWorkspace, '.github')
    //
    //   fs.mkdirpSync(dotGithubPath)
    //   fs.writeFileSync(
    //     path.join(dotGithubPath, 'template-sync-settings.yml'),
    //     'filters:\n' +
    //       '  -\n' +
    //       '    filepath: composer.json\n' +
    //       '    filter: 4\n'
    //   )
    //   fs.writeFileSync(
    //     path.join(templateRepositoryPath, 'composer.json'),
    //     '{\n' +
    //     '    "name": "narrowspark/tools",\n' +
    //     '    "description": "tools",\n' +
    //     '    "license": "proprietary",\n' +
    //     '    "require": {\n' +
    //     '        "php": "^7.4",\n' +
    //     '        "narrowspark/coding-standard": "^5.1.0",\n' +
    //     '        "wikimedia/composer-merge-plugin": "^1.4.1"\n' +
    //     '    },\n' +
    //     '    "extra": {\n' +
    //     '        "merge-plugin": {\n' +
    //     '            "include": [\n' +
    //     '                "../composer.json"\n' +
    //     '            ],\n' +
    //     '            "merge-extra": false,\n' +
    //     '            "merge-scripts": false\n' +
    //     '        },\n' +
    //     '        "prefetcher": {\n' +
    //     '            "require": {\n' +
    //     '                "phpunit/phpunit": "^9.0",\n' +
    //     '                "friendsofphp/php-cs-fixer": "^2.16.0"\n' +
    //     '            }\n' +
    //     '        }\n' +
    //     '    },\n' +
    //     '    "minimum-stability": "dev",\n' +
    //     '    "prefer-stable": true,\n' +
    //     '    "scripts": {\n' +
    //     '        "changelog": "changelog-generator generate --config=\\"./../.changelog\\" --file=\\"./../CHANGELOG.md\\" --prepend",\n' +
    //     '        "cs": "php-cs-fixer fix --config=\\"./../.php_cs\\" --ansi",\n' +
    //     '        "cs:check": "php-cs-fixer fix --config=\\"./../.php_cs\\" --ansi --dry-run",\n' +
    //     '        "infection": "infection --configuration=\\"./../infection.json\\" -j$(nproc) --ansi",\n' +
    //     '        "phpstan": "phpstan analyse -c ./../phpstan.neon --ansi",\n' +
    //     '        "phpstan:baseline": "phpstan analyse -c ./../phpstan.neon --ansi --generate-baseline",\n' +
    //     '        "psalm": "psalm --diff --diff-methods --threads=$(nproc)",\n' +
    //     '        "psalm:baseline": "psalm --threads=$(nproc) --set-baseline=./.build/psalm-baseline.xml",\n' +
    //     '        "psalm:fix": "psalm --alter --issues=all --threads=$(nproc)",\n' +
    //     '        "rector-src": "rector process ./../src/ --config=./rector-src.yaml --ansi --dry-run",\n' +
    //     '        "rector-src:fix": "rector process ./../src/ --config=./rector-src.yaml --ansi",\n' +
    //     '        "rector-tests": "rector process ./../tests/ --config=./rector-tests.yaml --ansi --dry-run",\n' +
    //     '        "rector-tests:fix": "rector process ./../tests/ --config=./rector-tests.yaml --ansi",\n' +
    //     '        "req:check": "composer-require-checker check --config-file=./../composer-require.json ./../composer.json"\n' +
    //     '    }\n' +
    //     '}'
    //   )
    //   const testFilePathB = createFile(
    //     path.join(gitHubWorkspace, 'composer.json'),
    //     '{\n' +
    //     '    "description": "tools",\n' +
    //     '    "minimum-stability": "dev",\n' +
    //     '    "prefer-stable": true,\n' +
    //     '    "require": {\n' +
    //     '        "php": "^7.3",\n' +
    //     '        "narrowspark/coding-standard": "^5.1.0",\n' +
    //     '        "wikimedia/composer-merge-plugin": "^1.4.1"\n' +
    //     '    },\n' +
    //     '    "extra": {\n' +
    //     '        "prefetcher": {\n' +
    //     '            "require": {\n' +
    //     '                "phpunit/phpunit": "^8.0 || ^9.0",\n' +
    //     '                "friendsofphp/php-cs-fixer": "^2.16.0"\n' +
    //     '            }\n' +
    //     '        },\n' +
    //     '        "merge-plugin": {\n' +
    //     '            "include": [\n' +
    //     '                "../composer.json"\n' +
    //     '            ],\n' +
    //     '            "merge-extra": false,\n' +
    //     '            "merge-scripts": false\n' +
    //     '        }\n' +
    //     '    },\n' +
    //     '    "scripts": {\n' +
    //     '        "changelog": "changelog-generator generate --config=\\"./../.changelog\\" --file=./../CHANGELOG.md --prepend",\n' +
    //     '        "cs": "php-cs-fixer fix --config=\\"./../.php_cs\\" --ansi",\n' +
    //     '        "cs:check": "php-cs-fixer fix --config=\\"./../.php_cs\\" --ansi --dry-run",\n' +
    //     '        "phpstan": "phpstan analyse -c ./../phpstan.neon --ansi",\n' +
    //     '        "psalm": "psalm --threads=$(nproc)",\n' +
    //     '        "psalm:fix": "psalm --alter --issues=all --threads=$(nproc)",\n' +
    //     '        "infection": "infection --configuration=\\"./../infection.json\\" -j$(nproc) --ansi",\n' +
    //     '        "rector-src": "rector process ../src/ --config=./rector-src.yaml --ansi --dry-run",\n' +
    //     '        "rector-src:fix": "rector process ../src/ --config=./rector-src.yaml --ansi",\n' +
    //     '        "rector-tests": "rector process ../tests/ --config=./rector-tests.yaml --ansi --dry-run",\n' +
    //     '        "rector-tests:fix": "rector process ../tests/ --config=./rector-tests.yaml --ansi"\n' +
    //     '    }\n' +
    //     '}'
    //   )
    //
    //   settings = new Settings(context)
    //   settings.templateRepositoryPath = templateRepositoryPath
    //
    //   await sync(settings)
    //
    //   expect(await fs.readFile(testFilePathB, 'utf8')).toBe(
    //     '{\n' +
    //     '    "name": "narrowspark/tools",\n' +
    //     '    "description": "tools",\n' +
    //     '    "license": "proprietary",\n' +
    //     '    "require": {\n' +
    //     '        "php": "^7.3",\n' +
    //     '        "narrowspark/coding-standard": "^5.1.0",\n' +
    //     '        "wikimedia/composer-merge-plugin": "^1.4.1"\n' +
    //     '    },\n' +
    //     '    "extra": {\n' +
    //     '        "merge-plugin": {\n' +
    //     '            "include": [\n' +
    //     '                "../composer.json"\n' +
    //     '            ],\n' +
    //     '            "merge-extra": false,\n' +
    //     '            "merge-scripts": false\n' +
    //     '        },\n' +
    //     '        "prefetcher": {\n' +
    //     '            "require": {\n' +
    //     '                "phpunit/phpunit": "^9.0",\n' +
    //     '                "friendsofphp/php-cs-fixer": "^2.16.0"\n' +
    //     '            }\n' +
    //     '        }\n' +
    //     '    },\n' +
    //     '    "minimum-stability": "dev",\n' +
    //     '    "prefer-stable": true,\n' +
    //     '    "scripts": {\n' +
    //     '        "changelog": "changelog-generator generate --config=\\"./../.changelog\\" --file=\\"./../CHANGELOG.md\\" --prepend",\n' +
    //     '        "cs": "php-cs-fixer fix --config=\\"./../.php_cs\\" --ansi",\n' +
    //     '        "cs:check": "php-cs-fixer fix --config=\\"./../.php_cs\\" --ansi --dry-run",\n' +
    //     '        "infection": "infection --configuration=\\"./../infection.json\\" -j$(nproc) --ansi",\n' +
    //     '        "phpstan": "phpstan analyse -c ./../phpstan.neon --ansi",\n' +
    //     '        "phpstan:baseline": "phpstan analyse -c ./../phpstan.neon --ansi --generate-baseline",\n' +
    //     '        "psalm": "psalm --diff --diff-methods --threads=$(nproc)",\n' +
    //     '        "psalm:baseline": "psalm --threads=$(nproc) --set-baseline=./.build/psalm-baseline.xml",\n' +
    //     '        "psalm:fix": "psalm --alter --issues=all --threads=$(nproc)",\n' +
    //     '        "rector-src": "rector process ./../src/ --config=./rector-src.yaml --ansi --dry-run",\n' +
    //     '        "rector-src:fix": "rector process ./../src/ --config=./rector-src.yaml --ansi",\n' +
    //     '        "rector-tests": "rector process ./../tests/ --config=./rector-tests.yaml --ansi --dry-run",\n' +
    //     '        "rector-tests:fix": "rector process ./../tests/ --config=./rector-tests.yaml --ansi",\n' +
    //     '        "req:check": "composer-require-checker check --config-file=./../composer-require.json ./../composer.json"\n' +
    //     '    }\n' +
    //     '}'
    //   )
    // })

    it("sync with long patch and more filters", async () => {
        const dotGithubPath = path.join(gitHubWorkspace, ".github");

        fs.mkdirpSync(dotGithubPath);
        fs.writeFileSync(
            path.join(dotGithubPath, "template-sync-settings.yml"),
            "filters:\n" +
                "  -\n" +
                "    filepath: composer.json\n" +
                "    filter: narrowspark/php-library-template\n" +
                "  -\n" +
                "    filepath: composer.json\n" +
                "    filter: narrowspark/php-library-template\n" +
                "  -\n" +
                "    filepath: composer.json\n" +
                "    filter: Provides a GitHub repository template for a Narrowspark PHP library, using GitHub actions\n" +
                "  -\n" +
                "    filepath: composer.json\n" +
                "    filter: 4\n" +
                "    strict: true\n" +
                "  -\n" +
                "    filepath: composer.json\n" +
                "    filter: 0\n" +
                "    strict: true\n" +
                "  -\n" +
                "    filepath: composer.json\n" +
                "    filter: Narrowspark\\\\Library\n" +
                "  -\n" +
                "    filepath: composer.json\n" +
                "    filter: Narrowspark\\\\Library\n" +
                "  -\n" +
                "    filepath: composer.json\n" +
                "    filter: narrowspark\n" +
                "  -\n" +
                "    filepath: composer.json\n" +
                "    filter: narrowspark/php-library-template\n",
        );
        fs.writeFileSync(
            path.join(templateRepositoryPath, "composer.json"),
            "{\n" +
                '    "name": "narrowspark/php-library-template",\n' +
                '    "type": "library",\n' +
                '    "description": "Provides a GitHub repository template for a Narrowspark PHP library, using GitHub actions.",\n' +
                '    "keywords": [\n' +
                '        "narrowspark"\n' +
                "    ],\n" +
                '    "homepage": "http://github.com/narrowspark/php-library-template",\n' +
                '    "license": "MIT",\n' +
                '    "authors": [\n' +
                "        {\n" +
                '            "name": "Daniel Bannert",\n' +
                '            "email": "d.bannert@anolilab.de",\n' +
                '            "homepage": "http://www.anolilab.de",\n' +
                '            "role": "Developer"\n' +
                "        }\n" +
                "    ],\n" +
                '    "require": {\n' +
                '        "php": "^7.4",\n' +
                '        "thecodingmachine/safe": "^1.1.1"\n' +
                "    },\n" +
                '    "require-dev": {\n' +
                '        "ext-json": "*",\n' +
                '        "phpunit/phpunit": "^9.1.5",\n' +
                '        "thecodingmachine/phpstan-safe-rule": "^1.0.0"\n' +
                "    },\n" +
                '    "config": {\n' +
                '        "preferred-install": "dist",\n' +
                '        "sort-packages": true\n' +
                "    },\n" +
                '    "extra": {\n' +
                '        "branch-alias": {\n' +
                '            "dev-master": "1.0-dev"\n' +
                "        },\n" +
                '        "prefetcher": {\n' +
                '            "require": {\n' +
                '                "phpunit/phpunit": "^8.0 || ^9.0"\n' +
                "            }\n" +
                "        }\n" +
                "    },\n" +
                '    "autoload": {\n' +
                '        "psr-4": {\n' +
                '            "Narrowspark\\\\Library\\\\": "src/"\n' +
                "        },\n" +
                '        "exclude-from-classmap": [\n' +
                '            "/tests/"\n' +
                "        ]\n" +
                "    },\n" +
                '    "autoload-dev": {\n' +
                '        "psr-4": {\n' +
                '            "Narrowspark\\\\Library\\\\Tests\\\\": "tests/"\n' +
                "        }\n" +
                "    },\n" +
                '    "minimum-stability": "dev",\n' +
                '    "prefer-stable": true,\n' +
                '    "scripts": {\n' +
                '        "post-install-cmd": "composer --working-dir=./.build install --lock",\n' +
                '        "post-update-cmd": "composer --working-dir=./.build update --lock",\n' +
                '        "changelog": "composer --working-dir=./.build changelog",\n' +
                '        "coverage": [\n' +
                '            "phpunit --dump-xdebug-filter=./.build/phpunit/.xdebug-filter.php",\n' +
                '            "phpunit --prepend=./.build/phpunit/.xdebug-filter.php --coverage-html=./.build/phpunit/coverage"\n' +
                "        ],\n" +
                '        "cs": "composer --working-dir=./.build cs -- -v",\n' +
                '        "cs:check": "composer --working-dir=./.build cs:check -- -v",\n' +
                '        "infection": "composer --working-dir=./.build infection -- --min-covered-msi=73 --min-msi=61",\n' +
                '        "phpstan": "composer --working-dir=./.build phpstan -- --memory-limit=-1",\n' +
                '        "phpstan:baseline": "composer --working-dir=./.build phpstan:baseline -- --memory-limit=-1",\n' +
                '        "psalm": "composer --working-dir=./.build psalm",\n' +
                '        "psalm:baseline": "composer --working-dir=./.build psalm:baseline",\n' +
                '        "psalm:fix": "composer --working-dir=./.build psalm:fix",\n' +
                '        "rector-src": "composer --working-dir=./.build rector-src",\n' +
                '        "rector-src:fix": "composer --working-dir=./.build rector-src:fix",\n' +
                '        "rector-tests": "composer --working-dir=./.build rector-tests",\n' +
                '        "rector-tests:fix": "composer --working-dir=./.build rector-tests:fix",\n' +
                '        "req:check": "composer --working-dir=./.build req:check",\n' +
                '        "test": "phpunit"\n' +
                "    },\n" +
                '    "support": {\n' +
                '        "issues": "https://github.com/narrowspark/php-library-template/issues",\n' +
                '        "source": "https://github.com/narrowspark/php-library-template"\n' +
                "    }\n" +
                "}",
        );
        const testFilePathB = createFile(
            path.join(gitHubWorkspace, "composer.json"),
            "{\n" +
                '    "name": "testomat/terminal-colour",\n' +
                '    "type": "library",\n' +
                '    "description": "Return your terminal message in style! Change the text style, text color and text background color from the terminal, console or shell interface with ANSI color codes.",\n' +
                '    "keywords": [\n' +
                '        "narrowspark",\n' +
                '        "testomat",\n' +
                '        "color",\n' +
                '        "terminal",\n' +
                '        "colour",\n' +
                '        "ansi",\n' +
                '        "style",\n' +
                '        "truecolor",\n' +
                '        "color256",\n' +
                '        "color16"\n' +
                "    ],\n" +
                '    "homepage": "http://github.com/testomat/terminal-colour",\n' +
                '    "license": "MIT",\n' +
                '    "authors": [\n' +
                "        {\n" +
                '            "name": "Daniel Bannert",\n' +
                '            "email": "d.bannert@anolilab.de",\n' +
                '            "homepage": "http://www.anolilab.de",\n' +
                '            "role": "Developer"\n' +
                "        }\n" +
                "    ],\n" +
                '    "require": {\n' +
                '        "php": "^7.3",\n' +
                '        "thecodingmachine/safe": "^1.1.1"\n' +
                "    },\n" +
                '    "require-dev": {\n' +
                '        "ext-json": "*",\n' +
                '        "phpunit/phpunit": "^9.1.4"\n' +
                "    },\n" +
                '    "config": {\n' +
                '        "preferred-install": "dist",\n' +
                '        "sort-packages": true\n' +
                "    },\n" +
                '    "extra": {\n' +
                '        "branch-alias": {\n' +
                '            "dev-master": "1.1-dev"\n' +
                "        },\n" +
                '        "prefetcher": {\n' +
                '            "require": {\n' +
                '                "phpunit/phpunit": "^8.0 || ^9.0"\n' +
                "            }\n" +
                "        }\n" +
                "    },\n" +
                '    "autoload": {\n' +
                '        "psr-4": {\n' +
                '            "Testomat\\\\TerminalColour\\\\": "src/"\n' +
                "        },\n" +
                '        "exclude-from-classmap": [\n' +
                '            "/tests/"\n' +
                "        ]\n" +
                "    },\n" +
                '    "autoload-dev": {\n' +
                '        "psr-4": {\n' +
                '            "Testomat\\\\TerminalColour\\\\Tests\\\\": "tests/"\n' +
                "        }\n" +
                "    },\n" +
                '    "minimum-stability": "dev",\n' +
                '    "prefer-stable": true,\n' +
                '    "scripts": {\n' +
                '        "changelog": "composer --working-dir=./.build changelog",\n' +
                '        "coverage": [\n' +
                '            "phpunit --dump-xdebug-filter=./.build/phpunit/.xdebug-filter.php",\n' +
                '            "phpunit --prepend=./.build/phpunit/.xdebug-filter.php --coverage-html=./.build/phpunit/coverage"\n' +
                "        ],\n" +
                '        "cs": "composer --working-dir=./.build cs -- -v",\n' +
                '        "cs:check": "composer --working-dir=./.build cs:check -- -v",\n' +
                '        "phpstan": "composer --working-dir=./.build phpstan -- --memory-limit=-1",\n' +
                '        "psalm": "composer --working-dir=./.build psalm",\n' +
                '        "psalm:fix": "composer --working-dir=./.build psalm:fix",\n' +
                '        "infection": "composer --working-dir=./.build infection -- --min-covered-msi=89 --min-msi=89",\n' +
                '        "rector-src": "composer --working-dir=./.build rector-src",\n' +
                '        "rector-src:fix": "composer --working-dir=./.build rector-src:fix",\n' +
                '        "rector-tests": "composer --working-dir=./.build rector-tests",\n' +
                '        "rector-tests:fix": "composer --working-dir=./.build rector-tests:fix",\n' +
                '        "test": "phpunit",\n' +
                '        "post-install-cmd": "composer --working-dir=./.build install --lock",\n' +
                '        "post-update-cmd": "composer --working-dir=./.build update --lock"\n' +
                "    },\n" +
                '    "support": {\n' +
                '        "issues": "https://github.com/testomat/terminal-colour/issues",\n' +
                '        "source": "https://github.com/testomat/terminal-colour"\n' +
                "    }\n" +
                "}",
        );

        settings = new Settings(context);
        settings.templateRepositoryPath = templateRepositoryPath;

        await sync(settings);

        expect(await fs.readFile(testFilePathB, "utf8")).toBe(
            "{\n" +
                '    "name": "testomat/terminal-colour",\n' +
                '    "type": "library",\n' +
                '    "description": "Return your terminal message in style! Change the text style, text color and text background color from the terminal, console or shell interface with ANSI color codes.",\n' +
                '    "keywords": [\n' +
                '        "narrowspark",\n' +
                '        "testomat",\n' +
                '        "color",\n' +
                '        "terminal",\n' +
                '        "colour",\n' +
                '        "ansi",\n' +
                '        "style",\n' +
                '        "truecolor",\n' +
                '        "color256",\n' +
                '        "color16"\n' +
                "    ],\n" +
                '    "homepage": "http://github.com/testomat/terminal-colour",\n' +
                '    "license": "MIT",\n' +
                '    "authors": [\n' +
                "        {\n" +
                '            "name": "Daniel Bannert",\n' +
                '            "email": "d.bannert@anolilab.de",\n' +
                '            "homepage": "http://www.anolilab.de",\n' +
                '            "role": "Developer"\n' +
                "        }\n" +
                "    ],\n" +
                '    "require": {\n' +
                '        "php": "^7.3",\n' +
                '        "thecodingmachine/safe": "^1.1.1"\n' +
                "    },\n" +
                '    "require-dev": {\n' +
                '        "ext-json": "*",\n' +
                '        "phpunit/phpunit": "^9.1.5",\n' +
                '        "thecodingmachine/phpstan-safe-rule": "^1.0.0"\n' +
                "    },\n" +
                '    "config": {\n' +
                '        "preferred-install": "dist",\n' +
                '        "sort-packages": true\n' +
                "    },\n" +
                '    "extra": {\n' +
                '        "branch-alias": {\n' +
                '            "dev-master": "1.1-dev"\n' +
                "        },\n" +
                '        "prefetcher": {\n' +
                '            "require": {\n' +
                '                "phpunit/phpunit": "^8.0 || ^9.0"\n' +
                "            }\n" +
                "        }\n" +
                "    },\n" +
                '    "autoload": {\n' +
                '        "psr-4": {\n' +
                '            "Testomat\\\\TerminalColour\\\\": "src/"\n' +
                "        },\n" +
                '        "exclude-from-classmap": [\n' +
                '            "/tests/"\n' +
                "        ]\n" +
                "    },\n" +
                '    "autoload-dev": {\n' +
                '        "psr-4": {\n' +
                '            "Testomat\\\\TerminalColour\\\\Tests\\\\": "tests/"\n' +
                "        }\n" +
                "    },\n" +
                '    "minimum-stability": "dev",\n' +
                '    "prefer-stable": true,\n' +
                '    "scripts": {\n' +
                '        "post-install-cmd": "composer --working-dir=./.build install --lock",\n' +
                '        "post-update-cmd": "composer --working-dir=./.build update --lock",\n' +
                '        "changelog": "composer --working-dir=./.build changelog",\n' +
                '        "coverage": [\n' +
                '            "phpunit --dump-xdebug-filter=./.build/phpunit/.xdebug-filter.php",\n' +
                '            "phpunit --prepend=./.build/phpunit/.xdebug-filter.php --coverage-html=./.build/phpunit/coverage"\n' +
                "        ],\n" +
                '        "cs": "composer --working-dir=./.build cs -- -v",\n' +
                '        "cs:check": "composer --working-dir=./.build cs:check -- -v",\n' +
                '        "infection": "composer --working-dir=./.build infection -- --min-covered-msi=73 --min-msi=61",\n' +
                '        "phpstan": "composer --working-dir=./.build phpstan -- --memory-limit=-1",\n' +
                '        "phpstan:baseline": "composer --working-dir=./.build phpstan:baseline -- --memory-limit=-1",\n' +
                '        "psalm": "composer --working-dir=./.build psalm",\n' +
                '        "psalm:baseline": "composer --working-dir=./.build psalm:baseline",\n' +
                '        "psalm:fix": "composer --working-dir=./.build psalm:fix",\n' +
                '        "rector-src": "composer --working-dir=./.build rector-src",\n' +
                '        "rector-src:fix": "composer --working-dir=./.build rector-src:fix",\n' +
                '        "rector-tests": "composer --working-dir=./.build rector-tests",\n' +
                '        "rector-tests:fix": "composer --working-dir=./.build rector-tests:fix",\n' +
                '        "req:check": "composer --working-dir=./.build req:check",\n' +
                '        "test": "phpunit"\n' +
                "    },\n" +
                '    "support": {\n' +
                '        "issues": "https://github.com/testomat/terminal-colour/issues",\n' +
                '        "source": "https://github.com/testomat/terminal-colour"\n' +
                "    }\n" +
                "}",
        );
    });
});
