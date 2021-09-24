import * as core from "@actions/core";
import * as io from "@actions/io";
import * as path from "path";
import fs from "fs-extra";
import { IGitCommandManager, IGithubManager, ISettings } from "./interfaces";
import { createCommandManager, MinimumGitVersion } from "./git-command-manager";
import { GitAuthHelper } from "./git-auth-helper";
import * as refHelper from "./ref-helper";
import * as stateHelper from "./state-helper";

export async function getSource(
    githubManager: IGithubManager,
    settings: ISettings,
    repositoryUrl: string,
    repositoryPath: string,
    ref: string, // ref
    fetchDepth = 0,
): Promise<void> {
    // Repository URL
    core.info(`Cloning repository: ${repositoryUrl}`);

    // Remove conflicting file path
    if (fs.existsSync(repositoryPath)) {
        await io.rmRF(repositoryPath);
    }

    // Create directory
    let isExisting = true;

    if (!fs.existsSync(repositoryPath)) {
        isExisting = false;

        await io.mkdirP(repositoryPath);
    }

    // Git command manager
    core.startGroup("Getting Git version info");
    const git = await gitCommandManager(repositoryPath);
    core.endGroup();

    // Prepare existing directory, otherwise recreate
    if (isExisting) {
        core.info(`Deleting the contents of '${repositoryPath}'`);

        for (const file of await fs.promises.readdir(repositoryPath)) {
            await io.rmRF(path.join(repositoryPath, file));
        }
    }

    if (!git) {
        // Downloading using REST API
        core.info(`The repository will be downloaded using the GitHub REST API`);
        core.info(`To create a local Git repository instead, add Git ${MinimumGitVersion} or higher to the PATH`);

        if (settings.sshKey) {
            throw new Error(
                `Input 'ssh-key' not supported when falling back to download using the GitHub REST API. To create a local Git repository instead, add Git ${MinimumGitVersion} or higher to the PATH.`,
            );
        }

        const [templateRepositoryOwner, templateRepositoryName] = repositoryPath.split("/");

        await githubManager.repos.downloadRepository(templateRepositoryOwner, templateRepositoryName, ref);
        return;
    }

    // Save state for POST action
    stateHelper.setTemplateRepositoryPath(repositoryPath);

    // Initialize the repository
    if (!fs.existsSync(path.join(repositoryPath, ".git"))) {
        core.startGroup("Initializing the repository");
        await git.init();

        await git.remoteAdd("origin", repositoryUrl);
        core.endGroup();
    }

    // Disable automatic garbage collection
    core.startGroup("Disabling automatic garbage collection");
    if (!(await git.tryDisableAutomaticGarbageCollection())) {
        core.warning(`Unable to turn off git automatic garbage collection. The git fetch operation may trigger garbage collection and cause a delay.`);
    }
    core.endGroup();

    const authHelper = new GitAuthHelper(git, settings);

    try {
        // Configure auth
        core.startGroup("Setting up auth");
        await authHelper.configureAuth();
        core.endGroup();

        // Fetch
        core.startGroup("Fetching the repository");
        const refSpec = refHelper.getRefSpec(ref);
        await git.fetch(fetchDepth, refSpec);
        core.endGroup();

        // Checkout info
        core.startGroup("Determining the checkout info");
        const checkoutInfo = await refHelper.getCheckoutInfo(git, ref);
        core.endGroup();

        // Checkout
        core.startGroup("Checking out the ref");
        await git.checkout(checkoutInfo.ref, checkoutInfo.startPoint);
        core.endGroup();

        // Dump some info about the checked out commit
        await git.log1();
    } finally {
        // Remove auth
        if (!settings.persistCredentials) {
            core.startGroup("Removing auth");
            await authHelper.removeAuth();
            core.endGroup();
        }
    }
}

async function gitCommandManager(repositoryPath: string): Promise<IGitCommandManager | undefined> {
    core.info(`Working directory is '${repositoryPath}'`);

    try {
        const manager = await createCommandManager(repositoryPath);

        manager.checkGitVersion();

        return manager;
    } catch (err) {
        // Otherwise fallback to REST API
        return undefined;
    }
}
