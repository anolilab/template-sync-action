/**
 * Diff Match and Patch
 * Copyright 2018 The diff-match-patch Authors.
 * https://github.com/google/diff-match-patch
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @fileoverview Computes the difference between two texts to create a patch.
 * Applies the patch onto another text, allowing for errors.
 * @author fraser@google.com (Neil Fraser)
 */
import { Diff } from "./diff";
import { DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT } from "../interfaces";
import { PatchObject } from "./patch-object";
import { levenshtein } from "./levenshtein";
import { diffLinesToChars } from "./diff-lines-to-chars";
import { diffCharsToLines } from "./diff-chars-to-lines";
import { commonSuffix } from "./common-suffix";
import { commonPrefix } from "./common-prefix";
import { diffXIndex } from "./diff-x-index";
import { diffCommonOverlap } from "./diff-common-overlap";
import { matchAlphabet } from "./match-alphabet";
import { patchDeepObjectCopy } from "./patch-deep-object-copy";
import { diffText } from "./diff-text";

export default class DiffMatchPatch {
    DiffTimeout: number;
    DiffEditCost: number;
    MatchThreshold: number;
    MatchDistance: number;
    PatchDeleteThreshold: number;
    PatchMargin: number;
    MatchMaxBits: number;

    // Define some regex patterns for matching boundaries.
    private static nonAlphaNumericRegex = /[^a-zA-Z0-9]/;
    private static whitespaceRegex = /\s/;
    private static linebreakRegex = /[\r\n]/;
    private static blankLineEndRegex = /\n\r?\n$/;
    private static blankLineStartRegex = /^\r?\n\r?\n/;

    constructor() {
        // Defaults.
        // Redefine these in your program to override the defaults.

        // Number of seconds to map a diff before giving up (0 for infinity).
        this.DiffTimeout = 1.0;
        // Cost of an empty edit operation in terms of edit characters.
        this.DiffEditCost = 4;
        // At what point is no match declared (0.0 = perfection, 1.0 = very loose).
        this.MatchThreshold = 0.5;
        // How far to search for a match (0 = exact location, 1000+ = broad match).
        // A match this many characters away from the expected location will add
        // 1.0 to the score (0.0 is a perfect match).
        this.MatchDistance = 1000;
        // When deleting a large block of text (over ~64 characters), how close do
        // the contents have to be to match the expected contents. (0.0 = perfection,
        // 1.0 = very loose).  Note that MatchThreshold controls how closely the
        // end points of a delete need to match.
        this.PatchDeleteThreshold = 0.5;
        // Chunk size for context length.
        this.PatchMargin = 4;

        // The number of bits in an int.
        this.MatchMaxBits = 32;
    }

    /**
     * Find the differences between two texts.  Simplifies the problem by stripping
     * any common prefix or suffix off the texts before diffing.
     *
     * @param {string} text1 Old string to be diffed.
     * @param {string} text2 New string to be diffed.
     * @param {boolean} optCheckLines Optional speedup flag. If present and false,
     *     then don't run a line-level diff first to identify the changed areas.
     *     Defaults to true, which does a faster, slightly less optimal diff.
     * @param {number} optDeadline Optional time when the diff should be complete
     *     by.  Used internally for recursive calls.  Users should set DiffTimeout
     *     instead.
     *
     * @return {!Array.<!Diff>} Array of diff tuples.
     */
    diff(text1: string, text2: string, optCheckLines?: boolean, optDeadline?: number): Diff[] {
        // Set a deadline by which time the diff must be complete.
        if (typeof optDeadline == "undefined") {
            if (this.DiffTimeout <= 0) {
                optDeadline = Number.MAX_VALUE;
            } else {
                optDeadline = new Date().getTime() + this.DiffTimeout * 1000;
            }
        }

        const deadline = optDeadline;

        // Check for equality (speedup).
        if (text1 == text2) {
            if (text1 !== "") {
                return [new Diff(DIFF_EQUAL, text1)];
            }

            return [];
        }

        if (typeof optCheckLines == "undefined") {
            optCheckLines = true;
        }

        const checkLines = optCheckLines;

        // Trim off common prefix (speedup).
        let commonLength = commonPrefix(text1, text2);

        const prefix = text1.substring(0, commonLength);

        text1 = text1.substring(commonLength);
        text2 = text2.substring(commonLength);

        // Trim off common suffix (speedup).
        commonLength = commonSuffix(text1, text2);

        const suffix = text1.substring(text1.length - commonLength);

        text1 = text1.substring(0, text1.length - commonLength);
        text2 = text2.substring(0, text2.length - commonLength);

        // Compute the diff on the middle block.
        const diffs = this.diffCompute(text1, text2, checkLines, deadline);

        // Restore the prefix and suffix.
        if (prefix) {
            diffs.unshift(new Diff(DIFF_EQUAL, prefix));
        }

        if (suffix) {
            diffs.push(new Diff(DIFF_EQUAL, suffix));
        }

        this.diffCleanupMerge(diffs);

        return diffs;
    }

    /**
     * Find the differences between two texts.  Assumes that the texts do not
     * have any common prefix or suffix.
     *
     * @param {string} text1 Old string to be diffed.
     * @param {string} text2 New string to be diffed.
     * @param {boolean} checkLines Speedup flag.  If false, then don't run a
     *     line-level diff first to identify the changed areas.
     *     If true, then run a faster, slightly less optimal diff.
     * @param {number} deadline Time when the diff should be complete by.
     *
     * @return {!Array.<!Diff>} Array of diff tuples.
     *
     * @private
     */
    private diffCompute(text1: string, text2: string, checkLines: boolean, deadline: number): Diff[] {
        let diffs;

        if (!text1) {
            // Just add some text (speedup).
            return [new Diff(DIFF_INSERT, text2)];
        }

        if (!text2) {
            // Just delete some text (speedup).
            return [new Diff(DIFF_DELETE, text1)];
        }

        const longtext = text1.length > text2.length ? text1 : text2;
        const shortText = text1.length > text2.length ? text2 : text1;
        const i = longtext.indexOf(shortText);

        if (i != -1) {
            // Shorter text is inside the longer text (speedup).
            diffs = [
                new Diff(DIFF_INSERT, longtext.substring(0, i)),
                new Diff(DIFF_EQUAL, shortText),
                new Diff(DIFF_INSERT, longtext.substring(i + shortText.length)),
            ];

            // Swap insertions for deletions if diff is reversed.
            if (text1.length > text2.length) {
                diffs[0].operation = diffs[2].operation = DIFF_DELETE;
            }

            return diffs;
        }

        if (shortText.length == 1) {
            // Single character string.
            // After the previous speedup, the character can't be an equality.
            return [new Diff(DIFF_DELETE, text1), new Diff(DIFF_INSERT, text2)];
        }

        // Check to see if the problem can be split in two.
        const hm = this.diffHalfMatch(text1, text2);

        if (hm) {
            // A half-match was found, sort out the return data.
            const text1A = hm[0];
            const text1B = hm[1];
            const text2A = hm[2];
            const text2B = hm[3];
            const midCommon = hm[4];
            // Send both pairs off for separate processing.
            const diffsA = this.diff(text1A, text2A, checkLines, deadline);
            const diffsB = this.diff(text1B, text2B, checkLines, deadline);

            // Merge the results.
            return diffsA.concat([new Diff(DIFF_EQUAL, midCommon)], diffsB);
        }

        if (checkLines && text1.length > 100 && text2.length > 100) {
            return this.diffLineMode(text1, text2, deadline);
        }

        return this.diffBisect(text1, text2, deadline);
    }

