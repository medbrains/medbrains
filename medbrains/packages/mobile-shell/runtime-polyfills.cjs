const root = globalThis;

if (typeof String.prototype.toWellFormed !== "function") {
  const loneSurrogate =
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

  Object.defineProperty(String.prototype, "toWellFormed", {
    configurable: true,
    value() {
      return String(this).replace(loneSurrogate, (match, prefix) => {
        if (prefix) {
          return `${prefix}\uFFFD`;
        }
        return "\uFFFD";
      });
    },
  });
}

if (typeof String.prototype.isWellFormed !== "function") {
  Object.defineProperty(String.prototype, "isWellFormed", {
    configurable: true,
    value() {
      return String(this) === String(this).toWellFormed();
    },
  });
}

const arrayBufferByteLength = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
)?.get;

if (arrayBufferByteLength) {
  if (!Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")) {
    Object.defineProperty(ArrayBuffer.prototype, "resizable", {
      configurable: true,
      get() {
        arrayBufferByteLength.call(this);
        return false;
      },
    });
  }

  if (typeof root.SharedArrayBuffer === "undefined") {
    class SharedArrayBufferShim extends ArrayBuffer {}

    Object.defineProperty(SharedArrayBufferShim.prototype, "byteLength", {
      configurable: true,
      get() {
        if (!(this instanceof SharedArrayBufferShim)) {
          throw new TypeError("Not a SharedArrayBuffer");
        }
        return arrayBufferByteLength.call(this);
      },
    });

    Object.defineProperty(SharedArrayBufferShim.prototype, "growable", {
      configurable: true,
      get() {
        if (!(this instanceof SharedArrayBufferShim)) {
          throw new TypeError("Not a SharedArrayBuffer");
        }
        return false;
      },
    });

    Object.defineProperty(SharedArrayBufferShim.prototype, Symbol.toStringTag, {
      configurable: true,
      value: "SharedArrayBuffer",
    });

    root.SharedArrayBuffer = SharedArrayBufferShim;
  }
}
