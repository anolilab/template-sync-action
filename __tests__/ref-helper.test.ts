import * as refHelper from "../lib/ref-helper";
import { IGitCommandManager } from "../lib/interfaces";

let git: IGitCommandManager;

describe("ref-helper tests", () => {
    beforeEach(() => {
        git = {} as unknown as IGitCommandManager;
    });

    it("getCheckoutInfo requires git", async () => {
        const git = null as unknown as IGitCommandManager;
        try {
            await refHelper.getCheckoutInfo(git, "refs/heads/my/branch");
            throw new Error("Should not reach here");
        } catch (err) {
            expect((err as Error).message).toBe("Arg git cannot be empty");
        }
    });

    it("getCheckoutInfo requires ref", async () => {
        try {
            await refHelper.getCheckoutInfo(git, "");
            throw new Error("Should not reach here");
        } catch (err) {
            expect((err as Error).message).toBe("Args ref cannot be empty");
        }
    });

    it("getCheckoutInfo refs/heads/", async () => {
        const checkoutInfo = await refHelper.getCheckoutInfo(git, "refs/heads/my/branch");
        expect(checkoutInfo.ref).toBe("my/branch");
        expect(checkoutInfo.startPoint).toBe("refs/remotes/origin/my/branch");
    });

    it("getCheckoutInfo refs/pull/", async () => {
        const checkoutInfo = await refHelper.getCheckoutInfo(git, "refs/pull/123/merge");
        expect(checkoutInfo.ref).toBe("refs/remotes/pull/123/merge");
        expect(checkoutInfo.startPoint).toBeFalsy();
    });

    it("getCheckoutInfo refs/tags/", async () => {
        const checkoutInfo = await refHelper.getCheckoutInfo(git, "refs/tags/my-tag");
        expect(checkoutInfo.ref).toBe("refs/tags/my-tag");
        expect(checkoutInfo.startPoint).toBeFalsy();
    });

    it("getCheckoutInfo unqualified branch only", async () => {
        git.branchExists = jest.fn(async () => {
            return true;
        });

        const checkoutInfo = await refHelper.getCheckoutInfo(git, "my/branch");

        expect(checkoutInfo.ref).toBe("my/branch");
        expect(checkoutInfo.startPoint).toBe("refs/remotes/origin/my/branch");
    });

    it("getCheckoutInfo unqualified tag only", async () => {
        git.branchExists = jest.fn(async () => {
            return false;
        });
        git.tagExists = jest.fn(async () => {
            return true;
        });

        const checkoutInfo = await refHelper.getCheckoutInfo(git, "my-tag");

        expect(checkoutInfo.ref).toBe("refs/tags/my-tag");
        expect(checkoutInfo.startPoint).toBeFalsy();
    });

    it("getCheckoutInfo unqualified ref only, not a branch or tag", async () => {
        git.branchExists = jest.fn(async () => {
            return false;
        });
        git.tagExists = jest.fn(async () => {
            return false;
        });

        try {
            await refHelper.getCheckoutInfo(git, "my-ref");
            throw new Error("Should not reach here");
        } catch (err) {
            expect((err as Error).message).toBe("A branch or tag with the name 'my-ref' could not be found");
        }
    });

    it("getRefSpec requires ref or commit", async () => {
        try {
            refHelper.getRefSpec("");
            throw new Error("Should not reach here");
        } catch (err) {
            expect((err as Error).message).toBe("Arg ref cannot be empty");
        }
    });

    it("getRefSpec unqualified ref only", async () => {
        const refSpec = refHelper.getRefSpec("my-ref");
        expect(refSpec.length).toBe(2);
        expect(refSpec[0]).toBe("+refs/heads/my-ref*:refs/remotes/origin/my-ref*");
        expect(refSpec[1]).toBe("+refs/tags/my-ref*:refs/tags/my-ref*");
    });

    it("getRefSpec refs/heads/ only", async () => {
        const refSpec = refHelper.getRefSpec("refs/heads/my/branch");
        expect(refSpec.length).toBe(1);
        expect(refSpec[0]).toBe("+refs/heads/my/branch:refs/remotes/origin/my/branch");
    });

    it("getRefSpec refs/pull/ only", async () => {
        const refSpec = refHelper.getRefSpec("refs/pull/123/merge");
        expect(refSpec.length).toBe(1);
        expect(refSpec[0]).toBe("+refs/pull/123/merge:refs/remotes/pull/123/merge");
    });

    it("getRefSpec refs/tags/ only", async () => {
        const refSpec = refHelper.getRefSpec("refs/tags/my-tag");
        expect(refSpec.length).toBe(1);
        expect(refSpec[0]).toBe("+refs/tags/my-tag:refs/tags/my-tag");
    });
});
