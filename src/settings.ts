import * as core from "@actions/core";
import { URL } from "url";
import { GithubActionContext } from "./github-action-context";
import { ISettings } from "./interfaces";
import path from "path";

export class Settings implements ISettings {
    settings: ISettings;

    constructor(context: GithubActionContext) {
        const message =
            "This pull request has been created by the [template sync action](https://github.com/narrowspark/template-sync-action) action.\n\nThis PR synchronizes with {0}\n\n---\n\n You can set a custom pull request title, body, ref and commit messages, see [Usage](https://github.com/narrowspark/template-sync-action#Usage).";

        let githubWorkspacePath = process.env["GITHUB_WORKSPACE"];

        if (!githubWorkspacePath) {
            throw new Error("GITHUB_WORKSPACE not defined");
        }

        githubWorkspacePath = path.resolve(githubWorkspacePath);

        core.debug(`GITHUB_WORKSPACE = '${githubWorkspacePath}'`);

        this.settings = {
            authToken: core.getInput("github_token", { required: true }),
            apiUrl: process.env["GITHUB_API_URL"] || "https://api.github.com",
            serverUrl: new URL(process.env["GITHUB_URL"] || "https://github.com"),

            sshKey: core.getInput("ssh_key"),
            sshKnownHosts: core.getInput("ssh_known_hosts"),
            sshStrict: (core.getInput("ssh_strict") || "true").toUpperCase() === "TRUE",
            persistCredentials: (core.getInput("persist_credentials") || "false").toUpperCase() === "TRUE",

            authorName: core.getInput("git_author_name", { required: true }),
            authorEmail: core.getInput("git_author_email", { required: true }),

            repositoryOwner: core.getInput("owner") || context.repo.owner,
            repositoryName: core.getInput("repo") || context.repo.repo,
            githubWorkspacePath,
            repositoryPath: githubWorkspacePath,

            messageHead: core.getInput("pr_title") || 'Enhancement: Synchronize with "{0}"',
            messageBody: core.getInput("pr_message") || message,

            ref: core.getInput("ref", { required: true }),
            syncBranchName: "feature/template/sync/{0}",

            templateRepositoryRef: core.getInput("template_ref") || "refs/heads/master",
            templateRepository: "",
            templateRepositoryUrl: "",
            templateRepositoryPath: (process.env["STATE_template_repository_path"] as string) || "",

            ignoreList: [
                ".git$",
                ".changelog",
                ".editorconfig",
                ".gitignore",
                "CHANGELOG.md",
                "LICENSE.md",
                "README.md",
                "UPGRADE.md",
            ].concat(core.getInput("ignore_list", { required: false }) || []),
            clean: (core.getInput("clean") || "true").toUpperCase() === "TRUE",
        };
    }

    get authToken(): string {
        return this.settings.authToken;
    }

    get apiUrl(): string {
        return this.settings.apiUrl;
    }

    get serverUrl(): URL {
        return this.settings.serverUrl;
    }

    get repositoryOwner(): string {
        return this.settings.repositoryOwner;
    }

    get repositoryName(): string {
        return this.settings.repositoryName;
    }

    get repositoryPath(): string {
        return this.settings.repositoryPath;
    }

    get githubWorkspacePath(): string {
        return this.settings.githubWorkspacePath;
    }

    get authorEmail(): string {
        return this.settings.authorEmail;
    }

    get authorName(): string {
        return this.settings.authorName;
    }

    get messageHead(): string {
        return this.settings.messageHead.replace("{0}", this.settings.templateRepository);
    }

    get messageBody(): string {
        return this.settings.messageBody.replace("{0}", this.settings.templateRepository);
    }

    get ref(): string {
        return this.settings.ref;
    }

    get syncBranchName(): string {
        return this.settings.syncBranchName.replace("{0}", this.settings.templateRepository);
    }

    get templateRepositoryRef(): string {
        return this.settings.templateRepositoryRef;
    }

    set templateRepository(templateRepository: string) {
        this.settings.templateRepository = templateRepository;
    }

    get templateRepository(): string {
        return this.settings.templateRepository;
    }

    set templateRepositoryUrl(templateUrl: string) {
        this.settings.templateRepositoryUrl = templateUrl;
    }

    get templateRepositoryUrl(): string {
        return this.settings.templateRepositoryUrl;
    }

    set templateRepositoryPath(templateRepository: string) {
        this.settings.templateRepositoryPath = templateRepository;
    }

    get templateRepositoryPath(): string {
        return this.settings.templateRepositoryPath;
    }

    get sshKey(): string {
        return this.settings.sshKey;
    }

    get sshKnownHosts(): string {
        return this.settings.sshKey;
    }

    get sshStrict(): boolean {
        return this.settings.sshStrict;
    }

    get persistCredentials(): boolean {
        return this.settings.persistCredentials;
    }

    get ignoreList(): string[] {
        return this.settings.ignoreList;
    }

    get clean(): boolean {
        return this.settings.clean;
    }
}
