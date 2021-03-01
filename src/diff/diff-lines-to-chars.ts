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
import assertSafe from "./assert-safe";

interface IOutput {
    chars1: string;
    chars2: string;
    lineArray: string[];
}

/**
 * Split two texts into an array of strings.  Reduce the texts to a string of
 * hashes where each Unicode character represents one line.
 *
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 *
 * @return {{chars1: string, chars2: string, lineArray: !Array.<string>}}
 *     An object containing the encoded text1, the encoded text2 and
 *     the array of unique strings.
 *     The zeroth element of the array of unique strings is intentionally blank.
 */
export const diffLinesToChars = (text1: string, text2: string): IOutput => {
    assertSafe(text1);
    assertSafe(text2);

    const lineArray: string[] = []; // e.g. lineArray[4] == 'Hello\n'
    const lineHash: { [key: string]: number } = {}; // e.g. lineHash['Hello\n'] == 4

    // '\x00' is a valid character, but various debuggers don't like it.
    // So we'll insert a junk entry to avoid generating a null character.
    lineArray[0] = text1.substring(0, 0);

    /**
     * Split a text into an array of strings.  Reduce the texts to a string of
     * hashes where each Unicode character represents one line.
     * Modifies lineArray and linehash through being a closure.
     * @param {string} text String to encode.
     * @return {string} Encoded string.
     * @private
     */
    function diffLinesToCharsMunge(text: string): string {
        let chars = "";
        // Walk the text, pulling out a substring for each line.
        // text.split('\n') would would temporarily double our memory footprint.
        // Modifying text would create many large strings to garbage collect.
        let lineStart = 0;
        let lineEnd = -1;
        // Keeping our own length variable is faster than looking it up.
        let lineArrayLength = lineArray.length;

        while (lineEnd < text.length - 1) {
            lineEnd = text.indexOf("\n", lineStart);

            if (lineEnd == -1) {
                lineEnd = text.length - 1;
            }

            let line = text.substring(lineStart, lineEnd + 1);
            const lineKey = line.toString();

            if (lineHash.hasOwnProperty ? lineHash.hasOwnProperty(lineKey) : lineHash[lineKey] !== undefined) {
                chars += String.fromCharCode(lineHash[lineKey]);
            } else {
                if (lineArrayLength == maxLines) {
                    // Bail out at 65535 because
                    // String.fromCharCode(65536) == String.fromCharCode(0)
                    line = text.substring(lineStart);
                    lineEnd = text.length;
                }

                chars += String.fromCharCode(lineArrayLength);
                lineHash[lineKey] = lineArrayLength;
                lineArray[lineArrayLength++] = line;
            }

            lineStart = lineEnd + 1;
        }

        return chars;
    }

    // Allocate 2/3rds of the space for text1, the rest for text2.
    let maxLines = 40000;

    const chars1 = diffLinesToCharsMunge(text1);

    maxLines = 65535;

    const chars2 = diffLinesToCharsMunge(text2);

    return { chars1, chars2, lineArray };
};
