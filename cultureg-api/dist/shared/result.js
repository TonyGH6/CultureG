"use strict";
/** Unified service result types */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
exports.err = err;
/** Convenience constructors */
function ok(data) {
    return { ok: true, ...data };
}
function err(status, error) {
    return { ok: false, status, error };
}
