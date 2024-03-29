import { IGitCommandManager } from "./interfaces";

export interface ICheckoutInfo {
    ref: string;
    startPoint: string;
}

export async function getCheckoutInfo(git: IGitCommandManager, ref: string): Promise<ICheckoutInfo> {
    if (!git) {
        throw new Error("Arg git cannot be empty");
    }

    if (!ref) {
        throw new Error("Args ref cannot be empty");
    }

    const result = {} as unknown as ICheckoutInfo;
    const upperRef = (ref || "").toUpperCase();

    // refs/heads/
    if (upperRef.startsWith("REFS/HEADS/")) {
        const branch = ref.substring("refs/heads/".length);
        result.ref = branch;
        result.startPoint = `refs/remotes/origin/${branch}`;
    }
    // refs/pull/
    else if (upperRef.startsWith("REFS/PULL/")) {
        const branch = ref.substring("refs/pull/".length);
        result.ref = `refs/remotes/pull/${branch}`;
    }
    // refs/tags/
    else if (upperRef.startsWith("REFS/")) {
        result.ref = ref;
    }
    // Unqualified ref, check for a matching ref or tag
    else {
        if (await git.branchExists(true, `origin/${ref}`)) {
            result.ref = ref;
            result.startPoint = `refs/remotes/origin/${ref}`;
        } else if (await git.tagExists(`${ref}`)) {
            result.ref = `refs/tags/${ref}`;
        } else {
            throw new Error(`A branch or tag with the name '${ref}' could not be found`);
        }
    }

    return result;
}

export function getRefSpec(ref: string): string[] {
    if (!ref) {
        throw new Error("Arg ref cannot be empty");
    }

    const upperRef = (ref || "").toUpperCase();

    // Unqualified ref, check for a matching ref or tag
    if (!upperRef.startsWith("REFS/")) {
        return [`+refs/heads/${ref}*:refs/remotes/origin/${ref}*`, `+refs/tags/${ref}*:refs/tags/${ref}*`];
    }
    // refs/heads/
    else if (upperRef.startsWith("REFS/HEADS/")) {
        const branch = ref.substring("refs/heads/".length);
        return [`+${ref}:refs/remotes/origin/${branch}`];
    }
    // refs/pull/
    else if (upperRef.startsWith("REFS/PULL/")) {
        const branch = ref.substring("refs/pull/".length);
        return [`+${ref}:refs/remotes/pull/${branch}`];
    }
    // refs/tags/
    else {
        return [`+${ref}:${ref}`];
    }
}