    /**
     * Do a quick line-level diff on both strings, then rediff the parts for
     * greater accuracy.
     * This speedup can produce non-minimal diffs.
     *
     * @param {string} text1 Old string to be diffed.
     * @param {string} text2 New string to be diffed.
     * @param {number} deadline Time when the diff should be complete by.
     *
     * @return {!Array.<!Diff>} Array of diff tuples.
     *
     * @private
     */
    private diffLineMode(text1: string, text2: string, deadline: number): Diff[] {
        // Scan the text on a line-by-line basis first.
        const a = diffLinesToChars(text1, text2);
        text1 = a.chars1;
        text2 = a.chars2;
        const lineArray = a.lineArray;

        const diffs = this.diff(text1, text2, false, deadline);

        // Convert the diff back to original text.
        diffCharsToLines(diffs, lineArray);
        // Eliminate freak matches (e.g. blank lines)
        this.diffCleanupSemantic(diffs);

        // Rediff any replacement blocks, this time character-by-character.
        // Add a dummy entry at the end.
        diffs.push(new Diff(DIFF_EQUAL, ""));

        let pointer = 0;
        let countDelete = 0;
        let countInsert = 0;
        let textDelete = "";
        let textInsert = "";

        while (pointer < diffs.length) {
            switch (diffs[pointer].operation) {
                case DIFF_INSERT:
                    countInsert++;
                    textInsert += diffs[pointer].text;
                    break;
                case DIFF_DELETE:
                    countDelete++;
                    textDelete += diffs[pointer].text;
                    break;
                case DIFF_EQUAL:
                    // Upon reaching an equality, check for prior redundancies.
                    if (countDelete >= 1 && countInsert >= 1) {
                        // Delete the offending records and add the merged ones.
                        diffs.splice(pointer - countDelete - countInsert, countDelete + countInsert);

                        pointer = pointer - countDelete - countInsert;

                        const subDiff = this.diff(textDelete, textInsert, false, deadline);

                        for (let j = subDiff.length - 1; j >= 0; j--) {
                            diffs.splice(pointer, 0, subDiff[j]);
                        }

                        pointer = pointer + subDiff.length;
                    }

                    countInsert = 0;
                    countDelete = 0;
                    textDelete = "";
                    textInsert = "";
                    break;
            }

            pointer++;
        }

        diffs.pop(); // Remove the dummy entry at the end.

        return diffs;
    }

    /**
     * Find the 'middle snake' of a diff, split the problem in two
     * and return the recursively constructed diff.
     * See Myers 1986 paper: An O(ND) Difference Algorithm and Its Variations.
     *
     * @param {string} text1 Old string to be diffed.
     * @param {string} text2 New string to be diffed.
     * @param {number} deadline Time at which to bail if not yet complete.
     *
     * @return {!Array.<!Diff>} Array of diff tuples.
     *
     * @private
     */
    private diffBisect(text1: string, text2: string, deadline: number): Diff[] {
        // Cache the text lengths to prevent multiple calls.
        const text1Length = text1.length;
        const text2Length = text2.length;
        const maxD = Math.ceil((text1Length + text2Length) / 2);
        const vOffset = maxD;
        const vLength = 2 * maxD;
        const v1 = new Array<number>(vLength);
        const v2 = new Array<number>(vLength);

        // Setting all elements to -1 is faster in Chrome & Firefox than mixing
        // integers and undefined.
        for (let x = 0; x < vLength; x++) {
            v1[x] = -1;
            v2[x] = -1;
        }

        v1[vOffset + 1] = 0;
        v2[vOffset + 1] = 0;

        const delta = text1Length - text2Length;
        // If the total number of characters is odd, then the front path will collide
        // with the reverse path.
        const front = delta % 2 != 0;
        // Offsets for start and end of k loop.
        // Prevents mapping of space beyond the grid.
        let k1start = 0;
        let k1end = 0;
        let k2start = 0;
        let k2end = 0;

        for (let d = 0; d < maxD; d++) {
            // Bail out if deadline is reached.
            if (new Date().getTime() > deadline) {
                break;
            }

            // Walk the front path one step.
            for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
                const k1Offset = vOffset + k1;
                let x1: number;

                if (k1 == -d || (k1 != d && v1[k1Offset - 1] < v1[k1Offset + 1])) {
                    x1 = v1[k1Offset + 1];
                } else {
                    x1 = v1[k1Offset - 1] + 1;
                }

                let y1 = x1 - k1;

                while (x1 < text1Length && y1 < text2Length && text1.charAt(x1) == text2.charAt(y1)) {
                    x1++;
                    y1++;
                }

                v1[k1Offset] = x1;

                if (x1 > text1Length) {
                    // Ran off the right of the graph.
                    k1end += 2;
                } else if (y1 > text2Length) {
                    // Ran off the bottom of the graph.
                    k1start += 2;
                } else if (front) {
                    const k2Offset = vOffset + delta - k1;

                    if (k2Offset >= 0 && k2Offset < vLength && v2[k2Offset] != -1) {
                        // Mirror x2 onto top-left coordinate system.
                        const x2 = text1Length - v2[k2Offset];

                        if (x1 >= x2) {
                            // Overlap detected.
                            return this.diffBisectSplit(text1, text2, x1, y1, deadline);
                        }
                    }
                }
            }

            // Walk the reverse path one step.
            for (let k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
                const k2Offset = vOffset + k2;
                let x2: number;

                if (k2 == -d || (k2 != d && v2[k2Offset - 1] < v2[k2Offset + 1])) {
                    x2 = v2[k2Offset + 1];
                } else {
                    x2 = v2[k2Offset - 1] + 1;
                }

                let y2 = x2 - k2;

                while (
                    x2 < text1Length &&
                    y2 < text2Length &&
                    text1.charAt(text1Length - x2 - 1) == text2.charAt(text2Length - y2 - 1)
                ) {
                    x2++;
                    y2++;
                }

                v2[k2Offset] = x2;

                if (x2 > text1Length) {
                    // Ran off the left of the graph.
                    k2end += 2;
                } else if (y2 > text2Length) {
                    // Ran off the top of the graph.
                    k2start += 2;
                } else if (!front) {
                    const k1Offset = vOffset + delta - k2;

                    if (k1Offset >= 0 && k1Offset < vLength && v1[k1Offset] != -1) {
                        const x1 = v1[k1Offset];
                        const y1 = vOffset + x1 - k1Offset;
                        // Mirror x2 onto top-left coordinate system.
                        x2 = text1Length - x2;

                        if (x1 >= x2) {
                            // Overlap detected.
                            return this.diffBisectSplit(text1, text2, x1, y1, deadline);
                        }
                    }
                }
            }
        }

