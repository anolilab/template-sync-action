import * as core from "@actions/core";
import { URL } from "url";
import path from "path";
import YAML from "yaml";
import fs from "fs-extra";
import { GithubActionContext } from "./github-action-context";
import { Filter, ISettings, IYamlSettings } from "./interfaces";
import { inspect } from "util";

export class Settings implements ISettings {
    settings: ISettings;

    constructor(context: GithubActionContext) {
        const message =
            "This pull request has been created by the [template sync action](https://github.com/narrowspark/template-sync-action) action.\n\nThis PR synchronizes with {0}\n\n---\n\n You can set a custom pull request title, body, ref and commit messages, see [Usage](https://github.com/narrowspark/template-sync-action#Usage).";

        let githubWorkspacePath = Settings.getGithubWorkspacePath();

        let { ignoreList, filters } = Settings.loadYamlSettings(
            path.join(githubWorkspacePath, ".github", "template-sync-settings.yml"),
        );

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

            messageHead: core.getInput("pr_title") || 'Enhancement: Synchronize with "{0}"',
            messageBody: core.getInput("pr_message") || message,

            ref: core.getInput("ref") || context.ref,
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
            ].concat(ignoreList),
            filters,
            clean: (core.getInput("clean") || "true").toUpperCase() === "TRUE",
        };
    }

    public static getGithubWorkspacePath(): string {
        let githubWorkspacePath = process.env["GITHUB_WORKSPACE"];

        if (!githubWorkspacePath) {
            throw new Error("GITHUB_WORKSPACE not defined");
        }

        githubWorkspacePath = path.resolve(githubWorkspacePath);

        core.debug(`GITHUB_WORKSPACE = '${githubWorkspacePath}'`);

        return githubWorkspacePath;
    }

    public static loadYamlSettings(dotGithubPath: string): { filters: Filter[]; ignoreList: string[] } {
        let ignoreList: string[] = [];
        const filters: Filter[] = [];

        try {
            const stats = fs.lstatSync(dotGithubPath);

            if (stats.isFile()) {
                const yamlSettings: IYamlSettings = YAML.parse(fs.readFileSync(dotGithubPath, "utf8"));
                const yamlFilters = yamlSettings.filters || [];

                yamlFilters.forEach((filter) => {
                    if (typeof filter === "object" && filter !== null) {
                        if (typeof filter.filepath !== "undefined" && typeof filter.filter !== "undefined") {
                            filters.push({
                                filePath: filter.filepath,
                                filter: filter.filter,
                                strict: Boolean(filter.strict || false),
                                count: 0,
                                maxCount: filter.count || 1,
                            } as Filter);
                        } else {
                            core.info(
                                `Please provide the correct syntax for ${inspect(
                                    filter,
                                )}; Check the readme of https://github.com/narrowspark/template-sync-action.`,
                            );
                        }
                    }
                });

                return {
                    ignoreList: (yamlSettings.ignore_list as string[]) || [],
                    filters,
                };
            }
        } catch (e) {
            core.info(`No settings file found under ${dotGithubPath}, continue without it...`);
        }

        return { ignoreList, filters };
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

    set ignoreList(ignoreList: string[]) {
        this.settings.ignoreList = ignoreList;
    }

    get ignoreList(): string[] {
        return this.settings.ignoreList;
    }

    set filters(filters: Filter[]) {
        this.settings.filters = filters;
    }

    get filters(): Filter[] {
        return this.settings.filters;
    }

    get clean(): boolean {
        return this.settings.clean;
    }
}
