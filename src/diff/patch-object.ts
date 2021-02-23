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
 * @author fraser@google.com (Neil Fraser)
 */

import { Diff } from "./diff";
import { DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT } from "../interfaces";

export class PatchObject {
    diffs: Diff[];
    start1: number | null;
    start2: number | null;
    length1: number;
    length2: number;

    constructor() {
        /** @type {!Array.<!Diff>} */
        this.diffs = [];
        /** @type {?number} */
        this.start1 = null;
        /** @type {?number} */
        this.start2 = null;
        /** @type {number} */
        this.length1 = 0;
        /** @type {number} */
        this.length2 = 0;
    }

    /**
     * Emulate GNU diff's format.
     * Header: @@ -382,8 +481,9 @@
     * Indices are printed as 1-based, not 0-based.
     * @return {string} The GNU diff string.
     */
    toString() {
        let coords1;
        let coords2;

        if (this.length1 === 0) {
            coords1 = `${this.start1},0`;
        } else if (this.length1 == 1) {
            coords1 = this.start1! + 1;
        } else {
            coords1 = `${this.start1! + 1},${this.length1}`;
        }

        if (this.length2 === 0) {
            coords2 = `${this.start2!},0`;
        } else if (this.length2 == 1) {
            coords2 = this.start2! + 1;
        } else {
            coords2 = `${this.start2! + 1},${this.length2}`;
        }

        const text = [`@@ -${coords1} +${coords2} @@\n`];
        let op;

        // Escape the body of the patch with %xx notation.
        for (let x = 0; x < this.diffs.length; x++) {
            switch (this.diffs[x].operation) {
                case DIFF_INSERT:
                    op = "+";
                    break;
                case DIFF_DELETE:
                    op = "-";
                    break;
                case DIFF_EQUAL:
                    op = " ";
                    break;
            }

            text[x + 1] = `${op + encodeURI(this.diffs[x].text)}\n`;
        }

        return text.join("").replace(/%20/g, " ");
    }
}
