import path from "path";
import fs from "fs-extra";
import * as core from "@actions/core";
import * as coreCommand from "@actions/core/lib/command";
import * as io from "@actions/io";
import { inspect } from "util";
import FileHound from "filehound";
import { Settings } from "./settings";
import { GithubActionContext } from "./github-action-context";
import * as gitSourceProvider from "./git-source-provider";
import { GithubManager } from "./github-manager";
import { createCommandManager } from "./git-command-manager";
import { octokit } from "./octokit";
import * as stateHelper from "./state-helper";
import * as refHelper from "./ref-helper";
import { ISettings } from "./interfaces";
import { cleanup } from "./github-action-cleanup";

const USER_EMAIL = "user.email";
const USER_NAME = "user.name";

const filehound = FileHound.create();

async function run(): Promise<void> {
    try {
        const context = new GithubActionContext();
        let settings: ISettings = new Settings(context);
        const githubManager = new GithubManager(octokit(settings));

        settings = await prepareTemplateSettings(settings, githubManager);

        core.debug(`Used settings: ${inspect(settings)}`);

        try {
            // Register problem matcher
            coreCommand.issueCommand("add-matcher", {}, path.join(__dirname, "problem-matcher.json"));

            if (
                !(await githubManager.branch.has(
                    settings.repositoryOwner,
                    settings.repositoryName,
                    settings.syncBranchName,
                ))
            ) {
                const baseBranch = await githubManager.branch.get(
                    settings.repositoryOwner,
                    settings.repositoryName,
                    settings.ref.replace(/^refs\/heads\//, ""),
                );

                await githubManager.branch.create(
                    settings.repositoryOwner,
                    settings.repositoryName,
                    baseBranch.data.object.sha,
                    settings.syncBranchName,
                );
            }

            const mainGitCommandManager = await createCommandManager(settings.repositoryPath);
            const ref = `refs/heads/${settings.syncBranchName}`;

            await mainGitCommandManager.fetch(0, refHelper.getRefSpec(ref));

            const checkoutInfo = await refHelper.getCheckoutInfo(mainGitCommandManager, ref);

            await mainGitCommandManager.checkout(checkoutInfo.ref, checkoutInfo.startPoint);

            // download the template repo
            await gitSourceProvider.getSource(
                githubManager,
                settings,
                settings.templateRepositoryUrl,
                settings.templateRepositoryPath,
                settings.templateRepositoryRef,
            );

            // find all files
            const files: string[] = filehound
                .path(settings.templateRepositoryPath)
                .discard(settings.ignoreList)
                .findSync();

            core.debug(`List of found files ${inspect(files)}`);

            for (const file of files) {
                fs.copySync(
                    file,
                    path.join(settings.githubWorkspacePath, file.replace(settings.templateRepositoryPath, "")),
                    {
                        overwrite: true,
                    },
                );
            }

            await io.rmRF(settings.templateRepositoryPath);

            try {
                core.startGroup("Setting up git user and email");
                await mainGitCommandManager.config(USER_EMAIL, settings.authorEmail, true);
                await mainGitCommandManager.config(USER_NAME, settings.authorName, true);
                core.endGroup();

                core.startGroup("Adding all changed files to main repository");
                await mainGitCommandManager.addAll();
                core.endGroup();

                core.startGroup("Checking if changes exist that needs to applied");
                if ((await mainGitCommandManager.status(["--porcelain"])) === "") {
                    core.setOutput("Git status", `No changes found for ${settings.templateRepositoryUrl}`);
                    process.exit(0); // there is currently no neutral exit code
                }
                core.endGroup();

                core.startGroup("Creating a commit");
                await mainGitCommandManager.commit(settings.messageHead);
                core.endGroup();

                core.startGroup("Pushing new commit");
                await mainGitCommandManager.push(settings.syncBranchName);
                core.endGroup();

                // Dump some info about the checked out commit
                await mainGitCommandManager.log1();
            } finally {
                await mainGitCommandManager.tryConfigUnset(USER_EMAIL, true);
                await mainGitCommandManager.tryConfigUnset(USER_NAME, true);
            }

            core.startGroup("Creating Pull request");
            await githubManager.pulls.create(
                settings.repositoryOwner,
                settings.repositoryName,
                settings.syncBranchName,
                settings.ref,
                settings.messageHead,
                settings.messageBody,
            );
            core.endGroup();
        } finally {
            // Unregister problem matcher
            coreCommand.issueCommand("remove-matcher", { owner: "checkout-git" }, "");
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

async function prepareTemplateSettings(settings: ISettings, githubManager: GithubManager): Promise<ISettings> {
    let template = core.getInput("template_repository", { required: false });

    if (!template) {
        const repoData = await githubManager.repos.get(settings.repositoryOwner, settings.repositoryName);

        if (repoData.data.template_repository !== undefined) {
            template = repoData.data.template_repository.full_name;
        } else {
            core.setFailed(
                'Template repository not found, please provide "template_repository" key, that you want to check',
            );

            process.exit(1); // there is currently no neutral exit code
        }
    } else {
        const [templateRepositoryOwner, templateRepositoryName] = template.split("/");
        const repoData = await githubManager.repos.get(templateRepositoryOwner, templateRepositoryName);

        if (repoData.data.template_repository === undefined) {
            core.setFailed('You need to provide a github template repository for "template_repository"');

            process.exit(1); // there is currently no neutral exit code
        }
    }

    settings.templateRepository = template;

    const [templateRepositoryOwner, templateRepositoryName] = template.split("/");

    settings.templateRepositoryPath = path.resolve(
        settings.githubWorkspacePath,
        `${encodeURIComponent(templateRepositoryOwner)}/${encodeURIComponent(templateRepositoryName)}`,
    );

    if (!(settings.templateRepositoryPath + path.sep).startsWith(settings.githubWorkspacePath + path.sep)) {
        throw new Error(
            `Repository path '${settings.templateRepositoryPath}' is not under '${settings.githubWorkspacePath}'`,
        );
    }

    if (settings.sshKey) {
        settings.templateRepositoryUrl = `git@${settings.serverUrl.hostname}:${settings.templateRepository}.git`;
    } else {
        // "origin" is SCHEME://HOSTNAME[:PORT]
        settings.templateRepositoryUrl = `${settings.serverUrl.origin}/${settings.templateRepository}`;
    }

    return settings;
}

if (!stateHelper.IsPost) {
    run();
} else {
    cleanup(stateHelper.TemplateRepositoryPath);
}
