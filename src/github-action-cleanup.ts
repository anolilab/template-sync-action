import fs from "fs-extra";
import path from "path";
import * as core from "@actions/core";
import { createCommandManager } from "./git-command-manager";
import { IGitCommandManager, ISettings } from "./interfaces";
import { GitAuthHelper } from "./git-auth-helper";
import { GithubActionContext } from "./github-action-context";
import { Settings } from "./settings";

export async function cleanup(repositoryPath: string): Promise<void> {
    if (!repositoryPath || !fs.existsSync(path.join(repositoryPath, ".git", "config"))) {
        return;
    }

    let git: IGitCommandManager;
    try {
        git = await createCommandManager(repositoryPath);
    } catch {
        return;
    }

    try {
        const context = new GithubActionContext();
        let settings: ISettings = new Settings(context);
        // Remove auth
        const authHelper = new GitAuthHelper(git, settings);
        await authHelper.removeAuth();

        await fs.remove(repositoryPath);
    } catch (error) {
        core.setFailed(error.message);
    }
}