        // Diff took too long and hit the deadline or
        // number of diffs equals number of characters, no commonality at all.
        return [new Diff(DIFF_DELETE, text1), new Diff(DIFF_INSERT, text2)];
    }

    /**
     * Given the location of the 'middle snake', split the diff in two parts
     * and recurse.
     *
     * @param {string} text1 Old string to be diffed.
     * @param {string} text2 New string to be diffed.
     * @param {number} x Index of split point in text1.
     * @param {number} y Index of split point in text2.
     * @param {number} deadline Time at which to bail if not yet complete.
     *
     * @return {!Array.<!Diff>} Array of diff tuples.
     *
     * @private
     */
    private diffBisectSplit(text1: string, text2: string, x: number, y: number, deadline: number): Diff[] {
        const text1a = text1.substring(0, x);
        const text2a = text2.substring(0, y);
        const text1b = text1.substring(x);
        const text2b = text2.substring(y);

        // Compute both diffs serially.
        const diffs = this.diff(text1a, text2a, false, deadline);
        const diffsB = this.diff(text1b, text2b, false, deadline);

        return diffs.concat(diffsB);
    }

    /**
     * Do the two texts share a substring which is at least half the length of the
     * longer text?
     * This speedup can produce non-minimal diffs.
     * @param {string} text1 First string.
     * @param {string} text2 Second string.
     * @return {Array.<string>} Five element Array, containing the prefix of
     *     text1, the suffix of text1, the prefix of text2, the suffix of
     *     text2 and the common middle.  Or null if there was no match.
     * @private
     */
    private diffHalfMatch(text1: string, text2: string): string[] | null {
        if (this.DiffTimeout <= 0) {
            // Don't risk returning a non-optimal diff if we have unlimited time.
            return null;
        }

        const longtext = text1.length > text2.length ? text1 : text2;
        const shortText = text1.length > text2.length ? text2 : text1;

        if (longtext.length < 4 || shortText.length * 2 < longtext.length) {
            return null; // Pointless.
        }

        /**
         * Does a substring of shortText exist within longtext such that the substring
         * is at least half the length of longtext?
         * Closure, but does not reference any external variables.
         * @param {string} longtext Longer string.
         * @param {string} shortText Shorter string.
         * @param {number} i Start index of quarter length substring within longtext.
         * @return {Array.<string>} Five element Array, containing the prefix of
         *     longtext, the suffix of longtext, the prefix of shortText, the suffix
         *     of shortText and the common middle.  Or null if there was no match.
         * @private
         */
        function diffHalfMatchI(longtext: string, shortText: string, i: number): string[] | null {
            // Start with a 1/4 length substring at position i as a seed.
            const seed = longtext.substring(i, i + Math.floor(longtext.length / 4));

            let j = -1;
            let bestCommon = "";
            let bestLongtextA = "";
            let bestLongtextB = "";
            let bestShortTextA = "";
            let bestShortTextB = "";

            while ((j = shortText.indexOf(seed, j + 1)) != -1) {
                const prefixLength = commonPrefix(longtext.substring(i), shortText.substring(j));

                const suffixLength = commonSuffix(longtext.substring(0, i), shortText.substring(0, j));

                if (bestCommon.length < suffixLength + prefixLength) {
                    bestCommon = shortText.substring(j - suffixLength, j) + shortText.substring(j, j + prefixLength);
                    bestLongtextA = longtext.substring(0, i - suffixLength);
                    bestLongtextB = longtext.substring(i + prefixLength);
                    bestShortTextA = shortText.substring(0, j - suffixLength);
                    bestShortTextB = shortText.substring(j + prefixLength);
                }
            }

            if (bestCommon.length * 2 >= longtext.length) {
                return [bestLongtextA, bestLongtextB, bestShortTextA, bestShortTextB, bestCommon];
            }

            return null;
        }

        // First check if the second quarter is the seed for a half-match.
        const hm1 = diffHalfMatchI(longtext, shortText, Math.ceil(longtext.length / 4));

        // Check again based on the third quarter.
        const hm2 = diffHalfMatchI(longtext, shortText, Math.ceil(longtext.length / 2));

        let hm: string[] | null;

        if (!hm1 && !hm2) {
            return null;
        } else if (!hm2) {
            hm = hm1;
        } else if (!hm1) {
            hm = hm2;
        } else {
            // Both matched.  Select the longest.
            hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
        }

        // A half-match was found, sort out the return data.
        let text1A;
        let text1B;
        let text2A;
        let text2B;

        if (text1.length > text2.length) {
            text1A = hm![0];
            text1B = hm![1];
            text2A = hm![2];
            text2B = hm![3];
        } else {
            text2A = hm![0];
            text2B = hm![1];
            text1A = hm![2];
            text1B = hm![3];
        }

        const midCommon = hm![4];

        return [text1A, text1B, text2A, text2B, midCommon];
    }

    /**
     * Reduce the number of edits by eliminating semantically trivial equalities.
     *
     * @param {!Array.<!Diff>} diffs Array of diff tuples.
     */
    diffCleanupSemantic(diffs: Diff[]) {
        const equalities: number[] = []; // Stack of indices where equalities are found.

        let changes = false;
        let equalitiesLength = 0; // Keeping our own length const is faster in JS.
        /** @type {?string} */
        let lastEquality = null;
        // Always equal to diffs[equalities[equalitiesLength - 1]][1]
        let pointer = 0; // Index of current position.
        // Number of characters that changed prior to the equality.
        let lengthInsertions1 = 0;
        let lengthDeletions1 = 0;
        // Number of characters that changed after the equality.
        let lengthInsertions2 = 0;
        let lengthDeletions2 = 0;

        while (pointer < diffs.length) {
            if (diffs[pointer].operation == DIFF_EQUAL) {
                // Equality found.
                equalities[equalitiesLength++] = pointer;
                lengthInsertions1 = lengthInsertions2;
                lengthDeletions1 = lengthDeletions2;
                lengthInsertions2 = 0;
                lengthDeletions2 = 0;
                lastEquality = diffs[pointer].text;
            } else {
                // An insertion or deletion.
                if (diffs[pointer].operation == DIFF_INSERT) {
                    lengthInsertions2 += diffs[pointer].text.length;
                } else {
                    lengthDeletions2 += diffs[pointer].text.length;
                }

                // Eliminate an equality that is smaller or equal to the edits on both
                // sides of it.
                if (
                    lastEquality &&
                    lastEquality.length <= Math.max(lengthInsertions1, lengthDeletions1) &&
                    lastEquality.length <= Math.max(lengthInsertions2, lengthDeletions2)
                ) {
                    // Duplicate record.
                    diffs.splice(equalities[equalitiesLength - 1], 0, new Diff(DIFF_DELETE, lastEquality));
                    // Change second copy to insert.
                    diffs[equalities[equalitiesLength - 1] + 1].operation = DIFF_INSERT;
                    // Throw away the equality we just deleted.
                    equalitiesLength--;
                    // Throw away the previous equality (it needs to be reevaluated).
                    equalitiesLength--;
                    pointer = equalitiesLength > 0 ? equalities[equalitiesLength - 1] : -1;
                    lengthInsertions1 = 0; // Reset the counters.
                    lengthDeletions1 = 0;
                    lengthInsertions2 = 0;
                    lengthDeletions2 = 0;
                    lastEquality = null;
                    changes = true;
                }
            }

            pointer++;
        }

        // Normalize the diff.
        if (changes) {
            this.diffCleanupMerge(diffs);
        }

        this.cleanupSemanticLossless(diffs);

        // Find any overlaps between deletions and insertions.
        // e.g: <del>abcxxx</del><ins>xxxdef</ins>
        //   -> <del>abc</del>xxx<ins>def</ins>
        // e.g: <del>xxxabc</del><ins>defxxx</ins>
        //   -> <ins>def</ins>xxx<del>abc</del>
        // Only extract an overlap if it is as big as the edit ahead or behind it.
        pointer = 1;

        while (pointer < diffs.length) {
            if (diffs[pointer - 1].operation == DIFF_DELETE && diffs[pointer].operation == DIFF_INSERT) {
                const deletion = diffs[pointer - 1].text;
                const insertion = diffs[pointer].text;
                const overlapLength1 = diffCommonOverlap(deletion, insertion);
                const overlapLength2 = diffCommonOverlap(insertion, deletion);
                if (overlapLength1 >= overlapLength2) {
                    if (overlapLength1 >= deletion.length / 2 || overlapLength1 >= insertion.length / 2) {
                        // Overlap found.  Insert an equality and trim the surrounding edits.
                        diffs.splice(pointer, 0, new Diff(DIFF_EQUAL, insertion.substring(0, overlapLength1)));

                        diffs[pointer - 1].text = deletion.substring(0, deletion.length - overlapLength1);
                        diffs[pointer + 1].text = insertion.substring(overlapLength1);

                        pointer++;
                    }
                } else {
                    if (overlapLength2 >= deletion.length / 2 || overlapLength2 >= insertion.length / 2) {
                        // Reverse overlap found.
                        // Insert an equality and swap and trim the surrounding edits.
                        diffs.splice(pointer, 0, new Diff(DIFF_EQUAL, deletion.substring(0, overlapLength2)));

                        diffs[pointer - 1].operation = DIFF_INSERT;
                        diffs[pointer - 1].text = insertion.substring(0, insertion.length - overlapLength2);
                        diffs[pointer + 1].operation = DIFF_DELETE;
                        diffs[pointer + 1].text = deletion.substring(overlapLength2);

                        pointer++;
                    }
                }

                pointer++;
            }

            pointer++;
        }
    }

    /**
     * Look for single edits surrounded on both sides by equalities
     * which can be shifted sideways to align the edit to a word boundary.
     * e.g: The c<ins>at c</ins>ame. -> The <ins>cat </ins>came.
     *
     * @param {!Array.<!Diff>} diffs Array of diff tuples.
     */
    private cleanupSemanticLossless(diffs: Diff[]) {
        /**
         * Given two strings, compute a score representing whether the internal
         * boundary falls on logical boundaries.
         * Scores range from 6 (best) to 0 (worst).
         * Closure, but does not reference any external variables.
         * @param {string} one First string.
         * @param {string} two Second string.
         * @return {number} The score.
         * @private
         */
        function diffCleanupSemanticScore(one: string, two: string): number {
            if (!one || !two) {
                // Edges are the best.
                return 6;
            }

            // Each port of this function behaves slightly differently due to
            // subtle differences in each language's definition of things like
            // 'whitespace'.  Since this function's purpose is largely cosmetic,
            // the choice has been made to use each language's native features
            // rather than force total conformity.
            const char1 = one.charAt(one.length - 1);
            const char2 = two.charAt(0);
            const nonAlphaNumeric1 = char1.match(DiffMatchPatch.nonAlphaNumericRegex);
            const nonAlphaNumeric2 = char2.match(DiffMatchPatch.nonAlphaNumericRegex);
            const whitespace1 = nonAlphaNumeric1 && char1.match(DiffMatchPatch.whitespaceRegex);
            const whitespace2 = nonAlphaNumeric2 && char2.match(DiffMatchPatch.whitespaceRegex);
            const lineBreak1 = whitespace1 && char1.match(DiffMatchPatch.linebreakRegex);
            const lineBreak2 = whitespace2 && char2.match(DiffMatchPatch.linebreakRegex);
            const blankLine1 = lineBreak1 && one.match(DiffMatchPatch.blankLineEndRegex);
            const blankLine2 = lineBreak2 && two.match(DiffMatchPatch.blankLineStartRegex);

            if (blankLine1 || blankLine2) {
                // Five points for blank lines.
                return 5;
            } else if (lineBreak1 || lineBreak2) {
                // Four points for line breaks.
                return 4;
            } else if (nonAlphaNumeric1 && !whitespace1 && whitespace2) {
                // Three points for end of sentences.
                return 3;
            } else if (whitespace1 || whitespace2) {
                // Two points for whitespace.
                return 2;
            } else if (nonAlphaNumeric1 || nonAlphaNumeric2) {
                // One point for non-alphanumeric.
                return 1;
            }

            return 0;
        }

        let pointer = 1;

        // Intentionally ignore the first and last element (don't need checking).
        while (pointer < diffs.length - 1) {
            if (diffs[pointer - 1].operation == DIFF_EQUAL && diffs[pointer + 1].operation == DIFF_EQUAL) {
                // This is a single edit surrounded by equalities.
                let equality1 = diffs[pointer - 1].text;
                let edit = diffs[pointer].text;
                let equality2 = diffs[pointer + 1].text;

                // First, shift the edit as far left as possible.
                const commonOffset = commonSuffix(equality1, edit);
                if (commonOffset) {
                    const commonString = edit.substring(edit.length - commonOffset);

                    equality1 = equality1.substring(0, equality1.length - commonOffset);
                    edit = commonString + edit.substring(0, edit.length - commonOffset);
                    equality2 = commonString + equality2;
                }

                // Second, step character by character right, looking for the best fit.
                let bestEquality1 = equality1;
                let bestEdit = edit;
                let bestEquality2 = equality2;
                let bestScore = diffCleanupSemanticScore(equality1, edit) + diffCleanupSemanticScore(edit, equality2);

                while (edit.charAt(0) === equality2.charAt(0)) {
                    equality1 += edit.charAt(0);
                    edit = edit.substring(1) + equality2.charAt(0);
                    equality2 = equality2.substring(1);

                    const score = diffCleanupSemanticScore(equality1, edit) + diffCleanupSemanticScore(edit, equality2);
                    // The >= encourages trailing rather than leading whitespace on edits.
                    if (score >= bestScore) {
                        bestScore = score;
                        bestEquality1 = equality1;
                        bestEdit = edit;
                        bestEquality2 = equality2;
                    }
                }

                if (diffs[pointer - 1].text != bestEquality1) {
                    // We have an improvement, save it back to the diff.
                    if (bestEquality1) {
                        diffs[pointer - 1].text = bestEquality1;
                    } else {
                        diffs.splice(pointer - 1, 1);
                        pointer--;
                    }

                    diffs[pointer].text = bestEdit;

                    if (bestEquality2) {
                        diffs[pointer + 1].text = bestEquality2;
                    } else {
                        diffs.splice(pointer + 1, 1);
                        pointer--;
                    }
                }
            }

            pointer++;
        }
    }

    /**
     * Reorder and merge like edit sections.  Merge equalities.
     * Any edit section can move as long as it doesn't cross an equality.
     *
     * @param {!Array.<!Diff>} diffs Array of diff tuples.
     */
    private diffCleanupMerge(diffs: Diff[]) {
        // Add a dummy entry at the end.
        diffs.push(new Diff(DIFF_EQUAL, ""));

        let pointer = 0;
        let countDelete = 0;
        let countInsert = 0;
        let textDelete = "";
        let textInsert = "";

        let commonLength;

        while (pointer < diffs.length) {
            switch (diffs[pointer].operation) {
                case DIFF_INSERT:
                    countInsert++;
                    textInsert += diffs[pointer].text;
                    pointer++;
                    break;
                case DIFF_DELETE:
                    countDelete++;
                    textDelete += diffs[pointer].text;
                    pointer++;
                    break;
                case DIFF_EQUAL:
                    // Upon reaching an equality, check for prior redundancies.
                    if (countDelete + countInsert > 1) {
                        if (countDelete !== 0 && countInsert !== 0) {
                            // Factor out any common prefixies.
                            commonLength = commonPrefix(textInsert, textDelete);

                            if (commonLength !== 0) {
                                if (
                                    pointer - countDelete - countInsert > 0 &&
                                    diffs[pointer - countDelete - countInsert - 1].operation == DIFF_EQUAL
                                ) {
                                    diffs[pointer - countDelete - countInsert - 1].text += textInsert.substring(
                                        0,
                                        commonLength,
                                    );
                                } else {
                                    diffs.splice(0, 0, new Diff(DIFF_EQUAL, textInsert.substring(0, commonLength)));

                                    pointer++;
                                }

                                textInsert = textInsert.substring(commonLength);
                                textDelete = textDelete.substring(commonLength);
                            }
                            // Factor out any common suffixies.
                            commonLength = commonSuffix(textInsert, textDelete);

                            if (commonLength !== 0) {
                                diffs[pointer].text =
                                    textInsert.substring(textInsert.length - commonLength) + diffs[pointer].text;
                                textInsert = textInsert.substring(0, textInsert.length - commonLength);
                                textDelete = textDelete.substring(0, textDelete.length - commonLength);
                            }
                        }

                        // Delete the offending records and add the merged ones.
                        pointer -= countDelete + countInsert;

                        diffs.splice(pointer, countDelete + countInsert);

                        if (textDelete.length !== 0) {
                            diffs.splice(pointer, 0, new Diff(DIFF_DELETE, textDelete, true));

                            pointer++;
                        }

                        if (textInsert.length !== 0) {
                            diffs.splice(pointer, 0, new Diff(DIFF_INSERT, textInsert, true));

                            pointer++;
                        }

                        pointer++;
                    } else if (pointer !== 0 && diffs[pointer - 1].operation == DIFF_EQUAL) {
                        // Merge this equality with the previous one.
                        diffs[pointer - 1].text += diffs[pointer].text;
                        diffs.splice(pointer, 1);
                    } else {
                        pointer++;
                    }

                    countInsert = 0;
                    countDelete = 0;
                    textDelete = "";
                    textInsert = "";

                    break;
            }
        }
        if (diffs[diffs.length - 1].text === "") {
            diffs.pop(); // Remove the dummy entry at the end.
        }

        // Second pass: look for single edits surrounded on both sides by equalities
        // which can be shifted sideways to eliminate an equality.
        // e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC
        let changes = false;

        pointer = 1;

        // Intentionally ignore the first and last element (don't need checking).
        while (pointer < diffs.length - 1) {
            if (diffs[pointer - 1].operation == DIFF_EQUAL && diffs[pointer + 1].operation == DIFF_EQUAL) {
                // This is a single edit surrounded by equalities.
                if (
                    diffs[pointer].text.substring(diffs[pointer].text.length - diffs[pointer - 1].text.length) ==
                    diffs[pointer - 1].text
                ) {
                    // Shift the edit over the previous equality.
                    diffs[pointer].text =
                        diffs[pointer - 1].text +
                        diffs[pointer].text.substring(0, diffs[pointer].text.length - diffs[pointer - 1].text.length);
                    diffs[pointer + 1].text = diffs[pointer - 1].text + diffs[pointer + 1].text;
                    diffs.splice(pointer - 1, 1);

                    changes = true;
                } else if (
                    diffs[pointer].text.substring(0, diffs[pointer + 1].text.length) == diffs[pointer + 1].text
                ) {
                    // Shift the edit over the next equality.
                    diffs[pointer - 1].text += diffs[pointer + 1].text;
                    diffs[pointer].text =
                        diffs[pointer].text.substring(diffs[pointer + 1].text.length) + diffs[pointer + 1].text;
                    diffs.splice(pointer + 1, 1);

                    changes = true;
                }
            }

            pointer++;
        }
        // If shifts were made, the diff needs reordering and another shift sweep.
        if (changes) {
            this.diffCleanupMerge(diffs);
        }
    }

    /**
     * Locate the best instance of 'pattern' in 'text' near 'loc'.
     *
     * @param {string} text The text to search.
     * @param {string} pattern The pattern to search for.
     * @param {number} loc The location to search around.
     *
     * @return {number} Best match index or -1.
     */
    private matchMain(text: string, pattern: string, loc: number): number {
        // Check for null inputs.
        if (text == null || pattern == null || loc == null) {
            throw new Error("Null input. (matchMain)");
        }

        loc = Math.max(0, Math.min(loc, text.length));

        if (text == pattern) {
            // Shortcut (potentially not guaranteed by the algorithm)
            return 0;
        } else if (!text.length) {
            // Nothing to match.
            return -1;
        } else if (text.substring(loc, loc + pattern.length) == pattern) {
            // Perfect match at the perfect spot!  (Includes case of null pattern)
            return loc;
        }

        // Do a fuzzy compare.
        return this.matchBiTap(text, pattern, loc);
    }

    /**
     * Locate the best instance of 'pattern' in 'text' near 'loc' using the
     * Bitap algorithm.
     *
     * @param {string} text The text to search.
     * @param {string} pattern The pattern to search for.
     * @param {number} loc The location to search around.
     *
     * @return {number} Best match index or -1.
     */
    private matchBiTap(text: string, pattern: string, loc: number): number {
        if (pattern.length > this.MatchMaxBits) {
            throw new Error("Pattern too long for this browser.");
        }

        // Initialise the alphabet.
        const s = matchAlphabet(pattern);
        const dmp = this; // 'this' becomes 'window' in a closure.

        /**
         * Compute and return the score for a match with e errors and x location.
         * Accesses loc and pattern through being a closure.
         *
         * @param {number} e Number of errors in match.
         * @param {number} x Location of match.
         *
         * @return {number} Overall score for match (0.0 = good, 1.0 = bad).
         *
         * @private
         */
        function matchBiTapScore(e: number, x: number): number {
            const accuracy = e / pattern.length;
            const proximity = Math.abs(loc - x);

            if (!dmp.MatchDistance) {
                // Dodge divide by zero error.
                return proximity ? 1.0 : accuracy;
            }

            return accuracy + proximity / dmp.MatchDistance;
        }

        // Highest score beyond which we give up.
        let scoreThreshold = this.MatchThreshold;
        // Is there a nearby exact match? (speedup)
        let bestLoc = text.indexOf(pattern, loc);

        if (bestLoc != -1) {
            scoreThreshold = Math.min(matchBiTapScore(0, bestLoc), scoreThreshold);

            // What about in the other direction? (speedup)
            bestLoc = text.lastIndexOf(pattern, loc + pattern.length);

            if (bestLoc != -1) {
                scoreThreshold = Math.min(matchBiTapScore(0, bestLoc), scoreThreshold);
            }
        }

        // Initialise the bit arrays.
        const matchMask = 1 << (pattern.length - 1);

        bestLoc = -1;

        let binMin;
        let binMid;

        let binMax = pattern.length + text.length;
        let lastRd: number[] = [];

        for (let d = 0; d < pattern.length; d++) {
            // Scan for the best match; each iteration allows for one more error.
            // Run a binary search to determine how far from 'loc' we can stray at this
            // error level.
            binMin = 0;
            binMid = binMax;

            while (binMin < binMid) {
                if (matchBiTapScore(d, loc + binMid) <= scoreThreshold) {
                    binMin = binMid;
                } else {
                    binMax = binMid;
                }

                binMid = Math.floor((binMax - binMin) / 2 + binMin);
            }

            // Use the result from this iteration as the maximum for the next.
            binMax = binMid;

            let start = Math.max(1, loc - binMid + 1);

            const finish = Math.min(loc + binMid, text.length) + pattern.length;
            const rd = Array<number>(finish + 2);

            rd[finish + 1] = (1 << d) - 1;

            for (let j = finish; j >= start; j--) {
                // The alphabet (s) is a sparse hash, so the following line generates
                // warnings.
                const charMatch = s[text.charAt(j - 1)];

                if (d === 0) {
                    // First pass: exact match.
                    rd[j] = ((rd[j + 1] << 1) | 1) & charMatch;
                } else {
                    // Subsequent passes: fuzzy match.
                    rd[j] =
                        (((rd[j + 1] << 1) | 1) & charMatch) | (((lastRd[j + 1] | lastRd[j]) << 1) | 1) | lastRd[j + 1];
                }

                if (rd[j] & matchMask) {
                    const score = matchBiTapScore(d, j - 1);
                    // This match will almost certainly be better than any existing match.
                    // But check anyway.
                    if (score <= scoreThreshold) {
                        // Told you so.
                        scoreThreshold = score;
                        bestLoc = j - 1;

                        if (bestLoc > loc) {
                            // When passing loc, don't exceed our current distance from loc.
                            start = Math.max(1, 2 * loc - bestLoc);
                        } else {
                            // Already passed loc, downhill from here on in.
                            break;
                        }
                    }
                }
            }
            // No hope for a (better) match at greater error levels.
            if (matchBiTapScore(d + 1, loc) > scoreThreshold) {
                break;
            }

            lastRd = rd;
        }

        return bestLoc;
    }

    /**
     * Compute a list of patches to turn text1 into text2.
     *
     * @param {!Array.<!Diff>} diffs Array of diff tuples
     *
     * @return {!Array.<!PatchObject>} Array of Patch objects.
     */
    patchMake(diffs: Diff[]): PatchObject[] {
        const text1 = diffText(diffs, DIFF_INSERT);

        if (diffs.length === 0) {
            return []; // Get rid of the null case.
        }

        const patches: PatchObject[] = [];
        let patch = new PatchObject();

        let patchDiffLength = 0; // Keeping our own length const is faster in JS.
        let charCount1 = 0; // Number of characters into the text1 string.
        let charCount2 = 0; // Number of characters into the text2 string.

        // Start with text1 (prePatchText) and apply the diffs until we arrive at
        // text2 (postPatchText).  We recreate the patches one by one to determine
        // context info.
        let prePatchText = text1;
        let postPatchText = text1;

        for (let x = 0; x < diffs.length; x++) {
            const diffType = diffs[x].operation;
            const diffText = diffs[x].text;

            if (!patchDiffLength && diffType !== DIFF_EQUAL) {
                // A new patch starts here.
                patch.start1 = charCount1;
                patch.start2 = charCount2;
            }

            switch (diffType) {
                case DIFF_INSERT:
                    patch.diffs[patchDiffLength++] = diffs[x];
                    patch.length2 += diffText.length;
                    postPatchText =
                        postPatchText.substring(0, charCount2) + diffText + postPatchText.substring(charCount2);
                    break;
                case DIFF_DELETE:
                    patch.length1 += diffText.length;
                    patch.diffs[patchDiffLength++] = diffs[x];
                    postPatchText =
                        postPatchText.substring(0, charCount2) + postPatchText.substring(charCount2 + diffText.length);
                    break;
                case DIFF_EQUAL:
                    if (diffText.length <= 2 * this.PatchMargin && patchDiffLength && diffs.length != x + 1) {
                        // Small equality inside a patch.
                        patch.diffs[patchDiffLength++] = diffs[x];
                        patch.length1 += diffText.length;
                        patch.length2 += diffText.length;
                    } else if (diffText.length >= 2 * this.PatchMargin) {
                        // Time for a new patch.
                        if (patchDiffLength) {
                            this.patchAddContext(patch, prePatchText);

                            patches.push(patch);
                            patch = new PatchObject();
                            patchDiffLength = 0;
                            // Unlike Unidiff, our patch lists have a rolling context.
                            // https://github.com/google/diff-match-patch/wiki/Unidiff
                            // Update prepatch text & pos to reflect the application of the
                            // just completed patch.
                            prePatchText = postPatchText;
                            charCount1 = charCount2;
                        }
                    }
                    break;
            }

            // Update the current character count.
            if (diffType !== DIFF_INSERT) {
                charCount1 += diffText.length;
            }

            if (diffType !== DIFF_DELETE) {
                charCount2 += diffText.length;
            }
        }

        // Pick up the leftover patch if not empty.
        if (patchDiffLength) {
            this.patchAddContext(patch, prePatchText);

            patches.push(patch);
        }

        return patches;
    }

    /**
     * Merge a set of patches onto the text.  Return a patched text, as well
     * as a list of true/false values indicating which patches were applied.
     *
     * @param {!Array.<!PatchObject>} patches Array of Patch objects.
     * @param {string} text Old text.
     *
     * @return {!Array.<string|!Array.<boolean>>} Two element Array, containing the
     *      new text and an array of boolean values.
     */
    patchApply(patches: PatchObject[], text: string): Array<string | boolean[]> {
        if (patches.length == 0) {
            return [text, []];
        }

        // Deep copy the patches so that no changes are made to originals.
        patches = patchDeepObjectCopy(patches);

        const nullPadding = this.patchAddPadding(patches);

        text = nullPadding + text + nullPadding;

        this.patchSplitMax(patches);

        // delta keeps track of the offset between the expected and actual location
        // of the previous patch.  If there are patches expected at positions 10 and
        // 20, but the first patch was found at 12, delta is 2 and the second patch
        // has an effective expected position of 22.
        let delta = 0;
        const results: boolean[] = [];

        for (let x = 0; x < patches.length; x++) {
            const expectedLoc = patches[x].start2! + delta;
            const text1 = diffText(patches[x].diffs, DIFF_INSERT);

            let startLoc;
            let endLoc = -1;

            if (text1.length > this.MatchMaxBits) {
                // patchSplitMax will only provide an oversized pattern in the case of
                // a monster delete.
                startLoc = this.matchMain(text, text1.substring(0, this.MatchMaxBits), expectedLoc);

                if (startLoc != -1) {
                    endLoc = this.matchMain(
                        text,
                        text1.substring(text1.length - this.MatchMaxBits),
                        expectedLoc + text1.length - this.MatchMaxBits,
                    );

                    if (endLoc == -1 || startLoc >= endLoc) {
                        // Can't find valid trailing context.  Drop this patch.
                        startLoc = -1;
                    }
                }
            } else {
                startLoc = this.matchMain(text, text1, expectedLoc);
            }

            if (startLoc == -1) {
                // No match found.  :(
                results[x] = false;
                // Subtract the delta for this failed patch from subsequent patches.
                delta -= patches[x].length2 - patches[x].length1;
            } else {
                // Found a match.  :)
                results[x] = true;
                delta = startLoc - expectedLoc;

                let text2;

                if (endLoc == -1) {
                    text2 = text.substring(startLoc, startLoc + text1.length);
                } else {
                    text2 = text.substring(startLoc, endLoc + this.MatchMaxBits);
                }

                if (text1 == text2) {
                    // Perfect match, just shove the replacement text in.
                    text =
                        text.substring(0, startLoc) +
                        diffText(patches[x].diffs, DIFF_DELETE) +
                        text.substring(startLoc + text1.length);
                } else {
                    // Imperfect match.  Run a diff to get a framework of equivalent
                    // indices.
                    const diffs = this.diff(text1, text2, false);

                    if (
                        text1.length > this.MatchMaxBits &&
                        levenshtein(diffs) / text1.length > this.PatchDeleteThreshold
                    ) {
                        // The end points match, but the content is unacceptably bad.
                        results[x] = false;
                    } else {
                        this.cleanupSemanticLossless(diffs);

                        let index1 = 0;
                        let index2 = 0;

                        for (let y = 0; y < patches[x].diffs.length; y++) {
                            const mod = patches[x].diffs[y];

                            if (mod.operation !== DIFF_EQUAL) {
                                index2 = diffXIndex(diffs, index1);
                            }

                            if (mod.operation === DIFF_INSERT) {
                                // Insertion
                                text =
                                    text.substring(0, startLoc + index2) + mod.text + text.substring(startLoc + index2);
                            } else if (mod.operation === DIFF_DELETE) {
                                // Deletion
                                text =
                                    text.substring(0, startLoc + index2) +
                                    text.substring(startLoc + diffXIndex(diffs, index1 + mod.text.length));
                            }

                            if (mod.operation !== DIFF_DELETE) {
                                index1 += mod.text.length;
                            }
                        }
                    }
                }
            }
        }

        // Strip the padding off.
        text = text.substring(nullPadding.length, text.length - nullPadding.length);

        return [text, results];
    }

    /**
     * Add some padding on text start and end so that edges can match something.
     * Intended to be called only from within patchApply.
     * @param {!Array.<!PatchObject>} patches Array of Patch objects.
     * @return {string} The padding string added to each side.
     */
    private patchAddPadding(patches: PatchObject[]): string {
        const paddingLength = this.PatchMargin;
        let nullPadding = "";

        for (let x = 1; x <= paddingLength; x++) {
            nullPadding += String.fromCharCode(x);
        }

        // Bump all the patches forward.
        for (let x = 0; x < patches.length; x++) {
            patches[x].start1! += paddingLength;
            patches[x].start2! += paddingLength;
        }

        // Add some padding on start of first diff.
        let patch = patches[0];
        let diffs = patch.diffs;

        if (diffs.length == 0 || diffs[0].operation != DIFF_EQUAL) {
            // Add nullPadding equality.
            diffs.unshift(new Diff(DIFF_EQUAL, nullPadding));

            patch.start1! -= paddingLength; // Should be 0.
            patch.start2! -= paddingLength; // Should be 0.
            patch.length1 += paddingLength;
            patch.length2 += paddingLength;
        } else if (paddingLength > diffs[0].text.length) {
            // Grow first equality.
            const extraLength = paddingLength - diffs[0].text.length;

            diffs[0].text = nullPadding.substring(diffs[0].text.length) + diffs[0].text;
            patch.start1! -= extraLength;
            patch.start2! -= extraLength;
            patch.length1 += extraLength;
            patch.length2 += extraLength;
        }

        // Add some padding on end of last diff.
        patch = patches[patches.length - 1];
        diffs = patch.diffs;

        if (diffs.length == 0 || diffs[diffs.length - 1].operation != DIFF_EQUAL) {
            // Add nullPadding equality.
            diffs.push(new Diff(DIFF_EQUAL, nullPadding));

            patch.length1 += paddingLength;
            patch.length2 += paddingLength;
        } else if (paddingLength > diffs[diffs.length - 1].text.length) {
            // Grow last equality.
            const extraLength = paddingLength - diffs[diffs.length - 1].text.length;

            diffs[diffs.length - 1].text += nullPadding.substring(0, extraLength);

            patch.length1 += extraLength;
            patch.length2 += extraLength;
        }

        return nullPadding;
    }

    /**
     * Look through the patches and break up any which are longer than the maximum
     * limit of the match algorithm.
     * Intended to be called only from within patchApply.
     *
     * @param {!Array.<!PatchObject>} patches Array of Patch objects.
     */
    private patchSplitMax(patches: PatchObject[]) {
        const patchSize = this.MatchMaxBits;

        for (let x = 0; x < patches.length; x++) {
            if (patches[x].length1 <= patchSize) {
                continue;
            }

            const bigPatch = patches[x];

            // Remove the big old patch.
            patches.splice(x--, 1);

            let start1 = Number(bigPatch.start1);
            let start2 = Number(bigPatch.start2);
            let preContext = "";

            while (bigPatch.diffs.length !== 0) {
                // Create one of several smaller patches.
                const patch = new PatchObject();
                let empty = true;

                patch.start1 = start1! - preContext.length;
                patch.start2 = start2! - preContext.length;

                if (preContext !== "") {
                    patch.length1 = patch.length2 = preContext.length;
                    patch.diffs.push(new Diff(DIFF_EQUAL, preContext));
                }

                while (bigPatch.diffs.length !== 0 && patch.length1 < patchSize - this.PatchMargin) {
                    const diffType = bigPatch.diffs[0].operation;
                    let diffText = bigPatch.diffs[0].text;

                    if (diffType === DIFF_INSERT) {
                        // Insertions are harmless.
                        patch.length2 += diffText.length;
                        start2 += diffText.length;
                        patch.diffs.push(bigPatch.diffs.shift()!);
                        empty = false;
                    } else if (
                        diffType === DIFF_DELETE &&
                        patch.diffs.length == 1 &&
                        patch.diffs[0].operation == DIFF_EQUAL &&
                        diffText.length > 2 * patchSize
                    ) {
                        // This is a large deletion.  Let it pass in one chunk.
                        patch.length1 += diffText.length;
                        start1 += diffText.length;
                        empty = false;
                        patch.diffs.push(new Diff(diffType, diffText));
                        bigPatch.diffs.shift();
                    } else {
                        // Deletion or equality.  Only take as much as we can stomach.
                        diffText = diffText.substring(0, patchSize - patch.length1 - this.PatchMargin);

                        patch.length1 += diffText.length;
                        start1 += diffText.length;

                        if (diffType === DIFF_EQUAL) {
                            patch.length2 += diffText.length;
                            start2 += diffText.length;
                        } else {
                            empty = false;
                        }

                        patch.diffs.push(new Diff(diffType, diffText));

                        if (diffText == bigPatch.diffs[0].text) {
                            bigPatch.diffs.shift();
                        } else {
                            bigPatch.diffs[0].text = bigPatch.diffs[0].text.substring(diffText.length);
                        }
                    }
                }

                // Compute the head context for the next patch.
                preContext = diffText(patch.diffs, DIFF_DELETE);
                preContext = preContext.substring(preContext.length - this.PatchMargin);

                // Append the end context for this patch.
                const postContext = diffText(bigPatch.diffs, DIFF_INSERT).substring(0, this.PatchMargin);

                if (postContext !== "") {
                    patch.length1 += postContext.length;
                    patch.length2 += postContext.length;

                    if (patch.diffs.length !== 0 && patch.diffs[patch.diffs.length - 1].operation === DIFF_EQUAL) {
                        patch.diffs[patch.diffs.length - 1].text += postContext;
                    } else {
                        patch.diffs.push(new Diff(DIFF_EQUAL, postContext));
                    }
                }

                if (!empty) {
                    patches.splice(++x, 0, patch);
                }
            }
        }
    }

    /**
     * Increase the context until it is unique,
     * but don't let the pattern expand beyond MatchMaxBits.
     * @param {!PatchObject} patch The patch to grow.
     * @param {string} text Source text.
     * @private
     */
    private patchAddContext(patch: PatchObject, text: string) {
        if (text.length == 0) {
            return;
        }

        if (patch.start2 === null) {
            throw Error("patch not initialized");
        }

        let pattern = text.substring(patch.start2, patch.start2 + patch.length1);
        let padding = 0;

        // Look for the first and last matches of pattern in text.  If two different
        // matches are found, increase the pattern length.
        while (
            text.indexOf(pattern) != text.lastIndexOf(pattern) &&
            pattern.length < this.MatchMaxBits - this.PatchMargin - this.PatchMargin
        ) {
            padding += this.PatchMargin;
            pattern = text.substring(patch.start2 - padding, patch.start2 + patch.length1 + padding);
        }
        // Add one chunk for good luck.
        padding += this.PatchMargin;

        // Add the prefix.
        const prefix = text.substring(patch.start2 - padding, patch.start2);

        if (prefix) {
            patch.diffs.unshift(new Diff(DIFF_EQUAL, prefix));
        }

        // Add the suffix.
        const suffix = text.substring(patch.start2 + patch.length1, patch.start2 + patch.length1 + padding);

        if (suffix) {
            patch.diffs.push(new Diff(DIFF_EQUAL, suffix));
        }

        // Roll back the start points.
        patch.start1! -= prefix.length;
        patch.start2 -= prefix.length;
        // Extend the lengths.
        patch.length1 += prefix.length + suffix.length;
        patch.length2 += prefix.length + suffix.length;
    }
}
