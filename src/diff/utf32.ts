export class Utf32 {
    public static force_utf32_string: boolean = false;

    public string: string = "";
    public codePoints: (number | undefined)[];
    public length: number = 0;

    constructor() {
        this.string = "";
        this.codePoints = [];
        this.length = 0;
    }

    public static hasSupplemental(text: string | Utf32): boolean {
        // Require at least String.prototype.codePointAt(), ES5+
        if (!String.prototype.codePointAt) {
            return false;
        }

        if (text.codePoints) {
            // Argument is another utf32_string; do not re-convert
            return false;
        }

        if (Utf32.force_utf32_string) {
            // Override: force utf32_string conversion
            return true;
        }

        for (let i = 0; i < text.length; i++) {
            const ch = text.charCodeAt(i);

            if (ch >= 0xd800 && ch <= 0xdfff) {
                return true;
            }
        }

        return false;
    }

    public static from(text: string): Utf32 {
        const result = new Utf32();

        for (let i = 0; i < text.length; i++) {
            const cp = text.codePointAt(i);

            result.codePoints.push(cp);

            if (cp !== undefined && cp > 0xffff) {
                i++;
            }
        }

        result.string = text;
        result.length = result.codePoints.length;

        return result;
    }

    charAt(i: number) {
        if (i < 0 || i >= this.length) {
            return "";
        }

        return String.fromCodePoint(this.codePoints[i]);
    }

    charCodeAt(i: number) {
        if (i < 0 || i >= this.length) {
            return 0;
        }

        return this.codePoints[i];
    }

    substring(start, end) {
        const result = new Utf32();
        // Implemented according to String.substring specification:
        // https://www.ecma-international.org/ecma-262/5.1/#sec-15.5.4.15
        let len = this.length;
        // TODO: Check for integers like the spec says?
        const intStart = start;
        const intEnd = typeof end === "undefined" ? len : end;
        const finalStart = Math.min(Math.max(intStart, 0), len);
        const finalEnd = Math.min(Math.max(intEnd, 0), len);
        const from = Math.min(finalStart, finalEnd);
        const to = Math.max(finalStart, finalEnd);

        // Compute the indices for the actual substring; we must maintain the string
        // because toString() operations are expected to be fast.
        let stringFrom = 0;

        for (let i = 0; i < from; i++) {
            stringFrom += this.codePoints[i] <= 0xffff ? 1 : 2;
        }

        let stringTo = stringFrom;

        for (let i = from; i < to; i++) {
            stringTo += this.codePoints[i] <= 0xffff ? 1 : 2;
        }

        result.string = this.string.substring(stringFrom, stringTo);
        result.codePoints = this.codePoints.slice(from, to);
        result.length = result.codePoints.length;

        return result;
    }

    indexOf(other, start) {
        return this.string.indexOf(other.toString(), start);
    }

    lastIndexOf(other, start) {
        return this.string.lastIndexOf(other.toString(), start);
    }

    concat() {
        if (arguments.length > 1) {
            const first = this.concat(arguments[0]);

            return first.concat.apply(first, Array.prototype.slice.call(arguments, 1));
        }

        // Make sure input is a utf32_string
        let other = arguments[0];

        if (!other.codePoints) {
            other = this.from(other);
        }

        const result = new Utf32();

        result.string = this.string + other.string;
        result.codePoints = [].concat(this.codePoints, other.codePoints);
        result.length = result.codePoints.length;

        return result;
    }

    match() {
        return this.string.match.apply(this.string, arguments);
    }

    replace() {
        return this.from(this.string.replace.apply(this.string, arguments));
    }

    valueOf() {
        throw new Error("warning: implicit conversion attempted on utf32_string; use toString instead");
    }

    toString() {
        return this.string;
    }
}
