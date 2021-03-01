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
import assertSafe from './assert-safe'

/**
 * Rehydrate the text in a diff from a string of line hashes to real lines of
 * text.
 *
 * @param {!Array.<!Diff>} diffs Array of diff tuples.
 * @param {!Array.<string>} lineArray Array of unique strings.
 */
export const diffCharsToLines = (diffs: Diff[], lineArray: string[]) => {
    assertSafe(lineArray)

    for (let x = 0; x < diffs.length; x++) {
        const chars = diffs[x].text;
        let text;

        if (chars.length === 0) {
            // don't lose string type (regular or utf32_string)
            text = lineArray[0].substring(0, 0);
        } else {
            text = lineArray[chars.charCodeAt(0)]
        }

        for (let y = 1; y < chars.length; y++) {
            text = text.concat(lineArray[chars.charCodeAt(y)]);
        }

        diffs[x].text = text;
    }
};
