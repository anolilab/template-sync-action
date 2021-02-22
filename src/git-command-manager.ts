import { GitVersion } from "./git-version";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";
import fs from "fs-extra";
import path from "path";
import { RetryHelper } from "./retry-helper";
import { IGitCommandManager } from "./interfaces";

const retryHelper = new RetryHelper();

// Auth header not supported before 2.9
// Wire protocol v2 not supported before 2.18
export const MinimumGitVersion = new GitVersion("2.18");

export async function createCommandManager(workingDirectory: string): Promise<IGitCommandManager> {
    return await GitCommandManager.createCommandManager(workingDirectory);
}

export class GitCommandManager implements IGitCommandManager {
    private gitEnv: { [key: string]: string } = {
        GIT_TERMINAL_PROMPT: "0", // Disable git prompt
        GCM_INTERACTIVE: "Never", // Disable prompting for git credential manager
    };

    private workingDirectory = "";

    private gitPath = "";

    private gitVersion?: GitVersion = undefined;

    private constructor() {}

    static async createCommandManager(workingDirectory: string): Promise<GitCommandManager> {
        const result = new GitCommandManager();

        await result.initializeCommandManager(workingDirectory);

        return result;
    }

    private async initializeCommandManager(workingDirectory: string): Promise<void> {
        this.workingDirectory = workingDirectory;
        this.gitPath = await io.which("git", true);

        // Git version
        core.debug("Getting git version");

        this.gitVersion = new GitVersion();
        const gitOutput = await this.execGit(["version"]);
        const stdout = gitOutput.stdout.trim();

        if (!stdout.includes("\n")) {
            const match = stdout.match(/\d+\.\d+(\.\d+)?/);

            if (match) {
                this.gitVersion = new GitVersion(match[0]);
            }
        }

        if (!this.gitVersion.isValid()) {
            throw new Error("Unable to determine git version");
        }

        // Set the user agent
        const gitHttpUserAgent = `git/${this.gitVersion} (github-actions-checkout)`;

        core.debug(`Set git useragent to: ${gitHttpUserAgent}`);

        this.gitEnv["GIT_HTTP_USER_AGENT"] = gitHttpUserAgent;
    }

    checkGitVersion(): void {
        if (this.gitVersion === undefined) {
            throw new Error("Init the git command manager");
        }

        if (!this.gitVersion.checkMinimum(MinimumGitVersion)) {
            throw new Error(
                `Minimum required git version is ${MinimumGitVersion}. Your git ('${this.gitPath}') is ${this.gitVersion}`,
            );
        }
    }

    getWorkingDirectory(): string {
        return this.workingDirectory;
    }

    async init(): Promise<void> {
        await this.execGit(["init", this.workingDirectory]);
    }

    async fetch(fetchDepth: number, refSpec: string[]): Promise<void> {
        const args = [
            "-c",
            "protocol.version=2",
            "fetch",
            "--no-tags",
            "--prune",
            "--progress",
            "--no-recurse-submodules",
        ];

        if (fetchDepth > 0) {
            args.push(`--depth=${fetchDepth}`);
        } else if (fs.existsSync(path.join(this.workingDirectory, ".git", "shallow"))) {
            args.push("--unshallow");
        }

        args.push("origin");

        for (const arg of refSpec) {
            args.push(arg);
        }

        const that = this;

        await retryHelper.execute(async () => {
            await that.execGit(args);
        });
    }

    async checkout(ref: string, startPoint: string): Promise<void> {
        const args = ["checkout", "--progress", "--force"];
        if (startPoint) {
            args.push("-B", ref, startPoint);
        } else {
            args.push(ref);
        }

        await this.execGit(args);
    }

    async sha(type: string): Promise<string> {
        const output = await this.execGit(["rev-parse", "--verify", type]);

        return output.stdout.trim();
    }

    async status(args: string[] = []): Promise<string> {
        const output = await this.execGit(["status"].concat(args));

        return output.stdout.trim();
    }

    async log1(): Promise<void> {
        await this.execGit(["log", "-1"]);
    }

    async config(configKey: string, configValue: string, globalConfig?: boolean): Promise<void> {
        await this.execGit(["config", globalConfig ? "--global" : "--local", configKey, configValue]);
    }

    async configExists(configKey: string, globalConfig?: boolean): Promise<boolean> {
        const pattern = configKey.replace(/[^a-zA-Z0-9_]/g, (x) => {
            return `\\${x}`;
        });
        const output = await this.execGit(
            ["config", globalConfig ? "--global" : "--local", "--name-only", "--get-regexp", pattern],
            true,
        );

        return output.exitCode === 0;
    }

    async tryConfigUnset(configKey: string, globalConfig?: boolean): Promise<boolean> {
        const output = await this.execGit(
            ["config", globalConfig ? "--global" : "--local", "--unset-all", configKey],
            true,
        );

        return output.exitCode === 0;
    }

    removeEnvironmentVariable(name: string): void {
        delete this.gitEnv[name];
    }

    setEnvironmentVariable(name: string, value: string): void {
        this.gitEnv[name] = value;
    }

    async tryDisableAutomaticGarbageCollection(): Promise<boolean> {
        const output = await this.execGit(["config", "--local", "gc.auto", "0"], true);

        return output.exitCode === 0;
    }

    async remoteAdd(remoteName: string, remoteUrl: string): Promise<void> {
        await this.execGit(["remote", "add", remoteName, remoteUrl]);
    }

    async branchExists(remote: boolean, pattern: string): Promise<boolean> {
        const args = ["branch", "--list"];

        if (remote) {
            args.push("--remote");
        }

        args.push(pattern);

        const output = await this.execGit(args);

        return !!output.stdout.trim();
    }

    async tagExists(pattern: string): Promise<boolean> {
        const output = await this.execGit(["tag", "--list", pattern]);

        return !!output.stdout.trim();
    }

    async addAll(): Promise<boolean> {
        const output = await this.execGit(["add", "--all"]);

        return Boolean(output.exitCode);
    }

    async commit(message: string): Promise<boolean> {
        const output = await this.execGit(["commit", "-m", `"${message}"`]);

        return Boolean(output.exitCode);
    }

    async push(ref: string): Promise<boolean> {
        const output = await this.execGit(["push", "-u", "origin", ref]);

        return Boolean(output.exitCode);
    }

    private async execGit(args: string[], allowAllExitCodes = false): Promise<GitOutput> {
        fs.existsSync(this.workingDirectory);

        const result = new GitOutput();

        const env: { [key: string]: string } = {};

        for (const key of Object.keys(process.env)) {
            env[key] = process.env[key] as string;
        }
        for (const key of Object.keys(this.gitEnv)) {
            env[key] = this.gitEnv[key];
        }

        const stdout: string[] = [];

        const options = {
            cwd: this.workingDirectory,
            env,
            ignoreReturnCode: allowAllExitCodes,
            listeners: {
                stdout: (data: Buffer) => {
                    stdout.push(data.toString());
                },
            },
        };

        result.exitCode = await exec.exec(`"${this.gitPath}"`, args, options);
        result.stdout = stdout.join("");

        return result;
    }
}

class GitOutput {
    stdout = "";
    exitCode = 0;
}
