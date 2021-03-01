import { Utf32 } from "./utf32";

const assertSafe = (obj: any) => {
    if (obj.codePoints) {
        return;
    }

    if (typeof obj === "string") {
        console.assert(!Utf32.hasSupplemental(obj), obj);
    }

    if (typeof obj === "object") {
        for (let i = 0; i < obj.length; i++) {
            assertSafe(obj[i]);
        }
    }

    if (typeof obj === "number") {
        return;
    }

    console.assert("Unknown object type", obj);
};

export default assertSafe;
