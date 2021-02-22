import { Octokit } from "@octokit/action";
import { Octokit as Core } from "@octokit/core";
import { retry } from "@octokit/plugin-retry";
import { ISettings } from "./interfaces";

// plugins for octokit
const MyOctokit = Octokit.plugin(retry);

export function octokit(setting: ISettings): Core {
    return new MyOctokit({
        auth: setting.authToken,
        baseUrl: setting.apiUrl,
        previews: [
            "baptiste", // templateRepositoryPath
            "lydian", // update pull request
        ],
    });
}
